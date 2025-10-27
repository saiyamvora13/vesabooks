import { Resend } from 'resend';
import type { Storybook, Purchase } from '@shared/schema';
import { storage } from '../storage';
import { getEmailTranslations, replacePlaceholders } from '../email-translations';
import { generatePrintReadyPDF } from './printPdf';

let connectionSettings: any;

async function getCredentials() {
  const hostname = process.env.REPLIT_CONNECTORS_HOSTNAME;
  const xReplitToken = process.env.REPL_IDENTITY 
    ? 'repl ' + process.env.REPL_IDENTITY 
    : process.env.WEB_REPL_RENEWAL 
    ? 'depl ' + process.env.WEB_REPL_RENEWAL 
    : null;

  if (!xReplitToken) {
    throw new Error('X_REPLIT_TOKEN not found for repl/depl');
  }

  connectionSettings = await fetch(
    'https://' + hostname + '/api/v2/connection?include_secrets=true&connector_names=resend',
    {
      headers: {
        'Accept': 'application/json',
        'X_REPLIT_TOKEN': xReplitToken
      }
    }
  ).then(res => res.json()).then(data => data.items?.[0]);

  if (!connectionSettings || (!connectionSettings.settings.api_key)) {
    throw new Error('Resend not connected');
  }
  return {apiKey: connectionSettings.settings.api_key, fromEmail: connectionSettings.settings.from_email};
}

// WARNING: Never cache this client.
// Access tokens expire, so a new client must be created each time.
// Always call this function again to get a fresh client.
async function getUncachableResendClient() {
  const credentials = await getCredentials();
  return {
    client: new Resend(credentials.apiKey),
    fromEmail: connectionSettings.settings.from_email
  };
}

