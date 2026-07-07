import { notFound } from 'next/navigation';
import { TradeBuilder } from '@/components/trade/TradeBuilder';
import { getTradeAssetUrl, supabase } from '@/lib/supabase';
import {
  RegisteredTradeItem,
  TradeCategory,
  TradeCollectionSummary,
  TradeImageRatio,
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
  sort_order: number | null;
  image_ratio: TradeImageRatio | null;
  benefit_subcategory: string | null;
};

function getSafeImageRatio(value?: string | null): TradeImageRatio {
  return value === 'photocard' ? 'photocard' : 'square';
}

export default async function TradePage({ params }: TradePageProps) {
  const { slug } = await params;

  const { data: collectionData, error: collectionError } = await supabase
    .from('trade_collections')
    .select('id, slug, title, description')
    .eq('slug', slug)
    .eq('is_public', true)
    .single();

  if (collectionError || !collectionData) {
    notFound();
  }

  const collectionRow = collectionData as TradeCollectionRow;

  const { data: itemData, error: itemError } = await supabase
    .from('trade_items')
    .select(
      'id, category, work_title, item_name, image_path, sort_order, image_ratio, benefit_subcategory',
    )
    .eq('collection_id', collectionRow.id)
    .eq('is_visible', true)
    .order('created_at', { ascending: true });

  if (itemError) {
    console.error(itemError);
  }

  const collection: TradeCollectionSummary = {
    id: collectionRow.id,
    slug: collectionRow.slug,
    title: collectionRow.title,
    description: collectionRow.description,
  };

  const registeredItems: RegisteredTradeItem[] = ((itemData ?? []) as TradeItemRow[])
    .filter((item) => item.image_path)
    .map((item) => ({
      id: item.id,
      category: item.category,
      workTitle: item.work_title,
      itemName: item.item_name || '',
      imageUrl: getTradeAssetUrl(item.image_path),
      sortOrder: item.sort_order ?? 0,
      imageRatio: getSafeImageRatio(item.image_ratio),
      benefitSubcategory: item.benefit_subcategory ?? null,
    }));

  return <TradeBuilder collection={collection} registeredItems={registeredItems} />;
}
