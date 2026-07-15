import {
  RegisteredTradeItem,
  TRADE_CATEGORIES,
  TradeCard,
  TradeCategory,
  TradeImageRatio,
} from "@/lib/trade-types";

export function sortKoreanTitles(titles: string[]) {
  return [...titles].sort((a, b) =>
    a.localeCompare(b, "ko-KR", { numeric: true, sensitivity: "base" }),
  );
}

export function getCategoryLabel(category: TradeCategory) {
  return TRADE_CATEGORIES.find((option) => option.id === category)?.label ?? category;
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
  const categoryLabel = getCategoryLabel(item.category);
  const benefitSubcategory = getBenefitSubcategoryLabel(item.benefitSubcategory);
  return item.category === "benefit" && benefitSubcategory
    ? `${categoryLabel} · ${benefitSubcategory}`
    : categoryLabel;
}

export function getCardMetaLabel(card: TradeCard) {
  const categoryLabel = getCategoryLabel(card.category);
  const benefitSubcategory = getBenefitSubcategoryLabel(card.benefitSubcategory);
  return card.category === "benefit" && benefitSubcategory
    ? `${categoryLabel} · ${benefitSubcategory}`
    : card.memo || categoryLabel;
}

function getCategorySortIndex(category: TradeCategory) {
  const index = TRADE_CATEGORIES.findIndex((option) => option.id === category);
  return index === -1 ? TRADE_CATEGORIES.length : index;
}

export function sortRegisteredItems(items: RegisteredTradeItem[]) {
  return [...items].sort((a, b) => {
    const categoryDiff = getCategorySortIndex(a.category) - getCategorySortIndex(b.category);
    if (categoryDiff !== 0) return categoryDiff;

    if (a.category === "benefit" && b.category === "benefit") {
      const subcategoryDiff = getBenefitSubcategoryLabel(a.benefitSubcategory).localeCompare(
        getBenefitSubcategoryLabel(b.benefitSubcategory),
        "ko-KR",
        { numeric: true, sensitivity: "base" },
      );
      if (subcategoryDiff !== 0) return subcategoryDiff;
    }

    return a.itemName.localeCompare(b.itemName, "ko-KR", {
      numeric: true,
      sensitivity: "base",
    });
  });
}
