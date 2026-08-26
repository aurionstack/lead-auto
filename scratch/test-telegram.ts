import { loadEnvConfig } from '@next/env';
loadEnvConfig(process.cwd());

import { sendTelegramNotification } from '../lib/telegram';

async function test() {
  console.log('Testing Telegram Notification...');
  console.log(`Sending to Chat ID: ${process.env.TELEGRAM_CHAT_ID}`);
  
  const success = await sendTelegramNotification('🚀 *Success!* Your Aurion Stack Lead System is now fully connected to Telegram. You will receive all your Instantly replies right here!');
  
  if (success) {
    console.log('✅ Test successful!');
  } else {
    console.log('❌ Test failed. Check logs above.');
  }
}

test();
