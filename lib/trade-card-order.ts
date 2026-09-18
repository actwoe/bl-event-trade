import {
  TradeCard,
  TradeCategory,
  TradeCategoryKind,
  TradeSide,
} from "@/lib/trade-types";
import { getFallbackCategorySortOrder } from "@/lib/trade-item-categories";
import { normalizeBenefitSubcategorySortOrder } from "@/lib/trade-benefit-subcategory-order";
import { normalizeCollectionPhotoCardSortOrder } from "@/lib/trade-collection-photo-card-order";

function getCategoryKind(
  category: TradeCategory,
  categoryKind?: TradeCategoryKind,
): TradeCategoryKind {
  if (categoryKind) return categoryKind;
  if (category === "benefit" || category === "collection_photo_card") {
    return category;
  }
  return "standard";
}

function getTradeSideSortIndex(side: TradeSide) {
  return side === "have" ? 0 : 1;
}

function getTradeCategorySortIndex(
  category: TradeCategory,
  categorySortOrder?: number | null,
) {
  return typeof categorySortOrder === "number" && Number.isFinite(categorySortOrder)
    ? categorySortOrder
    : getFallbackCategorySortOrder(category);
}

function normalizeCatalogOrder(value?: number | null) {
  return typeof value === "number" && Number.isFinite(value)
    ? value
    : Number.MAX_SAFE_INTEGER;
}

function compareRegisteredBenefitCards(left: TradeCard, right: TradeCard) {
  const leftHasCatalogOrder = Number.isFinite(left.registeredCatalogOrder);
  const rightHasCatalogOrder = Number.isFinite(right.registeredCatalogOrder);

  if (!leftHasCatalogOrder && !rightHasCatalogOrder) return 0;
  if (leftHasCatalogOrder !== rightHasCatalogOrder) {
    return leftHasCatalogOrder ? -1 : 1;
  }

  return (
    normalizeCatalogOrder(left.registeredCatalogOrder) -
    normalizeCatalogOrder(right.registeredCatalogOrder)
  );
}

function compareCollectionPhotoCards(
  left: TradeCard,
  right: TradeCard,
  workFirst: boolean,
) {
  const leftHasRegisteredOrder = Number.isFinite(left.registeredSortOrder);
  const rightHasRegisteredOrder = Number.isFinite(right.registeredSortOrder);

  if (!leftHasRegisteredOrder && !rightHasRegisteredOrder) return 0;

  if (workFirst) {
    const workTitleDiff = left.workTitle.localeCompare(right.workTitle, "ko-KR", {
      numeric: true,
      sensitivity: "base",
    });
    if (workTitleDiff !== 0) return workTitleDiff;
  }

  if (leftHasRegisteredOrder !== rightHasRegisteredOrder) {
    return leftHasRegisteredOrder ? -1 : 1;
  }

  const variantDiff =
    normalizeCollectionPhotoCardSortOrder(left.registeredSortOrder) -
    normalizeCollectionPhotoCardSortOrder(right.registeredSortOrder);
  if (variantDiff !== 0) return variantDiff;

  if (!workFirst) {
    const itemNameDiff = (left.itemName ?? left.memo ?? "").localeCompare(
      right.itemName ?? right.memo ?? "",
      "ko-KR",
      { numeric: true, sensitivity: "base" },
    );
    if (itemNameDiff !== 0) return itemNameDiff;
  }

  return 0;
}

export function getTradeCardGroupKey(card: TradeCard) {
  const benefitSubcategory = card.benefitSubcategory?.trim() ?? "";
  const collectionKey = card.collectionId?.trim() || "__single_collection__";

  if (getCategoryKind(card.category, card.categoryKind) === "benefit") {
    return `${collectionKey}:benefit:${benefitSubcategory || "__none__"}`;
  }

  return `${collectionKey}:category:${card.category}`;
}

