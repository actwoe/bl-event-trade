export type TradeSide = 'have' | 'want';

export type TradeCategory =
  | 'benefit'
  | 'deco_photo_pack'
  | 'sweets_acrylic_magnet'
  | 'heart_can_badge'
  | 'collection_photo_card';

export type TradeImageRatio = 'square' | 'photocard';

export type TradeCategoryDisplayMode = 'grouped' | 'simple';

export type TradeBoardMode = 'trade' | 'sell' | 'wanted';

export const TRADE_CATEGORIES: { id: TradeCategory; label: string }[] = [
  { id: 'benefit', label: '특전' },
  { id: 'deco_photo_pack', label: '데코 포토팩' },
  { id: 'sweets_acrylic_magnet', label: '스위츠 아크릴 마그넷' },
  { id: 'heart_can_badge', label: '하트 캔뱃지' },
  { id: 'collection_photo_card', label: '컬렉션 포토카드' },
];

export type TradeCard = {
  id: string;
  side: TradeSide;
  category: TradeCategory;
  imageUrl: string;
  workTitle: string;
  memo: string;
  imageRatio?: TradeImageRatio | null;
  benefitSubcategory?: string | null;
  benefitSubcategorySortOrder?: number | null;
  registeredSortOrder?: number | null;
  registeredCatalogOrder?: number | null;
  isPriority?: boolean;
  isForSale?: boolean;
};

export type TradeBoard = {
  nickname: string;
  contact: string;
  memo: string;
  cards: TradeCard[];
  boardMode?: TradeBoardMode;
  categoryDisplayMode?: TradeCategoryDisplayMode;
};

export type RegisteredTradeItem = {
  id: string;
  category: TradeCategory;
  workTitle: string;
  itemName: string;
  imageUrl: string;
  sortOrder: number;
  catalogOrder?: number | null;
  benefitType?: string | null;
  imageRatio?: TradeImageRatio | null;
  benefitSubcategory?: string | null;
  benefitSubcategorySortOrder?: number | null;
};

export type TradeReferenceImage = {
  id: string;
  imageUrl: string;
  sortOrder: number;
};

export type TradeCollectionSummary = {
  id: string;
  slug: string;
  title: string;
  description: string | null;
  eventStartDate?: string | null;
  eventEndDate?: string | null;
  location?: string | null;
  thumbnailUrl?: string | null;
  themeThumbnailUrl?: string | null;
};
