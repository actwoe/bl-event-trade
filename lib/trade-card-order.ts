import { TradeCard, TradeSide } from "@/lib/trade-types";

function getTradeSideSortIndex(side: TradeSide) {
  return side === "have" ? 0 : 1;
}

export function getTradeCardGroupKey(card: TradeCard) {
  const benefitSubcategory = card.benefitSubcategory?.trim() ?? "";

  if (card.category === "benefit") {
    return `benefit:${benefitSubcategory || "__none__"}`;
  }

  return `category:${card.category}`;
}

/**
 * 있어요와 구해요가 같은 특전 종류 순서를 공유하도록 정렬합니다.
 *
 * 1. 있어요에서 처음 등장한 특전 종류 순서를 기준으로 삼습니다.
 * 2. 구해요에만 존재하는 특전 종류는 그 뒤에 처음 등장한 순서대로 붙입니다.
 * 3. 각 특전 종류 안에서는 사용자가 선택한 순서를 유지합니다.
 * 4. 최종 목록에서는 있어요를 먼저, 구해요를 뒤에 배치합니다.
 */
export function sortTradeCardsBySideAndGroup(cards: TradeCard[]) {
  const indexedCards = cards.map((card, index) => ({ card, index }));
  const sharedGroupOrder = new Map<string, number>();

  for (const side of ["have", "want"] as const) {
    for (const { card } of indexedCards) {
      if (card.side !== side) continue;

      const groupKey = getTradeCardGroupKey(card);
      if (!sharedGroupOrder.has(groupKey)) {
        sharedGroupOrder.set(groupKey, sharedGroupOrder.size);
      }
    }
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

      return a.index - b.index;
    })
    .map(({ card }) => card);
}
