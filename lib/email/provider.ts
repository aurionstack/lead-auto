// ============================================================
// lib/email/provider.ts
// ============================================================
import nodemailer from 'nodemailer';
import { appendComplianceFooter } from './templates';

export interface SmtpConfig {
  host: string;
  port: number;
  user: string;
  pass: string;
  fromEmail: string;
  fromName?: string;
  replyTo?: string;
  postalAddress?: string;
}

export interface SendEmailParams {
  to: string;
  subject: string;
  html: string;
  text?: string;
  messageId?: string; // Optional custom message ID for tracking
  unsubscribeUrl?: string;
}

/**
 * Sends an email using the configured SMTP provider dynamically per tenant.
 */
export async function sendOutreachEmail(params: SendEmailParams, config: SmtpConfig) {
  if (!config.user || !config.pass) {
    console.warn('SMTP credentials are not configured. Email will not be sent.');
    return { success: false, error: 'SMTP credentials missing for organization' };
  }
  if (!config.postalAddress?.trim()) {
    console.warn('A physical postal address is required for commercial outreach. Email will not be sent.');
    return { success: false, error: 'Physical postal address missing for organization' };
  }

  const transporter = nodemailer.createTransport({
    host: config.host,
    port: config.port,
    secure: config.port === 465, // true for 465, false for other ports
    auth: {
      user: config.user,
      pass: config.pass,
    },
  });

  try {
    const fromStr = config.fromName ? `"${config.fromName}" <${config.fromEmail}>` : config.fromEmail;
    const content = appendComplianceFooter(
      params.html,
      params.text,
      config.fromName || 'AurionStack',
      config.postalAddress,
    );

    const info = await transporter.sendMail({
      from: fromStr,
      to: params.to,
      replyTo: config.replyTo || config.fromEmail,
      subject: params.subject,
      text: content.text,
      html: content.html,
      messageId: params.messageId, // Useful for tracking replies/bounces
      headers: params.unsubscribeUrl ? {
        'List-Unsubscribe': `<${params.unsubscribeUrl}>`,
        'List-Unsubscribe-Post': 'List-Unsubscribe=One-Click',
      } : undefined,
    });

    return { success: true, messageId: info.messageId };
  } catch (error) {
    console.error('Failed to send email:', error);
    return { success: false, error };
  }
}
