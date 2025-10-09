import type { Storybook } from "@shared/schema";
import { jsPDF } from "jspdf";
import { ObjectStorageService } from "../objectStorage";

export async function generateStorybookPDF(storybook: Storybook): Promise<Buffer> {
  const doc = new jsPDF({
    orientation: "portrait",
    unit: "mm",
    format: "a4",
  });

  const pageWidth = doc.internal.pageSize.getWidth();
  const pageHeight = doc.internal.pageSize.getHeight();
  const margin = 20;
  const contentWidth = pageWidth - (2 * margin);

  // Use localhost HTTP URLs to fetch images - similar to EPUB service
  const baseUrl = "http://localhost:5000";
  const objectStorageService = new ObjectStorageService();

  // Helper function to download image as base64
  async function getImageBase64(imageUrl: string): Promise<string | null> {
    try {
      const filename = imageUrl.split('/').pop();
      if (!filename) return null;
      
      const imageBuffer = await objectStorageService.getFileBuffer(filename);
      return `data:image/png;base64,${imageBuffer.toString('base64')}`;
    } catch (error) {
      console.error('Error loading image:', error);
      return null;
    }
  }

  // Page 1: Cover page with title and author
  const coverImageUrl = storybook.coverImageUrl || storybook.pages[0]?.imageUrl;
  if (coverImageUrl) {
    const coverBase64 = await getImageBase64(coverImageUrl);
    if (coverBase64) {
      // Add cover image as background
      doc.addImage(coverBase64, 'PNG', 0, 0, pageWidth, pageHeight);
      
      // Add solid white overlay at bottom for text
      doc.setFillColor(255, 255, 255);
      doc.rect(0, pageHeight - 60, pageWidth, 60, 'F');
      
      // Add title and author text
      doc.setFontSize(28);
      doc.setFont("helvetica", "bold");
      doc.setTextColor(30, 41, 59); // #1e293b
      const titleLines = doc.splitTextToSize(storybook.title, contentWidth - 20);
      doc.text(titleLines, pageWidth / 2, pageHeight - 45, { align: 'center' });
      
      doc.setFontSize(14);
      doc.setFont("helvetica", "normal");
      doc.setTextColor(71, 85, 105); // #475569
      doc.text("By AI Storyteller", pageWidth / 2, pageHeight - 25, { align: 'center' });
    }
  } else {
    // Text-only cover if no image
    doc.setFontSize(32);
    doc.setFont("helvetica", "bold");
    doc.setTextColor(30, 41, 59);
    const titleLines = doc.splitTextToSize(storybook.title, contentWidth);
    doc.text(titleLines, pageWidth / 2, pageHeight / 2 - 20, { align: 'center' });
    
    doc.setFontSize(16);
    doc.setFont("helvetica", "normal");
    doc.setTextColor(71, 85, 105);
    doc.text("By AI Storyteller", pageWidth / 2, pageHeight / 2 + 20, { align: 'center' });
  }

  // Add story pages
  for (let i = 0; i < storybook.pages.length; i++) {
    const page = storybook.pages[i];
    
    // Add new page
    doc.addPage();
    
    // Add page image
    if (page.imageUrl) {
      const pageImageBase64 = await getImageBase64(page.imageUrl);
      if (pageImageBase64) {
        // Image takes top 60% of page
        const imageHeight = pageHeight * 0.6;
        doc.addImage(pageImageBase64, 'PNG', margin, margin, contentWidth, imageHeight - margin);
        
        // Text in bottom 40%
        const textY = imageHeight + margin;
        const textHeight = pageHeight - imageHeight - (2 * margin);
        
        // Add background for text
        doc.setFillColor(245, 241, 232); // #f5f1e8
        doc.roundedRect(margin, textY, contentWidth, textHeight, 3, 3, 'F');
        
        // Add text
        doc.setFontSize(11);
        doc.setFont("helvetica", "normal");
        doc.setTextColor(51, 65, 85); // #334155
        const textLines = doc.splitTextToSize(page.text, contentWidth - 20);
        doc.text(textLines, margin + 10, textY + 15);
      }
    } else {
      // Text-only page
      doc.setFontSize(12);
      doc.setFont("helvetica", "normal");
      doc.setTextColor(51, 65, 85);
      const textLines = doc.splitTextToSize(page.text, contentWidth);
      doc.text(textLines, margin, margin + 20);
    }
  }

  // Convert PDF to Buffer
  const pdfArrayBuffer = doc.output('arraybuffer');
  return Buffer.from(pdfArrayBuffer);
}
