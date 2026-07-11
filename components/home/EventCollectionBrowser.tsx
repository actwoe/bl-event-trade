'use client';

import { useMemo, useState } from 'react';
import { CollectionCard } from '@/components/home/CollectionCard';
import {
  compareEventsByStatus,
  getEventPeriodLabel,
  getEventStatus,
  type EventFilter,
} from '@/lib/event-status';
import type { HomeTradeCollection } from '@/lib/home-trade-types';

export type { HomeTradeCollection } from '@/lib/home-trade-types';

type EventCollectionBrowserProps = {
  collections: HomeTradeCollection[];
  today: string;
};

const PAGE_SIZE = 6;

const FILTERS: Array<{ id: EventFilter; label: string }> = [
  { id: 'all', label: '전체' },
  { id: 'scheduled', label: '예정' },
  { id: 'ongoing', label: '진행중' },
  { id: 'ended', label: '종료' },
];

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
  const [visibleCount, setVisibleCount] = useState(PAGE_SIZE);

  const filteredCollections = useMemo(() => {
    return collections
      .filter((collection) => {
        if (filter === 'all') return true;

        return (
          getEventStatus(
            collection.eventStartDate,
            collection.eventEndDate,
            today,
          ) === filter
        );
      })
      .sort((left, right) => compareEventsByStatus(left, right, today));
  }, [collections, filter, today]);

  const visibleCollections = filteredCollections.slice(0, visibleCount);
  const hasMore = visibleCount < filteredCollections.length;

  function changeFilter(nextFilter: EventFilter) {
    setFilter(nextFilter);
    setVisibleCount(PAGE_SIZE);
  }

  function showMoreCollections() {
    setVisibleCount((current) => current + PAGE_SIZE);
  }

  return (
    <section>
      <div className="border-b border-neutral-100 pb-4">
        <h2 className="break-keep text-sm font-black leading-6 text-neutral-950">
          어떤 행사의 굿즈를 교환할까요?
        </h2>

        <div
          className="mt-3 flex flex-wrap gap-1.5"
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
                    ? 'rounded-full border border-neutral-950 bg-neutral-950 px-3 py-1.5 text-[11px] font-black leading-none text-white shadow-sm'
                    : 'rounded-full border border-neutral-200 bg-white px-3 py-1.5 text-[11px] font-bold leading-none text-neutral-500 transition hover:border-neutral-400 hover:text-neutral-950'
                }
              >
                {item.label}
              </button>
            );
          })}
        </div>
      </div>

      {visibleCollections.length === 0 ? (
        <div className="mt-5 rounded-2xl border border-dashed border-neutral-200 bg-neutral-50/70 px-4 py-10 text-center">
          <p className="text-sm font-bold text-neutral-400">
            {getEmptyMessage(filter)}
          </p>
        </div>
      ) : (
        <>
          <div className="mt-5 grid grid-cols-2 gap-3">
            {visibleCollections.map((collection) => {
              const status = getEventStatus(
                collection.eventStartDate,
                collection.eventEndDate,
                today,
              );

              return (
                <CollectionCard
                  key={collection.id}
                  href={`/trade/${collection.slug}`}
                  title={collection.title}
                  periodLabel={getEventPeriodLabel(
                    collection.eventStartDate,
                    collection.eventEndDate,
                  )}
                  thumbnailUrl={collection.thumbnailUrl}
                  ended={status === 'ended'}
                />
              );
            })}
          </div>

          {hasMore ? (
            <div className="mt-5 border-t border-neutral-100 pt-5">
              <button
                type="button"
                onClick={showMoreCollections}
                className="w-full rounded-full border border-neutral-200 bg-white px-5 py-3 text-sm font-black text-neutral-700 transition hover:border-neutral-400 hover:text-neutral-950"
              >
                행사 더보기
              </button>
            </div>
          ) : null}
        </>
      )}
    </section>
  );
}
