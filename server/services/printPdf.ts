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
  bookSize: string = 'a5-portrait'
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
  
  // Helper function to draw image covering full page
  function drawFullPageImage(page: any, image: any) {
    const imgAspectRatio = image.width / image.height;
    const pageAspectRatio = PAGE_WIDTH / PAGE_HEIGHT;
    
    let drawWidth = PAGE_WIDTH;
    let drawHeight = PAGE_HEIGHT;
    let x = 0;
    let y = 0;
    
    // Scale to cover page completely (no white space)
    if (imgAspectRatio > pageAspectRatio) {
      // Image is wider - fit to height
      drawHeight = PAGE_HEIGHT;
      drawWidth = drawHeight * imgAspectRatio;
      x = -(drawWidth - PAGE_WIDTH) / 2;
    } else {
      // Image is taller - fit to width
      drawWidth = PAGE_WIDTH;
      drawHeight = drawWidth / imgAspectRatio;
      y = -(drawHeight - PAGE_HEIGHT) / 2;
    }
    
    page.drawImage(image, { x, y, width: drawWidth, height: drawHeight });
  }
  
  // PAGE 1: FRONT COVER (full page image, no overlays)
  const coverPage = pdfDoc.addPage([PAGE_WIDTH, PAGE_HEIGHT]);
  const coverImageUrl = storybook.coverImageUrl || storybook.pages[0]?.imageUrl;
  
  if (coverImageUrl) {
    const coverImage = await embedImage(coverImageUrl);
    if (coverImage) {
      drawFullPageImage(coverPage, coverImage);
    } else {
      // Fallback: solid color background with centered title
      coverPage.drawRectangle({
        x: 0,
        y: 0,
        width: PAGE_WIDTH,
        height: PAGE_HEIGHT,
        color: rgb(0.976, 0.969, 0.953), // Soft background
      });
      
      const titleFontSize = 28;
      const titleText = storybook.title;
      const titleWidth = boldFont.widthOfTextAtSize(titleText, titleFontSize);
      const maxTitleWidth = PAGE_WIDTH - 2 * SAFETY_MARGIN_POINTS;
      
      let finalTitleSize = titleFontSize;
      if (titleWidth > maxTitleWidth) {
        finalTitleSize = (maxTitleWidth / titleWidth) * titleFontSize;
      }
      
      coverPage.drawText(titleText, {
        x: PAGE_WIDTH / 2 - boldFont.widthOfTextAtSize(titleText, finalTitleSize) / 2,
        y: PAGE_HEIGHT / 2,
        size: finalTitleSize,
        font: boldFont,
        color: rgb(0.12, 0.16, 0.23),
      });
    }
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
  
  // Calculate total page count including back cover that will be added
  const currentPageCount = pdfDoc.getPageCount();
  const totalPagesWithBackCover = currentPageCount + 1; // +1 for back cover
  
  // Add blank page if total will be odd (to make final count even)
  if (totalPagesWithBackCover % 2 !== 0) {
    console.warn(`⚠️ Adding blank page to ensure even page count (current: ${currentPageCount}, with back cover: ${totalPagesWithBackCover}).`);
    const blankPage = pdfDoc.addPage([PAGE_WIDTH, PAGE_HEIGHT]);
    blankPage.drawRectangle({
      x: 0,
      y: 0,
      width: PAGE_WIDTH,
      height: PAGE_HEIGHT,
      color: rgb(1, 1, 1), // White blank page
    });
  }
  
  // LAST PAGE: BACK COVER (full page image, no overlays)
  const backCoverPage = pdfDoc.addPage([PAGE_WIDTH, PAGE_HEIGHT]);
  
  if (storybook.backCoverImageUrl) {
    const backCoverImage = await embedImage(storybook.backCoverImageUrl);
    if (backCoverImage) {
      drawFullPageImage(backCoverPage, backCoverImage);
    } else {
      // Fallback: "The End" page
      backCoverPage.drawRectangle({
        x: 0,
        y: 0,
        width: PAGE_WIDTH,
        height: PAGE_HEIGHT,
        color: rgb(0.976, 0.969, 0.953),
      });
      
      const endText = "The End";
      const endFontSize = 32;
      const endTextWidth = boldFont.widthOfTextAtSize(endText, endFontSize);
      
      backCoverPage.drawText(endText, {
        x: PAGE_WIDTH / 2 - endTextWidth / 2,
        y: PAGE_HEIGHT / 2,
        size: endFontSize,
        font: boldFont,
        color: rgb(0.2, 0.25, 0.31),
      });
    }
  } else {
    // Default back cover: "The End"
    backCoverPage.drawRectangle({
      x: 0,
      y: 0,
      width: PAGE_WIDTH,
      height: PAGE_HEIGHT,
      color: rgb(0.976, 0.969, 0.953),
    });
    
    const endText = "The End";
    const endFontSize = 32;
    const endTextWidth = boldFont.widthOfTextAtSize(endText, endFontSize);
    
    backCoverPage.drawText(endText, {
      x: PAGE_WIDTH / 2 - endTextWidth / 2,
      y: PAGE_HEIGHT / 2,
      size: endFontSize,
      font: boldFont,
      color: rgb(0.2, 0.25, 0.31),
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
