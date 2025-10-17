import { PDFDocument, rgb, StandardFonts, degrees } from 'pdf-lib';
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
 * Generates a professional print-ready PDF for hardcover photo books
 * Follows Prodigi hardcover photo book specifications:
 * - Single-page layout (each PDF page is one element)
 * - No bleed (print service auto-generates)
 * - 10mm safety margins for text/logos
 * - 300 DPI resolution
 * - Even page count (24-300 pages)
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
  
  // Include spine customization in keywords for print service
  const keywords = ['storybook', 'print', 'hardcover', `${REQUIRED_DPI}dpi`];
  if (spineText) {
    keywords.push(`spine:${spineText}`);
  }
  if (spineTextColor) {
    keywords.push(`spine-text-color:${spineTextColor}`);
  }
  if (spineBackgroundColor) {
    keywords.push(`spine-bg-color:${spineBackgroundColor}`);
  }
  pdfDoc.setKeywords(keywords);
  
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
  
  // Helper function to parse hex colors
  const parseHexColor = (hex: string) => {
    const cleaned = hex.replace('#', '');
    const r = parseInt(cleaned.substring(0, 2), 16) / 255;
    const g = parseInt(cleaned.substring(2, 4), 16) / 255;
    const b = parseInt(cleaned.substring(4, 6), 16) / 255;
    return { r, g, b };
  };
  
  // Count actual content pages from storybook
  let actualContentPages = 0;
  for (const page of storybook.pages) {
    const hasImage = !!page.imageUrl;
    const hasText = !!(page.text && page.text.trim());
    if (hasImage || hasText) {
      actualContentPages++;
    }
  }
  
  // Calculate minimum interior pages needed
  // Total pages = 1 (wraparound cover) + interior pages
  // Minimum total is 24, so minimum interior is 23
  // But interior must be even, so minimum is 24 interior pages
  const MIN_TOTAL_PAGES = 24;
  const MIN_INTERIOR_PAGES = MIN_TOTAL_PAGES - 1; // 23
  const MIN_EVEN_INTERIOR = MIN_INTERIOR_PAGES % 2 === 0 ? MIN_INTERIOR_PAGES : MIN_INTERIOR_PAGES + 1; // 24
  
  // Calculate required interior pages (must be at least minimum and must be even)
  let requiredInteriorPages = Math.max(actualContentPages, MIN_EVEN_INTERIOR);
  if (requiredInteriorPages % 2 !== 0) {
    requiredInteriorPages++; // Make even
  }
  
  // Calculate how many blank pages we need to add
  const blankPagesToAdd = requiredInteriorPages - actualContentPages;
  
  if (blankPagesToAdd > 0) {
    console.log(`📄 Adding ${blankPagesToAdd} blank pages (${actualContentPages} content → ${requiredInteriorPages} total interior pages)`);
  }
  
  // Calculate total page count (1 wraparound cover + interior pages)
  const totalPages = 1 + requiredInteriorPages;
  
  // Calculate spine width based on total page count
  const spineWidthInches = Math.max(0.5, (totalPages * 0.002));
  const SPINE_WIDTH = spineWidthInches * 72; // Convert to points
  const SPREAD_WIDTH = PAGE_WIDTH + SPINE_WIDTH + PAGE_WIDTH;
  
  console.log(`📖 Creating wraparound cover spread: ${SPREAD_WIDTH.toFixed(2)} pts wide (back: ${PAGE_WIDTH.toFixed(2)} + spine: ${SPINE_WIDTH.toFixed(2)} + front: ${PAGE_WIDTH.toFixed(2)})`);
  console.log(`📄 Total pages: ${totalPages} (1 wraparound cover + ${requiredInteriorPages} interior pages)`);
  
  // PAGE 1: WRAPAROUND COVER SPREAD (back + spine + front)
  const wraparoundCover = pdfDoc.addPage([SPREAD_WIDTH, PAGE_HEIGHT]);
  
  // SECTION 1: Draw back cover on left (0 to PAGE_WIDTH)
  const backCoverImageUrl = storybook.backCoverImageUrl;
  if (backCoverImageUrl) {
    const backCoverImage = await embedImage(backCoverImageUrl);
    if (backCoverImage) {
      drawScaledImage(wraparoundCover, backCoverImage, 0, 0, PAGE_WIDTH, PAGE_HEIGHT);
    } else {
      // Fallback: "The End" on back cover
      wraparoundCover.drawRectangle({
        x: 0,
        y: 0,
        width: PAGE_WIDTH,
        height: PAGE_HEIGHT,
        color: rgb(0.976, 0.969, 0.953),
      });
      
      const endText = "The End";
      const endFontSize = 32;
      const endTextWidth = boldFont.widthOfTextAtSize(endText, endFontSize);
      
      wraparoundCover.drawText(endText, {
        x: PAGE_WIDTH / 2 - endTextWidth / 2,
        y: PAGE_HEIGHT / 2,
        size: endFontSize,
        font: boldFont,
        color: rgb(0.2, 0.25, 0.31),
      });
    }
  } else {
    // Default back cover: "The End"
    wraparoundCover.drawRectangle({
      x: 0,
      y: 0,
      width: PAGE_WIDTH,
      height: PAGE_HEIGHT,
      color: rgb(0.976, 0.969, 0.953),
    });
    
    const endText = "The End";
    const endFontSize = 32;
    const endTextWidth = boldFont.widthOfTextAtSize(endText, endFontSize);
    
    wraparoundCover.drawText(endText, {
      x: PAGE_WIDTH / 2 - endTextWidth / 2,
      y: PAGE_HEIGHT / 2,
      size: endFontSize,
      font: boldFont,
      color: rgb(0.2, 0.25, 0.31),
    });
  }
  
  // SECTION 2: Draw spine in middle (PAGE_WIDTH to PAGE_WIDTH + SPINE_WIDTH)
  const bgColor = spineBackgroundColor ? parseHexColor(spineBackgroundColor) : { r: 1, g: 1, b: 1 };
  const textColor = spineTextColor ? parseHexColor(spineTextColor) : { r: 0, g: 0, b: 0 };
  
  wraparoundCover.drawRectangle({
    x: PAGE_WIDTH,
    y: 0,
    width: SPINE_WIDTH,
    height: PAGE_HEIGHT,
    color: rgb(bgColor.r, bgColor.g, bgColor.b),
  });
  
  if (spineText) {
    const spineFontSize = Math.min(24, SPINE_WIDTH * 0.7);
    const spineTextWidth = boldFont.widthOfTextAtSize(spineText, spineFontSize);
    
    // Draw spine text rotated 90 degrees (reads from bottom to top when book is on shelf)
    wraparoundCover.drawText(spineText, {
      x: PAGE_WIDTH + SPINE_WIDTH / 2 + spineFontSize / 3,
      y: PAGE_HEIGHT / 2 - spineTextWidth / 2,
      size: spineFontSize,
      font: boldFont,
      color: rgb(textColor.r, textColor.g, textColor.b),
      rotate: degrees(90),
    });
  }
  
  // SECTION 3: Draw front cover on right (PAGE_WIDTH + SPINE_WIDTH to end)
  const coverImageUrl = storybook.coverImageUrl || storybook.pages[0]?.imageUrl;
  if (coverImageUrl) {
    const coverImage = await embedImage(coverImageUrl);
    if (coverImage) {
      drawScaledImage(wraparoundCover, coverImage, PAGE_WIDTH + SPINE_WIDTH, 0, PAGE_WIDTH, PAGE_HEIGHT);
    } else {
      // Fallback: solid color background with centered title
      wraparoundCover.drawRectangle({
        x: PAGE_WIDTH + SPINE_WIDTH,
        y: 0,
        width: PAGE_WIDTH,
        height: PAGE_HEIGHT,
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
      
      wraparoundCover.drawText(titleText, {
        x: PAGE_WIDTH + SPINE_WIDTH + PAGE_WIDTH / 2 - boldFont.widthOfTextAtSize(titleText, finalTitleSize) / 2,
        y: PAGE_HEIGHT / 2,
        size: finalTitleSize,
        font: boldFont,
        color: rgb(0.12, 0.16, 0.23),
      });
    }
  } else {
    // Fallback: solid color background with centered title
    wraparoundCover.drawRectangle({
      x: PAGE_WIDTH + SPINE_WIDTH,
      y: 0,
      width: PAGE_WIDTH,
      height: PAGE_HEIGHT,
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
    
    wraparoundCover.drawText(titleText, {
      x: PAGE_WIDTH + SPINE_WIDTH + PAGE_WIDTH / 2 - boldFont.widthOfTextAtSize(titleText, finalTitleSize) / 2,
      y: PAGE_HEIGHT / 2,
      size: finalTitleSize,
      font: boldFont,
      color: rgb(0.12, 0.16, 0.23),
    });
  }
  
  // CONTENT PAGES: Image and text pages (alternating or combined based on content)
  for (let i = 0; i < storybook.pages.length; i++) {
    const page = storybook.pages[i];
    const hasImage = !!page.imageUrl;
    const hasText = !!(page.text && page.text.trim());
    
    if (hasImage && hasText) {
      // COMBINED LAYOUT: Image with text overlay in safe area
      const contentPage = pdfDoc.addPage([PAGE_WIDTH, PAGE_HEIGHT]);
      
      // Draw full-page image
      const pageImage = await embedImage(page.imageUrl);
      if (pageImage) {
        drawFullPageImage(contentPage, pageImage);
      }
      
      // Draw semi-transparent overlay for text readability
      const textAreaHeight = PAGE_HEIGHT * 0.3; // Bottom 30% of page
      contentPage.drawRectangle({
        x: 0,
        y: 0,
        width: PAGE_WIDTH,
        height: textAreaHeight,
        color: rgb(0, 0, 0),
        opacity: 0.6,
      });
      
      // Draw text in safe area
      const fontSize = 14;
      const lineHeight = fontSize * 1.6;
      const textX = SAFETY_MARGIN_POINTS;
      const textY = textAreaHeight - SAFETY_MARGIN_POINTS;
      const textWidth = PAGE_WIDTH - 2 * SAFETY_MARGIN_POINTS;
      
      // Word wrap text
      const words = page.text.split(' ');
      const lines: string[] = [];
      let currentLine = '';
      
      for (const word of words) {
        const testLine = currentLine + (currentLine ? ' ' : '') + word;
        const testWidth = font.widthOfTextAtSize(testLine, fontSize);
        
        if (testWidth > textWidth && currentLine) {
          lines.push(currentLine);
          currentLine = word;
        } else {
          currentLine = testLine;
        }
      }
      if (currentLine) {
        lines.push(currentLine);
      }
      
      // Draw text lines
      let currentY = textY;
      for (const line of lines) {
        if (currentY - fontSize < SAFETY_MARGIN_POINTS) break;
        
        contentPage.drawText(line, {
          x: textX,
          y: currentY - fontSize,
          size: fontSize,
          font: font,
          color: rgb(1, 1, 1), // White text on dark overlay
        });
        
        currentY -= lineHeight;
      }
      
    } else if (hasImage) {
      // IMAGE-ONLY PAGE
      const imagePage = pdfDoc.addPage([PAGE_WIDTH, PAGE_HEIGHT]);
      const pageImage = await embedImage(page.imageUrl);
      if (pageImage) {
        drawFullPageImage(imagePage, pageImage);
      }
      
    } else if (hasText) {
      // TEXT-ONLY PAGE
      const textPage = pdfDoc.addPage([PAGE_WIDTH, PAGE_HEIGHT]);
      
      // Soft background
      textPage.drawRectangle({
        x: 0,
        y: 0,
        width: PAGE_WIDTH,
        height: PAGE_HEIGHT,
        color: rgb(0.976, 0.969, 0.953),
      });
      
      // Text area with safety margins
      const fontSize = 16;
      const lineHeight = fontSize * 1.8;
      const textX = SAFETY_MARGIN_POINTS;
      const textY = PAGE_HEIGHT - SAFETY_MARGIN_POINTS;
      const textWidth = PAGE_WIDTH - 2 * SAFETY_MARGIN_POINTS;
      const textHeight = PAGE_HEIGHT - 2 * SAFETY_MARGIN_POINTS;
      
      // Word wrap text
      const words = page.text.split(' ');
      const lines: string[] = [];
      let currentLine = '';
      
      for (const word of words) {
        const testLine = currentLine + (currentLine ? ' ' : '') + word;
        const testWidth = font.widthOfTextAtSize(testLine, fontSize);
        
        if (testWidth > textWidth && currentLine) {
          lines.push(currentLine);
          currentLine = word;
        } else {
          currentLine = testLine;
        }
      }
      if (currentLine) {
        lines.push(currentLine);
      }
      
      // Center text vertically if it fits
      const totalTextHeight = lines.length * lineHeight;
      const verticalOffset = totalTextHeight <= textHeight 
        ? (textHeight - totalTextHeight) / 2 
        : 0;
      
      let currentY = textY - verticalOffset;
      
      // Draw text lines
      for (const line of lines) {
        if (currentY - fontSize < SAFETY_MARGIN_POINTS) break;
        
        textPage.drawText(line, {
          x: textX,
          y: currentY - fontSize,
          size: fontSize,
          font: font,
          color: rgb(0.15, 0.2, 0.28),
        });
        
        currentY -= lineHeight;
      }
      
      // Add page number in safe area
      const pageNumText = `${i + 1}`;
      const pageNumSize = 11;
      const pageNumX = PAGE_WIDTH - SAFETY_MARGIN_POINTS - font.widthOfTextAtSize(pageNumText, pageNumSize);
      textPage.drawText(pageNumText, {
        x: pageNumX,
        y: SAFETY_MARGIN_POINTS,
        size: pageNumSize,
        font: font,
        color: rgb(0.5, 0.5, 0.5),
      });
    }
  }
  
  // Add blank pages to meet minimum page count
  for (let i = 0; i < blankPagesToAdd; i++) {
    const blankPage = pdfDoc.addPage([PAGE_WIDTH, PAGE_HEIGHT]);
    blankPage.drawRectangle({
      x: 0,
      y: 0,
      width: PAGE_WIDTH,
      height: PAGE_HEIGHT,
      color: rgb(1, 1, 1), // White blank page
    });
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