export async function sendInvoiceEmail(
  userEmail: string,
  userName: string,
  purchases: Purchase[],
  paymentIntentId: string,
  language: string = 'en'
): Promise<void> {
  const { client, fromEmail } = await getUncachableResendClient();
  
  // Use orderReference if available, otherwise fallback to paymentIntentId
  const orderRef = purchases[0]?.orderReference || paymentIntentId;
  const invoiceNumber = orderRef.slice(-8).toUpperCase();
  
  const t = getEmailTranslations(language, 'invoice');
  
  // Format date in the appropriate language
  const localeMap: { [key: string]: string } = {
    en: 'en-US',
    es: 'es-ES',
    fr: 'fr-FR',
    de: 'de-DE',
    zh: 'zh-CN'
  };
  const locale = localeMap[language.substring(0, 2)] || 'en-US';
  
  const invoiceDate = new Date().toLocaleDateString(locale, { 
    year: 'numeric', 
    month: 'long', 
    day: 'numeric' 
  });
  
  const purchaseItems = await Promise.all(
    purchases.map(async (purchase) => {
      const storybook = await storage.getStorybook(purchase.storybookId);
      return {
        title: storybook?.title || 'Unknown Storybook',
        type: purchase.type === 'digital' ? t.digitalEdition : t.printEdition,
        price: parseFloat(purchase.price),
      };
    })
  );
  
  const subtotal = purchaseItems.reduce((sum, item) => sum + item.price, 0);
  const total = subtotal;
  
  const formatPrice = (cents: number) => `$${(cents / 100).toFixed(2)}`;
  
  const itemsHtml = purchaseItems.map(item => `
    <tr>
      <td style="padding: 12px; border-bottom: 1px solid #e5e7eb; color: #374151;">
        ${item.title}<br>
        <span style="font-size: 14px; color: #6b7280;">${item.type}</span>
      </td>
      <td style="padding: 12px; border-bottom: 1px solid #e5e7eb; text-align: right; color: #374151;">
        ${formatPrice(item.price)}
      </td>
    </tr>
  `).join('');
  
  const htmlBody = `
    <div style="font-family: 'Segoe UI', Tahoma, Geneva, Verdana, sans-serif; max-width: 650px; margin: 0 auto; padding: 20px; background-color: #ffffff;">
      <div style="background-color: hsl(258, 90%, 20%); color: #ffffff; padding: 30px; text-align: center; border-radius: 8px 8px 0 0;">
        <h1 style="margin: 0; font-size: 32px; font-weight: 600;">${t.invoiceTitle}</h1>
        <p style="margin: 10px 0 0 0; font-size: 18px; opacity: 0.9;">${replacePlaceholders(t.subject, { invoiceNumber })}</p>
      </div>
      
      <div style="background-color: #f9f7f3; padding: 25px; border-radius: 0 0 8px 8px;">
        <div style="margin-bottom: 25px;">
          <p style="margin: 0 0 5px 0; color: #6b7280; font-size: 14px;">${t.invoiceDate}</p>
          <p style="margin: 0; color: #111827; font-size: 16px; font-weight: 500;">${invoiceDate}</p>
        </div>
        
        <div style="margin-bottom: 25px;">
          <p style="margin: 0 0 5px 0; color: #6b7280; font-size: 14px;">${t.customerDetails}</p>
          <p style="margin: 0; color: #111827; font-size: 16px; font-weight: 500;">${userName}</p>
          <p style="margin: 5px 0 0 0; color: #374151; font-size: 14px;">${userEmail}</p>
        </div>
      </div>
      
      <div style="margin-top: 30px;">
        <table style="width: 100%; border-collapse: collapse; background-color: #ffffff; border: 1px solid #e5e7eb; border-radius: 8px; overflow: hidden;">
          <thead>
            <tr style="background-color: hsl(258, 90%, 20%); color: #ffffff;">
              <th style="padding: 15px; text-align: left; font-weight: 600;">${t.item}</th>
              <th style="padding: 15px; text-align: right; font-weight: 600;">${t.price}</th>
            </tr>
          </thead>
          <tbody>
            ${itemsHtml}
          </tbody>
          <tfoot>
            <tr style="background-color: #f9f7f3;">
              <td style="padding: 15px; font-weight: 600; color: #111827; border-top: 2px solid hsl(258, 90%, 20%);">
                ${t.subtotal}
              </td>
              <td style="padding: 15px; text-align: right; font-weight: 600; color: #111827; border-top: 2px solid hsl(258, 90%, 20%);">
                ${formatPrice(subtotal)}
              </td>
            </tr>
            <tr style="background-color: hsl(258, 90%, 20%); color: #ffffff;">
              <td style="padding: 15px; font-weight: 700; font-size: 18px;">
                ${t.total}
              </td>
              <td style="padding: 15px; text-align: right; font-weight: 700; font-size: 18px;">
                ${formatPrice(total)}
              </td>
            </tr>
          </tfoot>
        </table>
      </div>
      
      <div style="margin-top: 30px; padding: 20px; background-color: #f9f7f3; border-radius: 8px;">
        <p style="margin: 0 0 10px 0; color: #6b7280; font-size: 14px;">${t.paymentMethod}</p>
        <p style="margin: 0; color: #111827; font-size: 16px; font-weight: 500;">${t.paidVia}</p>
      </div>
      
      <div style="margin-top: 30px; padding: 20px; text-align: center; border-top: 1px solid #e5e7eb;">
        <p style="margin: 0 0 10px 0; color: #374151; font-size: 14px;">
          ${t.thankYou}
        </p>
        <p style="margin: 0; color: #6b7280; font-size: 14px;">
          ${t.visitWebsite} <a href="[WEBSITE_URL_PLACEHOLDER]" style="color: hsl(258, 90%, 20%); text-decoration: none;">[WEBSITE_URL_PLACEHOLDER]</a>
        </p>
      </div>
      
      <div style="margin-top: 20px; padding: 15px; text-align: center;">
        <p style="margin: 0; color: #9ca3af; font-size: 12px;">
          ${t.disclaimer}
        </p>
      </div>
    </div>
  `;

  // Generate PDFs for print purchases
  const attachments: Array<{ filename: string; content: Buffer }> = [];
  
  for (const purchase of purchases) {
    if (purchase.type === 'print') {
      const storybook = await storage.getStorybook(purchase.storybookId);
      if (storybook) {
        // Use print purchase settings, or defaults
        const bookSize = purchase.bookSize || 'a5-portrait';
        const spineText = purchase.spineText || undefined;
        const spineTextColor = purchase.spineTextColor || undefined;
        const spineBackgroundColor = purchase.spineBackgroundColor || undefined;
        const pdfBuffer = await generatePrintReadyPDF(storybook, bookSize, spineText, spineTextColor, spineBackgroundColor);
        const filename = `${storybook.title.replace(/[^a-z0-9]/gi, '_').toLowerCase()}-print.pdf`;
        attachments.push({
          filename,
          content: pdfBuffer,
        });
      }
    }
  }

  await client.emails.send({
    from: fromEmail,
    to: userEmail,
    subject: replacePlaceholders(t.subject, { invoiceNumber }),
    html: htmlBody,
    ...(attachments.length > 0 && { attachments }),
  });
}

