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

type SideColumnProps = {
  title: string;
  emoji: string;
  side: 'have' | 'want';
  cards: TradeCard[];
  grouped: boolean;
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

type CardGroup = {
  key: string;
  label: string;
  cards: TradeCard[];
};

function getCardGroups(cards: TradeCard[]): CardGroup[] {
  const groups: CardGroup[] = [];

  for (const category of TRADE_CATEGORIES) {
    const categoryCards = cards.filter((card) => card.category === category.id);

    if (categoryCards.length === 0) continue;

    if (category.id !== 'benefit') {
      groups.push({
        key: category.id,
        label: category.label,
        cards: categoryCards,
      });
      continue;
    }

    const benefitGroups = new Map<string, TradeCard[]>();

    for (const card of categoryCards) {
      const subcategory =
        'benefitSubcategory' in card &&
        typeof card.benefitSubcategory === 'string'
          ? card.benefitSubcategory.trim()
          : '';
      const label = subcategory || category.label;
      const key = subcategory ? `benefit:${subcategory}` : 'benefit';
      const currentCards = benefitGroups.get(key) ?? [];
      currentCards.push(card);
      benefitGroups.set(key, currentCards);

      if (!groups.some((group) => group.key === key)) {
        groups.push({ key, label, cards: currentCards });
      }
    }
  }

  return groups;
}

export const TradePreview = forwardRef<HTMLDivElement, TradePreviewProps>(
  function TradePreview({ board, collectionTitle }, ref) {
    const hasCards = board.cards.length > 0;
    const nickname = board.nickname.trim();
    const contact = board.contact.trim();
    const memoChips = getMemoChips(board.memo);
    const profileText = [nickname, contact].filter(Boolean).join(' · ');
    const grouped = board.categoryDisplayMode !== 'simple';

    return (
      <div ref={ref} className="w-[560px] bg-white p-6 text-neutral-950">
        <div className="overflow-hidden rounded-[30px] bg-white">
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

          <section className="px-4 py-4">
            {hasCards ? (
              <div className="grid grid-cols-2">
                <SideColumn
                  title="있어요"
                  emoji="🙋🏻‍♀️"
                  side="have"
                  cards={board.cards}
                  grouped={grouped}
                />
                <SideColumn
                  title="구해요"
                  emoji="❤️"
                  side="want"
                  cards={board.cards}
                  grouped={grouped}
                  hasDivider
                />
              </div>
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

function SideColumn({
  title,
  emoji,
  side,
  cards,
  grouped,
  hasDivider = false,
}: SideColumnProps) {
  const sideCards = cards.filter((card) => card.side === side);
  const cardGroups = getCardGroups(sideCards);

  return (
    <section
      className={
        hasDivider
          ? 'min-w-0 border-l border-neutral-200 pl-3'
          : 'min-w-0 pr-3'
      }
    >
      <div className="mb-3 flex min-h-11 w-full items-center justify-center gap-2 rounded-2xl bg-neutral-200 px-3 py-3 text-neutral-800 shadow-[0_4px_12px_rgba(15,23,42,0.14)]">
        <span className="text-sm leading-none">{emoji}</span>
        <span className="text-sm font-black leading-none">{title}</span>
      </div>

      {grouped ? (
        <div className="flex flex-col gap-4">
          {cardGroups.map((group) => (
            <section
              key={group.key}
              className="block w-full [break-inside:avoid] [-webkit-column-break-inside:avoid]"
            >
              <div className="mb-2 flex min-h-5 w-full items-center gap-2">
                <h2 className="shrink-0 text-[10px] font-black leading-5 text-neutral-700">
                  {group.label}
                </h2>
                <div className="h-px min-w-0 flex-1 bg-neutral-200" />
              </div>
              <CardGrid cards={group.cards} />
            </section>
          ))}
        </div>
      ) : (
        <CardGrid cards={sideCards} />
      )}
    </section>
  );
}

function CardGrid({ cards }: { cards: TradeCard[] }) {
  if (cards.length === 0) {
    return (
      <div className="flex min-h-20 items-center justify-center rounded-xl bg-neutral-50 px-3 text-center text-[10px] font-bold text-neutral-300">
        선택된 굿즈가 없습니다
      </div>
    );
  }

  if (cards.length === 1) {
    return (
      <div className="flex justify-center">
        <div className="w-[calc(50%-0.25rem)]">
          <PreviewCard card={cards[0]} />
        </div>
      </div>
    );
  }

  return (
    <div className="grid grid-cols-2 gap-x-2 gap-y-1.5">
      {cards.map((card) => (
        <PreviewCard key={card.id} card={card} />
      ))}
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
          crossOrigin="anonymous"
          referrerPolicy="no-referrer"
          className="aspect-[3/4] w-full rounded-xl bg-white object-contain"
        />

        {quantity > 1 ? (
          <span className="absolute right-3 top-3 flex h-4 w-4 items-center justify-center rounded-full bg-neutral-950 text-[7px] font-black leading-none text-white">
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
