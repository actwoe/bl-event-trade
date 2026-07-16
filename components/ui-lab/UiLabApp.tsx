'use client';

import Link from 'next/link';
import { AppBottomNav, type AppBottomNavItem } from '@/components/ui/AppBottomNav';
import { useMemo, useState } from 'react';
import {
  compareEventsByStatus,
  getEventPeriodLabel,
  getEventStatus,
  type EventFilter,
} from '@/lib/event-status';

export type UiLabCollection = {
  id: string;
  slug: string;
  title: string;
  thumbnailUrl: string;
  eventStartDate: string | null;
  eventEndDate: string | null;
  location: string | null;
  sortOrder: number;
};


type UiLabAppProps = {
  collections: UiLabCollection[];
  today: string;
};

const FILTERS: Array<{ id: EventFilter; label: string }> = [
  { id: 'all', label: '전체' },
  { id: 'scheduled', label: '예정' },
  { id: 'ongoing', label: '진행중' },
  { id: 'ended', label: '종료' },
];

function Icon({ name }: { name: AppBottomNavItem | 'back' | 'share' | 'user' }) {
  if (name === 'home') {
    return (
      <svg viewBox="0 0 24 24" aria-hidden="true" className="h-5 w-5 fill-none stroke-current" strokeWidth="1.8">
        <path d="M3.5 10.5 12 3l8.5 7.5" />
        <path d="M5.5 9.5V21h13V9.5M9.5 21v-6h5v6" />
      </svg>
    );
  }

  if (name === 'submit') {
    return (
      <svg viewBox="0 0 24 24" aria-hidden="true" className="h-5 w-5 fill-none stroke-current" strokeWidth="1.8">
        <rect x="3" y="6" width="18" height="14" rx="3" />
        <path d="M8 6l1.5-2h5L16 6" />
        <circle cx="12" cy="13" r="3.5" />
      </svg>
    );
  }

  if (name === 'trades') {
    return (
      <svg viewBox="0 0 24 24" aria-hidden="true" className="h-5 w-5 fill-none stroke-current" strokeWidth="1.8">
        <rect x="5" y="3" width="14" height="18" rx="2.5" />
        <path d="M8.5 8h7M8.5 12h7M8.5 16h4" />
      </svg>
    );
  }

  if (name === 'login' || name === 'user') {
    return (
      <svg viewBox="0 0 24 24" aria-hidden="true" className="h-5 w-5 fill-none stroke-current" strokeWidth="1.8">
        <circle cx="12" cy="8" r="4" />
        <path d="M4.5 21c.7-4.2 3.2-6.5 7.5-6.5s6.8 2.3 7.5 6.5" />
      </svg>
    );
  }

  if (name === 'back') {
    return (
      <svg viewBox="0 0 24 24" aria-hidden="true" className="h-5 w-5 fill-none stroke-current" strokeWidth="1.8">
        <path d="m15 5-7 7 7 7" />
      </svg>
    );
  }

  return (
    <svg viewBox="0 0 24 24" aria-hidden="true" className="h-5 w-5 fill-none stroke-current" strokeWidth="1.8">
      <path d="M12 3v12" />
      <path d="m7 8 5-5 5 5" />
      <path d="M5 13v7h14v-7" />
    </svg>
  );
}

function getStatusLabel(status: ReturnType<typeof getEventStatus>) {
  if (status === 'scheduled') return '예정';
  if (status === 'ended') return '종료';
  return '진행중';
}

export function UiLabApp({ collections, today }: UiLabAppProps) {
  const [filter, setFilter] = useState<EventFilter>('all');

  const filteredCollections = useMemo(() => {
    return collections
      .filter((collection) => {
        if (filter === 'all') return true;
        return getEventStatus(collection.eventStartDate, collection.eventEndDate, today) === filter;
      })
      .sort((left, right) => compareEventsByStatus(left, right, today));
  }, [collections, filter, today]);

  function openTrade(collectionId: string) {
    window.location.href = `/admin/ui-lab/create?collection=${encodeURIComponent(collectionId)}`;
  }

  return (
    <div className="min-h-screen bg-[#f3f3f5] px-3 py-4 text-neutral-950 sm:px-6 sm:py-8">
      <div className="mx-auto max-w-[1180px]">
        <div className="mb-4 flex flex-wrap items-center justify-between gap-3 rounded-2xl border border-neutral-200 bg-white px-4 py-3 shadow-sm">
          <div>
            <p className="text-[11px] font-black uppercase tracking-[0.18em] text-[#7C5CFC]">UI LAB</p>
            <p className="mt-0.5 text-sm font-bold text-neutral-700">실서비스와 분리된 앱형 디자인 실험판</p>
          </div>
          <div className="rounded-full bg-neutral-950 px-3 py-2 text-xs font-black text-white">
            메인 보기
          </div>
        </div>

        <div className="mx-auto flex h-[min(820px,calc(100dvh-150px))] min-h-[560px] max-w-[470px] flex-col overflow-hidden rounded-[30px] border border-neutral-200 bg-white shadow-[0_12px_34px_rgba(15,23,42,0.08)]">
          <HomeScreen
            collections={filteredCollections}
            filter={filter}
            today={today}
            onFilterChange={setFilter}
            onOpenTrade={openTrade}
          />
        </div>
      </div>
    </div>
  );
}

