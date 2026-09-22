import RevQrOverview from '@/components/tools/revqr-whatsapp/RevQrOverview';
import { getRevQrDashboardData } from '@/lib/tools/revqr-whatsapp/service';

export default async function RevQrPage() { return <RevQrOverview data={await getRevQrDashboardData()} />; }
export const dynamic = 'force-dynamic';
