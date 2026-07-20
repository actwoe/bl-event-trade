import { AppBottomNav } from '@/components/ui/AppBottomNav';
import { AppFrame } from '@/components/ui/AppFrame';
import { AppTopBar } from '@/components/ui/AppTopBar';

export default function TradeLoadingPage() {
  return (
    <AppFrame>
      <AppTopBar title="교환/양도판 만들기" backHref="/" />

      <div className="min-h-0 flex-1 overflow-hidden">
        <div className="border-b border-neutral-100 px-5 py-4">
          <div className="h-3 w-28 animate-pulse rounded bg-neutral-100" />
          <div className="mt-3 h-7 w-3/4 animate-pulse rounded-lg bg-neutral-100" />
          <div className="mt-3 h-4 w-1/2 animate-pulse rounded bg-neutral-100" />
        </div>

        <div className="space-y-3 p-5">
          {[0, 1, 2].map((item) => (
            <div
              key={item}
              className="h-20 animate-pulse rounded-2xl border border-neutral-200 bg-neutral-50"
            />
          ))}
        </div>
      </div>

      <AppBottomNav active="home" />
    </AppFrame>
  );
}