export async function sendPasswordResetEmail(
  userEmail: string,
  resetToken: string,
  userName: string,
  language: string = 'en'
): Promise<void> {
  const { client, fromEmail } = await getUncachableResendClient();
  
  const resetLink = `https://${process.env.REPLIT_DOMAINS?.split(',')[0]}/reset-password?token=${resetToken}`;
  
  const t = getEmailTranslations(language, 'passwordReset');
  
  const htmlBody = `
    <div style="font-family: 'Segoe UI', Tahoma, Geneva, Verdana, sans-serif; max-width: 650px; margin: 0 auto; padding: 20px; background-color: #ffffff;">
      <div style="background-color: hsl(258, 90%, 20%); color: #ffffff; padding: 30px; text-align: center; border-radius: 8px 8px 0 0;">
        <h1 style="margin: 0; font-size: 32px; font-weight: 600;">${t.subject.split(' - ')[0]}</h1>
      </div>
      
      <div style="background-color: #f9f7f3; padding: 30px; border-radius: 0 0 8px 8px;">
        <p style="color: #374151; font-size: 16px; line-height: 1.6; margin: 0 0 20px 0;">
          ${replacePlaceholders(t.greeting || 'Hi {name},', { name: userName })}
        </p>
        
        <p style="color: #374151; font-size: 16px; line-height: 1.6; margin: 0 0 20px 0;">
          ${t.body1}
        </p>
        
        <div style="text-align: center; margin: 30px 0;">
          <a href="${resetLink}" style="background-color: hsl(258, 90%, 20%); color: #ffffff; padding: 14px 28px; text-decoration: none; border-radius: 6px; font-size: 16px; font-weight: 600; display: inline-block;">
            ${t.buttonText}
          </a>
        </div>
        
        <p style="color: #6b7280; font-size: 14px; line-height: 1.6; margin: 20px 0 0 0;">
          ${t.expiryText}
        </p>
        
        <p style="color: #6b7280; font-size: 14px; line-height: 1.6; margin: 20px 0 0 0;">
          ${t.securityNote}
        </p>
      </div>
      
      <div style="margin-top: 30px; padding: 20px; text-align: center; border-top: 1px solid #e5e7eb;">
        <p style="margin: 0; color: #374151; font-size: 14px;">
          ${t.closing}<br>
          <strong>${t.team}</strong>
        </p>
      </div>
      
      <div style="margin-top: 20px; padding: 15px; text-align: center;">
        <p style="margin: 0; color: #9ca3af; font-size: 12px;">
          ${t.disclaimer}
        </p>
      </div>
    </div>
  `;

  await client.emails.send({
    from: fromEmail,
    to: userEmail,
    subject: t.subject,
    html: htmlBody,
  });
}

