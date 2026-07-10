export default function TradeLoadingPage() {
  return (
    <section className="w-full bg-neutral-100 px-4 pb-4 pt-5 sm:pb-5 sm:pt-6">
      <div className="mx-auto w-full max-w-md overflow-hidden rounded-[2rem] border border-neutral-200/70 bg-white shadow-[0_8px_26px_rgba(15,23,42,0.032)] sm:max-w-lg">
        <div className="bg-[linear-gradient(135deg,#efe7ff_0%,#d8efff_48%,#ffe1f2_100%)] px-5 pb-6 pt-5">
          <div className="h-8 w-24 animate-pulse rounded-full bg-white/70" />
          <div className="mt-6 h-7 w-3/4 animate-pulse rounded-lg bg-white/75" />
          <div className="mt-3 h-4 w-full animate-pulse rounded bg-white/55" />
          <div className="mt-2 h-4 w-2/3 animate-pulse rounded bg-white/55" />
        </div>

        <div className="space-y-3 p-5">
          {[0, 1, 2].map((item) => (
            <div
              key={item}
              className="h-20 animate-pulse rounded-2xl border border-neutral-200 bg-neutral-50"
            />
          ))}
          <p className="pt-1 text-center text-xs font-bold text-neutral-400">
            굿즈 이미지를 불러오는 중입니다.
          </p>
        </div>
      </div>
    </section>
  );
}
