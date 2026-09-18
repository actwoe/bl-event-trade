export type TradeSide = 'have' | 'want';

// 행사마다 굿즈 종류를 직접 구성할 수 있으므로 카테고리 키는 동적 문자열입니다.
// 특수 기능은 category key가 아니라 category kind로 판정합니다.
export type TradeCategory = string;

export type TradeCategoryKind =
  | 'standard'
  | 'benefit'
  | 'collection_photo_card';

export type TradeCategoryOption = {
  id: TradeCategory;
  label: string;
  sortOrder: number;
  kind?: TradeCategoryKind;
  isVisible?: boolean;
};

export type TradeImageRatio = 'square' | 'photocard';

export type TradeCategoryDisplayMode = 'grouped' | 'simple';

export type TradeBoardMode = 'trade' | 'sell' | 'wanted';

// 새 행사에서는 trade_item_categories를 사용합니다.
// 아래 값은 마이그레이션 전/오류 시 기존 행사 표시를 보존하기 위한 fallback입니다.
export const TRADE_CATEGORIES: TradeCategoryOption[] = [
  { id: 'benefit', label: '특전', sortOrder: 0, kind: 'benefit' },
  { id: 'deco_photo_pack', label: '데코 포토팩', sortOrder: 1, kind: 'standard' },
  { id: 'sweets_acrylic_magnet', label: '스위츠 아크릴 마그넷', sortOrder: 2, kind: 'standard' },
  { id: 'heart_can_badge', label: '하트 캔뱃지', sortOrder: 3, kind: 'standard' },
  {
    id: 'collection_photo_card',
    label: '컬렉션 포토카드',
    sortOrder: 4,
    kind: 'collection_photo_card',
  },
];

export type TradeCard = {
  id: string;
  side: TradeSide;
  category: TradeCategory;
  categoryLabel?: string;
  categorySortOrder?: number | null;
  categoryKind?: TradeCategoryKind;
  imageUrl: string;
  workTitle: string;
  memo: string;
  itemName?: string;
  showItemName?: boolean;
  imageRatio?: TradeImageRatio | null;
  benefitSubcategory?: string | null;
  benefitSubcategorySortOrder?: number | null;
  registeredSortOrder?: number | null;
  registeredCatalogOrder?: number | null;
  collectionId?: string | null;
  collectionTitle?: string | null;
  collectionSortOrder?: number | null;
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
  categoryLabel?: string;
  categorySortOrder?: number | null;
  categoryKind?: TradeCategoryKind;
  workTitle: string;
  itemName: string;
  showItemName?: boolean;
  imageUrl: string;
  sortOrder: number;
  catalogOrder?: number | null;
  benefitType?: string | null;
  imageRatio?: TradeImageRatio | null;
  benefitSubcategory?: string | null;
  benefitSubcategorySortOrder?: number | null;
  collectionId?: string | null;
  collectionTitle?: string | null;
  collectionSortOrder?: number | null;
};

export type TradeReferenceImage = {
  id: string;
  imageUrl: string;
  sortOrder: number;
  collectionId?: string | null;
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
  // undefined: 카테고리 테이블을 읽지 못한 구버전/fallback
  // []: 이 행사에 아직 굿즈 종류를 등록하지 않음
  categoryOptions?: TradeCategoryOption[];
  referenceSectionEnabled?: boolean;
  referenceSectionTitle?: string | null;
  sortOrder?: number | null;
};