export async function sendPrintOrderConfirmation(params: {
  recipientEmail: string;
  recipientName: string;
  storybookTitle: string;
  storybookCoverUrl: string;
  orderId: string;
  bookSize: string;
  shippingMethod: string;
  recipientAddress: string;
  estimatedProduction: string;
}): Promise<void> {
  const { client, fromEmail } = await getUncachableResendClient();
  
  const {
    recipientEmail,
    recipientName,
    storybookTitle,
    storybookCoverUrl,
    orderId,
    bookSize,
    shippingMethod,
    recipientAddress,
    estimatedProduction,
  } = params;
  
  const htmlBody = `
    <!DOCTYPE html>
    <html>
    <head>
      <meta charset="utf-8">
      <meta name="viewport" content="width=device-width, initial-scale=1.0">
    </head>
    <body style="margin: 0; padding: 0; font-family: 'Segoe UI', Tahoma, Geneva, Verdana, sans-serif; background-color: #f5f5f5;">
      <table width="100%" cellpadding="0" cellspacing="0" style="background-color: #f5f5f5;">
        <tr>
          <td align="center" style="padding: 40px 20px;">
            <table width="600" cellpadding="0" cellspacing="0" style="background-color: white; border-radius: 8px; box-shadow: 0 2px 8px rgba(0,0,0,0.1); max-width: 600px;">
              <!-- Header -->
              <tr>
                <td style="background-color: hsl(258, 90%, 20%); color: #ffffff; padding: 40px 30px; text-align: center; border-radius: 8px 8px 0 0;">
                  <h1 style="margin: 0; font-size: 32px; font-weight: 600;">Order Confirmed! ✓</h1>
                  <p style="margin: 15px 0 0 0; font-size: 16px; opacity: 0.9;">Order #${orderId.slice(-8).toUpperCase()}</p>
                </td>
              </tr>
              
              <!-- Greeting -->
              <tr>
                <td style="padding: 30px 30px 20px 30px;">
                  <p style="margin: 0; color: #374151; font-size: 16px; line-height: 1.6;">
                    Hi ${recipientName},
                  </p>
                  <p style="margin: 15px 0 0 0; color: #374151; font-size: 16px; line-height: 1.6;">
                    Thank you for your print order! We've received your order and it's being prepared for production.
                  </p>
                </td>
              </tr>
              
              <!-- Storybook Info -->
              <tr>
                <td style="padding: 20px 30px;">
                  <table width="100%" cellpadding="0" cellspacing="0" style="background-color: #f9f7f3; border-radius: 8px; overflow: hidden;">
                    <tr>
                      <td align="center" style="padding: 20px;">
                        <img src="${storybookCoverUrl}" alt="${storybookTitle}" style="max-width: 200px; height: auto; border-radius: 4px; box-shadow: 0 2px 4px rgba(0,0,0,0.1);" />
                        <h2 style="margin: 20px 0 0 0; color: #111827; font-size: 20px; font-weight: 600;">${storybookTitle}</h2>
                      </td>
                    </tr>
                  </table>
                </td>
              </tr>
              
              <!-- Order Details -->
              <tr>
                <td style="padding: 20px 30px;">
                  <h3 style="margin: 0 0 15px 0; color: #111827; font-size: 18px; font-weight: 600;">Order Details</h3>
                  <table width="100%" cellpadding="0" cellspacing="0" style="background-color: #ffffff; border: 2px solid hsl(258, 90%, 20%); border-radius: 8px;">
                    <tr>
                      <td style="padding: 15px 20px; border-bottom: 1px solid #e5e7eb;">
                        <p style="margin: 0 0 5px 0; color: #6b7280; font-size: 14px;">Book Size</p>
                        <p style="margin: 0; color: #111827; font-size: 16px; font-weight: 500;">${bookSize}</p>
                      </td>
                    </tr>
                    <tr>
                      <td style="padding: 15px 20px; border-bottom: 1px solid #e5e7eb;">
                        <p style="margin: 0 0 5px 0; color: #6b7280; font-size: 14px;">Shipping Method</p>
                        <p style="margin: 0; color: #111827; font-size: 16px; font-weight: 500;">${shippingMethod}</p>
                      </td>
                    </tr>
                    <tr>
                      <td style="padding: 15px 20px; border-bottom: 1px solid #e5e7eb;">
                        <p style="margin: 0 0 5px 0; color: #6b7280; font-size: 14px;">Shipping Address</p>
                        <p style="margin: 0; color: #111827; font-size: 14px; line-height: 1.5;">${recipientAddress}</p>
                      </td>
                    </tr>
                    <tr>
                      <td style="padding: 15px 20px;">
                        <p style="margin: 0 0 5px 0; color: #6b7280; font-size: 14px;">Estimated Production Time</p>
                        <p style="margin: 0; color: #111827; font-size: 16px; font-weight: 500;">${estimatedProduction}</p>
                      </td>
                    </tr>
                  </table>
                </td>
              </tr>
              
              <!-- What's Next -->
              <tr>
                <td style="padding: 20px 30px;">
                  <h3 style="margin: 0 0 15px 0; color: #111827; font-size: 18px; font-weight: 600;">What Happens Next?</h3>
                  <table width="100%" cellpadding="0" cellspacing="0">
                    <tr>
                      <td style="padding: 10px 0;">
                        <p style="margin: 0; color: #374151; font-size: 14px; line-height: 1.6;">
                          <strong style="color: #111827;">1. Production</strong><br />
                          Your personalized hardcover book is being professionally printed and bound.
                        </p>
                      </td>
                    </tr>
                    <tr>
                      <td style="padding: 10px 0;">
                        <p style="margin: 0; color: #374151; font-size: 14px; line-height: 1.6;">
                          <strong style="color: #111827;">2. Quality Check</strong><br />
                          Each book goes through our quality control process to ensure perfection.
                        </p>
                      </td>
                    </tr>
                    <tr>
                      <td style="padding: 10px 0;">
                        <p style="margin: 0; color: #374151; font-size: 14px; line-height: 1.6;">
                          <strong style="color: #111827;">3. Shipping Notification</strong><br />
                          We'll email you tracking information as soon as your book ships.
                        </p>
                      </td>
                    </tr>
                  </table>
                </td>
              </tr>
              
              <!-- Footer -->
              <tr>
                <td style="padding: 20px 30px; border-top: 1px solid #e5e7eb; text-align: center;">
                  <p style="margin: 0 0 10px 0; color: #374151; font-size: 14px;">
                    Thank you for using StoryBook AI!<br />
                    Questions? Contact us at <a href="mailto:support@vesabooks.com" style="color: hsl(258, 90%, 20%); text-decoration: none;">support@vesabooks.com</a>
                  </p>
                  <p style="margin: 15px 0 0 0; color: #9ca3af; font-size: 12px;">
                    This is an automated email. Please do not reply to this email.
                  </p>
                </td>
              </tr>
            </table>
          </td>
        </tr>
      </table>
    </body>
    </html>
  `;

  await client.emails.send({
    from: fromEmail,
    to: recipientEmail,
    subject: `Order Confirmed - ${storybookTitle} - Print Edition`,
    html: htmlBody,
  });
}

