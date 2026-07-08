'use client';

import { forwardRef } from 'react';
import {
  TRADE_CATEGORIES,
  TradeBoard,
  TradeCard,
  TradeCategory,
  TradeImageRatio,
} from '@/lib/trade-types';

type TradePreviewProps = {
  board: TradeBoard;
  collectionTitle: string;
};

type QuantityTradeCard = TradeCard & {
  quantity?: number;
};

type VisibleCategory = {
  key: string;
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

  if (totalCardCount === 0) return 2;

  // 실제로 화면에 보이는 카드 개수를 기준으로 계산합니다.
  // 수량(quantity)은 ×2, ×3 배지로만 표시하고 사이즈 계산에는 넣지 않습니다.
  // 합쳐서 1~4개일 때도 한 줄 4개 기준 사이즈로 맞춥니다.
  if (totalCardCount <= 4 && maxSideCardCount <= 2) return 2;

  return 3;
}

function getCardWidth(columnCount: 1 | 2 | 3) {
  if (columnCount === 1) return '100%';
  if (columnCount === 2) return 'calc((100% - 0.25rem) / 2)';
  return 'calc((100% - 0.5rem) / 3)';
}

function getImageRatio(card: TradeCard): TradeImageRatio {
  return card.imageRatio === 'photocard' ? 'photocard' : 'square';
}

function getImageRatioClass(card: TradeCard) {
  return getImageRatio(card) === 'photocard' ? 'aspect-[55/85]' : 'aspect-square';
}

function getBenefitSubcategory(card: TradeCard) {
  return card.benefitSubcategory?.trim() || '';
}

function compareKorean(a: string, b: string) {
  return a.localeCompare(b, 'ko-KR', {
    numeric: true,
    sensitivity: 'base',
  });
}

function getBenefitSectionLabel(subcategory: string) {
  return subcategory ? `특전 · ${subcategory}` : '특전';
}

function createBenefitSections(cards: TradeCard[]) {
  const benefitCards = cards.filter((card) => card.category === 'benefit');
  const subcategories = Array.from(
    new Set(benefitCards.map((card) => getBenefitSubcategory(card))),
  ).sort((a, b) => {
    if (!a && b) return 1;
    if (a && !b) return -1;
    return compareKorean(a, b);
  });

  return subcategories
    .map((subcategory) => {
      const scopedCards = benefitCards.filter(
        (card) => getBenefitSubcategory(card) === subcategory,
      );
      const haveCards = scopedCards.filter((card) => card.side === 'have');
      const wantCards = scopedCards.filter((card) => card.side === 'want');

      return {
        key: `benefit-${subcategory || 'none'}`,
        id: 'benefit' as TradeCategory,
        label: getBenefitSectionLabel(subcategory),
        haveCards,
        wantCards,
        columnCount: getColumnCount(haveCards, wantCards),
      };
    })
    .filter(
      (category) => category.haveCards.length > 0 || category.wantCards.length > 0,
    );
}

function getVisibleCategories(cards: TradeCard[]): VisibleCategory[] {
  const benefitSections = createBenefitSections(cards);
  const otherSections = TRADE_CATEGORIES.filter(
    (category) => category.id !== 'benefit',
  )
    .map((category) => {
      const haveCards = cards.filter(
        (card) => card.category === category.id && card.side === 'have',
      );

      const wantCards = cards.filter(
        (card) => card.category === category.id && card.side === 'want',
      );

      return {
        key: category.id,
        id: category.id,
        label: category.label,
        haveCards,
        wantCards,
        columnCount: getColumnCount(haveCards, wantCards),
      };
    })
    .filter(
      (category) => category.haveCards.length > 0 || category.wantCards.length > 0,
    );

  return [...benefitSections, ...otherSections];
}

