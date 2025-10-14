import { PDFDocument, rgb, StandardFonts } from 'pdf-lib';
import type { Storybook } from "@shared/schema";
import { ObjectStorageService } from "../objectStorage";

// Constants in points (72 points = 1 inch)
const INCH_TO_POINTS = 72;
const TRIM_WIDTH = 6 * INCH_TO_POINTS;  // 432 points
const TRIM_HEIGHT = 9 * INCH_TO_POINTS;  // 648 points
const BLEED = 0.125 * INCH_TO_POINTS;    // 9 points
const PAGE_WIDTH = TRIM_WIDTH + (2 * BLEED);  // 450 points
const PAGE_HEIGHT = TRIM_HEIGHT + (2 * BLEED); // 666 points
const SAFE_MARGIN = 0.5 * INCH_TO_POINTS;      // 36 points from trim edge
const SPINE_MARGIN = 0.75 * INCH_TO_POINTS;    // 54 points on spine side

export async function generatePrintReadyPDF(storybook: Storybook): Promise<Buffer> {
  const pdfDoc = await PDFDocument.create();
  
  // Set PDF metadata for print compliance
  pdfDoc.setTitle(storybook.title);
  pdfDoc.setAuthor('AI Storybook Builder');
  pdfDoc.setSubject('Children\'s Storybook - Print Ready');
  pdfDoc.setProducer('AI Storybook Builder - Print Ready PDF');
  pdfDoc.setCreator('pdf-lib');
  
  // Print specifications implemented:
  // - Trim size: 6" × 9" (432 × 648 points)
  // - Bleed: 0.125" (9 points) on all sides
  // - Safe area: 0.5" from trim edge (36 points)
  // - Spine margin: 0.75" for binding (54 points)
  // - All text positioned from trim edge, not page edge
  // 
  // Note: For full PDF/X-4 or PDF/X-1a compliance, post-process with Ghostscript or Adobe tools
  // to add TrimBox, BleedBox, and convert to CMYK color space
  // This PDF is structured correctly for print with proper dimensions, bleed, and safe areas
  
  const objectStorageService = new ObjectStorageService();
  const font = await pdfDoc.embedFont(StandardFonts.Helvetica);
  const boldFont = await pdfDoc.embedFont(StandardFonts.HelveticaBold);
  
  // Helper function to fetch and embed image
  async function embedImage(imageUrl: string): Promise<any> {
    try {
      const filename = imageUrl.split('/').pop();
      if (!filename) return null;
      
      const imageBuffer = await objectStorageService.getFileBuffer(filename);
      
      // Try PNG first, then JPEG
      try {
        return await pdfDoc.embedPng(imageBuffer);
      } catch {
        return await pdfDoc.embedJpg(imageBuffer);
      }
    } catch (error) {
      console.error('Error embedding image:', error);
      return null;
    }
  }
  
  // Add cover page with full-bleed cover image
  const coverPage = pdfDoc.addPage([PAGE_WIDTH, PAGE_HEIGHT]);
  const coverImageUrl = storybook.coverImageUrl || storybook.pages[0]?.imageUrl;
  
  if (coverImageUrl) {
    const coverImage = await embedImage(coverImageUrl);
    if (coverImage) {
      const imgAspectRatio = coverImage.width / coverImage.height;
      const pageAspectRatio = PAGE_WIDTH / PAGE_HEIGHT;
      
      let drawWidth = PAGE_WIDTH;
      let drawHeight = PAGE_HEIGHT;
      let x = 0;
      let y = 0;
      
      // Scale to cover page with bleed (no white space)
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
      
      coverPage.drawImage(coverImage, {
        x,
        y,
        width: drawWidth,
        height: drawHeight,
      });
    }
    
    // Add title overlay at bottom (within safe area from trim)
    const titleBoxHeight = 90;
    const titleBoxY = BLEED + SAFE_MARGIN; // Position box within safe area from trim
    
    // Semi-transparent white background for title
    coverPage.drawRectangle({
      x: 0,
      y: titleBoxY - 10, // Extend slightly for visual effect
      width: PAGE_WIDTH,
      height: titleBoxHeight,
      color: rgb(1, 1, 1),
      opacity: 0.95,
    });
    
    // Draw title text
    const titleFontSize = 24;
    const titleText = storybook.title;
    const titleWidth = boldFont.widthOfTextAtSize(titleText, titleFontSize);
    const maxTitleWidth = PAGE_WIDTH - 2 * BLEED - 2 * SAFE_MARGIN; // Text safe area from trim
    
    let finalTitleSize = titleFontSize;
    if (titleWidth > maxTitleWidth) {
      finalTitleSize = (maxTitleWidth / titleWidth) * titleFontSize;
    }
    
    coverPage.drawText(titleText, {
      x: PAGE_WIDTH / 2 - boldFont.widthOfTextAtSize(titleText, finalTitleSize) / 2,
      y: titleBoxY + 50, // Position within title box
      size: finalTitleSize,
      font: boldFont,
      color: rgb(0.12, 0.16, 0.23), // Dark color
    });
    
    // Draw author text
    coverPage.drawText('By AI Storyteller', {
      x: PAGE_WIDTH / 2 - font.widthOfTextAtSize('By AI Storyteller', 12) / 2,
      y: titleBoxY + 20, // Position within safe area
      size: 12,
      font: font,
      color: rgb(0.28, 0.33, 0.41),
    });
  } else {
    // Text-only cover page
    const titleFontSize = 32;
    const titleText = storybook.title;
    const titleWidth = boldFont.widthOfTextAtSize(titleText, titleFontSize);
    const maxTitleWidth = PAGE_WIDTH - 2 * BLEED - 2 * SAFE_MARGIN; // Text safe area from trim
    
    let finalTitleSize = titleFontSize;
    if (titleWidth > maxTitleWidth) {
      finalTitleSize = (maxTitleWidth / titleWidth) * titleFontSize;
    }
    
    coverPage.drawText(titleText, {
      x: PAGE_WIDTH / 2 - boldFont.widthOfTextAtSize(titleText, finalTitleSize) / 2,
      y: PAGE_HEIGHT / 2 + 20,
      size: finalTitleSize,
      font: boldFont,
      color: rgb(0.12, 0.16, 0.23),
    });
    
    coverPage.drawText('By AI Storyteller', {
      x: PAGE_WIDTH / 2 - font.widthOfTextAtSize('By AI Storyteller', 14) / 2,
      y: PAGE_HEIGHT / 2 - 20,
      size: 14,
      font: font,
      color: rgb(0.28, 0.33, 0.41),
    });
  }
  
  // Add story pages: LEFT = image (full bleed), RIGHT = text (safe margins)
  for (let i = 0; i < storybook.pages.length; i++) {
    const page = storybook.pages[i];
    
    // LEFT PAGE: Full-bleed image
    const leftPage = pdfDoc.addPage([PAGE_WIDTH, PAGE_HEIGHT]);
    
    if (page.imageUrl) {
      const pageImage = await embedImage(page.imageUrl);
      if (pageImage) {
        const imgAspectRatio = pageImage.width / pageImage.height;
        const pageAspectRatio = PAGE_WIDTH / PAGE_HEIGHT;
        
        let drawWidth = PAGE_WIDTH;
        let drawHeight = PAGE_HEIGHT;
        let x = 0;
        let y = 0;
        
        // Scale to cover page with bleed (no white space)
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
        
        leftPage.drawImage(pageImage, {
          x,
          y,
          width: drawWidth,
          height: drawHeight,
        });
      }
    }
    
    // RIGHT PAGE: Text with safe margins
    const rightPage = pdfDoc.addPage([PAGE_WIDTH, PAGE_HEIGHT]);
    
    // Calculate text area with safe margins FROM TRIM EDGE
    // Trim edge is BLEED distance from page edge
    const textAreaLeft = BLEED + SPINE_MARGIN; // Left margin from trim (spine side)
    const textAreaRight = PAGE_WIDTH - BLEED - SAFE_MARGIN; // Right margin from trim
    const textAreaTop = PAGE_HEIGHT - BLEED - SAFE_MARGIN; // Top margin from trim
    const textAreaBottom = BLEED + SAFE_MARGIN + 30; // Bottom margin (extra space for page number)
    const textWidth = textAreaRight - textAreaLeft; // Width between margins
    const textHeight = textAreaTop - textAreaBottom; // Available height for text
    
    // Kid-friendly text formatting (ages 6-12)
    const fontSize = 20; // Larger font for young readers
    const lineHeight = fontSize * 1.8; // Extra line spacing for readability
    const textFont = boldFont; // Bold font is more readable for kids
    const words = page.text.split(' ');
    const lines: string[] = [];
    let currentLine = '';
    
    // Word wrap text
    for (const word of words) {
      const testLine = currentLine + (currentLine ? ' ' : '') + word;
      const testWidth = textFont.widthOfTextAtSize(testLine, fontSize);
      
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
    
    // Calculate total text block height
    const totalTextHeight = lines.length * lineHeight;
    
    // Center text vertically in available space
    let currentY = textAreaTop - ((textHeight - totalTextHeight) / 2);
    
    // Draw each line of text (centered horizontally)
    for (const line of lines) {
      if (currentY - lineHeight < textAreaBottom) break; // Stop if we reach bottom safe area
      
      // Center each line horizontally
      const lineWidth = textFont.widthOfTextAtSize(line, fontSize);
      const centerX = textAreaLeft + (textWidth - lineWidth) / 2;
      
      rightPage.drawText(line, {
        x: centerX,
        y: currentY - fontSize,
        size: fontSize,
        font: textFont,
        color: rgb(0.15, 0.2, 0.3), // Darker, kid-friendly color
      });
      
      currentY -= lineHeight;
    }
    
    // Add page number at bottom center (within safe area)
    const pageNumText = `${i + 1}`;
    const pageNumFontSize = 14;
    const pageNumWidth = textFont.widthOfTextAtSize(pageNumText, pageNumFontSize);
    const pageNumX = textAreaLeft + (textWidth - pageNumWidth) / 2; // Center horizontally
    rightPage.drawText(pageNumText, {
      x: pageNumX,
      y: BLEED + SAFE_MARGIN + 8, // Position within safe area
      size: pageNumFontSize,
      font: textFont,
      color: rgb(0.4, 0.4, 0.4),
    });
  }
  
  const pdfBytes = await pdfDoc.save();
  return Buffer.from(pdfBytes);
}
