import { verifyUnsubscribeToken } from '@/lib/email/unsubscribe';

export default async function UnsubscribePage({
  searchParams,
}: {
  searchParams: Promise<{ lead?: string; token?: string }>;
}) {
  const { lead = '', token = '' } = await searchParams;
  const valid = Boolean(lead && token && verifyUnsubscribeToken(lead, token));

  return (
    <main className="min-h-screen bg-slate-950 text-slate-100 flex items-center justify-center p-6">
      <section className="w-full max-w-lg rounded-2xl border border-slate-800 bg-slate-900 p-8 text-center shadow-xl">
        <h1 className="text-2xl font-bold">Email preferences</h1>
        {valid ? (
          <>
            <p className="mt-3 text-slate-400">Confirm that you no longer want outreach emails from Aurion Stack.</p>
            <form action="/api/unsubscribe" method="post" className="mt-6">
              <input type="hidden" name="lead" value={lead} />
              <input type="hidden" name="token" value={token} />
              <button className="rounded-xl bg-rose-600 px-5 py-3 font-semibold text-white hover:bg-rose-500">
                Unsubscribe me
              </button>
            </form>
          </>
        ) : (
          <p className="mt-3 text-rose-300">This unsubscribe link is invalid or incomplete.</p>
        )}
      </section>
    </main>
  );
}
