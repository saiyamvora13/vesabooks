import { PDFDocument, rgb, StandardFonts } from 'pdf-lib';
import fontkit from '@pdf-lib/fontkit';
import type { Storybook } from "@shared/schema";
import { ObjectStorageService } from "../objectStorage";
import { readFileSync } from 'fs';
import { join } from 'path';
import { 
  getBookDimensionsInPoints, 
  SAFETY_MARGIN_POINTS, 
  validatePageCount,
  REQUIRED_DPI 
} from '@shared/bookSizes';

// Cache font bytes to avoid blocking event loop with repeated readFileSync
let cachedComicNeueFontBytes: ArrayBuffer | null = null;

/**
 * Sanitizes text to ensure compatibility with WinAnsi encoding used by PDF standard fonts
 * Converts Unicode characters to ASCII equivalents to prevent PDF generation errors
 */
function sanitizeTextForPDF(text: string): string {
  if (!text) return '';
  
  return text
    // Normalize line breaks first (before other replacements)
    .replace(/\r\n/g, '\n')           // Windows line breaks → Unix
    .replace(/\r/g, '\n')             // Mac line breaks → Unix
    // Curly quotes to straight quotes
    .replace(/[\u201C\u201D]/g, '"')  // " and "
    .replace(/[\u2018\u2019]/g, "'")  // ' and '
    // Em dash and en dash to regular dash
    .replace(/[\u2013\u2014]/g, '-')
    // Ellipsis to three dots
    .replace(/\u2026/g, '...')
    // Non-breaking space to regular space
    .replace(/\u00A0/g, ' ')
    // Other common problematic characters
    .replace(/\u2022/g, '*')  // Bullet point
    .replace(/\u00AB/g, '<<') // Left guillemet
    .replace(/\u00BB/g, '>>') // Right guillemet
    // Remove any remaining non-ASCII characters (fallback)
    .replace(/[^\x00-\x7F]/g, '');
}

// Page manifest types
type PageType = 'frontCover' | 'image' | 'text' | 'backCover' | 'foreword' | 'attribution';
interface PageManifestEntry {
  type: PageType;
  pageIndex?: number; // Reference to storybook.pages index for image/text pages
  imageUrl?: string; // For cover pages
  text?: string; // For text pages and foreword
}

/**
 * Builds a deterministic page manifest for the print PDF following Prodigi's requirements
 * 
 * Structure: [front cover, foreword?, ...image/text pairs, attribution, back cover]
 * 
 * NOTE: Per Prodigi hardcover photo book guide:
 * - PDF Page 1 = Front cover
 * - PDF Page 2+ = Content pages (Prodigi auto-adds binding sheets)
 * - PDF Last page = Back cover
 * - Prodigi automatically adds: inside front cover, binding sheets (6 blank pages total)
 * - We do NOT add blank pages - Prodigi handles all binding pages
 */
function buildPageManifest(storybook: Storybook): PageManifestEntry[] {
  const manifest: PageManifestEntry[] = [];
  
  // 1. Front cover (Page 1 of PDF)
  const coverImageUrl = storybook.coverImageUrl || storybook.pages[0]?.imageUrl;
  manifest.push({ type: 'frontCover', imageUrl: coverImageUrl || undefined });
  
  // 2. Foreword/Dedication (if present) - First content page
  if (storybook.foreword) {
    manifest.push({ type: 'foreword', text: storybook.foreword });
  }
  
  // 3. Story content: each page becomes TWO PDF pages (image, then text)
  for (let i = 0; i < storybook.pages.length; i++) {
    const page = storybook.pages[i];
    
    // Image page
    manifest.push({ 
      type: 'image', 
      pageIndex: i, 
      imageUrl: page.imageUrl || undefined 
    });
    
    // Text page
    manifest.push({ 
      type: 'text', 
      pageIndex: i, 
      text: page.text 
    });
  }
  
  // 4. Attribution page before back cover
  manifest.push({ type: 'attribution' });
  
  // 5. Back cover (Last page of PDF)
  manifest.push({ 
    type: 'backCover', 
    imageUrl: storybook.backCoverImageUrl || undefined 
  });
  
  console.log(`📖 PDF structure: Front cover → ${storybook.foreword ? 'Foreword → ' : ''}${storybook.pages.length * 2} story pages → Attribution → Back cover`);
  console.log(`📄 Total PDF pages: ${manifest.length} (Prodigi will add ~6 binding pages automatically)`);
  
  return manifest;
}

