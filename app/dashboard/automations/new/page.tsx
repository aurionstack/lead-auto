import Link from 'next/link';
import AutomationBuilder from '@/components/tools/automation-studio/AutomationBuilder';
import { automationActionCatalog } from '@/lib/tools/automation-studio/catalog';
import { getAutomationStudioData } from '@/lib/tools/automation-studio/service';

export default async function NewAutomationPage() {
  const data = await getAutomationStudioData();
  return <main className="mx-auto max-w-7xl px-5 py-8 text-slate-100 sm:px-8"><Link href="/dashboard" className="mb-6 inline-flex text-sm text-violet-300">← Back to automations</Link><AutomationBuilder databaseReady={data.databaseReady} workflows={data.workflows} catalog={[...automationActionCatalog]} /></main>;
}
export const dynamic = 'force-dynamic';
