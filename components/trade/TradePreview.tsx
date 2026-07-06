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
    const haveCount = board.cards.filter((card) => card.side === 'have').length;
    const wantCount = board.cards.filter((card) => card.side === 'want').length;
    const ownerChips = [board.contact, board.nickname].filter(
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
            <div className="flex items-start justify-between gap-5">
              <div className="min-w-0">
                <p className="text-[11px] font-black uppercase tracking-[0.28em] text-neutral-400">
                  Goods Trade Board
                </p>

                <h1 className="mt-2 break-keep text-[34px] font-black leading-[1.05] tracking-tight">
                  {collectionTitle}
                </h1>
              </div>

              <div className="shrink-0 rounded-full border border-white/30 px-4 py-2 text-xs font-black">
                FAN MADE
              </div>
            </div>

            <div className="mt-5 grid grid-cols-2 gap-3">
              <div className="rounded-3xl bg-white px-4 py-3 text-neutral-950">
                <p className="text-[10px] font-black uppercase tracking-[0.2em] text-neutral-400">
                  Have
                </p>
                <p className="mt-1 text-2xl font-black">{haveCount}</p>
              </div>

              <div className="rounded-3xl bg-white px-4 py-3 text-neutral-950">
                <p className="text-[10px] font-black uppercase tracking-[0.2em] text-neutral-400">
                  Want
                </p>
                <p className="mt-1 text-2xl font-black">{wantCount}</p>
              </div>
            </div>

            {ownerChips.length > 0 || conditionChips.length > 0 ? (
              <div className="mt-4 flex flex-wrap gap-2">
                {ownerChips.map((chip) => (
                  <span
                    key={chip}
                    className="rounded-full bg-white/10 px-3 py-1.5 text-[11px] font-black text-white ring-1 ring-white/20"
                  >
                    {chip}
                  </span>
                ))}

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

          <section className="space-y-5 bg-white px-5 py-5">
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
            <p>본 이미지는 비공식 팬메이드 교환판입니다.</p>
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

  if (haveCards.length === 0 && wantCards.length === 0) {
    return null;
  }

  return (
    <section className="rounded-[30px] border border-neutral-200 bg-neutral-50 p-4">
      <div className="mb-4 flex items-center justify-between gap-3">
        <h2 className="text-xl font-black tracking-tight text-neutral-950">
          {categoryLabel}
        </h2>

        <span className="rounded-full bg-neutral-950 px-3 py-1 text-[10px] font-black uppercase tracking-[0.18em] text-white">
          {haveCards.length + wantCards.length} items
        </span>
      </div>

      <div className="space-y-4">
        {haveCards.length > 0 ? (
          <SideBlock label="있어요" cards={haveCards} />
        ) : null}

        {wantCards.length > 0 ? (
          <SideBlock label="구해요" cards={wantCards} />
        ) : null}
      </div>
    </section>
  );
}

function SideBlock({ label, cards }: SideBlockProps) {
  return (
    <div>
      <div className="mb-2 flex items-center gap-2">
        <span className="rounded-full bg-white px-3 py-1 text-xs font-black text-neutral-950 ring-1 ring-neutral-200">
          {label}
        </span>
        <span className="text-[10px] font-black uppercase tracking-[0.18em] text-neutral-400">
          {cards.length} selected
        </span>
      </div>

      <div className="grid grid-cols-3 gap-3">
        {cards.map((card) => (
          <PreviewCard key={card.id} card={card} />
        ))}
      </div>
    </div>
  );
}

function PreviewCard({ card }: PreviewCardProps) {
  return (
    <article className="overflow-hidden rounded-2xl bg-white shadow-sm ring-1 ring-neutral-200">
      <div className="relative bg-neutral-100">
        <img
          src={card.imageUrl}
          alt={card.memo || card.workTitle}
          className="aspect-[3/4] w-full object-cover"
        />

        <div className="absolute inset-x-0 bottom-0 bg-neutral-950/80 px-1 py-1 text-center text-[9px] font-black text-white">
          SAMPLE
        </div>
      </div>

      <div className="px-2 py-2">
        <p className="line-clamp-1 text-[10px] font-black text-neutral-950">
          {card.workTitle || '작품명'}
        </p>

        {card.memo ? (
          <p className="mt-0.5 line-clamp-2 text-[9px] font-bold leading-4 text-neutral-500">
            {card.memo}
          </p>
        ) : null}
      </div>
    </article>
  );
}
