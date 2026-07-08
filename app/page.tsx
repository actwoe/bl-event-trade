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
    <main className="w-full bg-neutral-100 px-4 pb-9 pt-5 sm:pb-10 sm:pt-6">
      <section className="mx-auto w-full max-w-md rounded-3xl border border-neutral-200/80 bg-white p-5 shadow-[0_10px_28px_rgba(15,23,42,0.045)] sm:max-w-lg">
        <header>
          <p className="text-xs font-black uppercase tracking-[0.2em] text-neutral-500">
            Popup & Callabo Cafe Trade Board
          </p>

          <h1 className="mt-1 break-keep text-2xl font-black leading-tight text-neutral-950">
            팝업 & 콜카 굿즈 교환판
          </h1>

          <p className="mt-2 text-sm leading-6 text-neutral-500">
            진행 중인 팝업과 콜라보 카페 굿즈 교환판을 선택해 있어요 / 구해요 이미지를 만들 수 있습니다.
          </p>
        </header>

        <div className="mt-6 border-t border-neutral-200 pt-5">
          <div>
            <h2 className="text-lg font-black text-neutral-950">교환판 목록</h2>
            <p className="mt-1 text-xs font-bold text-neutral-400">
              공개된 교환판 {collections.length}개
            </p>
          </div>

          {error ? (
            <p className="mt-4 rounded-2xl bg-neutral-100 px-4 py-3 text-sm leading-6 text-neutral-700">
              {error}
            </p>
          ) : null}

          {!error && collections.length === 0 ? (
            <div className="mt-5 rounded-2xl bg-neutral-100 px-4 py-10 text-center">
              <p className="text-sm font-bold text-neutral-400">
                아직 공개된 교환판이 없습니다.
              </p>
            </div>
          ) : null}

          {sortedCollections.length > 0 ? (
            <div className="mt-5 grid grid-cols-2 gap-3">
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
                    className="group overflow-hidden rounded-2xl border border-neutral-200/80 bg-white shadow-[0_6px_18px_rgba(15,23,42,0.035)] transition hover:-translate-y-0.5 hover:border-neutral-950 hover:shadow-[0_14px_34px_rgba(15,23,42,0.075)]"
                  >
                    <div className="relative aspect-[32/45] bg-neutral-100">
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
                        <span className="absolute left-2 top-2 rounded-full bg-neutral-950 px-2.5 py-1 text-[10px] font-black text-white">
                          종료
                        </span>
                      ) : null}
                    </div>

                    <div className="p-3">
                      <h3 className="line-clamp-2 break-keep text-sm font-black leading-5 text-neutral-950">
                        {collection.title}
                      </h3>

                      {periodLabel ? (
                        <p className="mt-1 line-clamp-2 text-[11px] font-bold leading-5 text-neutral-400">
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
