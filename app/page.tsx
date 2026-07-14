import Link from 'next/link';
import { EventCollectionBrowser } from '@/components/home/EventCollectionBrowser';
import { UserAuthLinks } from '@/components/auth/UserAuthLinks';
import { getKoreaTodayDateString } from '@/lib/event-status';
import type { HomeTradeCollection } from '@/lib/home-trade-types';
import { getTradeAssetUrl, supabase } from '@/lib/supabase';

export const revalidate = 300;

type TradeCollectionRow = {
  id: string;
  slug: string;
  title: string;
  thumbnail_path: string | null;
  event_start_date: string | null;
  event_end_date: string | null;
  event_location: string | null;
  sort_order: number | null;
};

async function loadCollections() {
  const { data, error } = await supabase
    .from('trade_collections')
    .select(
      'id, slug, title, thumbnail_path, event_start_date, event_end_date, event_location, sort_order',
    )
    .eq('is_public', true);

  if (error) {
    throw error;
  }

  return ((data ?? []) as TradeCollectionRow[]).map(
    (collection): HomeTradeCollection => ({
      id: collection.id,
      slug: collection.slug,
      title: collection.title,
      thumbnailUrl: collection.thumbnail_path
        ? getTradeAssetUrl(collection.thumbnail_path)
        : '',
      eventStartDate: collection.event_start_date,
      eventEndDate: collection.event_end_date,
      location: collection.event_location,
      sortOrder: collection.sort_order ?? 0,
    }),
  );
}

export default async function HomePage() {
  const today = getKoreaTodayDateString();

  let collections: HomeTradeCollection[] = [];
  let error = '';

  try {
    collections = await loadCollections();
  } catch (loadError) {
    console.error(loadError);
    error =
      '교환판 목록을 불러오지 못했습니다. Supabase 테이블, RLS 정책, 환경변수를 확인해 주세요.';
  }

  return (
    <main className="flex h-[100dvh] w-full items-center justify-center bg-neutral-100 px-3 py-3 sm:px-6 sm:py-6">
      <section className="flex h-full max-h-[860px] w-full max-w-[520px] flex-col overflow-hidden rounded-[28px] border border-neutral-200/70 bg-white shadow-[0_8px_26px_rgba(15,23,42,0.032)]">
        <header className="border-b border-neutral-200/70 bg-[linear-gradient(135deg,#efe7ff_0%,#d8efff_48%,#ffe1f2_100%)] p-5">
          <div className="flex justify-end">
            <Link
              href="/cardform"
              className="rounded-full border border-white/70 bg-white/75 px-4 py-2 text-xs font-bold text-neutral-600 shadow-[0_4px_12px_rgba(15,23,42,0.025)] transition hover:border-white hover:bg-white hover:text-neutral-950"
            >
              이미지 제보하기
            </Link>
          </div>

          <div className="mt-6">
            <p className="text-[11px] font-black uppercase tracking-[0.18em] text-neutral-500">
              Popup &amp; Collabo Cafe Trade Board
            </p>

            <h1 className="mt-1 break-keep text-2xl font-black leading-tight text-neutral-950">
              팝업 &amp; 콜카 굿즈 교환판
            </h1>

            <div className="mt-4 h-px bg-white/70" />

            <UserAuthLinks className="mt-4" />
          </div>
        </header>

        <div className="min-h-0 flex-1 overflow-y-auto overscroll-contain bg-white p-5">
          {error ? (
            <p className="rounded-2xl border border-neutral-200/70 bg-neutral-50/80 px-4 py-3 text-sm leading-6 text-neutral-600">
              {error}
            </p>
          ) : (
            <EventCollectionBrowser collections={collections} today={today} />
          )}
        </div>
      </section>
    </main>
  );
}
