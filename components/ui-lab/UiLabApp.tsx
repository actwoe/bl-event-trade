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
import type {
  RegisteredTradeItem,
  TradeCategory,
} from '@/lib/trade-types';

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

export type UiLabCollectionItems = Record<string, RegisteredTradeItem[]>;

type PreviewMode = 'grouped' | 'simple';

type UiLabAppProps = {
  collections: UiLabCollection[];
  itemsByCollection: UiLabCollectionItems;
  today: string;
};

const FILTERS: Array<{ id: EventFilter; label: string }> = [
  { id: 'all', label: '전체' },
  { id: 'scheduled', label: '예정' },
  { id: 'ongoing', label: '진행중' },
  { id: 'ended', label: '종료' },
];

const CATEGORY_LABELS: Record<TradeCategory, string> = {
  benefit: '특전',
  deco_photo_pack: '데코 포토팩',
  sweets_acrylic_magnet: '스위츠 아크릴 마그넷',
  heart_can_badge: '하트 캔뱃지',
  collection_photo_card: '컬렉션 포토카드',
};

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

function formatDateLabel(value: string | null) {
  if (!value) return '';
  const [year, month, day] = value.split('-');
  if (!year || !month || !day) return value;
  return `${year}.${month}.${day}`;
}

function getStatusLabel(status: ReturnType<typeof getEventStatus>) {
  if (status === 'scheduled') return '예정';
  if (status === 'ended') return '종료';
  return '진행중';
}

function getGroupLabel(item: RegisteredTradeItem) {
  if (item.category === 'benefit' && item.benefitSubcategory?.trim()) {
    return item.benefitSubcategory.trim();
  }
  return CATEGORY_LABELS[item.category];
}

function splitItems(items: RegisteredTradeItem[]) {
  const sorted = [...items].sort((a, b) => {
    const groupDiff = getGroupLabel(a).localeCompare(getGroupLabel(b), 'ko-KR', {
      numeric: true,
      sensitivity: 'base',
    });
    if (groupDiff !== 0) return groupDiff;
    const titleDiff = a.workTitle.localeCompare(b.workTitle, 'ko-KR', {
      numeric: true,
      sensitivity: 'base',
    });
    if (titleDiff !== 0) return titleDiff;
    return a.sortOrder - b.sortOrder;
  });

  const have = sorted.filter((_, index) => index % 2 === 0).slice(0, 8);
  const want = sorted.filter((_, index) => index % 2 === 1).slice(0, 8);

  if (want.length === 0 && have.length > 1) {
    return { have: have.slice(0, Math.ceil(have.length / 2)), want: have.slice(Math.ceil(have.length / 2)) };
  }

  return { have, want };
}

function groupItems(items: RegisteredTradeItem[]) {
  const groups = new Map<string, RegisteredTradeItem[]>();
  for (const item of items) {
    const label = getGroupLabel(item);
    groups.set(label, [...(groups.get(label) ?? []), item]);
  }
  return Array.from(groups, ([label, cards]) => ({ label, cards })).slice(0, 2);
}

