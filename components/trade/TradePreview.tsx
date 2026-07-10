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
  title: string;
  emoji: string;
  cards: TradeCard[];
};

type PreviewCardProps = {
  card: TradeCard;
};

function getMemoChips(memo: string) {
  return memo
    .split(' · ')
    .map((text) => text.trim())
    .filter(Boolean);
}

function getCardMetaLabel(card: TradeCard) {
  const categoryLabel =
    TRADE_CATEGORIES.find((category) => category.id === card.category)?.label ??
    card.category;

  const benefitSubcategory =
    'benefitSubcategory' in card && typeof card.benefitSubcategory === 'string'
      ? card.benefitSubcategory.trim()
      : '';

  if (card.category === 'benefit' && benefitSubcategory) {
    return `${categoryLabel} · ${benefitSubcategory}`;
  }

  return categoryLabel;
}

export const TradePreview = forwardRef<HTMLDivElement, TradePreviewProps>(
  function TradePreview({ board, collectionTitle }, ref) {
    const hasCards = board.cards.length > 0;
    const nickname = board.nickname.trim();
    const contact = board.contact.trim();
    const memoChips = getMemoChips(board.memo);
    const hasMeta = nickname || contact || memoChips.length > 0;

    return (
      <div ref={ref} className="w-[560px] bg-white p-6 text-neutral-950">
        <header className="rounded-[28px] border-2 border-neutral-950 bg-white p-5">
          <div className="flex items-start justify-between gap-4">
            <div className="min-w-0">
              <p className="text-[10px] font-black uppercase tracking-[0.24em] text-neutral-400">
                Trade Board
              </p>

              <h1 className="mt-1 break-keep text-2xl font-black leading-tight tracking-tight">
                {collectionTitle}
              </h1>
            </div>

            <div className="shrink-0 rounded-full bg-neutral-950 px-4 py-2 text-xs font-black text-white">
              GOODS
            </div>
          </div>

          {hasMeta ? (
            <div className="mt-4 flex flex-wrap gap-2">
              {contact ? (
                <span className="rounded-full bg-neutral-950 px-3 py-1.5 text-[11px] font-black text-white">
                  {contact}
                </span>
              ) : null}

              {nickname ? (
                <span className="rounded-full bg-neutral-100 px-3 py-1.5 text-[11px] font-black text-neutral-700">
                  {nickname}
                </span>
              ) : null}

              {memoChips.map((chip) => (
                <span
                  key={chip}
                  className="rounded-full bg-neutral-100 px-3 py-1.5 text-[11px] font-bold text-neutral-600"
                >
                  {chip}
                </span>
              ))}
            </div>
          ) : null}
        </header>

        <section className="mt-5 space-y-5">
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

        <footer className="mt-6 border-t border-neutral-200 pt-4 text-center text-[10px] font-bold leading-5 text-neutral-400">
          <p>본 이미지는 비공식 팬메이드 교환판입니다.</p>
          <p>
            사이트에 기재된 모든 이미지의 저작권은 키다리스튜디오와 각
            작가님들께 있습니다.
          </p>
        </footer>
      </div>
    );
  },
);

function CategorySection({ category, cards }: CategorySectionProps) {
  const categoryOption = TRADE_CATEGORIES.find(
    (option) => option.id === category,
  );
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
    <section className="overflow-hidden rounded-[28px] border-2 border-neutral-950 bg-white">
      <div className="bg-neutral-950 px-5 py-3">
        <h2 className="text-lg font-black text-white">{categoryLabel}</h2>
      </div>

      <div className="space-y-4 p-4">
        {haveCards.length > 0 ? (
          <SideBlock title="있어요" emoji="🙋🏻‍♀️" cards={haveCards} />
        ) : null}

        {wantCards.length > 0 ? (
          <SideBlock title="구해요" emoji="❤️" cards={wantCards} />
        ) : null}
      </div>
    </section>
  );
}

function SideBlock({ title, emoji, cards }: SideBlockProps) {
  return (
    <div>
      <div className="mb-3 inline-flex items-center gap-2 rounded-full bg-neutral-100 px-4 py-2">
        <span className="text-sm">{emoji}</span>
        <span className="text-sm font-black text-neutral-950">{title}</span>
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
  const metaLabel = getCardMetaLabel(card);

  return (
    <article className="overflow-hidden rounded-2xl border border-neutral-200 bg-white">
      <div className="relative bg-white p-1.5">
        <img
          src={card.imageUrl}
          alt={card.memo || card.workTitle}
          className="aspect-[3/4] w-full rounded-xl bg-white object-contain"
        />
      </div>

      <div className="border-t border-neutral-100 px-2 py-2">
        <p className="line-clamp-1 text-[10px] font-black text-neutral-950">
          {card.workTitle || '작품명'}
        </p>

        <p className="mt-0.5 line-clamp-1 text-[9px] font-bold leading-4 text-neutral-500">
          {metaLabel}
        </p>

        {card.memo ? (
          <p className="mt-0.5 line-clamp-1 text-[9px] font-bold leading-4 text-neutral-400">
            {card.memo}
          </p>
        ) : null}
      </div>
    </article>
  );
}
