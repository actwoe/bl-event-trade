export type TradeBenefitSubcategoryOrderRow = {
  name: string;
  sort_order: number | null;
};

export function normalizeBenefitSubcategoryName(value?: string | null) {
  return value?.trim() ?? "";
}

export function normalizeBenefitSubcategorySortOrder(
  value?: number | null,
) {
  return typeof value === "number" && Number.isFinite(value)
    ? value
    : Number.MAX_SAFE_INTEGER;
}

export function createBenefitSubcategoryOrderMap(
  rows: TradeBenefitSubcategoryOrderRow[],
) {
  const orderMap = new Map<string, number>();

  for (const row of rows) {
    const name = normalizeBenefitSubcategoryName(row.name);
    if (!name) continue;

    const nextOrder = normalizeBenefitSubcategorySortOrder(row.sort_order);
    const currentOrder = orderMap.get(name);

    if (currentOrder === undefined || nextOrder < currentOrder) {
      orderMap.set(name, nextOrder);
    }
  }

  return orderMap;
}

export function getBenefitSubcategorySortOrder(
  orderMap: ReadonlyMap<string, number>,
  value?: string | null,
) {
  const name = normalizeBenefitSubcategoryName(value);
  if (!name) return null;

  return orderMap.get(name) ?? null;
}

export function compareBenefitSubcategoryValues(
  leftName: string,
  leftOrder?: number | null,
  rightName?: string,
  rightOrder?: number | null,
) {
  const orderDiff =
    normalizeBenefitSubcategorySortOrder(leftOrder) -
    normalizeBenefitSubcategorySortOrder(rightOrder);

  if (orderDiff !== 0) return orderDiff;

  return normalizeBenefitSubcategoryName(leftName).localeCompare(
    normalizeBenefitSubcategoryName(rightName),
    "ko-KR",
    { numeric: true, sensitivity: "base" },
  );
}
