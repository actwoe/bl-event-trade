export type TradeCollection = {
  id: string;
  slug: string;
  title: string;
  description: string;
  thumbnailUrl: string;
  href: string;
  statusLabel?: string;
  createdAt: string;
};

export const tradeCollections: TradeCollection[] = [
  {
    id: 'collection-001',
    slug: 'main-event',
    title: '첫 번째 교환판',
    description:
      '작품명 또는 행사명을 여기에 넣어주세요. 등록된 굿즈 이미지로 교환판을 만들 수 있습니다.',
    thumbnailUrl: '/trade-thumbnails/main-event.jpg',
    href: '/trade',
    statusLabel: 'OPEN',
    createdAt: '2026-07-06',
  },
];