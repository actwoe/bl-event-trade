'use client';

import { forwardRef } from 'react';
import {
  TRADE_CATEGORIES,
  TradeBoard,
  TradeCard,
} from '@/lib/trade-types';
import { QuantityBadge } from '@/components/trade/QuantityBadge';

type TradePreviewLabProps = {
  board: TradeBoard;
  collectionTitle: string;
};

type PreviewCardProps = {
  card: TradeCard;
  showMeta: boolean;
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
    return benefitSubcategory;
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

export const TradePreviewLab = forwardRef<HTMLDivElement, TradePreviewLabProps>(
  function TradePreviewLab({ board, collectionTitle }, ref) {
    const hasCards = board.cards.length > 0;
    const nickname = board.nickname.trim();
    const contact = board.contact.trim();
    const memoChips = getMemoChips(board.memo);
    const profileText = [nickname, contact].filter(Boolean).join(' · ');
    const grouped = board.categoryDisplayMode !== 'simple';

    return (
      <div
        ref={ref}
        className="w-[560px] bg-white p-6 text-neutral-950"
        style={{
          fontFamily:
            "'Apple SD Gothic Neo', 'Noto Sans KR', Arial, sans-serif",
        }}
      >
        <div className="overflow-hidden rounded-[30px] bg-white shadow-[0_10px_30px_rgba(15,23,42,0.12)]">
          <header className="bg-neutral-950 px-5 py-3 text-white">
            <div className="flex items-start justify-between gap-4">
              <div className="min-w-0 flex-1">
                <p className="text-[10px] font-black uppercase tracking-[0.24em] text-white/55">
                  Trade Board
                </p>

                <h1 className="mt-0.5 break-keep text-[22px] font-black leading-tight tracking-tight text-white">
                  {collectionTitle}
                </h1>

                {profileText ? (
                  <p className="mt-1.5 text-[11px] font-bold leading-4 text-white/70">
                    {profileText}
                  </p>
                ) : null}
              </div>

              {memoChips.length > 0 ? (
                <div className="flex max-h-[44px] max-w-[220px] shrink-0 flex-wrap justify-end gap-1 overflow-hidden">
                  {memoChips.map((chip) => (
                    <span
                      key={chip}
                      className="rounded-full bg-white px-2.5 py-1 text-[9px] font-black leading-none text-neutral-950"
                    >
                      {chip}
                    </span>
                  ))}
                </div>
              ) : null}
            </div>
          </header>

          <section className="px-6 py-4">
            {hasCards ? (
              <TradeColumns cards={board.cards} grouped={grouped} />
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

function TradeColumns({
  cards,
  grouped,
}: {
  cards: TradeCard[];
  grouped: boolean;
}) {
  const haveCards = cards.filter((card) => card.side === 'have');
  const wantCards = cards.filter((card) => card.side === 'want');

  return (
    <div>
      <div className="grid grid-cols-2 gap-3">
        <TradeSideHeader title="있어요" emoji="🙋🏻‍♀️" />
        <TradeSideHeader title="구해요" emoji="❤️" />
      </div>

      {grouped ? (
        <GroupedTradeRows haveCards={haveCards} wantCards={wantCards} />
      ) : (
        <div className="mt-3 grid grid-cols-2">
          <div className="min-w-0 pr-3">
            <CardGrid cards={haveCards} showMeta />
          </div>
          <div className="min-w-0 border-l border-neutral-200 pl-3">
            <CardGrid cards={wantCards} showMeta />
          </div>
        </div>
      )}
    </div>
  );
}

function TradeSideHeader({ title, emoji }: { title: string; emoji: string }) {
  return (
    <div className="flex min-h-8 items-center justify-center gap-1.5 rounded-xl bg-neutral-200 px-3 py-2 text-neutral-700">
      <span
        className="text-[12px] leading-none"
        style={{
          fontFamily:
            "'Apple Color Emoji', 'Segoe UI Emoji', 'Noto Color Emoji', sans-serif",
        }}
      >
        {emoji}
      </span>
      <span className="text-[12px] font-black leading-none">{title}</span>
    </div>
  );
}

function GroupedTradeRows({
  haveCards,
  wantCards,
}: {
  haveCards: TradeCard[];
  wantCards: TradeCard[];
}) {
  const haveGroups = getCardGroups(haveCards);
  const wantGroups = getCardGroups(wantCards);
  const groupOrder: Array<{ key: string; label: string }> = [];

  for (const group of [...haveGroups, ...wantGroups]) {
    if (!groupOrder.some((item) => item.key === group.key)) {
      groupOrder.push({ key: group.key, label: group.label });
    }
  }

  return (
    <div className="mt-4 flex flex-col gap-5">
      {groupOrder.map((group) => {
        const haveGroupCards =
          haveGroups.find((item) => item.key === group.key)?.cards ?? [];
        const wantGroupCards =
          wantGroups.find((item) => item.key === group.key)?.cards ?? [];

        return (
          <section
            key={group.key}
            className="block w-full [break-inside:avoid] [-webkit-column-break-inside:avoid]"
          >
            <div className="mb-2 grid min-h-5 w-full grid-cols-[max-content_minmax(0,1fr)] items-center gap-3">
              <h2 className="max-w-[220px] truncate text-[10px] font-black leading-5 text-neutral-700">
                {group.label}
              </h2>
              <div className="h-px w-full bg-neutral-300" />
            </div>

            <div className="grid grid-cols-2">
              <div className="min-w-0 pr-3">
                <CardGrid cards={haveGroupCards} showMeta={false} />
              </div>
              <div className="min-w-0 border-l border-neutral-200 pl-3">
                <CardGrid cards={wantGroupCards} showMeta={false} />
              </div>
            </div>
          </section>
        );
      })}
    </div>
  );
}

function CardGrid({ cards, showMeta }: { cards: TradeCard[]; showMeta: boolean }) {
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
        <div className="w-[calc(50%_-_0.25rem)]">
          <PreviewCard card={cards[0]} showMeta={showMeta} />
        </div>
      </div>
    );
  }

  return (
    <div className="grid grid-cols-2 gap-x-2 gap-y-1.5">
      {cards.map((card) => (
        <PreviewCard key={card.id} card={card} showMeta={showMeta} />
      ))}
    </div>
  );
}

function PreviewCard({ card, showMeta }: PreviewCardProps) {
  const metaLabel = getCardMetaLabel(card);
  const quantity = getCardQuantity(card);

  return (
    <article className="overflow-hidden rounded-2xl bg-white">
      <div className="relative bg-white px-1 pt-0.5">
        <img
          src={card.imageUrl}
          alt={card.memo || card.workTitle}
          loading="eager"
          decoding="async"
          className={`${card.imageRatio === 'photocard' ? 'aspect-[55/85]' : 'aspect-square'} w-full rounded-xl bg-white object-contain`}
        />

        <QuantityBadge quantity={quantity} />
      </div>

      <div className="px-1.5 pb-1 pt-1.5">
        <p className="line-clamp-1 text-center text-[10px] font-black leading-4 text-neutral-950">
          {card.workTitle || '작품명'}
        </p>

        {showMeta ? (
          <p className="mt-0 line-clamp-1 text-center text-[9px] font-bold leading-3 text-neutral-500">
            {metaLabel}
          </p>
        ) : null}

        {card.memo ? (
          <p className="mt-0.5 line-clamp-1 text-center text-[9px] font-bold leading-3 text-neutral-400">
            {card.memo}
          </p>
        ) : null}
      </div>
    </article>
  );
}