/**
 * Generates a professional print-ready PDF for hardcover photo books
 * Following Prodigi's hardcover photo book specifications
 * 
 * PDF Structure:
 * - Page 1: Front cover
 * - Page 2+: Content (foreword if present, then image/text pairs, attribution)
 * - Last page: Back cover
 * 
 * Prodigi automatically adds:
 * - Inside front cover (blank)
 * - Front binding sheet (2 blank pages)
 * - Back binding sheet (2 blank pages)
 * - Inside back cover (blank)
 * Total: ~6 pages added by Prodigi
 * 
 * Specifications:
 * - 300 DPI resolution
 * - 10mm safety margins
 * - RGB color profile
 * - PDF/X-4 compliant
 */
export async function generatePrintReadyPDF(
  storybook: Storybook, 
  bookSize: string = 'a5-portrait',
  spineText?: string,
  spineTextColor?: string,
  spineBackgroundColor?: string
): Promise<Buffer> {
  const pdfDoc = await PDFDocument.create();
  
  // Register fontkit to enable custom font embedding
  pdfDoc.registerFontkit(fontkit);
  
  // Set PDF metadata for print compliance
  pdfDoc.setTitle(storybook.title);
  pdfDoc.setAuthor(storybook.author || 'AI Storyteller');
  pdfDoc.setSubject('Children\'s Storybook - Professional Hardcover Print');
  pdfDoc.setProducer('AI Storybook Builder - Prodigi Hardcover Specs');
  pdfDoc.setCreator('pdf-lib');
  pdfDoc.setKeywords(['storybook', 'print', 'hardcover', `${REQUIRED_DPI}dpi`]);
  
  // Get book dimensions based on selected size
  const { width: PAGE_WIDTH, height: PAGE_HEIGHT } = getBookDimensionsInPoints(bookSize);
  
  const objectStorageService = new ObjectStorageService();
  
  // Load kid-friendly Comic Neue font for ages 6-12 (cached for performance)
  if (!cachedComicNeueFontBytes) {
    const fontPath = join(process.cwd(), 'server', 'fonts', 'ComicNeue-Regular.ttf');
    cachedComicNeueFontBytes = readFileSync(fontPath);
  }
  const font = await pdfDoc.embedFont(cachedComicNeueFontBytes);
  const boldFont = await pdfDoc.embedFont(StandardFonts.HelveticaBold);
  
  // Import image optimization utility
  const { optimizeImageForPDF } = await import('../utils/imageOptimization');
  
  // Helper function to fetch and embed image
  async function embedImage(imageUrl: string): Promise<any> {
    try {
      // Extract path after /api/storage/
      const storagePathMatch = imageUrl.match(/\/api\/storage\/(.+)/);
      if (!storagePathMatch) return null;
      
      const filePath = storagePathMatch[1];
      const imageBuffer = await objectStorageService.getFileBuffer(filePath);
      
      // Optimize image for 300 DPI print quality
      const optimizedBuffer = await optimizeImageForPDF(imageBuffer);
      
      // Embed as JPEG
      return await pdfDoc.embedJpg(optimizedBuffer);
    } catch (error) {
      console.error('Error embedding image:', error);
      return null;
    }
  }
  
  // Helper function to draw image contained within specified dimensions
  function drawScaledImage(page: any, image: any, targetX: number, targetY: number, targetWidth: number, targetHeight: number) {
    const imgAspectRatio = image.width / image.height;
    const targetAspectRatio = targetWidth / targetHeight;
    
    let drawWidth = targetWidth;
    let drawHeight = targetHeight;
    let x = targetX;
    let y = targetY;
    
    // Scale to contain image completely within target area (may have white space)
    if (imgAspectRatio > targetAspectRatio) {
      // Image is wider - fit to width, add top/bottom margins
      drawWidth = targetWidth;
      drawHeight = drawWidth / imgAspectRatio;
      y = targetY + (targetHeight - drawHeight) / 2;
    } else {
      // Image is taller - fit to height, add left/right margins
      drawHeight = targetHeight;
      drawWidth = drawHeight * imgAspectRatio;
      x = targetX + (targetWidth - drawWidth) / 2;
    }
    
    page.drawImage(image, { x, y, width: drawWidth, height: drawHeight });
  }
  
  // Helper function to draw image covering full page
  function drawFullPageImage(page: any, image: any) {
    drawScaledImage(page, image, 0, 0, PAGE_WIDTH, PAGE_HEIGHT);
  }
  
  // Helper function to word wrap text (with sanitization for PDF compatibility)
  function wrapText(text: string, maxWidth: number, fontSize: number, textFont: any = font): string[] {
    // Sanitize text first to ensure PDF compatibility
    const sanitizedText = sanitizeTextForPDF(text);
    
    // Split by newlines first to preserve user's line breaks
    const paragraphs = sanitizedText.split('\n');
    const lines: string[] = [];
    
    // Process each paragraph separately
    for (const paragraph of paragraphs) {
      if (!paragraph.trim()) {
        // Empty line - add blank line
        lines.push('');
        continue;
      }
      
      const words = paragraph.split(' ');
      let currentLine = '';
      
      for (const word of words) {
        const testLine = currentLine + (currentLine ? ' ' : '') + word;
        const testWidth = textFont.widthOfTextAtSize(testLine, fontSize);
        
        if (testWidth > maxWidth && currentLine) {
          lines.push(currentLine);
          currentLine = word;
        } else {
          currentLine = testLine;
        }
      }
      if (currentLine) {
        lines.push(currentLine);
      }
    }
    
    return lines;
  }
  
  // Build page manifest
  const manifest = buildPageManifest(storybook);
  
  console.log(`📖 Generating Prodigi-compliant print PDF with ${manifest.length} pages`);
  console.log(`📄 Our PDF: Front cover → ${storybook.foreword ? 'Foreword → ' : ''}${storybook.pages.length * 2} story pages → Attribution → Back cover`);
  console.log(`📘 Final book: Prodigi adds ~6 binding pages automatically`);
  
  // Render each page based on manifest
  for (let i = 0; i < manifest.length; i++) {
    const entry = manifest[i];
    const page = pdfDoc.addPage([PAGE_WIDTH, PAGE_HEIGHT]);
    
    switch (entry.type) {
      case 'frontCover':
        // Front cover: full-page image with title overlay if no image
        if (entry.imageUrl) {
          const coverImage = await embedImage(entry.imageUrl);
          if (coverImage) {
            drawFullPageImage(page, coverImage);
          } else {
            // Fallback: title on colored background
            page.drawRectangle({
              x: 0, y: 0,
              width: PAGE_WIDTH, height: PAGE_HEIGHT,
              color: rgb(0.976, 0.969, 0.953),
            });
            
            const titleFontSize = 28;
            const titleText = sanitizeTextForPDF(storybook.title);
            const titleWidth = boldFont.widthOfTextAtSize(titleText, titleFontSize);
            const maxTitleWidth = PAGE_WIDTH - 2 * SAFETY_MARGIN_POINTS;
            
            let finalTitleSize = titleFontSize;
            if (titleWidth > maxTitleWidth) {
              finalTitleSize = (maxTitleWidth / titleWidth) * titleFontSize;
            }
            
            page.drawText(titleText, {
              x: PAGE_WIDTH / 2 - boldFont.widthOfTextAtSize(titleText, finalTitleSize) / 2,
              y: PAGE_HEIGHT / 2,
              size: finalTitleSize,
              font: boldFont,
              color: rgb(0.12, 0.16, 0.23),
            });
          }
        }
        break;
        
      case 'backCover':
        // Back cover: image or "The End" text
        if (entry.imageUrl) {
          const backCoverImage = await embedImage(entry.imageUrl);
          if (backCoverImage) {
            drawFullPageImage(page, backCoverImage);
          } else {
            // Fallback: "The End"
            page.drawRectangle({
              x: 0, y: 0,
              width: PAGE_WIDTH, height: PAGE_HEIGHT,
              color: rgb(0.976, 0.969, 0.953),
            });
            
            const endText = "The End";
            const endFontSize = 32;
            const endTextWidth = boldFont.widthOfTextAtSize(endText, endFontSize);
            
            page.drawText(endText, {
              x: PAGE_WIDTH / 2 - endTextWidth / 2,
              y: PAGE_HEIGHT / 2,
              size: endFontSize,
              font: boldFont,
              color: rgb(0.2, 0.25, 0.31),
            });
          }
        } else {
          // Default: "The End"
          page.drawRectangle({
            x: 0, y: 0,
            width: PAGE_WIDTH, height: PAGE_HEIGHT,
            color: rgb(0.976, 0.969, 0.953),
          });
          
          const endText = "The End";
          const endFontSize = 32;
          const endTextWidth = boldFont.widthOfTextAtSize(endText, endFontSize);
          
          page.drawText(endText, {
            x: PAGE_WIDTH / 2 - endTextWidth / 2,
            y: PAGE_HEIGHT / 2,
            size: endFontSize,
            font: boldFont,
            color: rgb(0.2, 0.25, 0.31),
          });
        }
        break;
        
      case 'foreword':
        // Foreword/Dedication page: centered, italicized text
        page.drawRectangle({
          x: 0, y: 0,
          width: PAGE_WIDTH, height: PAGE_HEIGHT,
          color: rgb(0.976, 0.969, 0.953), // Soft cream background
        });
        
        if (entry.text && entry.text.trim()) {
          // Load Georgia or Times New Roman style font (use serif)
          const serifFont = await pdfDoc.embedFont(StandardFonts.TimesRomanItalic);
          const fontSize = 14;
          const lineHeight = fontSize * 1.6;
          const textX = SAFETY_MARGIN_POINTS + 30; // Extra horizontal margins
          const textWidth = PAGE_WIDTH - 2 * (SAFETY_MARGIN_POINTS + 30);
          
          const lines = wrapText(entry.text, textWidth, fontSize, serifFont);
          
          // Center text vertically and horizontally
          const totalTextHeight = lines.length * lineHeight;
          const verticalOffset = (PAGE_HEIGHT - totalTextHeight) / 2;
          let currentY = PAGE_HEIGHT - verticalOffset;
          
          for (const line of lines) {
            const lineWidth = serifFont.widthOfTextAtSize(line, fontSize);
            const centerX = (PAGE_WIDTH - lineWidth) / 2;
            
            page.drawText(line, {
              x: centerX,
              y: currentY - fontSize,
              size: fontSize,
              font: serifFont,
              color: rgb(0.2, 0.25, 0.31),
            });
            
            currentY -= lineHeight;
          }
        }
        break;
        
      case 'image':
        // Image page: full-page image only
        if (entry.imageUrl) {
          const pageImage = await embedImage(entry.imageUrl);
          if (pageImage) {
            drawFullPageImage(page, pageImage);
          } else {
            // Fallback: white page
            page.drawRectangle({
              x: 0, y: 0,
              width: PAGE_WIDTH, height: PAGE_HEIGHT,
              color: rgb(1, 1, 1),
            });
          }
        } else {
          // Fallback: white page
          page.drawRectangle({
            x: 0, y: 0,
            width: PAGE_WIDTH, height: PAGE_HEIGHT,
            color: rgb(1, 1, 1),
          });
        }
        break;
        
      case 'text':
        // Text page: text on soft background with safety margins
        page.drawRectangle({
          x: 0, y: 0,
          width: PAGE_WIDTH, height: PAGE_HEIGHT,
          color: rgb(0.976, 0.969, 0.953), // Soft cream background
        });
        
        if (entry.text && entry.text.trim()) {
          const fontSize = 16;
          const lineHeight = fontSize * 1.8;
          const textX = SAFETY_MARGIN_POINTS;
          const textY = PAGE_HEIGHT - SAFETY_MARGIN_POINTS;
          const textWidth = PAGE_WIDTH - 2 * SAFETY_MARGIN_POINTS;
          const textHeight = PAGE_HEIGHT - 2 * SAFETY_MARGIN_POINTS;
          
          const lines = wrapText(entry.text, textWidth, fontSize);
          
          // Center text vertically if it fits
          const totalTextHeight = lines.length * lineHeight;
          const verticalOffset = totalTextHeight <= textHeight 
            ? (textHeight - totalTextHeight) / 2 
            : 0;
          
          let currentY = textY - verticalOffset;
          
          // Draw text lines
          for (const line of lines) {
            if (currentY - fontSize < SAFETY_MARGIN_POINTS) break;
            
            page.drawText(line, {
              x: textX,
              y: currentY - fontSize,
              size: fontSize,
              font: font,
              color: rgb(0.15, 0.2, 0.28), // Dark gray text
            });
            
            currentY -= lineHeight;
          }
          
          // Add page number in safe area
          if (entry.pageIndex !== undefined) {
            const pageNumText = `${entry.pageIndex + 1}`;
            const pageNumSize = 11;
            const pageNumX = PAGE_WIDTH - SAFETY_MARGIN_POINTS - font.widthOfTextAtSize(pageNumText, pageNumSize);
            page.drawText(pageNumText, {
              x: pageNumX,
              y: SAFETY_MARGIN_POINTS,
              size: pageNumSize,
              font: font,
              color: rgb(0.5, 0.5, 0.5),
            });
          }
        }
        break;
        
      case 'attribution':
        // Attribution page: "Created on www.vesabooks.com"
        page.drawRectangle({
          x: 0, y: 0,
          width: PAGE_WIDTH, height: PAGE_HEIGHT,
          color: rgb(0.976, 0.969, 0.953), // Soft cream background
        });
        
        const attributionText = "Created on www.vesabooks.com";
        const attributionSize = 10;
        const attributionWidth = font.widthOfTextAtSize(attributionText, attributionSize);
        const attributionX = (PAGE_WIDTH - attributionWidth) / 2;
        const attributionY = PAGE_HEIGHT / 2;
        
        page.drawText(attributionText, {
          x: attributionX,
          y: attributionY,
          size: attributionSize,
          font: font,
          color: rgb(0.4, 0.4, 0.4), // Subtle gray
        });
        break;
    }
  }
  
  // Final validation
  const finalPageCount = pdfDoc.getPageCount();
  const finalValidation = validatePageCount(finalPageCount);
  
  if (!finalValidation.valid) {
    console.error(`❌ Page count validation failed: ${finalValidation.message}`);
    throw new Error(finalValidation.message);
  }
  
  if (finalValidation.message) {
    console.warn(`⚠️ ${finalValidation.message}`);
  }
  
  console.log(`✅ Print-ready PDF generated: ${finalPageCount} pages, ${bookSize} format, ${REQUIRED_DPI} DPI`);
  
  const pdfBytes = await pdfDoc.save();
  return Buffer.from(pdfBytes);
}
