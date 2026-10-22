import {
  RegisteredTradeItem,
  TradeCard,
  TradeCategory,
  TradeCategoryKind,
  TradeImageRatio,
} from "@/lib/trade-types";
import {
  compareBenefitSubcategoryValues,
} from "@/lib/trade-benefit-subcategory-order";
import { normalizeCollectionPhotoCardSortOrder } from "@/lib/trade-collection-photo-card-order";
import {
  getFallbackCategoryLabel,
  getFallbackCategorySortOrder,
} from "@/lib/trade-item-categories";


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

export function sortKoreanTitles(titles: string[]) {
  return [...titles].sort((a, b) =>
    a.localeCompare(b, "ko-KR", { numeric: true, sensitivity: "base" }),
  );
}

export function getCategoryLabel(
  category: TradeCategory,
  categoryLabel?: string | null,
) {
  return categoryLabel?.trim() || getFallbackCategoryLabel(category);
}

export function getCategorySortOrder(
  category: TradeCategory,
  categorySortOrder?: number | null,
) {
  return typeof categorySortOrder === "number" && Number.isFinite(categorySortOrder)
    ? categorySortOrder
    : getFallbackCategorySortOrder(category);
}

export function getItemImageRatio(item: RegisteredTradeItem): TradeImageRatio {
  return item.imageRatio === "photocard" ? "photocard" : "square";
}

export function getImageRatioClass(ratio: TradeImageRatio) {
  return ratio === "photocard" ? "aspect-[55/85]" : "aspect-square";
}

export function getBenefitSubcategoryLabel(value?: string | null) {
  return value?.trim() || "";
}

export function getItemMetaLabel(item: RegisteredTradeItem) {
  const categoryLabel = getCategoryLabel(item.category, item.categoryLabel);
  const benefitSubcategory = getBenefitSubcategoryLabel(item.benefitSubcategory);
  return getCategoryKind(item.category, item.categoryKind) === "benefit" &&
    benefitSubcategory
    ? `${categoryLabel} · ${benefitSubcategory}`
    : categoryLabel;
}

export function getCardMetaLabel(card: TradeCard) {
  const categoryLabel = getCategoryLabel(card.category, card.categoryLabel);
  const benefitSubcategory = getBenefitSubcategoryLabel(card.benefitSubcategory);
  return getCategoryKind(card.category, card.categoryKind) === "benefit" &&
    benefitSubcategory
    ? `${categoryLabel} · ${benefitSubcategory}`
    : categoryLabel;
}

function normalizeCatalogOrder(value?: number | null) {
  return typeof value === "number" && Number.isFinite(value)
    ? value
    : Number.MAX_SAFE_INTEGER;
}

export function sortRegisteredItems(items: RegisteredTradeItem[]) {
  const collectionWorkTitlesByCategory = new Map<string, Set<string>>();
  for (const item of items) {
    if (
      getCategoryKind(item.category, item.categoryKind) !==
      "collection_photo_card"
    ) {
      continue;
    }

    const workTitle = item.workTitle.trim();
    if (!workTitle) continue;

    const titles =
      collectionWorkTitlesByCategory.get(item.category) ?? new Set<string>();
    titles.add(workTitle);
    collectionWorkTitlesByCategory.set(item.category, titles);
  }

  return [...items].sort((a, b) => {
    const categoryDiff =
      getCategorySortOrder(a.category, a.categorySortOrder) -
      getCategorySortOrder(b.category, b.categorySortOrder);
    if (categoryDiff !== 0) return categoryDiff;

    if (a.category === "benefit" && b.category === "benefit") {
      const subcategoryDiff = compareBenefitSubcategoryValues(
        getBenefitSubcategoryLabel(a.benefitSubcategory),
        a.benefitSubcategorySortOrder,
        getBenefitSubcategoryLabel(b.benefitSubcategory),
        b.benefitSubcategorySortOrder,
      );
      if (subcategoryDiff !== 0) return subcategoryDiff;

      const catalogOrderDiff =
        normalizeCatalogOrder(a.catalogOrder) -
        normalizeCatalogOrder(b.catalogOrder);
      if (catalogOrderDiff !== 0) return catalogOrderDiff;
    }

    if (
      a.category === b.category &&
      getCategoryKind(a.category, a.categoryKind) === "collection_photo_card" &&
      getCategoryKind(b.category, b.categoryKind) === "collection_photo_card"
    ) {
      const collectionUsesMultipleWorks =
        (collectionWorkTitlesByCategory.get(a.category)?.size ?? 0) > 1;

      if (collectionUsesMultipleWorks) {
        const workTitleDiff = a.workTitle.localeCompare(b.workTitle, "ko-KR", {
          numeric: true,
          sensitivity: "base",
        });
        if (workTitleDiff !== 0) return workTitleDiff;
      }

      const collectionOrderDiff =
        normalizeCollectionPhotoCardSortOrder(a.sortOrder) -
        normalizeCollectionPhotoCardSortOrder(b.sortOrder);
      if (collectionOrderDiff !== 0) return collectionOrderDiff;

      const customOrderDiff =
        normalizeCatalogOrder(a.catalogOrder) - normalizeCatalogOrder(b.catalogOrder);
      if (customOrderDiff !== 0) return customOrderDiff;

      if (!collectionUsesMultipleWorks) {
        const itemNameDiff = a.itemName.localeCompare(b.itemName, "ko-KR", {
          numeric: true,
          sensitivity: "base",
        });
        if (itemNameDiff !== 0) return itemNameDiff;
      }
    }

    const customOrderDiff =
      normalizeCatalogOrder(a.catalogOrder) - normalizeCatalogOrder(b.catalogOrder);
    if (customOrderDiff !== 0) return customOrderDiff;

    return a.itemName.localeCompare(b.itemName, "ko-KR", {
      numeric: true,
      sensitivity: "base",
    });
  });
}
