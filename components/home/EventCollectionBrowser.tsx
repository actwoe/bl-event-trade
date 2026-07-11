'use client';

import { useMemo, useState } from 'react';
import { CollectionCard } from '@/components/home/CollectionCard';

export type HomeTradeCollection = {
  id: string;
  slug: string;
  title: string;
  thumbnailUrl: string;
  eventStartDate: string | null;
  eventEndDate: string | null;
  sortOrder: number;
};

type EventStatus = 'scheduled' | 'ongoing' | 'ended';
type EventFilter = 'all' | EventStatus;

type EventCollectionBrowserProps = {
  collections: HomeTradeCollection[];
  today: string;
};

const INITIAL_VISIBLE_COUNT = 6;
const LOAD_MORE_COUNT = 6;

const FILTERS: Array<{ id: EventFilter; label: string }> = [
  { id: 'all', label: '전체' },
  { id: 'scheduled', label: '예정' },
  { id: 'ongoing', label: '진행중' },
  { id: 'ended', label: '종료' },
];

function getEventStatus(
  collection: HomeTradeCollection,
  today: string,
): EventStatus {
  if (collection.eventEndDate && collection.eventEndDate < today) {
    return 'ended';
  }

  if (collection.eventStartDate && collection.eventStartDate > today) {
    return 'scheduled';
  }

  return 'ongoing';
}

function formatDate(value: string | null) {
  if (!value) return '';

  const [year, month, day] = value.split('-');

  if (!year || !month || !day) {
    return value;
  }

  return `${year}.${month}.${day}`;
}

function getEventPeriodLabel(collection: HomeTradeCollection) {
  if (collection.eventStartDate && collection.eventEndDate) {
    return `${formatDate(collection.eventStartDate)} – ${formatDate(
      collection.eventEndDate,
    )}`;
  }

  if (collection.eventStartDate) {
    return `${formatDate(collection.eventStartDate)}부터`;
  }

  if (collection.eventEndDate) {
    return `${formatDate(collection.eventEndDate)}까지`;
  }

  return '행사 기간 미정';
}

function getStatusSortIndex(status: EventStatus) {
  if (status === 'ongoing') return 0;
  if (status === 'scheduled') return 1;
  return 2;
}

function sortCollections(
  collections: HomeTradeCollection[],
  today: string,
) {
  return [...collections].sort((a, b) => {
    const aStatus = getEventStatus(a, today);
    const bStatus = getEventStatus(b, today);
    const statusDiff =
      getStatusSortIndex(aStatus) - getStatusSortIndex(bStatus);

    if (statusDiff !== 0) {
      return statusDiff;
    }

    if (aStatus === 'scheduled' && bStatus === 'scheduled') {
      const startDiff = (a.eventStartDate ?? '').localeCompare(
        b.eventStartDate ?? '',
      );

      if (startDiff !== 0) {
        return startDiff;
      }
    }

    if (aStatus === 'ended' && bStatus === 'ended') {
      const endDiff = (b.eventEndDate ?? '').localeCompare(
        a.eventEndDate ?? '',
      );

      if (endDiff !== 0) {
        return endDiff;
      }
    }

    const sortDiff = a.sortOrder - b.sortOrder;

    if (sortDiff !== 0) {
      return sortDiff;
    }

    return a.title.localeCompare(b.title, 'ko-KR', {
      numeric: true,
      sensitivity: 'base',
    });
  });
}

function getEmptyMessage(filter: EventFilter) {
  if (filter === 'scheduled') return '예정된 행사가 없습니다.';
  if (filter === 'ongoing') return '현재 진행 중인 행사가 없습니다.';
  if (filter === 'ended') return '종료된 행사가 없습니다.';
  return '아직 공개된 교환판이 없습니다.';
}