export async function sendShippingNotification(params: {
  recipientEmail: string;
  recipientName: string;
  storybookTitle: string;
  storybookCoverUrl: string;
  orderId: string;
  trackingNumber: string;
  trackingUrl: string;
  carrier: string;
  carrierService: string;
  estimatedDelivery: Date;
}): Promise<void> {
  const { client, fromEmail } = await getUncachableResendClient();
  
  const {
    recipientEmail,
    recipientName,
    storybookTitle,
    storybookCoverUrl,
    orderId,
    trackingNumber,
    trackingUrl,
    carrier,
    carrierService,
    estimatedDelivery,
  } = params;
  
  const formattedDeliveryDate = new Date(estimatedDelivery).toLocaleDateString('en-US', {
    year: 'numeric',
    month: 'long',
    day: 'numeric'
  });
  
  const htmlBody = `
    <!DOCTYPE html>
    <html>
    <head>
      <meta charset="utf-8">
      <meta name="viewport" content="width=device-width, initial-scale=1.0">
    </head>
    <body style="margin: 0; padding: 0; font-family: 'Segoe UI', Tahoma, Geneva, Verdana, sans-serif; background-color: #f5f5f5;">
      <table width="100%" cellpadding="0" cellspacing="0" style="background-color: #f5f5f5;">
        <tr>
          <td align="center" style="padding: 40px 20px;">
            <table width="600" cellpadding="0" cellspacing="0" style="background-color: white; border-radius: 8px; box-shadow: 0 2px 8px rgba(0,0,0,0.1); max-width: 600px;">
              <!-- Header -->
              <tr>
                <td style="background-color: hsl(258, 90%, 20%); color: #ffffff; padding: 40px 30px; text-align: center; border-radius: 8px 8px 0 0;">
                  <h1 style="margin: 0; font-size: 32px; font-weight: 600;">Your Order Has Shipped! 📦</h1>
                  <p style="margin: 15px 0 0 0; font-size: 16px; opacity: 0.9;">Order #${orderId.slice(-8).toUpperCase()}</p>
                </td>
              </tr>
              
              <!-- Greeting -->
              <tr>
                <td style="padding: 30px 30px 20px 30px;">
                  <p style="margin: 0; color: #374151; font-size: 16px; line-height: 1.6;">
                    Hi ${recipientName},
                  </p>
                  <p style="margin: 15px 0 0 0; color: #374151; font-size: 16px; line-height: 1.6;">
                    Great news! Your personalized storybook has shipped and is on its way to you.
                  </p>
                </td>
              </tr>
              
              <!-- Storybook Info -->
              <tr>
                <td style="padding: 20px 30px;">
                  <table width="100%" cellpadding="0" cellspacing="0" style="background-color: #f9f7f3; border-radius: 8px; overflow: hidden;">
                    <tr>
                      <td align="center" style="padding: 20px;">
                        <img src="${storybookCoverUrl}" alt="${storybookTitle}" style="max-width: 200px; height: auto; border-radius: 4px; box-shadow: 0 2px 4px rgba(0,0,0,0.1);" />
                        <h2 style="margin: 20px 0 0 0; color: #111827; font-size: 20px; font-weight: 600;">${storybookTitle}</h2>
                      </td>
                    </tr>
                  </table>
                </td>
              </tr>
              
              <!-- Shipping Information -->
              <tr>
                <td style="padding: 20px 30px;">
                  <h3 style="margin: 0 0 15px 0; color: #111827; font-size: 18px; font-weight: 600;">Shipping Information</h3>
                  <table width="100%" cellpadding="0" cellspacing="0" style="background-color: #ffffff; border: 2px solid hsl(258, 90%, 20%); border-radius: 8px;">
                    <tr>
                      <td style="padding: 15px 20px; border-bottom: 1px solid #e5e7eb;">
                        <p style="margin: 0 0 5px 0; color: #6b7280; font-size: 14px;">Tracking Number</p>
                        <p style="margin: 0;">
                          <a href="${trackingUrl}" style="color: hsl(258, 90%, 20%); text-decoration: none; font-weight: 600; font-size: 16px;">${trackingNumber}</a>
                        </p>
                      </td>
                    </tr>
                    <tr>
                      <td style="padding: 15px 20px; border-bottom: 1px solid #e5e7eb;">
                        <p style="margin: 0 0 5px 0; color: #6b7280; font-size: 14px;">Carrier</p>
                        <p style="margin: 0; color: #111827; font-size: 16px; font-weight: 500;">${carrier} - ${carrierService}</p>
                      </td>
                    </tr>
                    <tr>
                      <td style="padding: 15px 20px;">
                        <p style="margin: 0 0 5px 0; color: #6b7280; font-size: 14px;">Estimated Delivery</p>
                        <p style="margin: 0; color: #111827; font-size: 16px; font-weight: 500;">${formattedDeliveryDate}</p>
                      </td>
                    </tr>
                  </table>
                </td>
              </tr>
              
              <!-- CTA Button -->
              <tr>
                <td style="padding: 20px 30px 30px 30px; text-align: center;">
                  <a href="${trackingUrl}" style="display: inline-block; background-color: hsl(258, 90%, 20%); color: #ffffff; padding: 16px 32px; text-decoration: none; border-radius: 6px; font-size: 16px; font-weight: 600;">Track Your Package</a>
                </td>
              </tr>
              
              <!-- Footer -->
              <tr>
                <td style="padding: 20px 30px; border-top: 1px solid #e5e7eb; text-align: center;">
                  <p style="margin: 0 0 10px 0; color: #374151; font-size: 14px;">
                    Thank you for using StoryBook AI!
                  </p>
                  <p style="margin: 0; color: #6b7280; font-size: 14px;">
                    We hope you love your personalized storybook.
                  </p>
                </td>
              </tr>
              
              <!-- Disclaimer -->
              <tr>
                <td style="padding: 20px 30px; text-align: center;">
                  <p style="margin: 0; color: #9ca3af; font-size: 12px; line-height: 1.5;">
                    This is an automated shipping notification. Please do not reply to this email.<br>
                    If you have any questions, please contact our support team.
                  </p>
                </td>
              </tr>
            </table>
          </td>
        </tr>
      </table>
    </body>
    </html>
  `;

  await client.emails.send({
    from: fromEmail,
    to: recipientEmail,
    subject: 'Your StoryBook Order Has Shipped! 📦',
    html: htmlBody,
  });
  
  console.log(`✅ Shipping notification sent to ${recipientEmail} for order ${orderId}`);
}

