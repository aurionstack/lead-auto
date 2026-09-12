import { loadEnvConfig } from '@next/env';
loadEnvConfig(process.cwd());
import { processQueue } from '../lib/email/queue';

async function testQueue() {
  console.log('Processing outreach queue manually...');
  const result = await processQueue(10);
  console.log('Process Output:', result);
}
testQueue();