export function EventCollectionBrowser({
  collections,
  today,
}: EventCollectionBrowserProps) {
  const [filter, setFilter] = useState<EventFilter>('all');
  const [visibleCount, setVisibleCount] = useState(INITIAL_VISIBLE_COUNT);

  const counts = useMemo(() => {
    return collections.reduce(
      (result, collection) => {
        const status = getEventStatus(collection, today);
        result.all += 1;
        result[status] += 1;
        return result;
      },
      {
        all: 0,
        scheduled: 0,
        ongoing: 0,
        ended: 0,
      } satisfies Record<EventFilter, number>,
    );
  }, [collections, today]);

  const filteredCollections = useMemo(() => {
    const filtered =
      filter === 'all'
        ? collections
        : collections.filter(
            (collection) => getEventStatus(collection, today) === filter,
          );

    return sortCollections(filtered, today);
  }, [collections, filter, today]);

  const visibleCollections = filteredCollections.slice(0, visibleCount);
  const remainingCount = Math.max(
    filteredCollections.length - visibleCollections.length,
    0,
  );

  function changeFilter(nextFilter: EventFilter) {
    setFilter(nextFilter);
    setVisibleCount(INITIAL_VISIBLE_COUNT);
  }

  function showMoreCollections() {
    setVisibleCount((current) => current + LOAD_MORE_COUNT);
  }

  return (
    <section>
      <div className="border-b border-neutral-100 pb-4">
        <div className="flex flex-col gap-3 sm:flex-row sm:items-end sm:justify-between">
          <div className="min-w-0">
            <h2 className="break-keep text-sm font-black leading-6 text-neutral-950">
              어떤 행사의 굿즈를 교환할까요?
            </h2>
            <p className="mt-0.5 text-[11px] font-semibold text-neutral-400">
              {counts[filter]}개의 행사
            </p>
          </div>

          <div
            className="grid w-full grid-cols-4 gap-2 sm:w-auto sm:min-w-[292px] sm:shrink-0"
            role="tablist"
            aria-label="행사 상태 필터"
          >
            {FILTERS.map((item) => {
              const selected = filter === item.id;

              return (
                <button
                  key={item.id}
                  type="button"
                  role="tab"
                  aria-selected={selected}
                  onClick={() => changeFilter(item.id)}
                  className={
                    selected
                      ? 'flex min-h-10 items-center justify-center gap-1 rounded-full border border-neutral-950 bg-neutral-950 px-2.5 py-2 text-[11px] font-black text-white shadow-sm'
                      : 'flex min-h-10 items-center justify-center gap-1 rounded-full border border-neutral-200 bg-white px-2.5 py-2 text-[11px] font-bold text-neutral-500 transition hover:border-neutral-400 hover:text-neutral-950'
                  }
                >
                  <span>{item.label}</span>
                  <span
                    className={
                      selected
                        ? 'inline-flex min-w-4 items-center justify-center rounded-full bg-white/16 px-1 text-[9px] leading-4 text-white'
                        : 'inline-flex min-w-4 items-center justify-center rounded-full bg-neutral-100 px-1 text-[9px] leading-4 text-neutral-400'
                    }
                  >
                    {counts[item.id]}
                  </span>
                </button>
              );
            })}
          </div>
        </div>
      </div>

      {filteredCollections.length > 0 ? (
        <>
          <div className="mt-5 grid grid-cols-2 gap-3">
            {visibleCollections.map((collection) => {
              const status = getEventStatus(collection, today);

              return (
                <CollectionCard
                  key={collection.id}
                  href={`/trade/${collection.slug}`}
                  title={collection.title}
                  periodLabel={getEventPeriodLabel(collection)}
                  thumbnailUrl={collection.thumbnailUrl}
                  ended={status === 'ended'}
                />
              );
            })}
          </div>

          {remainingCount > 0 ? (
            <div className="mt-5 border-t border-neutral-100 pt-5">
              <button
                type="button"
                onClick={showMoreCollections}
                className="flex w-full items-center justify-center gap-2 rounded-full border border-neutral-200 bg-white px-5 py-3 text-sm font-black text-neutral-700 transition hover:border-neutral-400 hover:text-neutral-950"
              >
                <span>행사 더보기</span>
                <span className="rounded-full bg-neutral-100 px-2 py-0.5 text-[10px] font-bold text-neutral-400">
                  {Math.min(LOAD_MORE_COUNT, remainingCount)}개
                </span>
              </button>
              <p className="mt-2 text-center text-[11px] font-semibold text-neutral-400">
                전체 {filteredCollections.length}개 중 {visibleCollections.length}개 표시
              </p>
            </div>
          ) : null}
        </>
      ) : (
        <div className="mt-5 rounded-2xl border border-dashed border-neutral-200 bg-neutral-50/70 px-4 py-10 text-center">
          <p className="text-sm font-bold text-neutral-400">
            {getEmptyMessage(filter)}
          </p>
        </div>
      )}
    </section>
  );
}
