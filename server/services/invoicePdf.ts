import { PDFDocument, rgb, StandardFonts } from 'pdf-lib';
import { format } from 'date-fns';

interface InvoiceItem {
  title: string;
  size: string;
  price: number;
}

interface InvoiceData {
  orderId: string;
  orderDate: string;
  items: InvoiceItem[];
  totalAmount: number;
}

/**
 * Generate an invoice PDF for an order
 */
export async function generateInvoicePDF(invoiceData: InvoiceData): Promise<Buffer> {
  const pdfDoc = await PDFDocument.create();
  
  // Add a page
  const page = pdfDoc.addPage([612, 792]); // Letter size in points
  const { width, height } = page.getSize();
  
  // Load fonts
  const boldFont = await pdfDoc.embedFont(StandardFonts.HelveticaBold);
  const regularFont = await pdfDoc.embedFont(StandardFonts.Helvetica);
  
  // Colors
  const primaryColor = rgb(0.4, 0.3, 0.8); // Purple
  const darkGray = rgb(0.2, 0.2, 0.2);
  const lightGray = rgb(0.5, 0.5, 0.5);
  
  // Starting Y position from top
  let y = height - 60;
  
  // Company Header
  page.drawText('AI Storybook Builder', {
    x: 50,
    y,
    size: 24,
    font: boldFont,
    color: primaryColor,
  });
  
  y -= 20;
  page.drawText('Order Invoice', {
    x: 50,
    y,
    size: 16,
    font: boldFont,
    color: darkGray,
  });
  
  // Order Info (right aligned)
  const rightX = width - 50;
  page.drawText(`Invoice Date: ${format(new Date(), 'MMMM d, yyyy')}`, {
    x: rightX - 200,
    y: height - 60,
    size: 10,
    font: regularFont,
    color: darkGray,
  });
  
  page.drawText(`Order #: ${invoiceData.orderId.slice(-8).toUpperCase()}`, {
    x: rightX - 200,
    y: height - 75,
    size: 10,
    font: regularFont,
    color: darkGray,
  });
  
  page.drawText(`Order Date: ${invoiceData.orderDate}`, {
    x: rightX - 200,
    y: height - 90,
    size: 10,
    font: regularFont,
    color: darkGray,
  });
  
  y -= 80;
  
  // Horizontal line
  page.drawLine({
    start: { x: 50, y },
    end: { x: width - 50, y },
    thickness: 1,
    color: lightGray,
  });
  
  y -= 40;
  
  // Items header
  page.drawText('Description', {
    x: 50,
    y,
    size: 11,
    font: boldFont,
    color: darkGray,
  });
  
  page.drawText('Format', {
    x: 350,
    y,
    size: 11,
    font: boldFont,
    color: darkGray,
  });
  
  page.drawText('Amount', {
    x: rightX - 80,
    y,
    size: 11,
    font: boldFont,
    color: darkGray,
  });
  
  y -= 5;
  
  // Line under headers
  page.drawLine({
    start: { x: 50, y },
    end: { x: width - 50, y },
    thickness: 1,
    color: lightGray,
  });
  
  y -= 30;
  
  // Helper function to draw table headers on a page
  const drawTableHeaders = (targetPage: any, yPos: number) => {
    const { width, height } = targetPage.getSize();
    const pageRightX = width - 50;
    
    // Items header
    targetPage.drawText('Description', {
      x: 50,
      y: yPos,
      size: 11,
      font: boldFont,
      color: darkGray,
    });
    
    targetPage.drawText('Format', {
      x: 350,
      y: yPos,
      size: 11,
      font: boldFont,
      color: darkGray,
    });
    
    targetPage.drawText('Amount', {
      x: pageRightX - 80,
      y: yPos,
      size: 11,
      font: boldFont,
      color: darkGray,
    });
    
    // Line under headers
    targetPage.drawLine({
      start: { x: 50, y: yPos - 5 },
      end: { x: width - 50, y: yPos - 5 },
      thickness: 1,
      color: lightGray,
    });
    
    return yPos - 35; // Return new Y position after headers
  };
  
  // Items
  let currentPage = page;
  for (const item of invoiceData.items) {
    // Check if we need a new page
    if (y < 150) {
      currentPage = pdfDoc.addPage([612, 792]);
      const { height: newHeight } = currentPage.getSize();
      y = newHeight - 60;
      
      // Draw headers on new page
      y = drawTableHeaders(currentPage, y);
    }
    
    // Title (with wrapping if too long)
    let title = item.title;
    if (title.length > 50) {
      title = title.substring(0, 47) + '...';
    }
    
    currentPage.drawText(title, {
      x: 50,
      y,
      size: 10,
      font: regularFont,
      color: darkGray,
    });
    
    // Format
    const formatText = item.size.replace(/-/g, ' ').replace(/\b\w/g, l => l.toUpperCase());
    currentPage.drawText(formatText, {
      x: 350,
      y,
      size: 10,
      font: regularFont,
      color: darkGray,
    });
    
    // Price
    const priceText = `$${(item.price / 100).toFixed(2)}`;
    const priceWidth = regularFont.widthOfTextAtSize(priceText, 10);
    currentPage.drawText(priceText, {
      x: rightX - priceWidth - 30,
      y,
      size: 10,
      font: regularFont,
      color: darkGray,
    });
    
    y -= 25;
  }
  
  y -= 20;
  
  // Subtotal line
  currentPage.drawLine({
    start: { x: width - 200, y },
    end: { x: width - 50, y },
    thickness: 1,
    color: lightGray,
  });
  
  y -= 25;
  
  // Subtotal
  currentPage.drawText('Subtotal:', {
    x: rightX - 180,
    y,
    size: 11,
    font: boldFont,
    color: darkGray,
  });
  
  const subtotalText = `$${(invoiceData.totalAmount / 100).toFixed(2)}`;
  const subtotalWidth = boldFont.widthOfTextAtSize(subtotalText, 11);
  currentPage.drawText(subtotalText, {
    x: rightX - subtotalWidth - 30,
    y,
    size: 11,
    font: boldFont,
    color: darkGray,
  });
  
  y -= 15;
  
  // Note about shipping (Prodigi includes shipping/tax in item price)
  currentPage.drawText('(Shipping & Tax included in item prices)', {
    x: rightX - 280,
    y,
    size: 9,
    font: regularFont,
    color: lightGray,
  });
  
  y -= 25;
  
  // Total line
  currentPage.drawLine({
    start: { x: width - 200, y },
    end: { x: width - 50, y },
    thickness: 2,
    color: darkGray,
  });
  
  y -= 30;
  
  // Order Total
  currentPage.drawText('Order Total:', {
    x: rightX - 180,
    y,
    size: 14,
    font: boldFont,
    color: primaryColor,
  });
  
  const totalText = `$${(invoiceData.totalAmount / 100).toFixed(2)}`;
  const totalWidth = boldFont.widthOfTextAtSize(totalText, 14);
  currentPage.drawText(totalText, {
    x: rightX - totalWidth - 30,
    y,
    size: 14,
    font: boldFont,
    color: primaryColor,
  });
  
  // Footer on the last/current page
  const footerY = 50;
  currentPage.drawText('Thank you for your order!', {
    x: 50,
    y: footerY + 20,
    size: 10,
    font: regularFont,
    color: lightGray,
  });
  
  currentPage.drawText('AI Storybook Builder - Personalized Children\'s Storybooks', {
    x: 50,
    y: footerY,
    size: 8,
    font: regularFont,
    color: lightGray,
  });
  
  // Serialize the PDF
  const pdfBytes = await pdfDoc.save();
  return Buffer.from(pdfBytes);
}
