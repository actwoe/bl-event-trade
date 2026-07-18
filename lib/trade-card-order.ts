import {
  TRADE_CATEGORIES,
  TradeCard,
  TradeCategory,
  TradeSide,
} from "@/lib/trade-types";
import { normalizeBenefitSubcategorySortOrder } from "@/lib/trade-benefit-subcategory-order";
import { normalizeCollectionPhotoCardSortOrder } from "@/lib/trade-collection-photo-card-order";

function getTradeSideSortIndex(side: TradeSide) {
  return side === "have" ? 0 : 1;
}

function getTradeCategorySortIndex(category: TradeCategory) {
  const index = TRADE_CATEGORIES.findIndex((option) => option.id === category);
  return index === -1 ? TRADE_CATEGORIES.length : index;
}

function compareCollectionPhotoCards(left: TradeCard, right: TradeCard) {
  const leftHasRegisteredOrder = Number.isFinite(left.registeredSortOrder);
  const rightHasRegisteredOrder = Number.isFinite(right.registeredSortOrder);

  if (!leftHasRegisteredOrder && !rightHasRegisteredOrder) return 0;

  const workTitleDiff = left.workTitle.localeCompare(right.workTitle, "ko-KR", {
    numeric: true,
    sensitivity: "base",
  });
  if (workTitleDiff !== 0) return workTitleDiff;

  if (leftHasRegisteredOrder !== rightHasRegisteredOrder) {
    return leftHasRegisteredOrder ? -1 : 1;
  }

  return (
    normalizeCollectionPhotoCardSortOrder(left.registeredSortOrder) -
    normalizeCollectionPhotoCardSortOrder(right.registeredSortOrder)
  );
}

export function getTradeCardGroupKey(card: TradeCard) {
  const benefitSubcategory = card.benefitSubcategory?.trim() ?? "";

  if (card.category === "benefit") {
    return `benefit:${benefitSubcategory || "__none__"}`;
  }

  return `category:${card.category}`;
}

type TradeCardGroupOrder = {
  key: string;
  category: TradeCategory;
  benefitSubcategory: string;
  benefitSubcategorySortOrder: number;
  firstIndex: number;
};

function createSharedGroupOrder(cards: TradeCard[]) {
  const groups = new Map<string, TradeCardGroupOrder>();

  cards.forEach((card, index) => {
    const key = getTradeCardGroupKey(card);
    const existing = groups.get(key);
    const benefitSubcategory = card.benefitSubcategory?.trim() ?? "";
    const benefitSubcategorySortOrder = benefitSubcategory
      ? normalizeBenefitSubcategorySortOrder(
          card.benefitSubcategorySortOrder,
        )
      : -1;

    if (!existing) {
      groups.set(key, {
        key,
        category: card.category,
        benefitSubcategory,
        benefitSubcategorySortOrder,
        firstIndex: index,
      });
      return;
    }

    if (
      card.category === "benefit" &&
      benefitSubcategorySortOrder < existing.benefitSubcategorySortOrder
    ) {
      existing.benefitSubcategorySortOrder = benefitSubcategorySortOrder;
    }
  });

  return [...groups.values()]
    .sort((left, right) => {
      const categoryDiff =
        getTradeCategorySortIndex(left.category) -
        getTradeCategorySortIndex(right.category);
      if (categoryDiff !== 0) return categoryDiff;

      if (left.category === "benefit" && right.category === "benefit") {
        const subcategoryOrderDiff =
          left.benefitSubcategorySortOrder -
          right.benefitSubcategorySortOrder;
        if (subcategoryOrderDiff !== 0) return subcategoryOrderDiff;

        if (
          left.benefitSubcategorySortOrder !== Number.MAX_SAFE_INTEGER &&
          right.benefitSubcategorySortOrder !== Number.MAX_SAFE_INTEGER
        ) {
          const labelDiff = left.benefitSubcategory.localeCompare(
            right.benefitSubcategory,
            "ko-KR",
            { numeric: true, sensitivity: "base" },
          );
          if (labelDiff !== 0) return labelDiff;
        }
      }

      return left.firstIndex - right.firstIndex;
    })
    .reduce((orderMap, group, index) => {
      orderMap.set(group.key, index);
      return orderMap;
    }, new Map<string, number>());
}

/**
 * 있어요와 구해요가 같은 특전 종류 순서를 공유하도록 정렬합니다.
 *
 * 1. 행사 관리에서 지정한 특전 하위 분류 순서를 우선합니다.
 * 2. 순서가 없는 직접 업로드 그룹은 사용자가 처음 선택한 순서를 유지합니다.
 * 3. 각 특전 종류 안에서는 사용자가 선택한 순서를 유지합니다.
 * 4. 최종 목록에서는 있어요를 먼저, 구해요를 뒤에 배치합니다.
 */
export function sortTradeCardsBySideAndGroup(cards: TradeCard[]) {
  const indexedCards = cards.map((card, index) => ({ card, index }));
  const sharedGroupOrder = createSharedGroupOrder(cards);

  return indexedCards
    .sort((a, b) => {
      const sideDiff =
        getTradeSideSortIndex(a.card.side) - getTradeSideSortIndex(b.card.side);
      if (sideDiff !== 0) return sideDiff;

      const groupDiff =
        (sharedGroupOrder.get(getTradeCardGroupKey(a.card)) ??
          Number.MAX_SAFE_INTEGER) -
        (sharedGroupOrder.get(getTradeCardGroupKey(b.card)) ??
          Number.MAX_SAFE_INTEGER);
      if (groupDiff !== 0) return groupDiff;

      if (
        a.card.category === "collection_photo_card" &&
        b.card.category === "collection_photo_card"
      ) {
        const collectionCardDiff = compareCollectionPhotoCards(a.card, b.card);
        if (collectionCardDiff !== 0) return collectionCardDiff;
      }

      return a.index - b.index;
    })
    .map(({ card }) => card);
}