export function UiLabApp({ collections, itemsByCollection: _itemsByCollection, today }: UiLabAppProps) {
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

function TradeScreen({
  collection,
  today,
  haveItems,
  wantItems,
  previewMode,
  onModeChange,
  onBack,
}: {
  collection: UiLabCollection;
  today: string;
  haveItems: RegisteredTradeItem[];
  wantItems: RegisteredTradeItem[];
  previewMode: PreviewMode;
  onModeChange: (mode: PreviewMode) => void;
  onBack: () => void;
}) {
  const status = getEventStatus(collection.eventStartDate, collection.eventEndDate, today);
  const todayLabel = formatDateLabel(today);

  return (
    <div className="flex h-full min-h-0 flex-col bg-[#fafafa]">
      <header className="bg-white px-4 pb-4 pt-4">
        <div className="grid grid-cols-[40px_1fr_40px] items-center">
          <button type="button" onClick={onBack} className="flex h-10 w-10 items-center justify-center" aria-label="뒤로가기">
            <Icon name="back" />
          </button>
          <h1 className="text-center text-sm font-black">교환판 미리보기</h1>
          <button type="button" className="flex h-10 w-10 items-center justify-center" aria-label="공유">
            <Icon name="share" />
          </button>
        </div>

        <div className="mt-3">
          <span className="rounded-full bg-[#F3F0FF] px-2.5 py-1 text-[10px] font-black text-[#7C5CFC]">{getStatusLabel(status)}</span>
          <h2 className="mt-2 break-keep text-[22px] font-black leading-tight tracking-[-0.025em]">{collection.title}</h2>
          <p className="mt-2 text-[11px] font-semibold text-neutral-500">{getEventPeriodLabel(collection.eventStartDate, collection.eventEndDate)}{collection.location ? ` · ${collection.location}` : ''}</p>
        </div>

        <div className="mt-4 flex gap-2 rounded-full bg-neutral-100 p-1">
          <button
            type="button"
            onClick={() => onModeChange('grouped')}
            className={previewMode === 'grouped' ? 'flex-1 rounded-full bg-white px-3 py-2 text-[11px] font-black shadow-sm' : 'flex-1 rounded-full px-3 py-2 text-[11px] font-bold text-neutral-500'}
          >
            특전 구분
          </button>
          <button
            type="button"
            onClick={() => onModeChange('simple')}
            className={previewMode === 'simple' ? 'flex-1 rounded-full bg-white px-3 py-2 text-[11px] font-black shadow-sm' : 'flex-1 rounded-full px-3 py-2 text-[11px] font-bold text-neutral-500'}
          >
            구분 없이
          </button>
        </div>
      </header>

      <main className="min-h-0 flex-1 overflow-y-auto overscroll-contain px-3 pb-6 pt-2">
        <div className="overflow-hidden rounded-[24px] border border-neutral-200 bg-neutral-950 shadow-[0_18px_38px_rgba(15,23,42,0.15)]">
          <div className="px-5 py-4 text-white">
            <div className="flex items-start justify-between gap-3">
              <div className="min-w-0 flex-1 text-left">
                <p className="text-[9px] font-black uppercase tracking-[0.22em] text-white/45">Trade Board</p>
                <h3 className="mt-1 break-keep text-[20px] font-black leading-tight">{collection.title}</h3>
              </div>

              <div className="flex max-w-[165px] shrink-0 flex-wrap justify-end gap-1.5 pt-1">
                <span className="rounded-full bg-white px-2.5 py-1.5 text-[8px] font-black leading-none text-neutral-950">동일 작품 우선</span>
                <span className="rounded-full bg-white px-2.5 py-1.5 text-[8px] font-black leading-none text-neutral-950">하자 확인</span>
              </div>
            </div>
          </div>

          <div className="rounded-t-[20px] bg-white px-3 pb-7 pt-3">

            {previewMode === 'grouped' ? (
              <GroupedPreview haveItems={haveItems} wantItems={wantItems} />
            ) : (
              <SimplePreview haveItems={haveItems} wantItems={wantItems} />
            )}
          </div>

          <div className="px-4 py-3 text-white">
            <div className="flex items-center justify-between gap-3">
              <div className="min-w-0">
                <p className="truncate text-[11px] font-black">ru1ned1over</p>
                <p className="truncate text-[9px] text-white/60">@ru1ned1over</p>
              </div>
              <p className="shrink-0 text-[9px] font-semibold text-white/70">{todayLabel} 기준</p>
            </div>
            <div className="mt-3 border-t border-white/10 pt-3 text-center text-[8px] leading-4 text-white/55">
              <p>업로드된 모든 이미지의 저작권은 각 플랫폼과 작가님께 있습니다.</p>
              <p>제작 NP @ru1ned1over</p>
            </div>
          </div>
        </div>

        <Link
          href={`/admin/ui-lab/create?collection=${encodeURIComponent(collection.id)}`}
          className="mt-4 flex w-full items-center justify-center rounded-2xl bg-neutral-950 px-5 py-3.5 text-sm font-black text-white"
        >
          이 행사로 교환판 만들기
        </Link>
        <p className="mt-2 text-center text-[10px] font-semibold leading-4 text-neutral-400">
          다음 화면에서는 실제 굿즈 선택·업로드·수량 변경·PNG 저장이 동작합니다.
        </p>
      </main>

      <BottomNav active="home" />
    </div>
  );
}

function GroupedPreview({ haveItems, wantItems }: { haveItems: RegisteredTradeItem[]; wantItems: RegisteredTradeItem[] }) {
  const haveGroups = groupItems(haveItems);
  const wantGroups = groupItems(wantItems);
  const labels = Array.from(new Set([...haveGroups.map((group) => group.label), ...wantGroups.map((group) => group.label)])).slice(0, 2);
  const visibleLabels = labels.length > 0 ? labels : ['굿즈'];

  return (
    <div className="mt-4">
      <div className="grid grid-cols-2 pb-3">
        <h4 className="px-2 text-center text-[12px] font-black text-[#7C5CFC]">있어요 (Have)</h4>
        <h4 className="px-2 text-center text-[12px] font-black text-[#7C5CFC]">구해요 (Want)</h4>
      </div>

      <div className="space-y-4">
        {visibleLabels.map((label) => {
          const haveCards = haveGroups.find((group) => group.label === label)?.cards ?? [];
          const wantCards = wantGroups.find((group) => group.label === label)?.cards ?? [];
          const fallbackHave = label === '굿즈' ? haveItems.slice(0, 4) : haveCards;
          const fallbackWant = label === '굿즈' ? wantItems.slice(0, 4) : wantCards;

          return (
            <section key={label} className="border-t border-neutral-200 pt-4 first:border-t-0 first:pt-0">
              <div className="mb-3 flex justify-center">
                <h5 className="rounded-full bg-neutral-100 px-3 py-1.5 text-[9px] font-black text-neutral-700">{label}</h5>
              </div>
              <div className="grid grid-cols-2">
                <div className="grid grid-cols-2 gap-1.5 pr-2">
                  {fallbackHave.slice(0, 4).map((item) => (
                    <MiniItem key={item.id} item={item} />
                  ))}
                </div>
                <div className="grid grid-cols-2 gap-1.5 border-l border-dashed border-neutral-300 pl-2">
                  {fallbackWant.slice(0, 4).map((item) => (
                    <MiniItem key={item.id} item={item} />
                  ))}
                </div>
              </div>
            </section>
          );
        })}
      </div>
    </div>
  );
}

function SimplePreview({ haveItems, wantItems }: { haveItems: RegisteredTradeItem[]; wantItems: RegisteredTradeItem[] }) {
  return (
    <div className="mt-4 space-y-4">
      <SimpleSection title="있어요 (Have)" items={haveItems} />
      <div className="border-t border-neutral-200" />
      <SimpleSection title="구해요 (Want)" items={wantItems} />
    </div>
  );
}

function SimpleSection({ title, items }: { title: string; items: RegisteredTradeItem[] }) {
  return (
    <section>
      <h4 className="text-center text-[12px] font-black text-[#7C5CFC]">{title}</h4>
      <div className="mt-2 grid grid-cols-4 gap-2">
        {items.slice(0, 8).map((item) => (
          <MiniItem key={item.id} item={item} showCategory />
        ))}
      </div>
    </section>
  );
}

function MiniItem({ item, showCategory = false }: { item: RegisteredTradeItem; showCategory?: boolean }) {
  return (
    <div className="min-w-0 text-center">
      <div className="aspect-square overflow-hidden rounded-lg border border-neutral-200 bg-neutral-50">
        <img src={item.imageUrl} alt="" className="block h-full w-full object-contain" />
      </div>
      <p className="mt-1 line-clamp-2 text-[7px] font-bold leading-3 text-neutral-700">{showCategory ? item.workTitle : item.itemName || item.workTitle}</p>
      {showCategory ? (
        <p className="mt-0.5 truncate text-[6.5px] font-semibold leading-3 text-neutral-400">{getGroupLabel(item)}</p>
      ) : null}
    </div>
  );
}

function BottomNav({ active }: { active: AppBottomNavItem }) {
  return <AppBottomNav active={active} homeHref="/admin/ui-lab" />;
}
