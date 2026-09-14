export default function DashboardLoading() {
  return (
    <main className="min-h-screen bg-[#080a10] p-6 text-white lg:p-10">
      <div className="mx-auto max-w-[1440px] animate-pulse space-y-8">
        <div className="h-14 w-64 rounded-2xl bg-white/5" />
        <div className="grid gap-4 sm:grid-cols-2 xl:grid-cols-4">
          {Array.from({ length: 4 }).map((_, index) => (
            <div key={index} className="h-36 rounded-2xl border border-white/5 bg-white/[0.03]" />
          ))}
        </div>
        <div className="grid gap-5 lg:grid-cols-[1.7fr_1fr]">
          <div className="h-96 rounded-2xl border border-white/5 bg-white/[0.03]" />
          <div className="h-96 rounded-2xl border border-white/5 bg-white/[0.03]" />
        </div>
      </div>
    </main>
  );
}
