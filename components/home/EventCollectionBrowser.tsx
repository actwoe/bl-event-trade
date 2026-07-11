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

  const visibleCollections = useMemo(() => {
    const filtered =
      filter === 'all'
        ? collections
        : collections.filter(
            (collection) => getEventStatus(collection, today) === filter,
          );

    return sortCollections(filtered, today);
  }, [collections, filter, today]);

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
            className="grid w-full grid-cols-4 gap-1 rounded-xl bg-neutral-100 p-1 sm:w-auto sm:shrink-0"
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
                  onClick={() => setFilter(item.id)}
                  className={
                    selected
                      ? 'rounded-lg bg-neutral-950 px-2.5 py-2 text-[11px] font-black text-white shadow-sm'
                      : 'rounded-lg px-2.5 py-2 text-[11px] font-bold text-neutral-500 transition hover:bg-white hover:text-neutral-950'
                  }
                >
                  {item.label}
                </button>
              );
            })}
          </div>
        </div>
      </div>

      {visibleCollections.length > 0 ? (
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
