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

type SideBlockProps = {
  title: string;
  emoji: string;
  cards: TradeCard[];
  hasDivider?: boolean;
};

type GroupedSideBlockProps = {
  title: string;
  emoji: string;
  side: 'have' | 'want';
  cards: TradeCard[];
  hasDivider?: boolean;
};

type PreviewCardProps = {
  card: TradeCard;
};

type QuantityTradeCard = TradeCard & {
  quantity?: number;
};

function getMemoChips(memo: string) {
  return memo
    .split(' · ')
    .map((text) => text.trim())
    .filter(Boolean);
}

function getCardQuantity(card: TradeCard) {
  const quantity = (card as QuantityTradeCard).quantity ?? 1;

  if (!Number.isFinite(quantity)) return 1;

  return Math.max(1, Math.floor(quantity));
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
    const profileText = [nickname, contact].filter(Boolean).join(' · ');
    const useSimpleMode = board.categoryDisplayMode === 'simple';

    return (
      <div ref={ref} className="w-[560px] bg-white p-6 text-neutral-950">
        <div className="overflow-hidden rounded-[30px] border-2 border-neutral-950 bg-white">
          <header className="bg-neutral-950 px-5 py-4 text-white">
            <div className="flex items-start justify-between gap-4">
              <div className="min-w-0 flex-1">
                <p className="text-[10px] font-black uppercase tracking-[0.24em] text-white/55">
                  Trade Board
                </p>

                <h1 className="mt-1 break-keep text-2xl font-black leading-tight tracking-tight text-white">
                  {collectionTitle}
                </h1>

                {profileText ? (
                  <p className="mt-2 text-[12px] font-bold leading-5 text-white/70">
                    {profileText}
                  </p>
                ) : null}
              </div>

              {memoChips.length > 0 ? (
                <div className="flex max-h-[52px] max-w-[210px] shrink-0 flex-wrap justify-end gap-1.5 overflow-hidden">
                  {memoChips.map((chip) => (
                    <span
                      key={chip}
                      className="rounded-full bg-white px-3 py-1.5 text-[10px] font-black leading-none text-neutral-950"
                    >
                      {chip}
                    </span>
                  ))}
                </div>
              ) : null}
            </div>
          </header>

          <section className="space-y-3 px-4 py-4">
            {hasCards ? (
              useSimpleMode ? (
                <SimpleSection cards={board.cards} />
              ) : (
                <GroupedSection cards={board.cards} />
              )
            ) : (
              <div className="rounded-[28px] border-2 border-dashed border-neutral-200 px-6 py-16 text-center">
                <p className="text-lg font-black text-neutral-300">
                  선택된 이미지가 없습니다
                </p>
              </div>
            )}
          </section>
        </div>
      </div>
    );
  },
);

function GroupedSection({ cards }: { cards: TradeCard[] }) {
  return (
    <section className="bg-white px-1 py-1.5">
      <div className="grid grid-cols-2">
        <GroupedSideBlock
          title="있어요"
          emoji="🙋🏻‍♀️"
          side="have"
          cards={cards}
          hasDivider={false}
        />

        <GroupedSideBlock
          title="구해요"
          emoji="❤️"
          side="want"
          cards={cards}
          hasDivider
        />
      </div>
    </section>
  );
}

