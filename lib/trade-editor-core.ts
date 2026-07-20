import {
  RegisteredTradeItem,
  TradeBoard,
  TradeCard,
  TradeSide,
} from "@/lib/trade-types";
import { sortTradeCardsBySideAndGroup } from "@/lib/trade-card-order";

export type QuantityTradeCard = TradeCard & {
  quantity?: number;
  registeredItemId?: string;
  registeredSortOrder?: number | null;
};

function normalizeTradeCardStatus(card: QuantityTradeCard): QuantityTradeCard {
  return {
    ...card,
    isPriority: card.side === "want" && card.isPriority === true,
    isForSale: card.side === "have" && card.isForSale === true,
  };
}

export const TRADE_CONDITIONS = [
  "같은 종류끼리만 교환",
  "교차 교환 가능",
  "현장 직거래 가능",
  "반택/일택 거래 가능",
  "N:1 가능",
  "양도 가능",
] as const;

export function createInitialTradeBoard(): TradeBoard {
  return {
    nickname: "",
    contact: "",
    memo: "",
    cards: [],
    categoryDisplayMode: "grouped",
  };
}

export function getCardQuantity(card: TradeCard) {
  const quantity = (card as QuantityTradeCard).quantity ?? 1;

  if (!Number.isFinite(quantity)) return 1;

  return Math.max(1, Math.floor(quantity));
}

export function isSameTradeItem(left: TradeCard, right: TradeCard): boolean {
  const leftQuantityCard = left as QuantityTradeCard;
  const rightQuantityCard = right as QuantityTradeCard;

  if (leftQuantityCard.registeredItemId || rightQuantityCard.registeredItemId) {
    return (
      Boolean(leftQuantityCard.registeredItemId) &&
      leftQuantityCard.registeredItemId === rightQuantityCard.registeredItemId
    );
  }

  return (
    left.imageUrl === right.imageUrl &&
    left.category === right.category &&
    (left.workTitle ?? "") === (right.workTitle ?? "") &&
    (left.memo ?? "") === (right.memo ?? "") &&
    (left.benefitSubcategory ?? null) === (right.benefitSubcategory ?? null)
  );
}

export function isSameRegisteredCard(
  card: TradeCard,
  item: RegisteredTradeItem,
  side: TradeSide,
) {
  const quantityCard = card as QuantityTradeCard;

  if (quantityCard.registeredItemId) {
    return quantityCard.registeredItemId === item.id && card.side === side;
  }

  return (
    card.side === side &&
    card.category === item.category &&
    card.imageUrl === item.imageUrl &&
    card.workTitle === item.workTitle &&
    card.memo === item.itemName
  );
}

export function getRegisteredItemQuantity(
  cards: TradeCard[],
  item: RegisteredTradeItem,
  side: TradeSide,
) {
  const selectedCard = cards.find((card) =>
    isSameRegisteredCard(card, item, side),
  );

  return selectedCard ? getCardQuantity(selectedCard) : 0;
}

/**
 * 카드 수정과 있어요/구해요 이동 시 중복 병합을 한 곳에서 처리합니다.
 * 동일 카드가 대상 영역에 이미 있으면 별도 카드를 만들지 않고 수량을 합칩니다.
 */
export function updateTradeCardList(
  cards: TradeCard[],
  cardId: string,
  patch: Partial<QuantityTradeCard>,
) {
  const currentCard = cards.find((card) => card.id === cardId);
  if (!currentCard) return cards;

  const updatedCard = normalizeTradeCardStatus({
    ...currentCard,
    ...patch,
  });

  if (patch.side && patch.side !== currentCard.side) {
    const duplicateCard = cards.find(
      (card) =>
        card.id !== cardId &&
        card.side === updatedCard.side &&
        isSameTradeItem(card, updatedCard),
    );

    if (duplicateCard) {
      return sortTradeCardsBySideAndGroup(
        cards
          .filter((card) => card.id !== cardId)
          .map((card) =>
            card.id === duplicateCard.id
              ? {
                  ...card,
                  quantity:
                    getCardQuantity(card) + getCardQuantity(updatedCard),
                }
              : card,
          ),
      );
    }
  }

  return sortTradeCardsBySideAndGroup(
    cards.map((card) => (card.id === cardId ? updatedCard : card)),
  );
}
