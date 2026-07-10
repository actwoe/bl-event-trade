import Link from 'next/link';
import { getTradeAssetUrl, supabase } from '@/lib/supabase';

type TradeCollectionRow = {
  id: string;
  slug: string;
  title: string;
  description: string | null;
  thumbnail_path: string | null;
  event_start_date: string | null;
  event_end_date: string | null;
  sort_order: number | null;
};

function getKoreaTodayDateString() {
  const formatter = new Intl.DateTimeFormat('en-CA', {
    timeZone: 'Asia/Seoul',
    year: 'numeric',
    month: '2-digit',
    day: '2-digit',
  });

  const parts = formatter.formatToParts(new Date());
  const year = parts.find((part) => part.type === 'year')?.value ?? '';
  const month = parts.find((part) => part.type === 'month')?.value ?? '';
  const day = parts.find((part) => part.type === 'day')?.value ?? '';

  return `${year}-${month}-${day}`;
}

function isEventEnded(collection: TradeCollectionRow, today: string) {
  if (!collection.event_end_date) {
    return false;
  }

  return collection.event_end_date < today;
}

function formatDate(value: string | null) {
  if (!value) return '';

  const [year, month, day] = value.split('-');

  if (!year || !month || !day) {
    return value;
  }

  return `${year}.${month}.${day}`;
}

function getEventPeriodLabel(collection: TradeCollectionRow) {
  if (collection.event_start_date && collection.event_end_date) {
    return `${formatDate(collection.event_start_date)} - ${formatDate(
      collection.event_end_date,
    )}`;
  }

  if (collection.event_start_date) {
    return `${formatDate(collection.event_start_date)} 시작`;
  }

  if (collection.event_end_date) {
    return `${formatDate(collection.event_end_date)} 종료`;
  }

  return collection.description ?? '';
}

function sortCollectionsByStatus(rows: TradeCollectionRow[], today: string) {
  return [...rows].sort((a, b) => {
    const aEnded = isEventEnded(a, today) ? 1 : 0;
    const bEnded = isEventEnded(b, today) ? 1 : 0;

    if (aEnded !== bEnded) {
      return aEnded - bEnded;
    }

    const sortDiff = (a.sort_order ?? 0) - (b.sort_order ?? 0);

    if (sortDiff !== 0) {
      return sortDiff;
    }

    return a.title.localeCompare(b.title, 'ko-KR', {
      numeric: true,
      sensitivity: 'base',
    });
  });
}

async function loadCollections() {
  const { data, error } = await supabase
    .from('trade_collections')
    .select(
      'id, slug, title, description, thumbnail_path, event_start_date, event_end_date, sort_order',
    )
    .eq('is_public', true)
    .order('sort_order', { ascending: true })
    .order('published_at', { ascending: false, nullsFirst: false });

  if (error) {
    console.error(error);
    return {
      collections: [] as TradeCollectionRow[],
      error:
        '교환판 목록을 불러오지 못했습니다. Supabase 테이블, RLS 정책, 환경변수를 확인해 주세요.',
    };
  }

  return {
    collections: (data ?? []) as TradeCollectionRow[],
    error: '',
  };
}

export default async function HomePage() {
  const { collections, error } = await loadCollections();
  const today = getKoreaTodayDateString();
  const sortedCollections = sortCollectionsByStatus(collections, today);

  return (
    <main className="w-full bg-neutral-100 px-4 pb-5 pt-5 sm:pb-6 sm:pt-6">
      <section className="mx-auto w-full max-w-md overflow-hidden rounded-[28px] border border-neutral-200/70 bg-white shadow-[0_8px_26px_rgba(15,23,42,0.032)] sm:max-w-lg">
        <header className="border-b border-neutral-200/70 bg-[linear-gradient(135deg,#efe7ff_0%,#d8efff_48%,#ffe1f2_100%)] p-5">
            <div className="mb-6 flex items-center justify-between gap-3">
              <Link
                href="/"
                className="rounded-full border border-white/70 bg-white/75 px-4 py-2 text-xs font-bold text-neutral-600 shadow-[0_4px_12px_rgba(15,23,42,0.025)] transition hover:border-white hover:bg-white hover:text-neutral-950"
              >
                ← 메인으로
              </Link>

              <Link
                href="/cardform"
                className="rounded-full border border-white/70 bg-white/75 px-4 py-2 text-xs font-bold text-neutral-600 shadow-[0_4px_12px_rgba(15,23,42,0.025)] transition hover:border-white hover:bg-white hover:text-neutral-950"
              >
                이미지 제보하기
              </Link>
            </div>

          <h1 className="break-keep text-2xl font-black leading-tight text-neutral-950">
            팝업 & 콜카 굿즈 교환판
          </h1>

          <p className="mt-2 text-sm font-semibold leading-6 text-neutral-700">
            어떤 행사의 굿즈를 교환할까요?
          </p>
        </header>

        <div className="bg-white p-5">
          {error ? (
            <p className="mt-4 rounded-2xl border border-neutral-200/70 bg-neutral-50/80 px-4 py-3 text-sm leading-6 text-neutral-600">
              {error}
            </p>
          ) : null}

          {!error && collections.length === 0 ? (
            <div className="mt-5 rounded-2xl border border-dashed border-neutral-200 bg-neutral-50/70 px-4 py-10 text-center">
              <p className="text-sm font-bold text-neutral-400">
                아직 공개된 교환판이 없습니다.
              </p>
            </div>
          ) : null}

          {sortedCollections.length > 0 ? (
            <div className="grid grid-cols-2 gap-3">
              {sortedCollections.map((collection) => {
                const thumbnailUrl = collection.thumbnail_path
                  ? getTradeAssetUrl(collection.thumbnail_path)
                  : '';
                const ended = isEventEnded(collection, today);
                const periodLabel = getEventPeriodLabel(collection);

                return (
                  <Link
                    key={collection.id}
                    href={`/trade/${collection.slug}`}
                    className="group overflow-hidden rounded-2xl border border-neutral-200/70 bg-white transition hover:-translate-y-0.5 hover:border-neutral-300 hover:shadow-[0_10px_24px_rgba(15,23,42,0.05)]"
                  >
                    <div className="relative aspect-[32/45] bg-neutral-50">
                      {thumbnailUrl ? (
                        <img
                          src={thumbnailUrl}
                          alt={collection.title}
                          className={`h-full w-full object-cover transition group-hover:scale-[1.02] ${
                            ended ? 'grayscale opacity-60' : ''
                          }`}
                        />
                      ) : (
                        <div className="flex h-full w-full items-center justify-center px-3 text-center text-xs font-bold leading-5 text-neutral-400">
                          썸네일 없음
                        </div>
                      )}

                      {ended ? (
                        <span className="absolute left-2 top-2 rounded-full bg-neutral-950 px-2.5 py-1 text-[10px] font-bold text-white">
                          종료
                        </span>
                      ) : null}
                    </div>

                    <div className="p-3">
                      <h3 className="line-clamp-2 break-keep text-sm font-bold leading-5 text-neutral-900">
                        {collection.title}
                      </h3>

                      {periodLabel ? (
                        <p className="mt-1 line-clamp-2 text-[11px] font-medium leading-5 text-neutral-400">
                          {periodLabel}
                        </p>
                      ) : null}
                    </div>
                  </Link>
                );
              })}
            </div>
          ) : null}
        </div>
      </section>
    </main>
  );
}
