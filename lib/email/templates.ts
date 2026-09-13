// ============================================================
// lib/email/templates.ts
// ============================================================

export interface EmailTemplateData {
  businessName: string;
  body: string; // The AI generated draft
  unsubscribeLink: string;
}

function escapeHtml(value: string): string {
  return value.replace(/[&<>"']/g, (character) => ({
    '&': '&amp;', '<': '&lt;', '>': '&gt;', '"': '&quot;', "'": '&#039;',
  })[character] as string);
}

/**
 * Wraps the AI drafted pitch into a proper HTML email layout.
 */
export function buildOutreachHtml(data: EmailTemplateData): string {
  const safeBody = escapeHtml(data.body).replace(/\r?\n/g, '<br/>');
  const safeBusinessName = escapeHtml(data.businessName);
  const safeUnsubscribeLink = escapeHtml(data.unsubscribeLink);
  return `
<!DOCTYPE html>
<html>
<head>
  <meta charset="utf-8">
  <style>
    body { font-family: -apple-system, BlinkMacSystemFont, "Segoe UI", Roboto, Helvetica, Arial, sans-serif; line-height: 1.6; color: #333; }
    .container { max-width: 600px; margin: 0 auto; padding: 20px; }
    .footer { margin-top: 40px; padding-top: 20px; border-top: 1px solid #eaeaea; font-size: 12px; color: #888; }
    .footer a { color: #888; text-decoration: underline; }
  </style>
</head>
<body>
  <div class="container">
    ${safeBody}
    
    <div class="footer">
      <p>This email was sent to ${safeBusinessName}. If you'd prefer not to receive these emails, you can <a href="${safeUnsubscribeLink}">unsubscribe here</a>.</p>
    </div>
  </div>
</body>
</html>
  `.trim();
}

/**
 * Plain text version of the email for better deliverability and accessibility.
 */
export function buildOutreachText(data: EmailTemplateData): string {
  return `
${data.body}

--
This email was sent to ${data.businessName}. 
To unsubscribe, visit: ${data.unsubscribeLink}
  `.trim();
}
