import { notFound } from 'next/navigation';
import { TradeBuilder } from '@/components/trade/TradeBuilder';
import { getTradeAssetUrl, supabase } from '@/lib/supabase';
import {
  RegisteredTradeItem,
  TradeCategory,
  TradeCollectionSummary,
  TradeImageRatio,
  TradeReferenceImage,
} from '@/lib/trade-types';

export const revalidate = 300;

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

type TradeReferenceImageRow = {
  id: string;
  image_path: string;
  sort_order: number | null;
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

  const [{ data: itemData, error: itemError }, { data: referenceData, error: referenceError }] =
    await Promise.all([
      supabase
        .from('trade_items')
        .select(
          'id, category, work_title, item_name, image_path, sort_order, image_ratio, benefit_subcategory',
        )
        .eq('collection_id', collectionRow.id)
        .eq('is_visible', true)
        .order('created_at', { ascending: true }),
      supabase
        .from('trade_reference_images')
        .select('id, image_path, sort_order')
        .eq('collection_id', collectionRow.id)
        .order('sort_order', { ascending: true })
        .order('created_at', { ascending: true }),
    ]);

  if (itemError) {
    console.error(itemError);
  }

  if (referenceError && process.env.NODE_ENV !== 'production') {
    console.warn(
      '공지용 이미지 목록을 불러오지 못했습니다. trade_reference_images 권한 또는 SQL 적용 여부를 확인해 주세요.',
      referenceError.message,
    );
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

  const referenceImages: TradeReferenceImage[] = ((referenceData ?? []) as TradeReferenceImageRow[])
    .filter((image) => image.image_path)
    .map((image) => ({
      id: image.id,
      imageUrl: getTradeAssetUrl(image.image_path),
      sortOrder: image.sort_order ?? 0,
    }));

  return (
    <TradeBuilder
      collection={collection}
      registeredItems={registeredItems}
      referenceImages={referenceImages}
    />
  );
}