export const TradePreview = forwardRef<HTMLDivElement, TradePreviewProps>(
  function TradePreview({ board, collectionTitle }, ref) {
    const visibleCategories = getVisibleCategories(board.cards);
    const hasCards = visibleCategories.length > 0;
    const nickname = board.nickname.trim();
    const contact = board.contact.trim();
    const hasProfile = nickname.length > 0 || contact.length > 0;
    const conditionItems = board.memo
      .split(' · ')
      .map((item) => item.trim())
      .filter(Boolean);

    return (
      <div ref={ref} className="w-[560px] bg-white p-3 text-neutral-950">
        <div className="overflow-hidden rounded-[24px] border border-neutral-200 bg-white">
          <header className="bg-neutral-950 px-4 py-3 text-white">
            <div className="flex items-center justify-between gap-3">
              <div className="min-w-0 flex-1 text-left">
                <h1 className="break-keep text-[21px] font-black leading-[1.08] tracking-tight">
                  {collectionTitle}
                </h1>

                {hasProfile ? (
                  <div className="mt-1 flex flex-wrap items-center gap-x-1.5 gap-y-0.5 text-[9px] font-extrabold leading-3 text-white/70">
                    {nickname.length > 0 ? (
                      <span className="max-w-[180px] truncate">{nickname}</span>
                    ) : null}

                    {nickname.length > 0 && contact.length > 0 ? (
                      <span className="text-white/35">/</span>
                    ) : null}

                    {contact.length > 0 ? (
                      <span className="max-w-[180px] truncate">{contact}</span>
                    ) : null}
                  </div>
                ) : (
                  <p className="mt-1 text-[9px] font-extrabold leading-3 text-white/35">
                    POPUP & CALLABO CAFE TRADE BOARD
                  </p>
                )}
              </div>

              {conditionItems.length > 0 ? (
                <div className="flex max-w-[220px] shrink-0 flex-wrap justify-end gap-1">
                  {conditionItems.map((condition) => (
                    <span
                      key={condition}
                      className="rounded-full border border-white/25 bg-white px-2.5 py-1 text-[8px] font-black leading-none text-neutral-950"
                    >
                      {condition}
                    </span>
                  ))}
                </div>
              ) : null}
            </div>
          </header>

          <section className="bg-neutral-100 px-3 py-3">
            {hasCards ? (
              visibleCategories.map((category, index) => (
                <CategorySection
                  key={category.key}
                  category={category}
                  isFirst={index === 0}
                />
              ))
            ) : (
              <div className="rounded-[20px] border-2 border-dashed border-neutral-300 bg-white px-5 py-12 text-center">
                <p className="text-base font-black text-neutral-300">
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

function CategorySection({ category, isFirst }: CategorySectionProps) {
  return (
    <section className={isFirst ? 'pb-3' : 'border-t border-neutral-200 py-3'}>
      <div className="mb-2 flex items-center gap-2">
        <span className="h-3 w-1 rounded-full bg-neutral-950" />
        <h2 className="text-left text-sm font-black tracking-tight text-neutral-950">
          {category.label}
        </h2>
      </div>

      <div className="grid grid-cols-[1fr_1px_1fr] gap-2.5">
        <SideBlock
          label="있어요"
          cards={category.haveCards}
          columnCount={category.columnCount}
        />
        <div className="bg-neutral-200" aria-hidden="true" />
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
  const cardWidth = getCardWidth(columnCount);

  return (
    <div>
      <div className="mb-1.5 rounded-md bg-neutral-100 px-2 py-1 text-center">
        <span
          className={
            hasCards
              ? 'text-[10px] font-black text-neutral-950'
              : 'text-[10px] font-black text-neutral-300'
          }
        >
          {label}
        </span>
      </div>

      <div
        className={
          cards.length < columnCount
            ? 'flex flex-wrap items-start justify-center gap-1'
            : 'flex flex-wrap items-start justify-start gap-1'
        }
      >
        {cards.map((card) => (
          <div key={card.id} style={{ width: cardWidth }}>
            <PreviewCard card={card} />
          </div>
        ))}
      </div>
    </div>
  );
}

function PreviewCard({ card }: PreviewCardProps) {
  const quantity = getCardQuantity(card);

  return (
    <article className="relative overflow-hidden rounded-lg border border-neutral-300 bg-neutral-50 p-[2px] shadow-sm">
      <img
        src={card.imageUrl}
        alt={card.memo || card.workTitle}
        className={`${getImageRatioClass(card)} w-full rounded-md bg-white object-contain`}
      />

      {quantity > 1 ? (
        <span className="absolute right-1 top-1 rounded-full bg-neutral-950 px-1.5 py-0.5 text-[10px] font-black leading-none text-white">
          ×{quantity}
        </span>
      ) : null}
    </article>
  );
}
