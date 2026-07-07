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

type CategorySectionProps = {
  category: TradeCategory;
  cards: TradeCard[];
};

type SideBlockProps = {
  label: string;
  cards: TradeCard[];
};

type PreviewCardProps = {
  card: TradeCard;
};

export const TradePreview = forwardRef<HTMLDivElement, TradePreviewProps>(
  function TradePreview({ board, collectionTitle }, ref) {
    const hasCards = board.cards.length > 0;
    const profileTexts = [board.nickname, board.contact].filter(
      (item) => item.trim().length > 0,
    );
    const conditionChips = board.memo
      .split(' · ')
      .map((item) => item.trim())
      .filter(Boolean);

    return (
      <div ref={ref} className="w-[560px] bg-white p-5 text-neutral-950">
        <div className="overflow-hidden rounded-[34px] border-2 border-neutral-950 bg-white shadow-[10px_10px_0_#171717]">
          <header className="bg-neutral-950 px-6 py-6 text-white">
            <p className="text-[11px] font-black uppercase tracking-[0.28em] text-neutral-400">
              Goods Trade Board
            </p>

            <h1 className="mt-2 break-keep text-[34px] font-black leading-[1.05] tracking-tight">
              {collectionTitle}
            </h1>

            {profileTexts.length > 0 ? (
              <p className="mt-3 break-keep text-sm font-bold leading-6 text-neutral-200">
                {profileTexts.join(' · ')}
              </p>
            ) : null}

            {conditionChips.length > 0 ? (
              <div className="mt-4 flex flex-wrap gap-2">
                {conditionChips.map((chip) => (
                  <span
                    key={chip}
                    className="rounded-full bg-white px-3 py-1.5 text-[11px] font-black text-neutral-950"
                  >
                    {chip}
                  </span>
                ))}
              </div>
            ) : null}
          </header>

          <section className="space-y-6 bg-white px-5 py-5">
            {hasCards ? (
              TRADE_CATEGORIES.map((category) => (
                <CategorySection
                  key={category.id}
                  category={category.id}
                  cards={board.cards}
                />
              ))
            ) : (
              <div className="rounded-[28px] border-2 border-dashed border-neutral-200 px-6 py-16 text-center">
                <p className="text-lg font-black text-neutral-300">
                  선택된 이미지가 없습니다
                </p>
              </div>
            )}
          </section>

          <footer className="border-t-2 border-dashed border-neutral-200 bg-neutral-50 px-6 py-4 text-center text-[10px] font-bold leading-5 text-neutral-400">
            <p>본 이미지는 비공식 교환판입니다.</p>
            <p>
              사이트에 기재된 모든 이미지의 저작권은 키다리스튜디오와 각
              작가님들께 있습니다.
            </p>
          </footer>
        </div>
      </div>
    );
  },
);

function CategorySection({ category, cards }: CategorySectionProps) {
  const categoryOption = TRADE_CATEGORIES.find((option) => option.id === category);
  const categoryLabel = categoryOption?.label ?? category;

  const haveCards = cards.filter(
    (card) => card.category === category && card.side === 'have',
  );

  const wantCards = cards.filter(
    (card) => card.category === category && card.side === 'want',
  );

  const hasHaveCards = haveCards.length > 0;
  const hasWantCards = wantCards.length > 0;

  if (!hasHaveCards && !hasWantCards) {
    return null;
  }

  return (
    <section>
      <h2 className="mb-3 text-xl font-black tracking-tight text-neutral-950">
        {categoryLabel}
      </h2>

      <div
        className={
          hasHaveCards && hasWantCards
            ? 'grid grid-cols-2 gap-4'
            : 'grid grid-cols-1 gap-4'
        }
      >
        {hasHaveCards ? <SideBlock label="있어요" cards={haveCards} /> : null}
        {hasWantCards ? <SideBlock label="구해요" cards={wantCards} /> : null}
      </div>
    </section>
  );
}

function SideBlock({ label, cards }: SideBlockProps) {
  return (
    <div>
      <div className="mb-2 flex items-center justify-center">
        <span className="rounded-full bg-neutral-950 px-4 py-1.5 text-xs font-black text-white">
          {label}
        </span>
      </div>

      <div className="grid grid-cols-2 gap-2">
        {cards.map((card) => (
          <PreviewCard key={card.id} card={card} />
        ))}
      </div>
    </div>
  );
}

function PreviewCard({ card }: PreviewCardProps) {
  return (
    <article className="overflow-hidden rounded-2xl bg-white">
      <img
        src={card.imageUrl}
        alt={card.memo || card.workTitle}
        className="aspect-[3/4] w-full bg-white object-contain p-1"
      />
    </article>
  );
}
