// ============================================================
// lib/email/provider.ts
// ============================================================
import nodemailer from 'nodemailer';

// Configuration from environment variables
const SMTP_HOST = process.env.SMTP_HOST || 'smtp.zoho.com';
const SMTP_PORT = parseInt(process.env.SMTP_PORT || '465', 10);
const SMTP_USER = process.env.SMTP_USER || '';
const SMTP_PASS = process.env.SMTP_PASS || '';

const EMAIL_FROM = process.env.EMAIL_FROM || 'hello@aurionstack.dev';
const EMAIL_REPLY_TO = process.env.EMAIL_REPLY_TO || 'sameer@aurionstack.dev';

// Configure the nodemailer transporter
export const transporter = nodemailer.createTransport({
  host: SMTP_HOST,
  port: SMTP_PORT,
  secure: SMTP_PORT === 465, // true for 465, false for other ports
  auth: {
    user: SMTP_USER,
    pass: SMTP_PASS,
  },
});

export interface SendEmailParams {
  to: string;
  subject: string;
  html: string;
  text?: string;
  messageId?: string; // Optional custom message ID for tracking
}

/**
 * Sends an email using the configured SMTP provider.
 * Automatically sets the Reply-To header to the business mailbox.
 */
export async function sendOutreachEmail({ to, subject, html, text, messageId }: SendEmailParams) {
  if (!SMTP_USER || !SMTP_PASS) {
    console.warn('SMTP credentials are not configured. Email will not be sent.');
    return { success: false, error: 'SMTP credentials missing' };
  }

  try {
    const info = await transporter.sendMail({
      from: EMAIL_FROM,
      to,
      replyTo: EMAIL_REPLY_TO,
      subject,
      text,
      html,
      messageId, // Useful for tracking replies/bounces
    });

    return { success: true, messageId: info.messageId };
  } catch (error) {
    console.error('Failed to send email:', error);
    return { success: false, error };
  }
}
