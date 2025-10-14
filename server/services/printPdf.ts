import { PDFDocument, rgb, StandardFonts } from 'pdf-lib';
import fontkit from '@pdf-lib/fontkit';
import type { Storybook } from "@shared/schema";
import { ObjectStorageService } from "../objectStorage";
import { readFileSync } from 'fs';
import { join } from 'path';

// Constants in points (72 points = 1 inch)
const INCH_TO_POINTS = 72;
const TRIM_WIDTH = 6 * INCH_TO_POINTS;  // 432 points
const TRIM_HEIGHT = 9 * INCH_TO_POINTS;  // 648 points
const BLEED = 0.125 * INCH_TO_POINTS;    // 9 points
const PAGE_WIDTH = TRIM_WIDTH + (2 * BLEED);  // 450 points
const PAGE_HEIGHT = TRIM_HEIGHT + (2 * BLEED); // 666 points
const SAFE_MARGIN = 0.5 * INCH_TO_POINTS;      // 36 points from trim edge
const SPINE_MARGIN = 0.75 * INCH_TO_POINTS;    // 54 points on spine side

// Cache font bytes to avoid blocking event loop with repeated readFileSync
let cachedComicNeueFontBytes: ArrayBuffer | null = null;

export async function generatePrintReadyPDF(storybook: Storybook): Promise<Buffer> {
  const pdfDoc = await PDFDocument.create();
  
  // Register fontkit to enable custom font embedding
  pdfDoc.registerFontkit(fontkit);
  
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
  
  // Load kid-friendly Comic Neue font for ages 6-12 (cached for performance)
  if (!cachedComicNeueFontBytes) {
    const fontPath = join(process.cwd(), 'server', 'fonts', 'ComicNeue-Regular.ttf');
    cachedComicNeueFontBytes = readFileSync(fontPath);
  }
  const font = await pdfDoc.embedFont(cachedComicNeueFontBytes);
  const boldFont = await pdfDoc.embedFont(StandardFonts.HelveticaBold); // Keep bold for titles
  
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
    const textX = BLEED + SPINE_MARGIN; // Left margin from trim (spine side)
    const textY = PAGE_HEIGHT - BLEED - SAFE_MARGIN; // Top margin from trim
    const textWidth = PAGE_WIDTH - BLEED - SPINE_MARGIN - BLEED - SAFE_MARGIN; // Width between margins
    const textHeight = PAGE_HEIGHT - 2 * BLEED - 2 * SAFE_MARGIN; // Height between top and bottom safe areas
    
    // Render text if page has content (skip for image-only pages)
    const pageText = page.text || '';
    if (pageText.trim()) {
      // Format and draw text - kid-friendly sizing and centered vertically
      const fontSize = 16; // Larger font for kids ages 6-12
      const lineHeight = fontSize * 1.8; // More spacing for easier reading
      const words = pageText.split(' ');
      const lines: string[] = [];
      let currentLine = '';
      
      // Word wrap text
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
      
      // Calculate total text height to center it vertically (only if it fits)
      const totalTextHeight = lines.length * lineHeight;
      const availableHeight = textHeight;
      // Only center if text fits in available space; otherwise top-align to ensure all text renders
      const verticalOffset = totalTextHeight <= availableHeight 
        ? (availableHeight - totalTextHeight) / 2 
        : 0;
      
      // Start drawing from centered position (or top if text is too long)
      let currentY = textY - verticalOffset;
      
      // Draw each line of text
      for (const line of lines) {
        // Check if there's room for this line (baseline must be above safe margin)
        if (currentY - fontSize < BLEED + SAFE_MARGIN) break;
        
        rightPage.drawText(line, {
          x: textX,
          y: currentY - fontSize,
          size: fontSize,
          font: font,
          color: rgb(0.15, 0.2, 0.28), // Slightly softer color for kids
        });
        
        currentY -= lineHeight;
      }
    }
    
    // Add page number at bottom (within safe area) - kid-friendly style
    const pageNumText = `${i + 1}`;
    const pageNumSize = 12; // Slightly larger for kids
    const pageNumX = PAGE_WIDTH - BLEED - SAFE_MARGIN - font.widthOfTextAtSize(pageNumText, pageNumSize);
    rightPage.drawText(pageNumText, {
      x: pageNumX,
      y: BLEED + SAFE_MARGIN + 10, // Position within safe area, 10pts above safe margin
      size: pageNumSize,
      font: font,
      color: rgb(0.5, 0.5, 0.5),
    });
  }
  
  // Add end page (no page number)
  const endPage = pdfDoc.addPage([PAGE_WIDTH, PAGE_HEIGHT]);
  
  // Create gradient-like background with soft colors
  endPage.drawRectangle({
    x: 0,
    y: 0,
    width: PAGE_WIDTH,
    height: PAGE_HEIGHT,
    color: rgb(0.976, 0.969, 0.953), // #f9f7f3
  });
  
  // Draw "The End" text centered
  const endText = "The End";
  const endFontSize = 36;
  const endTextWidth = boldFont.widthOfTextAtSize(endText, endFontSize);
  
  endPage.drawText(endText, {
    x: PAGE_WIDTH / 2 - endTextWidth / 2,
    y: PAGE_HEIGHT / 2,
    size: endFontSize,
    font: boldFont,
    color: rgb(0.2, 0.25, 0.31), // Slate 800
  });
  
  const pdfBytes = await pdfDoc.save();
  return Buffer.from(pdfBytes);
}
