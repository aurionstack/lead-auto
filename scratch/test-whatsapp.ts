import { loadEnvConfig } from '@next/env';
loadEnvConfig(process.cwd());

import { sendWhatsAppNotification } from '../lib/whatsapp';

async function test() {
  console.log('Testing Meta WhatsApp Cloud API...');
  console.log(`Sending to: ${process.env.YOUR_WHATSAPP_NUMBER}`);
  
  const success = await sendWhatsAppNotification('🚀 Hello! This is a test message from your Aurion Stack Lead System.');
  
  if (success) {
    console.log('✅ Test successful!');
  } else {
    console.log('❌ Test failed. Check logs above.');
  }
}

test();
