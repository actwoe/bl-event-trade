import { notFound } from 'next/navigation';
import { TradeBuilder } from '@/components/trade/TradeBuilder';
import { AppBottomNav } from '@/components/ui/AppBottomNav';
import { AppFrame } from '@/components/ui/AppFrame';
import { AppTopBar } from '@/components/ui/AppTopBar';
import {
  getEventPeriodLabel,
  getEventStatus,
  getEventStatusLabel,
  getKoreaTodayDateString,
} from '@/lib/event-status';
import { getTradeAssetUrl, supabase } from '@/lib/supabase';
import {
  addBenefitSubcategoryItemOrderFallback,
  createBenefitSubcategoryOrderMap,
  getBenefitSubcategorySortOrder,
} from '@/lib/trade-benefit-subcategory-order';
import {
  RegisteredTradeItem,
  TradeCategory,
  TradeCollectionSummary,
  TradeImageRatio,
  TradeReferenceImage,
} from '@/lib/trade-types';

export const dynamic = 'force-dynamic';

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
  event_start_date: string | null;
  event_end_date: string | null;
  event_location: string | null;
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

type TradeBenefitSubcategoryRow = {
  name: string;
  sort_order: number | null;
};

type TradeReferenceImageRow = {
  id: string;
  image_path: string;
  sort_order: number | null;
};

function getSafeImageRatio(value?: string | null): TradeImageRatio {
  return value === 'photocard' ? 'photocard' : 'square';
}

async function getTradePageData(slug: string) {
    const { data: collectionData, error: collectionError } = await supabase
      .from('trade_collections')
      .select(
        'id, slug, title, description, event_start_date, event_end_date, event_location',
      )
      .eq('slug', slug)
      .eq('is_public', true)
      .single();

    if (collectionError || !collectionData) {
      return null;
    }

    const collectionRow = collectionData as TradeCollectionRow;
    const [itemsResult, referencesResult, subcategoriesResult] =
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
      supabase
        .from('trade_benefit_subcategories')
        .select('name, sort_order')
        .eq('collection_id', collectionRow.id)
        .eq('is_visible', true)
        .order('sort_order', { ascending: true })
        .order('name', { ascending: true }),
    ]);

    return {
      collectionRow,
      itemData: itemsResult.data,
      itemError: itemsResult.error,
      referenceData: referencesResult.data,
      referenceError: referencesResult.error,
      subcategoryData: subcategoriesResult.data,
      subcategoryError: subcategoriesResult.error,
    };
}

export default async function TradePage({ params }: TradePageProps) {
  const { slug } = await params;
  const result = await getTradePageData(slug);

  if (!result) {
    notFound();
  }

  const {
    collectionRow,
    itemData,
    itemError,
    referenceData,
    referenceError,
    subcategoryData,
    subcategoryError,
  } = result;

  if (itemError) {
    console.error(itemError);
  }

  if (subcategoryError && process.env.NODE_ENV !== 'production') {
    console.warn(
      '특전 하위 분류 순서를 불러오지 못해 기본 순서로 표시합니다.',
      subcategoryError.message,
    );
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
    eventStartDate: collectionRow.event_start_date,
    eventEndDate: collectionRow.event_end_date,
    location: collectionRow.event_location,
  };

  const benefitSubcategoryOrderMap = createBenefitSubcategoryOrderMap(
    (subcategoryData ?? []) as TradeBenefitSubcategoryRow[],
  );
  addBenefitSubcategoryItemOrderFallback(
    benefitSubcategoryOrderMap,
    (itemData ?? []) as TradeItemRow[],
  );

  const registeredItems: RegisteredTradeItem[] = (
    (itemData ?? []) as TradeItemRow[]
  )
    .filter((item) => item.image_path)
    .map((item, catalogOrder) => ({
      id: item.id,
      category: item.category,
      workTitle: item.work_title,
      itemName: item.item_name || '',
      imageUrl: getTradeAssetUrl(item.image_path),
      sortOrder: item.sort_order ?? 0,
      catalogOrder,
      imageRatio: getSafeImageRatio(item.image_ratio),
      benefitSubcategory: item.benefit_subcategory ?? null,
      benefitSubcategorySortOrder: getBenefitSubcategorySortOrder(
        benefitSubcategoryOrderMap,
        item.benefit_subcategory,
      ),
    }));

  const referenceImages: TradeReferenceImage[] = (
    (referenceData ?? []) as TradeReferenceImageRow[]
  )
    .filter((image) => image.image_path)
    .map((image) => ({
      id: image.id,
      imageUrl: getTradeAssetUrl(image.image_path),
      sortOrder: image.sort_order ?? 0,
    }));

  const today = getKoreaTodayDateString();
  const eventStatus = getEventStatus(
    collection.eventStartDate ?? null,
    collection.eventEndDate ?? null,
    today,
  );
  const eventPeriod = getEventPeriodLabel(
    collection.eventStartDate ?? null,
    collection.eventEndDate ?? null,
  );

  return (
    <AppFrame>
      <AppTopBar title="교환판 만들기" backHref="/" />

      <div className="min-h-0 flex-1 overflow-x-hidden overflow-y-auto overscroll-contain">
        <section className="border-b border-neutral-100 bg-white px-5 py-4">
          <p className="text-[12px] font-black tracking-[0.04em] text-[#7C5CFC]">
            BL GOODS TRADE
          </p>

          <div className="mt-1 flex items-start justify-between gap-3">
            <h2 className="min-w-0 break-keep text-[24px] font-black leading-tight tracking-[-0.03em] text-neutral-950">
              {collection.title}
            </h2>
            <span
              className={
                eventStatus === 'ongoing'
                  ? 'shrink-0 rounded-full bg-[#F1EDFF] px-3 py-1.5 text-[11px] font-black text-[#7C5CFC]'
                  : 'shrink-0 rounded-full bg-neutral-100 px-3 py-1.5 text-[11px] font-black text-neutral-500'
              }
            >
              {getEventStatusLabel(eventStatus)}
            </span>
          </div>

          <p className="mt-2 flex flex-wrap items-center gap-x-2 gap-y-1 text-[12px] font-semibold text-neutral-500">
            <svg
              viewBox="0 0 24 24"
              aria-hidden="true"
              className="h-4 w-4 shrink-0 fill-none stroke-current"
              strokeWidth="1.8"
            >
              <rect x="4" y="5.5" width="16" height="14" rx="2" />
              <path d="M8 3.5v4M16 3.5v4M4 9.5h16" />
            </svg>
            <span>{eventPeriod}</span>
            {collection.location ? (
              <>
                <span className="text-neutral-300">|</span>
                <svg
                  viewBox="0 0 24 24"
                  aria-hidden="true"
                  className="h-4 w-4 shrink-0 fill-none stroke-current"
                  strokeWidth="1.8"
                >
                  <path d="M12 21s6-5.1 6-11a6 6 0 1 0-12 0c0 5.9 6 11 6 11Z" />
                  <circle cx="12" cy="10" r="2.2" />
                </svg>
                <span>{collection.location}</span>
              </>
            ) : null}
          </p>
        </section>

        <TradeBuilder
          collection={collection}
          registeredItems={registeredItems}
          referenceImages={referenceImages}
          embedded
        />
      </div>

      <AppBottomNav active="home" />
    </AppFrame>
  );
}
