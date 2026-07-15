export type HomeTradeCollection = {
  id: string;
  slug: string;
  title: string;
  thumbnailUrl: string;
  eventStartDate: string | null;
  eventEndDate: string | null;
  location?: string | null;
  sortOrder: number;
};