function GroupedSideBlock({
  title,
  emoji,
  side,
  cards,
  hasDivider = false,
}: GroupedSideBlockProps) {
  const sideCards = cards.filter((card) => card.side === side);

  return (
    <div
      className={
        hasDivider
          ? 'min-w-0 border-l border-neutral-200 pl-3'
          : 'min-w-0 pr-3'
      }
    >
      <div className="mb-3 inline-flex items-center gap-1.5 rounded-full bg-neutral-100 px-3 py-1.5">
        <span className="text-xs">{emoji}</span>
        <span className="text-xs font-black text-neutral-950">{title}</span>
      </div>

      <div className="space-y-4">
        {TRADE_CATEGORIES.map((category) => {
          const categoryCards = sideCards.filter(
            (card) => card.category === category.id,
          );

          if (categoryCards.length === 0) {
            return null;
          }

          return (
            <section key={category.id}>
              <div className="mb-1.5 flex items-center gap-2">
                <h2 className="shrink-0 text-[11px] font-black text-neutral-700">
                  {category.label}
                </h2>
                <div className="h-px flex-1 bg-neutral-200" />
              </div>

              {categoryCards.length === 1 ? (
                <div className="flex justify-center">
                  <div className="w-[calc(50%-0.25rem)]">
                    <PreviewCard card={categoryCards[0]} />
                  </div>
                </div>
              ) : (
                <div className="grid grid-cols-2 gap-x-2 gap-y-1.5">
                  {categoryCards.map((card) => (
                    <PreviewCard key={card.id} card={card} />
                  ))}
                </div>
              )}
            </section>
          );
        })}
      </div>
    </div>
  );
}

function SimpleSection({ cards }: { cards: TradeCard[] }) {
  const haveCards = cards.filter((card) => card.side === 'have');
  const wantCards = cards.filter((card) => card.side === 'want');

  return (
    <section className="bg-white px-1 py-1.5">
      <div className="grid grid-cols-2">
        <SideBlock
          title="있어요"
          emoji="🙋🏻‍♀️"
          cards={haveCards}
          hasDivider={false}
        />

        <SideBlock
          title="구해요"
          emoji="❤️"
          cards={wantCards}
          hasDivider={true}
        />
      </div>
    </section>
  );
}

function SideBlock({ title, emoji, cards, hasDivider = false }: SideBlockProps) {
  return (
    <div
      className={
        hasDivider
          ? 'min-w-0 border-l border-neutral-200 pl-3'
          : 'min-w-0 pr-3'
      }
    >
      <div className="mb-1.5 inline-flex items-center gap-1.5 rounded-full bg-neutral-100 px-3 py-1.5">
        <span className="text-xs">{emoji}</span>
        <span className="text-xs font-black text-neutral-950">{title}</span>
      </div>

      {cards.length === 1 ? (
        <div className="flex justify-center">
          <div className="w-[calc(50%-0.25rem)]">
            <PreviewCard card={cards[0]} />
          </div>
        </div>
      ) : (
        <div className="grid grid-cols-2 gap-x-2 gap-y-1.5">
          {cards.map((card) => (
            <PreviewCard key={card.id} card={card} />
          ))}
        </div>
      )}
    </div>
  );
}

function PreviewCard({ card }: PreviewCardProps) {
  const metaLabel = getCardMetaLabel(card);
  const quantity = getCardQuantity(card);

  return (
    <article className="overflow-hidden rounded-2xl bg-white">
      <div className="relative bg-white px-1 pt-0">
        <img
          src={card.imageUrl}
          alt={card.memo || card.workTitle}
          className="aspect-[3/4] w-full rounded-xl bg-white object-contain"
        />

        {quantity > 1 ? (
          <span className="absolute right-2.5 top-2.5 flex h-3.5 w-3.5 items-center justify-center rounded-full bg-neutral-950 text-[7px] font-black leading-none text-white shadow-sm">
            ×{quantity}
          </span>
        ) : null}
      </div>

      <div className="-mt-1 px-1.5 pb-1 pt-0">
        <p className="line-clamp-1 text-[10px] font-black leading-4 text-neutral-950">
          {card.workTitle || '작품명'}
        </p>

        <p className="mt-0 line-clamp-1 text-[9px] font-bold leading-3 text-neutral-500">
          {metaLabel}
        </p>

        {card.memo ? (
          <p className="mt-0.5 line-clamp-1 text-[9px] font-bold leading-3 text-neutral-400">
            {card.memo}
          </p>
        ) : null}
      </div>
    </article>
  );
}
