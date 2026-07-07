'use client';

import { forwardRef } from 'react';
import {
  TRADE_CATEGORIES,
  TradeBoard,
  TradeCard,
  TradeCategory,
} from '@/lib/trade-types';

type TradePreviewProps = {
  board: TradeBoard;
  collectionTitle: string;
};

type QuantityTradeCard = TradeCard & {
  quantity?: number;
};

type VisibleCategory = {
  id: TradeCategory;
  label: string;
  haveCards: TradeCard[];
  wantCards: TradeCard[];
  columnCount: 1 | 2 | 3;
};

type CategorySectionProps = {
  category: VisibleCategory;
  isFirst: boolean;
};

type SideBlockProps = {
  label: string;
  cards: TradeCard[];
  columnCount: 1 | 2 | 3;
};

type PreviewCardProps = {
  card: TradeCard;
};

function getCardQuantity(card: TradeCard) {
  const quantity = (card as QuantityTradeCard).quantity ?? 1;

  if (!Number.isFinite(quantity)) return 1;

  return Math.max(1, Math.floor(quantity));
}

function getColumnCount(haveCards: TradeCard[], wantCards: TradeCard[]): 1 | 2 | 3 {
  const haveCardCount = haveCards.length;
  const wantCardCount = wantCards.length;
  const totalCardCount = haveCardCount + wantCardCount;
  const maxSideCardCount = Math.max(haveCardCount, wantCardCount);

  const columnsByTotal = totalCardCount <= 2 ? 1 : totalCardCount <= 4 ? 2 : 3;
  const columnsBySide = maxSideCardCount <= 1 ? 1 : maxSideCardCount <= 2 ? 2 : 3;

  return Math.max(columnsByTotal, columnsBySide) as 1 | 2 | 3;
}

function getGridColumnClass(columnCount: 1 | 2 | 3) {
  if (columnCount === 1) return 'grid-cols-1';
  if (columnCount === 2) return 'grid-cols-2';
  return 'grid-cols-3';
}

function getVisibleCategories(cards: TradeCard[]): VisibleCategory[] {
  return TRADE_CATEGORIES.map((category) => {
    const haveCards = cards.filter(
      (card) => card.category === category.id && card.side === 'have',
    );

    const wantCards = cards.filter(
      (card) => card.category === category.id && card.side === 'want',
    );

    return {
      id: category.id,
      label: category.label,
      haveCards,
      wantCards,
      columnCount: getColumnCount(haveCards, wantCards),
    };
  }).filter(
    (category) => category.haveCards.length > 0 || category.wantCards.length > 0,
  );
}

export const TradePreview = forwardRef<HTMLDivElement, TradePreviewProps>(
  function TradePreview({ board, collectionTitle }, ref) {
    const visibleCategories = getVisibleCategories(board.cards);
    const hasCards = visibleCategories.length > 0;
    const profileTexts = [board.nickname, board.contact].filter(
      (item) => item.trim().length > 0,
    );
    const conditionChips = board.memo
      .split(' · ')
      .map((item) => item.trim())
      .filter(Boolean);

    return (
      <div ref={ref} className="w-[560px] bg-white p-3 text-neutral-950">
        <div className="overflow-hidden rounded-[26px] bg-white">
          <header className="border-b border-neutral-200 bg-white px-5 py-3 text-center">
            <h1 className="break-keep text-[24px] font-black leading-[1.12] tracking-tight text-neutral-950">
              {collectionTitle}
            </h1>

            {profileTexts.length > 0 ? (
              <p className="mt-1 break-keep text-[12px] font-extrabold leading-5 text-neutral-500">
                {profileTexts.join(' · ')}
              </p>
            ) : null}

            {conditionChips.length > 0 ? (
              <div className="mt-2 flex flex-wrap justify-center gap-1.5">
                {conditionChips.map((chip) => (
                  <span
                    key={chip}
                    className="rounded-full bg-neutral-100 px-2.5 py-1 text-[9px] font-black leading-none text-neutral-600"
                  >
                    {chip}
                  </span>
                ))}
              </div>
            ) : null}
          </header>

          <section className="bg-white px-3 py-3">
            {hasCards ? (
              visibleCategories.map((category, index) => (
                <CategorySection
                  key={category.id}
                  category={category}
                  isFirst={index === 0}
                />
              ))
            ) : (
              <div className="rounded-[22px] border-2 border-dashed border-neutral-200 px-5 py-12 text-center">
                <p className="text-base font-black text-neutral-300">
                  선택된 이미지가 없습니다
                </p>
              </div>
            )}
          </section>

          <footer className="border-t border-neutral-200 bg-neutral-50 px-4 py-2 text-center text-[8px] font-bold leading-3 text-neutral-400">
            비공식 교환판 · 이미지 저작권은 원저작권자에게 있습니다.
          </footer>
        </div>
      </div>
    );
  },
);

function CategorySection({ category, isFirst }: CategorySectionProps) {
  return (
    <section className={isFirst ? 'pb-3' : 'border-t border-neutral-200 py-3'}>
      <h2 className="mb-2 text-center text-sm font-black tracking-tight text-neutral-950">
        {category.label}
      </h2>

      <div className="grid grid-cols-2 gap-2.5">
        <SideBlock
          label="있어요"
          cards={category.haveCards}
          columnCount={category.columnCount}
        />
        <SideBlock
          label="구해요"
          cards={category.wantCards}
          columnCount={category.columnCount}
        />
      </div>
    </section>
  );
}

function SideBlock({ label, cards, columnCount }: SideBlockProps) {
  const hasCards = cards.length > 0;
  const gridClassName = getGridColumnClass(columnCount);

  return (
    <div>
      <div className="mb-1.5 border-b border-neutral-200 pb-1 text-center">
        <span
          className={
            hasCards
              ? 'text-[11px] font-black text-neutral-950'
              : 'text-[11px] font-black text-neutral-300'
          }
        >
          {label}
        </span>
      </div>

      <div className={`grid ${gridClassName} gap-1`}>
        {cards.map((card) => (
          <PreviewCard key={card.id} card={card} />
        ))}
      </div>
    </div>
  );
}

function PreviewCard({ card }: PreviewCardProps) {
  const quantity = getCardQuantity(card);

  return (
    <article className="relative overflow-hidden rounded-lg bg-white">
      <img
        src={card.imageUrl}
        alt={card.memo || card.workTitle}
        className="aspect-square w-full bg-white object-contain"
      />

      {quantity > 1 ? (
        <span className="absolute right-1 top-1 rounded-full bg-neutral-950 px-1.5 py-0.5 text-[10px] font-black leading-none text-white">
          ×{quantity}
        </span>
      ) : null}
    </article>
  );
}