function HomeScreen({
  collections,
  filter,
  today,
  onFilterChange,
  onOpenTrade,
}: {
  collections: UiLabCollection[];
  filter: EventFilter;
  today: string;
  onFilterChange: (filter: EventFilter) => void;
  onOpenTrade: (id: string) => void;
}) {
  return (
    <div className="flex h-full min-h-0 flex-col bg-[#fafafa]">
      <header className="bg-white px-5 pb-5 pt-6">
        <div className="flex items-start justify-between gap-4">
          <div className="min-w-0">
            <p className="text-[11px] font-black uppercase tracking-[0.18em] text-[#7C5CFC]">BL GOODS TRADE</p>
            <h1 className="mt-1 break-keep text-[25px] font-black leading-tight tracking-[-0.03em]">팝업 &amp; 콜카 굿즈 교환판</h1>
            <p className="mt-2 text-sm font-medium text-neutral-500">어떤 행사의 굿즈를 교환할까요?</p>
          </div>
          <Link href="/login" aria-label="로그인" className="flex h-11 w-11 shrink-0 items-center justify-center rounded-full border border-neutral-200 bg-white text-neutral-900 shadow-sm">
            <Icon name="user" />
          </Link>
        </div>

        <div className="mt-5 flex flex-wrap gap-2" role="tablist" aria-label="행사 상태 필터">
          {FILTERS.map((item) => {
            const active = item.id === filter;
            return (
              <button
                key={item.id}
                type="button"
                role="tab"
                aria-selected={active}
                onClick={() => onFilterChange(item.id)}
                className={active ? 'rounded-full bg-neutral-950 px-4 py-2 text-[11px] font-black leading-none text-white' : 'rounded-full border border-neutral-200 bg-white px-4 py-2 text-[11px] font-bold leading-none text-neutral-500'}
              >
                {item.label}
              </button>
            );
          })}
        </div>
      </header>

      <main className="min-h-0 flex-1 overflow-y-auto overscroll-contain px-4 pb-6 pt-2">
        {collections.length > 0 ? (
          <div className="grid grid-cols-2 gap-3">
            {collections.slice(0, 8).map((collection) => {
              const status = getEventStatus(collection.eventStartDate, collection.eventEndDate, today);
              return (
                <button
                  key={collection.id}
                  type="button"
                  onClick={() => onOpenTrade(collection.id)}
                  className="overflow-hidden rounded-[18px] border border-neutral-200 bg-white text-left transition active:scale-[0.985]"
                >
                  <div className="relative aspect-[32/45] bg-neutral-100">
                    {collection.thumbnailUrl ? (
                      <img
                        src={collection.thumbnailUrl}
                        alt=""
                        className={`block h-full w-full object-cover ${status === 'ended' ? 'grayscale opacity-70' : ''}`}
                      />
                    ) : (
                      <div className="flex h-full items-center justify-center px-3 text-center text-xs font-bold text-neutral-400">썸네일 없음</div>
                    )}
                    <span className={status === 'ongoing' ? 'absolute right-2 top-2 rounded-full bg-[#F3F0FF] px-2 py-1 text-[9px] font-black text-[#7C5CFC]' : 'absolute right-2 top-2 rounded-full bg-white/90 px-2 py-1 text-[9px] font-black text-neutral-500'}>
                      {getStatusLabel(status)}
                    </span>
                  </div>
                  <div className="p-3">
                    <h2 className="line-clamp-2 break-keep text-[13px] font-black leading-5">{collection.title}</h2>
                    <p className="mt-1.5 text-[10px] font-semibold text-neutral-500">{getEventPeriodLabel(collection.eventStartDate, collection.eventEndDate)}</p>
                    <p className="mt-1 line-clamp-1 text-[10px] text-neutral-400">장소 정보는 UI 적용 시 연결</p>
                  </div>
                </button>
              );
            })}
          </div>
        ) : (
          <div className="rounded-2xl border border-dashed border-neutral-200 bg-white px-6 py-14 text-center text-sm font-bold text-neutral-400">해당 상태의 행사가 없습니다.</div>
        )}
      </main>

      <BottomNav active="home" />
    </div>
  );
}

function BottomNav({ active }: { active: AppBottomNavItem }) {
  return <AppBottomNav active={active} homeHref="/admin/ui-lab" />;
}
