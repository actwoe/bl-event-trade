import { TradeCard } from "@/lib/trade-types";

export type PreviewColumnCount = 1 | 2 | 3;

export function getPreviewColumnsPerSide(
  counts: number[],
  maxColumns: PreviewColumnCount = 3,
): PreviewColumnCount {
  return Math.min(maxColumns, Math.max(1, ...counts)) as PreviewColumnCount;
}

export type PreviewCardGroup = {
  key: string;
  label: string;
  cards: TradeCard[];
};

export function getSharedPreviewGroupOrder(
  haveGroups: PreviewCardGroup[],
  wantGroups: PreviewCardGroup[],
) {
  const order: Array<{ key: string; label: string }> = [];

  for (const group of [...haveGroups, ...wantGroups]) {
    if (!order.some((item) => item.key === group.key)) {
      order.push({ key: group.key, label: group.label });
    }
  }

  return order;
}
