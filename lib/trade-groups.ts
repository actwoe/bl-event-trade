import {
  TradeCategory,
  TradeBoardMode,
  TradeCategoryDisplayMode,
  TradeImageRatio,
  TradeSide,
} from '@/lib/trade-types';

export const MAX_TRADE_GROUPS = 3;

export type SavedTradeGroupCard = {
  itemId: string;
  side: TradeSide;
  quantity: number;
  category: TradeCategory;
  workTitle: string;
  memo: string;
  imageRatio: TradeImageRatio;
  benefitSubcategory: string | null;
  isPriority?: boolean;
  isForSale?: boolean;
};

export type SavedTradeGroupBoard = {
  version: 1;
  nickname: string;
  contact: string;
  selectedConditions: string[];
  boardMode?: TradeBoardMode;
  categoryDisplayMode: TradeCategoryDisplayMode;
  cards: SavedTradeGroupCard[];
};

export type TradeGroupRow = {
  id: string;
  user_id: string;
  collection_id: string;
  name: string;
  board_data: SavedTradeGroupBoard;
  created_at: string;
  updated_at: string;
};

function isTradeSide(value: unknown): value is TradeSide {
  return value === 'have' || value === 'want';
}

function isTradeCategory(value: unknown): value is TradeCategory {
  return (
    value === 'benefit' ||
    value === 'deco_photo_pack' ||
    value === 'sweets_acrylic_magnet' ||
    value === 'heart_can_badge' ||
    value === 'collection_photo_card'
  );
}

function isTradeImageRatio(value: unknown): value is TradeImageRatio {
  return value === 'square' || value === 'photocard';
}

function isTradeCategoryDisplayMode(
  value: unknown,
): value is TradeCategoryDisplayMode {
  return value === 'grouped' || value === 'simple';
}

function isTradeBoardMode(value: unknown): value is TradeBoardMode {
  return value === 'trade' || value === 'sell' || value === 'wanted';
}

function isSavedTradeGroupCard(value: unknown): value is SavedTradeGroupCard {
  if (!value || typeof value !== 'object') return false;

  const card = value as Record<string, unknown>;

  return (
    typeof card.itemId === 'string' &&
    card.itemId.length > 0 &&
    isTradeSide(card.side) &&
    typeof card.quantity === 'number' &&
    Number.isFinite(card.quantity) &&
    card.quantity >= 1 &&
    isTradeCategory(card.category) &&
    typeof card.workTitle === 'string' &&
    typeof card.memo === 'string' &&
    isTradeImageRatio(card.imageRatio) &&
    (card.benefitSubcategory === null ||
      typeof card.benefitSubcategory === 'string') &&
    (card.isPriority === undefined || typeof card.isPriority === 'boolean') &&
    (card.isForSale === undefined || typeof card.isForSale === 'boolean')
  );
}

export function parseSavedTradeGroupBoard(
  value: unknown,
): SavedTradeGroupBoard | null {
  if (!value || typeof value !== 'object') return null;

  const board = value as Record<string, unknown>;

  if (
    board.version !== 1 ||
    typeof board.nickname !== 'string' ||
    typeof board.contact !== 'string' ||
    !Array.isArray(board.selectedConditions) ||
    !board.selectedConditions.every((item) => typeof item === 'string') ||
    (board.boardMode !== undefined && !isTradeBoardMode(board.boardMode)) ||
    !isTradeCategoryDisplayMode(board.categoryDisplayMode) ||
    !Array.isArray(board.cards) ||
    !board.cards.every(isSavedTradeGroupCard)
  ) {
    return null;
  }

  return board as SavedTradeGroupBoard;
}
