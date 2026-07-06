export type TradeSide = 'have' | 'want';

export type TradeCategory =
  | 'benefit'
  | 'deco_photo_pack'
  | 'sweets_acrylic_magnet'
  | 'heart_can_badge'
  | 'collection_photo_card';

export type BenefitType =
  | 'admission'
  | 'purchase_a'
  | 'drink_b'
  | 'dessert';

export type BenefitTypeFilter = BenefitType | 'all';

export type TradeCategoryOption = {
  id: TradeCategory;
  label: string;
};

export type BenefitTypeOption = {
  id: BenefitTypeFilter;
  label: string;
};

export const TRADE_CATEGORIES: TradeCategoryOption[] = [
  {
    id: 'benefit',
    label: '특전',
  },
  {
    id: 'deco_photo_pack',
    label: '데코 포토팩',
  },
  {
    id: 'sweets_acrylic_magnet',
    label: '스위츠 아크릴 마그넷',
  },
  {
    id: 'heart_can_badge',
    label: '하트 캔뱃지',
  },
  {
    id: 'collection_photo_card',
    label: '컬렉션 포토카드',
  },
];

export const BENEFIT_TYPE_OPTIONS: BenefitTypeOption[] = [
  {
    id: 'all',
    label: '전체',
  },
  {
    id: 'admission',
    label: '입장특전',
  },
  {
    id: 'purchase_a',
    label: '구매특전 (A ver.)',
  },
  {
    id: 'drink_b',
    label: '음료 특전 (B ver.)',
  },
  {
    id: 'dessert',
    label: '디저트 특전',
  },
];

export function getBenefitTypeLabel(benefitType?: BenefitType | null) {
  if (!benefitType) return '';

  return (
    BENEFIT_TYPE_OPTIONS.find((option) => option.id === benefitType)?.label ?? ''
  );
}

export type TradeCard = {
  id: string;
  side: TradeSide;
  category: TradeCategory;
  benefitType?: BenefitType | null;
  imageUrl: string;
  workTitle: string;
  memo: string;
};

export type TradeBoard = {
  nickname: string;
  contact: string;
  memo: string;
  cards: TradeCard[];
};

export type RegisteredTradeItem = {
  id: string;
  category: TradeCategory;
  workTitle: string;
  itemName: string;
  imageUrl: string;
  sortOrder: number;
  benefitType?: string | null;
};

export type TradeCollectionSummary = {
  id: string;
  slug: string;
  title: string;
  description: string;
};