'use client';

import { useMemo, useState } from 'react';
import { UserAuthLinks } from '@/components/auth/UserAuthLinks';
import { CollectionCard } from '@/components/home/CollectionCard';
import { AppBottomNav } from '@/components/ui/AppBottomNav';
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
  error?: string;
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
  error = '',
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
    <div className="flex h-full min-h-0 flex-col bg-[#fafafa]">
      <header className="shrink-0 bg-white px-5 pb-5 pt-[max(24px,env(safe-area-inset-top))]">
        <div className="flex items-start justify-between gap-4">
          <div className="min-w-0">
            <p className="text-[11px] font-black uppercase tracking-[0.18em] text-[#7C5CFC]">
              BL GOODS TRADE
            </p>
            <h1 className="mt-1 break-keep text-[25px] font-black leading-tight tracking-[-0.03em] text-neutral-950">
              팝업 &amp; 콜카 굿즈 교환판
            </h1>
            <p className="mt-2 text-sm font-medium text-neutral-500">
              어떤 행사의 굿즈를 교환할까요?
            </p>
          </div>

          <UserAuthLinks variant="icon" />
        </div>

        <div
          className="mt-5 flex flex-wrap gap-2"
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
                    ? 'rounded-full bg-neutral-950 px-4 py-2 text-[11px] font-black leading-none text-white'
                    : 'rounded-full border border-neutral-200 bg-white px-4 py-2 text-[11px] font-bold leading-none text-neutral-500 transition hover:border-neutral-300 hover:text-neutral-950'
                }
              >
                {item.label}
              </button>
            );
          })}
        </div>
      </header>

      <div className="min-h-0 flex-1 overflow-y-auto overscroll-contain px-4 pb-6 pt-2">
        {error ? (
          <p className="rounded-2xl border border-neutral-200 bg-white px-4 py-3 text-sm leading-6 text-neutral-600">
            {error}
          </p>
        ) : visibleCollections.length === 0 ? (
          <div className="rounded-2xl border border-dashed border-neutral-200 bg-white px-6 py-14 text-center">
            <p className="text-sm font-bold text-neutral-400">
              {getEmptyMessage(filter)}
            </p>
          </div>
        ) : (
          <>
            <div className="grid grid-cols-2 gap-3">
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
                    location={collection.location ?? null}
                    thumbnailUrl={collection.thumbnailUrl}
                    status={status}
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
      </div>

      <AppBottomNav active="home" />
    </div>
  );
}
