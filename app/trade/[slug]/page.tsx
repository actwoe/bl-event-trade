import { notFound } from 'next/navigation';
import { TradeBuilder } from '@/components/trade/TradeBuilder';
import { SiteFooter } from '@/components/shared/SiteFooter';
import { getTradeAssetUrl, supabase } from '@/lib/supabase';
import {
  RegisteredTradeItem,
  TradeCategory,
  TradeCollectionSummary,
} from '@/lib/trade-types';

type TradePageProps = {
  params: Promise<{
    slug: string;
  }>;
};

type TradeCollectionRow = {
  id: string;
  slug: string;
  title: string;
  description: string | null;
};

type TradeItemRow = {
  id: string;
  category: TradeCategory;
  work_title: string;
  item_name: string | null;
  image_path: string;
  sort_order: number;
};

export default async function TradeSlugPage({ params }: TradePageProps) {
  const { slug } = await params;

  const { data: collection, error: collectionError } = await supabase
    .from('trade_collections')
    .select('id, slug, title, description')
    .eq('slug', slug)
    .eq('is_public', true)
    .single();

  if (collectionError || !collection) {
    notFound();
  }

  const typedCollection = collection as TradeCollectionRow;

  const { data: items, error: itemsError } = await supabase
    .from('trade_items')
    .select('id, category, work_title, item_name, image_path, sort_order')
    .eq('collection_id', typedCollection.id)
    .eq('is_visible', true)
    .order('sort_order', { ascending: true })
    .order('created_at', { ascending: true });

  const tradeCollection: TradeCollectionSummary = {
    id: typedCollection.id,
    slug: typedCollection.slug,
    title: typedCollection.title,
    description: typedCollection.description ?? '',
  };

  const registeredItems: RegisteredTradeItem[] = ((items ?? []) as TradeItemRow[])
    .filter((item) => Boolean(item.image_path))
    .map((item) => ({
      id: item.id,
      category: item.category,
      workTitle: item.work_title,
      itemName: item.item_name ?? '',
      imageUrl: getTradeAssetUrl(item.image_path),
      sortOrder: item.sort_order,
    }));

  return (
    <main className="min-h-screen bg-neutral-100">
      {itemsError ? (
        <div className="mx-auto max-w-md px-4 pt-6 sm:max-w-lg">
          <div className="rounded-2xl border border-red-200 bg-red-50 px-4 py-4 text-sm leading-6 text-red-700">
            굿즈 이미지 목록을 불러오지 못했습니다. trade_items 테이블의 RLS
            정책과 데이터를 확인해 주세요.
          </div>
        </div>
      ) : null}

      <TradeBuilder
        collection={tradeCollection}
        registeredItems={registeredItems}
      />

      <SiteFooter />
    </main>
  );
}