type TradeCardGroupOrder = {
  key: string;
  category: TradeCategory;
  categoryKind: TradeCategoryKind;
  benefitSubcategory: string;
  benefitSubcategorySortOrder: number;
  categorySortOrder: number;
  firstIndex: number;
  collectionId: string;
  collectionSortOrder: number;
  collectionTitle: string;
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
        categoryKind: getCategoryKind(card.category, card.categoryKind),
        benefitSubcategory,
        benefitSubcategorySortOrder,
        categorySortOrder: getTradeCategorySortIndex(card.category, card.categorySortOrder),
        firstIndex: index,
        collectionId: card.collectionId?.trim() || "__single_collection__",
        collectionSortOrder:
          typeof card.collectionSortOrder === "number" && Number.isFinite(card.collectionSortOrder)
            ? card.collectionSortOrder
            : 0,
        collectionTitle: card.collectionTitle?.trim() || "",
      });
      return;
    }

    if (
      getCategoryKind(card.category, card.categoryKind) === "benefit" &&
      benefitSubcategorySortOrder < existing.benefitSubcategorySortOrder
    ) {
      existing.benefitSubcategorySortOrder = benefitSubcategorySortOrder;
    }
  });

  return [...groups.values()]
    .sort((left, right) => {
      const collectionOrderDiff =
        left.collectionSortOrder - right.collectionSortOrder;
      if (collectionOrderDiff !== 0) return collectionOrderDiff;

      if (left.collectionId !== right.collectionId) {
        const collectionTitleDiff = left.collectionTitle.localeCompare(
          right.collectionTitle,
          "ko-KR",
          { numeric: true, sensitivity: "base" },
        );
        if (collectionTitleDiff !== 0) return collectionTitleDiff;
        const collectionIdDiff = left.collectionId.localeCompare(right.collectionId);
        if (collectionIdDiff !== 0) return collectionIdDiff;
      }

      const categoryDiff =
        left.categorySortOrder - right.categorySortOrder;
      if (categoryDiff !== 0) return categoryDiff;

      if (left.categoryKind === "benefit" && right.categoryKind === "benefit") {
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
 * 3. 각 특전 종류 안에서는 관리자 굿즈 등록 순서를 우선합니다.
 * 4. 최종 목록에서는 있어요를 먼저, 구해요를 뒤에 배치합니다.
 */
export function sortTradeCardsBySideAndGroup(cards: TradeCard[]) {
  const indexedCards = cards.map((card, index) => ({ card, index }));
  const sharedGroupOrder = createSharedGroupOrder(cards);
  const collectionWorkTitlesByCategory = new Map<string, Set<string>>();
  for (const card of cards) {
    if (
      getCategoryKind(card.category, card.categoryKind) !==
      "collection_photo_card"
    ) {
      continue;
    }

    const workTitle = card.workTitle.trim();
    if (!workTitle) continue;

    const collectionCategoryKey = `${card.collectionId?.trim() || "__single_collection__"}:${card.category}`;
    const titles =
      collectionWorkTitlesByCategory.get(collectionCategoryKey) ?? new Set<string>();
    titles.add(workTitle);
    collectionWorkTitlesByCategory.set(collectionCategoryKey, titles);
  }

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
        getCategoryKind(a.card.category, a.card.categoryKind) === "benefit" &&
        getCategoryKind(b.card.category, b.card.categoryKind) === "benefit"
      ) {
        const benefitCardDiff = compareRegisteredBenefitCards(a.card, b.card);
        if (benefitCardDiff !== 0) return benefitCardDiff;
      }

      if (
        a.card.category === b.card.category &&
        getCategoryKind(a.card.category, a.card.categoryKind) ===
          "collection_photo_card" &&
        getCategoryKind(b.card.category, b.card.categoryKind) ===
          "collection_photo_card"
      ) {
        const collectionCardDiff = compareCollectionPhotoCards(
          a.card,
          b.card,
          (collectionWorkTitlesByCategory.get(`${a.card.collectionId?.trim() || "__single_collection__"}:${a.card.category}`)?.size ?? 0) > 1,
        );
        if (collectionCardDiff !== 0) return collectionCardDiff;
      }

      return a.index - b.index;
    })
    .map(({ card }) => card);
}
