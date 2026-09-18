import {
  TRADE_CATEGORIES,
  TradeCategory,
  TradeCategoryKind,
  TradeCategoryOption,
} from '@/lib/trade-types';

export type TradeItemCategoryRow = {
  id?: string;
  collection_id?: string;
  category_key: string;
  label: string;
  category_kind?: TradeCategoryKind | string | null;
  is_visible?: boolean | null;
  sort_order?: number | null;
  created_at?: string;
};

export function normalizeCategoryKind(
  value?: string | null,
): TradeCategoryKind {
  if (value === 'benefit' || value === 'collection_photo_card') return value;
  return 'standard';
}

export function getLegacyCategoryOption(
  category: TradeCategory,
): TradeCategoryOption | undefined {
  return TRADE_CATEGORIES.find((option) => option.id === category);
}

export function getFallbackCategoryLabel(category: TradeCategory) {
  const legacyLabel = getLegacyCategoryOption(category)?.label;
  if (legacyLabel) return legacyLabel;
  return category.startsWith('custom_') ? '기타 굿즈' : category;
}

export function getFallbackCategorySortOrder(category: TradeCategory) {
  return (
    getLegacyCategoryOption(category)?.sortOrder ?? Number.MAX_SAFE_INTEGER
  );
}

export function categoryRowsToOptions(
  rows: TradeItemCategoryRow[],
): TradeCategoryOption[] {
  return [...rows]
    .sort((a, b) => {
      const orderDiff = (a.sort_order ?? 0) - (b.sort_order ?? 0);
      if (orderDiff !== 0) return orderDiff;
      return a.label.localeCompare(b.label, 'ko-KR', {
        numeric: true,
        sensitivity: 'base',
      });
    })
    .map((row) => ({
      id: row.category_key,
      label: row.label,
      sortOrder: row.sort_order ?? 0,
      kind: normalizeCategoryKind(row.category_kind),
      isVisible: row.is_visible ?? true,
    }));
}

export function createCategoryOptionMap(options?: TradeCategoryOption[]) {
  return new Map((options ?? []).map((option) => [option.id, option]));
}

export function getCategoryOption(
  category: TradeCategory,
  options?: TradeCategoryOption[],
) {
  return options?.find((option) => option.id === category);
}

export function createCustomCategoryKey() {
  const randomPart = Math.random().toString(36).slice(2, 8);
  return `custom_${Date.now().toString(36)}_${randomPart}`;
}
