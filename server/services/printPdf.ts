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

// Page manifest types
type PageType = 'frontCover' | 'blank' | 'image' | 'text' | 'backCover';
interface PageManifestEntry {
  type: PageType;
  pageIndex?: number; // Reference to storybook.pages index for image/text pages
  imageUrl?: string; // For cover pages
  text?: string; // For text pages
}

/**
 * Builds a deterministic page manifest for the print PDF
 * Structure: [front cover, blank, ...image/text pairs, blank, back cover]
 */
function buildPageManifest(storybook: Storybook): PageManifestEntry[] {
  const manifest: PageManifestEntry[] = [];
  
  // 1. Front cover (using coverImageUrl or first page image)
  const coverImageUrl = storybook.coverImageUrl || storybook.pages[0]?.imageUrl;
  manifest.push({ type: 'frontCover', imageUrl: coverImageUrl || undefined });
  
  // 2. First blank page
  manifest.push({ type: 'blank' });
  
  // 3. Story content: each page becomes TWO PDF pages (image, then text)
  for (let i = 0; i < storybook.pages.length; i++) {
    const page = storybook.pages[i];
    
    // Image page (left/even)
    manifest.push({ 
      type: 'image', 
      pageIndex: i, 
      imageUrl: page.imageUrl || undefined 
    });
    
    // Text page (right/odd)
    manifest.push({ 
      type: 'text', 
      pageIndex: i, 
      text: page.text 
    });
  }
  
  // 4. Calculate padding needed for minimum 24 pages
  const MIN_TOTAL_PAGES = 24;
  const currentPageCount = manifest.length + 2; // +2 for last blank + back cover
  
  if (currentPageCount < MIN_TOTAL_PAGES) {
    const pagesNeeded = MIN_TOTAL_PAGES - currentPageCount;
    // Add blank pages in pairs to maintain even count and left/right alignment
    const blankPairsNeeded = Math.ceil(pagesNeeded / 2);
    
    for (let i = 0; i < blankPairsNeeded * 2; i++) {
      manifest.push({ type: 'blank' });
    }
    
    console.log(`📄 Adding ${blankPairsNeeded * 2} blank pages for minimum page count`);
  }
  
  // 5. Last blank page
  manifest.push({ type: 'blank' });
  
  // 6. Back cover (using backCoverImageUrl or "The End" text)
  manifest.push({ 
    type: 'backCover', 
    imageUrl: storybook.backCoverImageUrl || undefined 
  });
  
  // Ensure even page count for proper book binding
  if (manifest.length % 2 !== 0) {
    manifest.push({ type: 'blank' });
    console.log(`📄 Adding 1 blank page to ensure even page count`);
  }
  
  return manifest;
}

/**
 * Generates a professional print-ready PDF for hardcover photo books
 * New layout: Image and text on separate pages (not overlaid)
 * - Front cover → Blank → Image/Text pairs → Blank → Back cover
 * - Minimum 24 pages, even page count
 * - 300 DPI resolution with 10mm safety margins
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
  
  // Helper function to draw image covering specified dimensions
  function drawScaledImage(page: any, image: any, targetX: number, targetY: number, targetWidth: number, targetHeight: number) {
    const imgAspectRatio = image.width / image.height;
    const targetAspectRatio = targetWidth / targetHeight;
    
    let drawWidth = targetWidth;
    let drawHeight = targetHeight;
    let x = targetX;
    let y = targetY;
    
    // Scale to cover area completely (no white space)
    if (imgAspectRatio > targetAspectRatio) {
      // Image is wider - fit to height
      drawHeight = targetHeight;
      drawWidth = drawHeight * imgAspectRatio;
      x = targetX - (drawWidth - targetWidth) / 2;
    } else {
      // Image is taller - fit to width
      drawWidth = targetWidth;
      drawHeight = drawWidth / imgAspectRatio;
      y = targetY - (drawHeight - targetHeight) / 2;
    }
    
    page.drawImage(image, { x, y, width: drawWidth, height: drawHeight });
  }
  
  // Helper function to draw image covering full page
  function drawFullPageImage(page: any, image: any) {
    drawScaledImage(page, image, 0, 0, PAGE_WIDTH, PAGE_HEIGHT);
  }
  
  // Helper function to word wrap text
  function wrapText(text: string, maxWidth: number, fontSize: number): string[] {
    const words = text.split(' ');
    const lines: string[] = [];
    let currentLine = '';
    
    for (const word of words) {
      const testLine = currentLine + (currentLine ? ' ' : '') + word;
      const testWidth = font.widthOfTextAtSize(testLine, fontSize);
      
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
    
    return lines;
  }
  
  // Build page manifest
  const manifest = buildPageManifest(storybook);
  
  console.log(`📖 Generating print PDF with ${manifest.length} pages`);
  console.log(`📄 Layout: Front cover → Blank → ${storybook.pages.length * 2} content pages (${storybook.pages.length} image/text pairs) → Blank → Back cover`);
  
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
            const titleText = storybook.title;
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
        
      case 'blank':
        // Blank page: pure white
        page.drawRectangle({
          x: 0, y: 0,
          width: PAGE_WIDTH, height: PAGE_HEIGHT,
          color: rgb(1, 1, 1),
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
