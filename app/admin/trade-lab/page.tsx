'use client';

import Link from 'next/link';
import { useEffect, useState } from 'react';
import { TradeBuilder } from '@/components/trade/TradeBuilder';
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
  event_start_date: string | null;
  event_end_date: string | null;
  event_location: string | null;
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
          'id, slug, title, description, event_start_date, event_end_date, event_location, is_public, sort_order, created_at',
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
        eventStartDate: selectedCollection.event_start_date,
        eventEndDate: selectedCollection.event_end_date,
        location: selectedCollection.event_location,
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
      <main className="w-full bg-[#fafafa] px-5 py-4">
        <section className="rounded-2xl border border-neutral-200 bg-neutral-50 p-4 text-sm text-neutral-500">
          관리자 권한을 확인하는 중입니다.
        </section>
      </main>
    );
  }

  if (adminState === 'signed-out') {
    return (
      <main className="w-full bg-[#fafafa] px-5 py-4">
        <section className="rounded-2xl border border-neutral-200 bg-neutral-50 p-4">
          <h1 className="text-lg font-black text-neutral-950">
            로그인이 필요합니다
          </h1>
          <p className="mt-2 text-sm leading-6 text-neutral-500">
            교환판 테스트 페이지는 관리자 로그인 후 이용할 수 있습니다.
          </p>
          <Link
            href="/admin/login"
            className="mt-5 inline-flex rounded-2xl bg-neutral-950 px-5 py-3 text-sm font-black text-white"
          >
            관리자 로그인
          </Link>
        </section>
      </main>
    );
  }

  if (adminState === 'not-admin') {
    return (
      <main className="w-full bg-[#fafafa] px-5 py-4">
        <section className="rounded-2xl border border-neutral-200 bg-neutral-50 p-4">
          <h1 className="text-lg font-black text-neutral-950">
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
    <main className="w-full bg-[#fafafa]">
      <section className="border-b border-neutral-100 bg-white px-5 py-4">
        <p className="text-[12px] font-black tracking-[0.04em] text-[#7C5CFC]">
          ADMIN TRADE LAB
        </p>
        <h1 className="mt-1 break-keep text-[24px] font-black leading-tight tracking-[-0.03em] text-neutral-950">
          교환판 테스트
        </h1>
        <p className="mt-2 text-[13px] font-medium leading-5 text-neutral-500">
          실제 운영 교환판과 동일한 편집기에서 행사별 굿즈를 테스트합니다.
        </p>
      </section>

      <div className="space-y-4 px-5 py-4">
        <section className="rounded-2xl border border-neutral-200 bg-neutral-50 p-4">
          <label className="block">
            <span className="text-sm font-black text-neutral-950">
              테스트할 행사
            </span>
            <select
              value={selectedCollectionId}
              onChange={(event) => setSelectedCollectionId(event.target.value)}
              className="mt-3 w-full rounded-2xl border border-neutral-200 bg-white px-4 py-3 text-sm outline-none focus:border-[#7C5CFC]"
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
            <p className="mt-3 rounded-2xl border border-neutral-200 bg-white px-4 py-3 text-sm leading-6 text-neutral-600">
              {message}
            </p>
          ) : null}

          {!message && collections.length === 0 ? (
            <p className="mt-3 rounded-2xl border border-neutral-200 bg-white px-4 py-3 text-sm leading-6 text-neutral-600">
              등록된 행사가 없습니다.
            </p>
          ) : null}
        </section>
      </div>

      {isLoadingCollection ? (
        <div className="px-5 pb-4">
          <section className="rounded-2xl border border-neutral-200 bg-neutral-50 p-4 text-sm text-neutral-500">
            행사와 굿즈 데이터를 불러오는 중입니다.
          </section>
        </div>
      ) : null}

      {!isLoadingCollection && collection ? (
        <div className="border-t border-neutral-100 bg-white">
          <TradeBuilder
            key={collection.id}
            collection={collection}
            registeredItems={registeredItems}
            referenceImages={referenceImages}
            embedded
          />
        </div>
      ) : null}
    </main>
  );
}