export async function sendOrderCancelledEmail(
  userEmail: string,
  userName: string,
  storybookTitle: string,
  printOrderId: string,
  paymentIntentId: string,
  language: string = 'en'
): Promise<void> {
  const { client, fromEmail } = await getUncachableResendClient();
  
  const t = getEmailTranslations(language, 'orderCancelled');
  
  const htmlBody = `
    <div style="font-family: 'Segoe UI', Tahoma, Geneva, Verdana, sans-serif; max-width: 650px; margin: 0 auto; padding: 20px; background-color: #ffffff;">
      <div style="background-color: #dc2626; color: #ffffff; padding: 30px; text-align: center; border-radius: 8px 8px 0 0;">
        <h1 style="margin: 0; font-size: 32px; font-weight: 600;">⚠️ Order Cancelled</h1>
      </div>
      
      <div style="background-color: #f9f7f3; padding: 30px; border-radius: 0 0 8px 8px;">
        <p style="color: #374151; font-size: 16px; line-height: 1.6; margin: 0 0 20px 0;">
          ${replacePlaceholders(t.greeting || 'Hi {name},', { name: userName })}
        </p>
        
        <p style="color: #374151; font-size: 16px; line-height: 1.6; margin: 0 0 20px 0;">
          ${replacePlaceholders(t.body1 || '', { title: storybookTitle })}
        </p>
        
        <div style="background-color: #ffffff; border-left: 4px solid #dc2626; padding: 15px 20px; margin: 20px 0;">
          <p style="color: #374151; font-size: 16px; line-height: 1.6; margin: 0;">
            ${t.body2}
          </p>
        </div>
        
        <div style="background-color: #ffffff; border-left: 4px solid #10b981; padding: 15px 20px; margin: 20px 0;">
          <p style="color: #374151; font-size: 16px; line-height: 1.6; margin: 0;">
            ${t.body3}
          </p>
        </div>
        
        <div style="background-color: #f3f4f6; padding: 15px; border-radius: 6px; margin: 20px 0;">
          <p style="color: #6b7280; font-size: 14px; margin: 0 0 8px 0;">
            <strong>Order ID:</strong> ${printOrderId}
          </p>
          <p style="color: #6b7280; font-size: 14px; margin: 0;">
            <strong>Payment ID:</strong> ${paymentIntentId}
          </p>
        </div>
      </div>
      
      <div style="margin-top: 30px; padding: 20px; text-align: center; border-top: 1px solid #e5e7eb;">
        <p style="margin: 0; color: #374151; font-size: 14px;">
          ${t.closing}<br>
          <strong>${t.team}</strong>
        </p>
      </div>
      
      <div style="margin-top: 20px; padding: 15px; text-align: center;">
        <p style="margin: 0; color: #9ca3af; font-size: 12px;">
          ${t.disclaimer}
        </p>
      </div>
    </div>
  `;

  await client.emails.send({
    from: fromEmail,
    to: userEmail,
    subject: replacePlaceholders(t.subject, { title: storybookTitle }),
    html: htmlBody,
  });
  
  console.log(`✅ Order cancellation email sent to ${userEmail} for order ${printOrderId}`);
}

