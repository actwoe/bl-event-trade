'use client';

import Link from 'next/link';
import { useEffect, useState } from 'react';
import { TradeBuilderLab } from '@/components/trade-lab/TradeBuilderLab';
import { getTradeAssetUrl, supabase } from '@/lib/supabase';
import {
  RegisteredTradeItem,
  TradeCategory,
  TradeCollectionSummary,
  TradeImageRatio,
  TradeReferenceImage,
} from '@/lib/trade-types';

type AdminState = 'checking' | 'admin' | 'not-admin' | 'signed-out';

type TradeCollectionRow = {
  id: string;
  slug: string;
  title: string;
  description: string | null;
  is_public: boolean;
  sort_order: number | null;
  created_at: string | null;
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

function sortCollections(rows: TradeCollectionRow[]) {
  return [...rows].sort((a, b) => {
    const sortDiff = (a.sort_order ?? 0) - (b.sort_order ?? 0);

    if (sortDiff !== 0) {
      return sortDiff;
    }

    return a.title.localeCompare(b.title, 'ko-KR', {
      numeric: true,
      sensitivity: 'base',
    });
  });
}

export default function AdminTradeLabPage() {
  const [adminState, setAdminState] = useState<AdminState>('checking');
  const [collections, setCollections] = useState<TradeCollectionRow[]>([]);
  const [selectedCollectionId, setSelectedCollectionId] = useState('');
  const [collection, setCollection] =
    useState<TradeCollectionSummary | null>(null);
  const [registeredItems, setRegisteredItems] = useState<
    RegisteredTradeItem[]
  >([]);
  const [referenceImages, setReferenceImages] = useState<
    TradeReferenceImage[]
  >([]);
  const [isLoadingCollection, setIsLoadingCollection] = useState(false);
  const [message, setMessage] = useState('');

  useEffect(() => {
    async function checkAdminAndLoadCollections() {
      const { data: sessionData } = await supabase.auth.getSession();
      const user = sessionData.session?.user;

      if (!user) {
        setAdminState('signed-out');
        return;
      }

      const { data: adminUser, error: adminError } = await supabase
        .from('admin_users')
        .select('user_id')
        .eq('user_id', user.id)
        .maybeSingle();

      if (adminError || !adminUser) {
        setAdminState('not-admin');
        return;
      }

      setAdminState('admin');

      const { data, error } = await supabase
        .from('trade_collections')
        .select(
          'id, slug, title, description, is_public, sort_order, created_at',
        )
        .order('sort_order', { ascending: true })
        .order('created_at', { ascending: false });

      if (error) {
        console.error(error);
        setMessage('테스트할 행사 목록을 불러오지 못했습니다.');
        return;
      }

      const nextCollections = sortCollections(
        (data ?? []) as TradeCollectionRow[],
      );
      setCollections(nextCollections);
      setSelectedCollectionId(nextCollections[0]?.id ?? '');
    }

    checkAdminAndLoadCollections();
  }, []);

  useEffect(() => {
    if (adminState !== 'admin' || !selectedCollectionId) {
      return;
    }

    let isCancelled = false;

    async function loadCollectionData() {
      setIsLoadingCollection(true);
      setMessage('');

      const selectedCollection = collections.find(
        (item) => item.id === selectedCollectionId,
      );

      if (!selectedCollection) {
        setCollection(null);
        setRegisteredItems([]);
        setReferenceImages([]);
        setIsLoadingCollection(false);
        return;
      }

      const [itemsResult, referencesResult] = await Promise.all([
        supabase
          .from('trade_items')
          .select(
            'id, category, work_title, item_name, image_path, sort_order, image_ratio, benefit_subcategory',
          )
          .eq('collection_id', selectedCollection.id)
          .eq('is_visible', true)
          .order('created_at', { ascending: true }),
        supabase
          .from('trade_reference_images')
          .select('id, image_path, sort_order')
          .eq('collection_id', selectedCollection.id)
          .order('sort_order', { ascending: true })
          .order('created_at', { ascending: true }),
      ]);

      if (isCancelled) {
        return;
      }

      if (itemsResult.error) {
        console.error(itemsResult.error);
        setMessage('행사의 굿즈 목록을 불러오지 못했습니다.');
        setCollection(null);
        setRegisteredItems([]);
        setReferenceImages([]);
        setIsLoadingCollection(false);
        return;
      }

      if (referencesResult.error) {
        console.error(referencesResult.error);
      }

      setCollection({
        id: selectedCollection.id,
        slug: selectedCollection.slug,
        title: selectedCollection.title,
        description: selectedCollection.description,
      });

      setRegisteredItems(
        ((itemsResult.data ?? []) as TradeItemRow[])
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
          })),
      );

      setReferenceImages(
        ((referencesResult.data ?? []) as TradeReferenceImageRow[])
          .filter((image) => image.image_path)
          .map((image) => ({
            id: image.id,
            imageUrl: getTradeAssetUrl(image.image_path),
            sortOrder: image.sort_order ?? 0,
          })),
      );

      setIsLoadingCollection(false);
    }

    loadCollectionData();

    return () => {
      isCancelled = true;
    };
  }, [adminState, collections, selectedCollectionId]);

  if (adminState === 'checking') {
    return (
      <main className="w-full bg-neutral-100 px-4 py-5 sm:py-6">
        <section className="mx-auto max-w-md rounded-[28px] border border-neutral-200/70 bg-white p-5 text-sm text-neutral-500 shadow-[0_8px_26px_rgba(15,23,42,0.032)] sm:max-w-lg">
          관리자 권한을 확인하는 중입니다.
        </section>
      </main>
    );
  }

  if (adminState === 'signed-out') {
    return (
      <main className="w-full bg-neutral-100 px-4 py-5 sm:py-6">
        <section className="mx-auto max-w-md rounded-[28px] border border-neutral-200/70 bg-white p-5 shadow-[0_8px_26px_rgba(15,23,42,0.032)] sm:max-w-lg">
          <h1 className="text-2xl font-bold text-neutral-950">
            로그인이 필요합니다
          </h1>
          <p className="mt-2 text-sm leading-6 text-neutral-500">
            교환판 테스트 페이지는 관리자 로그인 후 이용할 수 있습니다.
          </p>
          <Link
            href="/admin/login"
            className="mt-6 inline-flex rounded-2xl bg-neutral-950 px-5 py-3 text-sm font-bold text-white"
          >
            관리자 로그인
          </Link>
        </section>
      </main>
    );
  }

  if (adminState === 'not-admin') {
    return (
      <main className="w-full bg-neutral-100 px-4 py-5 sm:py-6">
        <section className="mx-auto max-w-md rounded-[28px] border border-neutral-200/70 bg-white p-5 shadow-[0_8px_26px_rgba(15,23,42,0.032)] sm:max-w-lg">
          <h1 className="text-2xl font-bold text-neutral-950">
            관리자 권한이 없습니다
          </h1>
          <p className="mt-2 text-sm leading-6 text-neutral-500">
            이 페이지는 관리자 계정만 이용할 수 있습니다.
          </p>
        </section>
      </main>
    );
  }

  return (
    <main className="w-full bg-neutral-100 pb-5 sm:pb-6">
      <section className="px-4 pt-5 sm:pt-6">
        <div className="mx-auto max-w-md overflow-hidden rounded-[28px] border border-neutral-200/70 bg-white shadow-[0_8px_26px_rgba(15,23,42,0.032)] sm:max-w-lg">
          <header className="border-b border-neutral-200/70 bg-[linear-gradient(135deg,#efe7ff_0%,#d8efff_48%,#ffe1f2_100%)] p-5">
            <Link
              href="/admin"
              className="inline-flex rounded-full border border-white/70 bg-white/75 px-4 py-2 text-xs font-bold text-neutral-600 shadow-[0_4px_12px_rgba(15,23,42,0.025)] transition hover:border-white hover:bg-white hover:text-neutral-950"
            >
              ← 관리자 홈
            </Link>

            <p className="mt-6 text-xs font-bold uppercase tracking-[0.2em] text-neutral-500">
              Trade Lab
            </p>
            <h1 className="mt-1 text-2xl font-bold text-neutral-950">
              교환판 테스트 페이지
            </h1>
            <p className="mt-2 text-sm leading-6 text-neutral-500">
              실제 서비스와 분리된 관리자 전용 실험 화면입니다.
            </p>
          </header>

          <div className="p-5">
            <label className="block">
              <span className="text-sm font-bold text-neutral-800">
                테스트할 행사
              </span>
              <select
                value={selectedCollectionId}
                onChange={(event) =>
                  setSelectedCollectionId(event.target.value)
                }
                className="mt-2 w-full rounded-2xl border border-neutral-200 bg-white px-4 py-3 text-sm outline-none focus:border-neutral-950"
              >
                {collections.map((item) => (
                  <option key={item.id} value={item.id}>
                    {item.title}
                    {item.is_public ? '' : ' · 비공개'}
                  </option>
                ))}
              </select>
            </label>

            {message ? (
              <p className="mt-4 rounded-2xl bg-neutral-100 px-4 py-3 text-sm leading-6 text-neutral-700">
                {message}
              </p>
            ) : null}

            {!message && collections.length === 0 ? (
              <p className="mt-4 rounded-2xl bg-neutral-100 px-4 py-3 text-sm leading-6 text-neutral-700">
                등록된 행사가 없습니다.
              </p>
            ) : null}
          </div>
        </div>
      </section>

      {isLoadingCollection ? (
        <section className="px-4 pt-5">
          <div className="mx-auto max-w-md rounded-[28px] border border-neutral-200/70 bg-white p-5 text-sm text-neutral-500 shadow-[0_8px_26px_rgba(15,23,42,0.032)] sm:max-w-lg">
            행사와 굿즈 데이터를 불러오는 중입니다.
          </div>
        </section>
      ) : null}

      {!isLoadingCollection && collection ? (
        <TradeBuilderLab
          key={collection.id}
          collection={collection}
          registeredItems={registeredItems}
          referenceImages={referenceImages}
        />
      ) : null}
    </main>
  );
}
