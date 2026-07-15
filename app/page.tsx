import { EventCollectionBrowser } from '@/components/home/EventCollectionBrowser';
import { AppFrame } from '@/components/ui/AppFrame';
import { getKoreaTodayDateString } from '@/lib/event-status';
import type { HomeTradeCollection } from '@/lib/home-trade-types';
import { getTradeAssetUrl, supabase } from '@/lib/supabase';

export const revalidate = 300;

type TradeCollectionRow = {
  id: string;
  slug: string;
  title: string;
  thumbnail_path: string | null;
  event_start_date: string | null;
  event_end_date: string | null;
  event_location: string | null;
  sort_order: number | null;
};

async function loadCollections() {
  const { data, error } = await supabase
    .from('trade_collections')
    .select(
      'id, slug, title, thumbnail_path, event_start_date, event_end_date, event_location, sort_order',
    )
    .eq('is_public', true);

  if (error) {
    throw error;
  }

  return ((data ?? []) as TradeCollectionRow[]).map(
    (collection): HomeTradeCollection => ({
      id: collection.id,
      slug: collection.slug,
      title: collection.title,
      thumbnailUrl: collection.thumbnail_path
        ? getTradeAssetUrl(collection.thumbnail_path)
        : '',
      eventStartDate: collection.event_start_date,
      eventEndDate: collection.event_end_date,
      location: collection.event_location,
      sortOrder: collection.sort_order ?? 0,
    }),
  );
}

export default async function HomePage() {
  const today = getKoreaTodayDateString();

  let collections: HomeTradeCollection[] = [];
  let error = '';

  try {
    collections = await loadCollections();
  } catch (loadError) {
    console.error(loadError);
    error =
      '교환판 목록을 불러오지 못했습니다. Supabase 테이블, RLS 정책, 환경변수를 확인해 주세요.';
  }

  return (
    <AppFrame>
      <EventCollectionBrowser
        collections={collections}
        today={today}
        error={error}
      />
    </AppFrame>
  );
}