export async function sendRefundConfirmationEmail(
  userEmail: string,
  userName: string,
  purchase: Purchase,
  refundAmount: number,
  refundReason: string,
  language: string = 'en'
): Promise<void> {
  const { client, fromEmail } = await getUncachableResendClient();
  
  const storybook = await storage.getStorybook(purchase.storybookId);
  const storybookTitle = storybook?.title || 'Unknown Storybook';
  const orderRef = purchase.orderReference || purchase.stripePaymentIntentId;
  const orderNumber = orderRef.slice(-8).toUpperCase();
  
  const formatPrice = (cents: number) => `$${(cents / 100).toFixed(2)}`;
  
  // Map refund reason to user-friendly text
  const refundReasonText: { [key: string]: string } = {
    'requested_by_customer': 'Customer request',
    'duplicate': 'Duplicate charge',
    'fraudulent': 'Fraudulent transaction'
  };
  const reasonText = refundReasonText[refundReason] || refundReason;
  
  const refundDate = new Date().toLocaleDateString('en-US', { 
    year: 'numeric', 
    month: 'long', 
    day: 'numeric' 
  });
  
  const htmlBody = `
    <div style="font-family: 'Segoe UI', Tahoma, Geneva, Verdana, sans-serif; max-width: 650px; margin: 0 auto; padding: 20px; background-color: #ffffff;">
      <div style="background-color: #059669; color: #ffffff; padding: 30px; text-align: center; border-radius: 8px 8px 0 0;">
        <h1 style="margin: 0; font-size: 32px; font-weight: 600;">Refund Processed</h1>
        <p style="margin: 10px 0 0 0; font-size: 18px; opacity: 0.9;">Order #${orderNumber}</p>
      </div>
      
      <div style="background-color: #f9f7f3; padding: 25px; border-radius: 0 0 8px 8px;">
        <p style="color: #374151; font-size: 16px; line-height: 1.6; margin: 0 0 20px 0;">
          Hi ${userName},
        </p>
        
        <p style="color: #374151; font-size: 16px; line-height: 1.6; margin: 0 0 20px 0;">
          A refund for your order has been processed and will appear on your original payment method within 5-10 business days.
        </p>
      </div>
      
      <div style="margin-top: 30px;">
        <table style="width: 100%; border-collapse: collapse; background-color: #ffffff; border: 2px solid #059669; border-radius: 8px; overflow: hidden;">
          <thead>
            <tr style="background-color: #059669; color: #ffffff;">
              <th style="padding: 15px; text-align: left; font-weight: 600;">Refund Details</th>
              <th style="padding: 15px; text-align: right; font-weight: 600;">Amount</th>
            </tr>
          </thead>
          <tbody>
            <tr>
              <td style="padding: 12px 15px; border-bottom: 1px solid #e5e7eb; color: #374151;">
                ${storybookTitle}<br>
                <span style="font-size: 14px; color: #6b7280;">${purchase.type === 'digital' ? 'Digital Edition' : 'Print Edition'}</span>
              </td>
              <td style="padding: 12px 15px; border-bottom: 1px solid #e5e7eb; text-align: right; color: #374151;">
                ${formatPrice(refundAmount)}
              </td>
            </tr>
          </tbody>
          <tfoot>
            <tr style="background-color: #f9f7f3;">
              <td style="padding: 15px; font-weight: 600; color: #111827; border-top: 2px solid #059669;">
                Refund Date
              </td>
              <td style="padding: 15px; text-align: right; font-weight: 600; color: #111827; border-top: 2px solid #059669;">
                ${refundDate}
              </td>
            </tr>
            <tr style="background-color: #059669; color: #ffffff;">
              <td style="padding: 15px; font-weight: 700; font-size: 18px;">
                Total Refunded
              </td>
              <td style="padding: 15px; text-align: right; font-weight: 700; font-size: 18px;">
                ${formatPrice(refundAmount)}
              </td>
            </tr>
          </tfoot>
        </table>
      </div>
      
      <div style="margin-top: 30px; padding: 20px; background-color: #f9f7f3; border-radius: 8px;">
        <p style="margin: 0 0 10px 0; color: #6b7280; font-size: 14px;">Refund Reason</p>
        <p style="margin: 0; color: #111827; font-size: 16px; font-weight: 500;">${reasonText}</p>
      </div>
      
      <div style="margin-top: 30px; padding: 20px; background-color: #ecfdf5; border-left: 4px solid #059669; border-radius: 4px;">
        <p style="margin: 0; color: #065f46; font-size: 14px; line-height: 1.6;">
          <strong>What happens next?</strong><br>
          Your refund will be credited to your original payment method within 5-10 business days, depending on your financial institution.
        </p>
      </div>
      
      <div style="margin-top: 30px; padding: 20px; text-align: center; border-top: 1px solid #e5e7eb;">
        <p style="margin: 0 0 10px 0; color: #374151; font-size: 14px;">
          If you have questions about this refund, please contact our support team.
        </p>
        <p style="margin: 0; color: #6b7280; font-size: 14px;">
          Thank you for using Vesa Books
        </p>
      </div>
      
      <div style="margin-top: 20px; padding: 15px; text-align: center;">
        <p style="margin: 0; color: #9ca3af; font-size: 12px;">
          This is an automated refund confirmation email.
        </p>
      </div>
    </div>
  `;

  await client.emails.send({
    from: fromEmail,
    to: userEmail,
    subject: `Refund Processed - Order #${orderNumber}`,
    html: htmlBody,
  });
  
  console.log(`✅ Refund confirmation email sent to ${userEmail} for order ${orderRef}`);
}
