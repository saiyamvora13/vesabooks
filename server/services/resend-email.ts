import { Resend } from 'resend';
import type { Storybook } from '@shared/schema';

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
  pdfBuffer: Buffer
): Promise<void> {
  const { client, fromEmail } = await getUncachableResendClient();
  
  // Clean up storybook title for filename (remove special characters)
  const cleanTitle = storybook.title.replace(/[^a-z0-9]/gi, '_').toLowerCase();
  const filename = `${cleanTitle}.pdf`;
  
  const htmlBody = `
    <div style="font-family: Arial, sans-serif; max-width: 600px; margin: 0 auto; padding: 20px;">
      <h1 style="color: #1e293b; margin-bottom: 20px;">Your Print Order - ${storybook.title}</h1>
      
      <p style="color: #475569; font-size: 16px; line-height: 1.6;">
        Thank you for your print order!
      </p>
      
      <p style="color: #475569; font-size: 16px; line-height: 1.6;">
        While we finalize our printing partnership, please enjoy this digital PDF version of 
        <strong>"${storybook.title}"</strong>. Your PDF is attached to this email.
      </p>
      
      <p style="color: #475569; font-size: 16px; line-height: 1.6;">
        We'll notify you as soon as physical printing becomes available!
      </p>
      
      <div style="margin-top: 30px; padding: 15px; background-color: #f5f1e8; border-radius: 8px;">
        <p style="color: #334155; font-size: 14px; margin: 0;">
          Best regards,<br>
          <strong>AI Storyteller Team</strong>
        </p>
      </div>
    </div>
  `;

  await client.emails.send({
    from: fromEmail,
    to: userEmail,
    subject: `Your Print Order - ${storybook.title}`,
    html: htmlBody,
    attachments: [
      {
        filename: filename,
        content: pdfBuffer,
      }
    ],
  });
}
