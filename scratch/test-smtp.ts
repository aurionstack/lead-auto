import fs from 'fs';
import path from 'path';

// Load .env.local manually
const envPath = path.resolve(process.cwd(), '.env.local');
if (fs.existsSync(envPath)) {
  const envContent = fs.readFileSync(envPath, 'utf-8');
  envContent.split('\n').forEach(line => {
    const match = line.match(/^([^=]+)=(.*)$/);
    if (match) {
      process.env[match[1].trim()] = match[2].trim().replace(/^['"](.*)['"]$/, '$1');
    }
  });
}


// We use dynamic import to ensure environment variables are loaded FIRST
async function testEmail() {
  const { sendOutreachEmail } = await import('../lib/email/provider');
  
  console.log('Testing SMTP connection with settings:');
  console.log('Host:', process.env.SMTP_HOST);
  console.log('Port:', process.env.SMTP_PORT);
  console.log('User:', process.env.SMTP_USER ? '***' : 'Missing');
  console.log('From:', process.env.EMAIL_FROM);
  console.log('Reply-To:', process.env.EMAIL_REPLY_TO);
  
  try {
    const result = await sendOutreachEmail({
      to: 'samir@aurionstack.dev', // Sending a test email to the user
      subject: 'Test Email from lead-system',
      html: '<h1>Hello!</h1><p>This is a test email from your automated lead-system to verify SMTP credentials.</p>',
      text: 'Hello! This is a test email from your automated lead-system to verify SMTP credentials.'
    });

    if (result.success) {
      console.log('SUCCESS! Email sent successfully.');
      console.log('Message ID:', result.messageId);
    } else {
      console.error('FAILED to send email.');
      console.error(result.error);
    }
  } catch (error) {
    console.error('Unexpected error during test:', error);
  }
}

testEmail();
