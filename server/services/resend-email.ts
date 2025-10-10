import { Resend } from 'resend';
import type { Storybook, Purchase } from '@shared/schema';
import { storage } from '../storage';
import { getEmailTranslations, replacePlaceholders } from '../email-translations';

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

export async function sendPrintOrderEmail(
  userEmail: string,
  storybook: Storybook,
  pdfBuffer: Buffer,
  language: string = 'en'
): Promise<void> {
  const { client, fromEmail } = await getUncachableResendClient();
  
  // Clean up storybook title for filename (remove special characters)
  const cleanTitle = storybook.title.replace(/[^a-z0-9]/gi, '_').toLowerCase();
  const filename = `${cleanTitle}.pdf`;
  
  const t = getEmailTranslations(language, 'printPurchase');
  
  const htmlBody = `
    <div style="font-family: Arial, sans-serif; max-width: 600px; margin: 0 auto; padding: 20px;">
      <h1 style="color: #1e293b; margin-bottom: 20px;">${replacePlaceholders(t.printOrderTitle!, { title: storybook.title })}</h1>
      
      <p style="color: #475569; font-size: 16px; line-height: 1.6;">
        ${t.printThankYou}
      </p>
      
      <p style="color: #475569; font-size: 16px; line-height: 1.6;">
        ${replacePlaceholders(t.printBody1!, { title: storybook.title })}
      </p>
      
      <p style="color: #475569; font-size: 16px; line-height: 1.6;">
        ${t.printNotification}
      </p>
      
      <div style="margin-top: 30px; padding: 15px; background-color: #f5f1e8; border-radius: 8px;">
        <p style="color: #334155; font-size: 14px; margin: 0;">
          ${t.closing}<br>
          <strong>${t.team}</strong>
        </p>
      </div>
    </div>
  `;

  await client.emails.send({
    from: fromEmail,
    to: userEmail,
    subject: replacePlaceholders(t.subject, { title: storybook.title }),
    html: htmlBody,
    attachments: [
      {
        filename: filename,
        content: pdfBuffer,
      }
    ],
  });
}

export async function sendInvoiceEmail(
  userEmail: string,
  userName: string,
  purchases: Purchase[],
  paymentIntentId: string,
  language: string = 'en'
): Promise<void> {
  const { client, fromEmail } = await getUncachableResendClient();
  
  const invoiceNumber = paymentIntentId.slice(-8).toUpperCase();
  
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

  await client.emails.send({
    from: fromEmail,
    to: userEmail,
    subject: replacePlaceholders(t.subject, { invoiceNumber }),
    html: htmlBody,
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
