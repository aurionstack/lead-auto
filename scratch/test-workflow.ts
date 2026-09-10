import fs from 'fs';
import path from 'path';

// 1. Load env vars
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

async function testWorkflow() {
  console.log('=== STARTING WORKFLOW TEST ===');
  
  // 1. Test the AI processing (bypassing the nextjs route directly via the module is hard because Next.js handlers expect Request objects)
  // Instead, let's just make fetch calls to localhost if the server is running, or we can just explain to the user that we are going to manually trigger them.
  console.log('To test the entire workflow locally, you should run `npm run dev` and then in another terminal, run:');
  console.log(`curl -H "Authorization: Bearer \${process.env.CRON_SECRET}" http://localhost:3000/api/cron/process-leads`);
  console.log('Wait for it to finish, then run:');
  console.log(`curl -H "Authorization: Bearer \${process.env.CRON_SECRET}" http://localhost:3000/api/cron/process-outreach`);
  console.log('\nThis will test the end-to-end pipeline against your live database.');
}

testWorkflow();
