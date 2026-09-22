import AutomationBuilder from '@/components/tools/automation-studio/AutomationBuilder';
import { automationActionCatalog } from '@/lib/tools/automation-studio/catalog';
import { getAutomationStudioData } from '@/lib/tools/automation-studio/service';

export default async function AutomationStudioPage() {
  const data = await getAutomationStudioData();
  return <AutomationBuilder databaseReady={data.databaseReady} workflows={data.workflows} catalog={[...automationActionCatalog]} />;
}
export const dynamic = 'force-dynamic';
