'use client';

import Link from 'next/link';
import { useEffect, useState } from 'react';
import {
  UiLabApp,
  type UiLabCollection,
  type UiLabCollectionItems,
} from '@/components/ui-lab/UiLabApp';
import { getKoreaTodayDateString } from '@/lib/event-status';
import { getTradeAssetUrl, supabase } from '@/lib/supabase';
import type {
  RegisteredTradeItem,
  TradeCategory,
  TradeImageRatio,
} from '@/lib/trade-types';

type AdminState = 'checking' | 'admin' | 'not-admin' | 'signed-out';

type CollectionRow = {
  id: string;
  slug: string;
  title: string;
  thumbnail_path: string | null;
  event_start_date: string | null;
  event_end_date: string | null;
  event_location: string | null;
  sort_order: number | null;
};

type ItemRow = {
  id: string;
  collection_id: string;
  category: TradeCategory;
  work_title: string;
  item_name: string | null;
  image_path: string;
  sort_order: number | null;
  image_ratio: TradeImageRatio | null;
  benefit_subcategory: string | null;
};

function getSafeRatio(value: TradeImageRatio | null): TradeImageRatio {
  return value === 'photocard' ? 'photocard' : 'square';
}

export default function AdminUiLabPage() {
  const [adminState, setAdminState] = useState<AdminState>('checking');
  const [collections, setCollections] = useState<UiLabCollection[]>([]);
  const [itemsByCollection, setItemsByCollection] = useState<UiLabCollectionItems>({});
  const [message, setMessage] = useState('');

  useEffect(() => {
    let cancelled = false;

    async function load() {
      const { data: sessionData } = await supabase.auth.getSession();
      const user = sessionData.session?.user;

      if (!user) {
        if (!cancelled) setAdminState('signed-out');
        return;
      }

      const { data: adminUser, error: adminError } = await supabase
        .from('admin_users')
        .select('user_id')
        .eq('user_id', user.id)
        .maybeSingle();

      if (adminError || !adminUser) {
        if (!cancelled) setAdminState('not-admin');
        return;
      }

      if (!cancelled) setAdminState('admin');

      const [collectionsResult, itemsResult] = await Promise.all([
        supabase
          .from('trade_collections')
          .select('id, slug, title, thumbnail_path, event_start_date, event_end_date, event_location, sort_order')
          .order('sort_order', { ascending: true }),
        supabase
          .from('trade_items')
          .select('id, collection_id, category, work_title, item_name, image_path, sort_order, image_ratio, benefit_subcategory')
          .eq('is_visible', true)
          .order('sort_order', { ascending: true }),
      ]);

      if (cancelled) return;

      if (collectionsResult.error) {
        console.error(collectionsResult.error);
        setMessage('행사 목록을 불러오지 못했습니다.');
        return;
      }

      if (itemsResult.error) {
        console.error(itemsResult.error);
        setMessage('굿즈 목록을 불러오지 못했습니다.');
        return;
      }

      const nextCollections = ((collectionsResult.data ?? []) as CollectionRow[]).map(
        (row): UiLabCollection => ({
          id: row.id,
          slug: row.slug,
          title: row.title,
          thumbnailUrl: row.thumbnail_path ? getTradeAssetUrl(row.thumbnail_path) : '',
          eventStartDate: row.event_start_date,
          eventEndDate: row.event_end_date,
          location: row.event_location,
          sortOrder: row.sort_order ?? 0,
        }),
      );

      const nextItems: UiLabCollectionItems = {};
      for (const row of (itemsResult.data ?? []) as ItemRow[]) {
        if (!row.image_path) continue;
        const item: RegisteredTradeItem = {
          id: row.id,
          category: row.category,
          workTitle: row.work_title,
          itemName: row.item_name ?? '',
          imageUrl: getTradeAssetUrl(row.image_path),
          sortOrder: row.sort_order ?? 0,
          imageRatio: getSafeRatio(row.image_ratio),
          benefitSubcategory: row.benefit_subcategory,
        };
        nextItems[row.collection_id] = [...(nextItems[row.collection_id] ?? []), item];
      }

      setCollections(nextCollections);
      setItemsByCollection(nextItems);
    }

    load();
    return () => {
      cancelled = true;
    };
  }, []);

  if (adminState === 'checking') {
    return <StateCard title="UI 랩을 준비하는 중입니다" description="관리자 권한과 행사 데이터를 확인하고 있습니다." />;
  }

  if (adminState === 'signed-out') {
    return (
      <StateCard title="로그인이 필요합니다" description="UI 랩은 관리자 로그인 후 확인할 수 있습니다.">
        <Link href="/admin/login" className="mt-5 inline-flex rounded-full bg-neutral-950 px-5 py-3 text-sm font-black text-white">관리자 로그인</Link>
      </StateCard>
    );
  }

  if (adminState === 'not-admin') {
    return <StateCard title="관리자 권한이 없습니다" description="이 디자인 실험 페이지는 관리자 계정만 이용할 수 있습니다." />;
  }

  if (message) {
    return <StateCard title="데이터를 불러오지 못했습니다" description={message} />;
  }

  return (
    <UiLabApp
      collections={collections}
      itemsByCollection={itemsByCollection}
      today={getKoreaTodayDateString()}
    />
  );
}

function StateCard({
  title,
  description,
  children,
}: {
  title: string;
  description: string;
  children?: React.ReactNode;
}) {
  return (
    <main className="min-h-screen bg-neutral-100 px-4 py-10">
      <section className="mx-auto max-w-md rounded-[28px] border border-neutral-200 bg-white p-6 shadow-sm">
        <h1 className="text-xl font-black text-neutral-950">{title}</h1>
        <p className="mt-2 text-sm leading-6 text-neutral-500">{description}</p>
        {children}
      </section>
    </main>
  );
}
