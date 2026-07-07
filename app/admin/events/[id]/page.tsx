'use client';

import Link from 'next/link';
import { ChangeEvent, FormEvent, useEffect, useMemo, useState } from 'react';
import { useParams, useRouter } from 'next/navigation';
import { getTradeAssetUrl, supabase } from '@/lib/supabase';
import { TRADE_CATEGORIES, TradeCategory } from '@/lib/trade-types';

type AdminState = 'checking' | 'admin' | 'not-admin' | 'signed-out';

type TradeCollectionRow = {
  id: string;
  slug: string;
  title: string;
  description: string | null;
  thumbnail_path: string;
  status_label: string | null;
  is_public: boolean;
  sort_order: number;
};

type TradeWorkRow = {
  id: string;
  collection_id: string;
  title: string;
  is_visible: boolean;
  created_at: string;
};

type TradeItemRow = {
  id: string;
  collection_id: string;
  category: TradeCategory;
  work_title: string;
  item_name: string | null;
  image_path: string;
  is_visible: boolean;
  sort_order: number;
  created_at: string;
};

function normalizeSlug(value: string) {
  return value
    .trim()
    .toLowerCase()
    .replace(/[^a-z0-9-]/g, '-')
    .replace(/-+/g, '-')
    .replace(/^-|-$/g, '');
}

function normalizePathPart(value: string) {
  const normalized = value
    .trim()
    .toLowerCase()
    .normalize('NFKD')
    .replace(/[\u0300-\u036f]/g, '')
    .replace(/[^a-z0-9-]/g, '-')
    .replace(/-+/g, '-')
    .replace(/^-|-$/g, '');

  return normalized || 'item';
}

function getFileExtension(file: File) {
  const extension = file.name.split('.').pop()?.toLowerCase();

  if (!extension) {
    return 'jpg';
  }

  if (extension === 'jpeg') {
    return 'jpg';
  }

  return extension;
}

function sortKoreanTitles<T extends { title: string }>(rows: T[]) {
  return [...rows].sort((a, b) =>
    a.title.localeCompare(b.title, 'ko-KR', {
      numeric: true,
      sensitivity: 'base',
    }),
  );
}

function getCategoryLabel(category: TradeCategory) {
  return (
    TRADE_CATEGORIES.find((option) => option.id === category)?.label ?? category
  );
}

function getCategorySortIndex(category: TradeCategory) {
  const index = TRADE_CATEGORIES.findIndex((option) => option.id === category);

  return index === -1 ? TRADE_CATEGORIES.length : index;
}

function sortTradeItems(rows: TradeItemRow[]) {
  return [...rows].sort((a, b) => {
    const categoryDiff =
      getCategorySortIndex(a.category) - getCategorySortIndex(b.category);

    if (categoryDiff !== 0) {
      return categoryDiff;
    }

    const titleDiff = a.work_title.localeCompare(b.work_title, 'ko-KR', {
      numeric: true,
      sensitivity: 'base',
    });

    if (titleDiff !== 0) {
      return titleDiff;
    }

    return new Date(a.created_at).getTime() - new Date(b.created_at).getTime();
  });
}

export default function AdminEventManagePage() {
  const router = useRouter();
  const params = useParams<{ id: string }>();

  const eventId = params.id;

  const [adminState, setAdminState] = useState<AdminState>('checking');
  const [eventData, setEventData] = useState<TradeCollectionRow | null>(null);
  const [works, setWorks] = useState<TradeWorkRow[]>([]);
  const [items, setItems] = useState<TradeItemRow[]>([]);

  const [title, setTitle] = useState('');
  const [slug, setSlug] = useState('');
  const [period, setPeriod] = useState('');
  const [statusLabel, setStatusLabel] = useState('');
  const [isPublic, setIsPublic] = useState(true);
  const [sortOrder, setSortOrder] = useState('0');

  const [thumbnailFile, setThumbnailFile] = useState<File | null>(null);
  const [thumbnailPreviewUrl, setThumbnailPreviewUrl] = useState('');

  const [newWorkTitle, setNewWorkTitle] = useState('');
  const [newWorkIsVisible, setNewWorkIsVisible] = useState(true);

  const [editingWorkId, setEditingWorkId] = useState('');
  const [editingWorkTitle, setEditingWorkTitle] = useState('');
  const [editingWorkIsVisible, setEditingWorkIsVisible] = useState(true);

  const [selectedWorkTitle, setSelectedWorkTitle] = useState('');
  const [category, setCategory] = useState<TradeCategory>('benefit');
  const [itemIsVisible, setItemIsVisible] = useState(true);
  const [imageFile, setImageFile] = useState<File | null>(null);
  const [imagePreviewUrl, setImagePreviewUrl] = useState('');

  const [editingItemId, setEditingItemId] = useState('');
  const [editingItemWorkTitle, setEditingItemWorkTitle] = useState('');
  const [editingItemCategory, setEditingItemCategory] =
    useState<TradeCategory>('benefit');
  const [editingItemIsVisible, setEditingItemIsVisible] = useState(true);

  const [message, setMessage] = useState('');
  const [isSubmittingEvent, setIsSubmittingEvent] = useState(false);
  const [isSubmittingWork, setIsSubmittingWork] = useState(false);
  const [isUpdatingWorkId, setIsUpdatingWorkId] = useState('');
  const [isSubmittingItem, setIsSubmittingItem] = useState(false);
  const [isUpdatingItemId, setIsUpdatingItemId] = useState('');
  const [isDeletingWorkId, setIsDeletingWorkId] = useState('');
  const [isDeletingItemId, setIsDeletingItemId] = useState('');

  const normalizedSlug = useMemo(() => {
    return normalizeSlug(slug);
  }, [slug]);

  const visibleWorks = useMemo(() => {
    return sortKoreanTitles(works.filter((work) => work.is_visible));
  }, [works]);

  useEffect(() => {
    async function loadPageData() {
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
          'id, slug, title, description, thumbnail_path, status_label, is_public, sort_order',
        )
        .eq('id', eventId)
        .single();

      if (error || !data) {
        console.error(error);
        setMessage('행사 정보를 불러오지 못했습니다.');
        return;
      }

      const typedEvent = data as TradeCollectionRow;

      setEventData(typedEvent);
      setTitle(typedEvent.title);
      setSlug(typedEvent.slug);
      setPeriod(typedEvent.description ?? '');
      setStatusLabel(typedEvent.status_label ?? '');
      setIsPublic(typedEvent.is_public);
      setSortOrder(String(typedEvent.sort_order ?? 0));
      setThumbnailPreviewUrl(getTradeAssetUrl(typedEvent.thumbnail_path));

      await Promise.all([loadWorks(), loadItems()]);
    }

    loadPageData();
  }, [eventId]);

  useEffect(() => {
    return () => {
      if (thumbnailPreviewUrl.startsWith('blob:')) {
        URL.revokeObjectURL(thumbnailPreviewUrl);
      }

      if (imagePreviewUrl.startsWith('blob:')) {
        URL.revokeObjectURL(imagePreviewUrl);
      }
    };
  }, [thumbnailPreviewUrl, imagePreviewUrl]);

  async function loadWorks() {
    const { data, error } = await supabase
      .from('trade_collection_works')
      .select('id, collection_id, title, is_visible, created_at')
      .eq('collection_id', eventId)
      .order('title', { ascending: true });

    if (error) {
      console.error(error);
      setMessage('작품 목록을 불러오지 못했습니다.');
      return;
    }

    const nextWorks = sortKoreanTitles((data ?? []) as TradeWorkRow[]);

    setWorks(nextWorks);

    const firstVisibleWork = nextWorks.find((work) => work.is_visible);
    setSelectedWorkTitle((prev) => {
      if (prev && nextWorks.some((work) => work.title === prev)) {
        return prev;
      }

      return firstVisibleWork?.title || '';
    });
  }

  async function loadItems() {
    const { data, error } = await supabase
      .from('trade_items')
      .select(
        'id, collection_id, category, work_title, item_name, image_path, is_visible, sort_order, created_at',
      )
      .eq('collection_id', eventId)
      .order('created_at', { ascending: true });

    if (error) {
      console.error(error);
      setMessage('굿즈 이미지 목록을 불러오지 못했습니다.');
      return;
    }

    setItems(sortTradeItems((data ?? []) as TradeItemRow[]));
  }

  function handleThumbnailChange(event: ChangeEvent<HTMLInputElement>) {
    const file = event.target.files?.[0];

    if (!file) {
      return;
    }

    if (!file.type.startsWith('image/')) {
      setMessage('이미지 파일만 업로드할 수 있습니다.');
      return;
    }

    if (thumbnailPreviewUrl.startsWith('blob:')) {
      URL.revokeObjectURL(thumbnailPreviewUrl);
    }

    setThumbnailFile(file);
    setThumbnailPreviewUrl(URL.createObjectURL(file));
  }

  function handleImageChange(event: ChangeEvent<HTMLInputElement>) {
    const file = event.target.files?.[0];

    if (!file) {
      return;
    }

    if (!file.type.startsWith('image/')) {
      setMessage('이미지 파일만 업로드할 수 있습니다.');
      return;
    }

    if (imagePreviewUrl.startsWith('blob:')) {
      URL.revokeObjectURL(imagePreviewUrl);
    }

    setImageFile(file);
    setImagePreviewUrl(URL.createObjectURL(file));
  }

  async function handleUpdateEvent(event: FormEvent<HTMLFormElement>) {
    event.preventDefault();

    if (!eventData) {
      setMessage('행사 정보를 불러온 뒤 다시 시도해 주세요.');
      return;
    }

    if (!title.trim()) {
      setMessage('행사 제목을 입력해 주세요.');
      return;
    }

    if (!normalizedSlug) {
      setMessage('slug를 입력해 주세요.');
      return;
    }

    try {
      setIsSubmittingEvent(true);
      setMessage('');

      let nextThumbnailPath = eventData.thumbnail_path;

      if (thumbnailFile) {
        const fileExtension = getFileExtension(thumbnailFile);
        nextThumbnailPath = `${normalizedSlug}/thumbnail.${fileExtension}`;

        const { error: uploadError } = await supabase.storage
          .from('trade-assets')
          .upload(nextThumbnailPath, thumbnailFile, {
            cacheControl: '3600',
            upsert: true,
            contentType: thumbnailFile.type,
          });

        if (uploadError) {
          console.error(uploadError);
          setMessage(
            '썸네일 업로드에 실패했습니다. Storage 정책을 확인해 주세요.',
          );
          return;
        }
      }

      const parsedSortOrder = Number.parseInt(sortOrder, 10);

      const { error: updateError } = await supabase
        .from('trade_collections')
        .update({
          title: title.trim(),
          slug: normalizedSlug,
          description: period.trim() || null,
          thumbnail_path: nextThumbnailPath,
          status_label: statusLabel.trim() || null,
          is_public: isPublic,
          sort_order: Number.isNaN(parsedSortOrder) ? 0 : parsedSortOrder,
        })
        .eq('id', eventData.id);

      if (updateError) {
        console.error(updateError);
        setMessage(
          '행사 수정에 실패했습니다. slug 중복 또는 DB 정책을 확인해 주세요.',
        );
        return;
      }

      const { data } = await supabase
        .from('trade_collections')
        .select(
          'id, slug, title, description, thumbnail_path, status_label, is_public, sort_order',
        )
        .eq('id', eventData.id)
        .single();

      if (data) {
        const refreshedEvent = data as TradeCollectionRow;

        setEventData(refreshedEvent);
        setTitle(refreshedEvent.title);
        setSlug(refreshedEvent.slug);
        setPeriod(refreshedEvent.description ?? '');
        setStatusLabel(refreshedEvent.status_label ?? '');
        setIsPublic(refreshedEvent.is_public);
        setSortOrder(String(refreshedEvent.sort_order ?? 0));
        setThumbnailPreviewUrl(getTradeAssetUrl(refreshedEvent.thumbnail_path));
        setThumbnailFile(null);
      }

      setMessage('행사 정보가 수정되었습니다.');
      router.refresh();
    } catch (error) {
      console.error(error);
      setMessage('행사 수정 중 오류가 발생했습니다.');
    } finally {
      setIsSubmittingEvent(false);
    }
  }

  async function handleAddWork(event: FormEvent<HTMLFormElement>) {
    event.preventDefault();

    if (!eventData) {
      setMessage('행사 정보를 불러온 뒤 다시 시도해 주세요.');
      return;
    }

    if (!newWorkTitle.trim()) {
      setMessage('작품명을 입력해 주세요.');
      return;
    }

    try {
      setIsSubmittingWork(true);
      setMessage('');

      const { error } = await supabase.from('trade_collection_works').insert({
        collection_id: eventData.id,
        title: newWorkTitle.trim(),
        sort_order: 0,
        is_visible: newWorkIsVisible,
      });

      if (error) {
        console.error(error);
        setMessage('작품 등록에 실패했습니다. 이미 등록된 작품명일 수 있습니다.');
        return;
      }

      setNewWorkTitle('');
      setNewWorkIsVisible(true);

      await loadWorks();
      setMessage('작품명이 등록되었습니다.');
    } catch (error) {
      console.error(error);
      setMessage('작품 등록 중 오류가 발생했습니다.');
    } finally {
      setIsSubmittingWork(false);
    }
  }

  function handleStartEditWork(work: TradeWorkRow) {
    setEditingWorkId(work.id);
    setEditingWorkTitle(work.title);
    setEditingWorkIsVisible(work.is_visible);
  }

  function handleCancelEditWork() {
    setEditingWorkId('');
    setEditingWorkTitle('');
    setEditingWorkIsVisible(true);
  }

  async function handleUpdateWork(work: TradeWorkRow) {
    const nextTitle = editingWorkTitle.trim();

    if (!nextTitle) {
      setMessage('수정할 작품명을 입력해 주세요.');
      return;
    }

    try {
      setIsUpdatingWorkId(work.id);
      setMessage('');

      const oldTitle = work.title;
      const titleChanged = oldTitle !== nextTitle;

      const { error: updateWorkError } = await supabase
        .from('trade_collection_works')
        .update({
          title: nextTitle,
          is_visible: editingWorkIsVisible,
        })
        .eq('id', work.id);

      if (updateWorkError) {
        console.error(updateWorkError);
        setMessage(
          '작품명 수정에 실패했습니다. 이미 등록된 작품명일 수 있습니다.',
        );
        return;
      }

      if (titleChanged) {
        const { error: updateItemsError } = await supabase
          .from('trade_items')
          .update({
            work_title: nextTitle,
          })
          .eq('collection_id', work.collection_id)
          .eq('work_title', oldTitle);

        if (updateItemsError) {
          console.error(updateItemsError);
          setMessage(
            '작품명은 수정됐지만, 기존 굿즈의 작품명 반영에 실패했습니다.',
          );
          return;
        }

        const { error: updateSubmissionsError } = await supabase
          .from('card_submissions')
          .update({
            work_title: nextTitle,
          })
          .eq('collection_id', work.collection_id)
          .eq('work_title', oldTitle);

        if (updateSubmissionsError) {
          console.error(updateSubmissionsError);
        }

        if (selectedWorkTitle === oldTitle) {
          setSelectedWorkTitle(nextTitle);
        }

        if (editingItemWorkTitle === oldTitle) {
          setEditingItemWorkTitle(nextTitle);
        }
      }

      handleCancelEditWork();

      await Promise.all([loadWorks(), loadItems()]);

      setMessage('작품명이 수정되었습니다.');
      router.refresh();
    } catch (error) {
      console.error(error);
      setMessage('작품명 수정 중 오류가 발생했습니다.');
    } finally {
      setIsUpdatingWorkId('');
    }
  }

  async function handleDeleteWork(work: TradeWorkRow) {
    const ok = window.confirm(
      '이 작품명을 작품 선택 목록에서 삭제할까요? 이미 등록된 굿즈 이미지는 삭제되지 않습니다.',
    );

    if (!ok) {
      return;
    }

    try {
      setIsDeletingWorkId(work.id);
      setMessage('');

      const { error } = await supabase
        .from('trade_collection_works')
        .delete()
        .eq('id', work.id);

      if (error) {
        console.error(error);
        setMessage('작품명 삭제에 실패했습니다.');
        return;
      }

      await loadWorks();

      if (selectedWorkTitle === work.title) {
        setSelectedWorkTitle('');
      }

      setMessage('작품명이 삭제되었습니다.');
    } catch (error) {
      console.error(error);
      setMessage('작품명 삭제 중 오류가 발생했습니다.');
    } finally {
      setIsDeletingWorkId('');
    }
  }

  async function handleAddItem(event: FormEvent<HTMLFormElement>) {
    event.preventDefault();

    if (!eventData) {
      setMessage('행사 정보를 불러온 뒤 다시 시도해 주세요.');
      return;
    }

    if (!selectedWorkTitle) {
      setMessage('작품명을 선택해 주세요.');
      return;
    }

    if (!imageFile) {
      setMessage('굿즈 이미지를 업로드해 주세요.');
      return;
    }

    try {
      setIsSubmittingItem(true);
      setMessage('');

      const fileExtension = getFileExtension(imageFile);
      const safeWorkTitle = normalizePathPart(selectedWorkTitle);
      const fileName = `${category}-${safeWorkTitle}-${Date.now()}.${fileExtension}`;
      const imagePath = `${eventData.slug}/${fileName}`;

      const { error: uploadError } = await supabase.storage
        .from('trade-assets')
        .upload(imagePath, imageFile, {
          cacheControl: '3600',
          upsert: false,
          contentType: imageFile.type,
        });

      if (uploadError) {
        console.error(uploadError);
        setMessage(
          '이미지 업로드에 실패했습니다. Storage 정책과 trade-assets 버킷을 확인해 주세요.',
        );
        return;
      }

      const { error: insertError } = await supabase.from('trade_items').insert({
        collection_id: eventData.id,
        category,
        work_title: selectedWorkTitle,
        item_name: null,
        image_path: imagePath,
        is_visible: itemIsVisible,
        sort_order: 0,
      });

      if (insertError) {
        console.error(insertError);
        setMessage('굿즈 등록에 실패했습니다. DB 정책을 확인해 주세요.');
        return;
      }

      setImageFile(null);
      setImagePreviewUrl('');
      setItemIsVisible(true);

      await loadItems();

      setMessage('굿즈 이미지가 등록되었습니다.');
      router.refresh();
    } catch (error) {
      console.error(error);
      setMessage('굿즈 등록 중 오류가 발생했습니다.');
    } finally {
      setIsSubmittingItem(false);
    }
  }

  function handleStartEditItem(item: TradeItemRow) {
    setEditingItemId(item.id);
    setEditingItemWorkTitle(item.work_title);
    setEditingItemCategory(item.category);
    setEditingItemIsVisible(item.is_visible);
  }

  function handleCancelEditItem() {
    setEditingItemId('');
    setEditingItemWorkTitle('');
    setEditingItemCategory('benefit');
    setEditingItemIsVisible(true);
  }

  async function handleUpdateItem(item: TradeItemRow) {
    if (!editingItemWorkTitle) {
      setMessage('작품명을 선택해 주세요.');
      return;
    }

    try {
      setIsUpdatingItemId(item.id);
      setMessage('');

      const { error } = await supabase
        .from('trade_items')
        .update({
          work_title: editingItemWorkTitle,
          category: editingItemCategory,
          item_name: null,
          is_visible: editingItemIsVisible,
        })
        .eq('id', item.id);

      if (error) {
        console.error(error);
        setMessage('굿즈 수정에 실패했습니다. DB 정책을 확인해 주세요.');
        return;
      }

      handleCancelEditItem();

      await loadItems();

      setMessage('굿즈 정보가 수정되었습니다.');
      router.refresh();
    } catch (error) {
      console.error(error);
      setMessage('굿즈 수정 중 오류가 발생했습니다.');
    } finally {
      setIsUpdatingItemId('');
    }
  }

  async function handleDeleteItem(item: TradeItemRow) {
    const ok = window.confirm('이 굿즈 이미지를 삭제할까요?');

    if (!ok) {
      return;
    }

    try {
      setIsDeletingItemId(item.id);
      setMessage('');

      const { error: storageError } = await supabase.storage
        .from('trade-assets')
        .remove([item.image_path]);

      if (storageError) {
        console.error(storageError);
      }

      const { error: deleteError } = await supabase
        .from('trade_items')
        .delete()
        .eq('id', item.id);

      if (deleteError) {
        console.error(deleteError);
        setMessage('굿즈 삭제에 실패했습니다.');
        return;
      }

      await loadItems();
      setMessage('굿즈 이미지가 삭제되었습니다.');
      router.refresh();
    } catch (error) {
      console.error(error);
      setMessage('굿즈 삭제 중 오류가 발생했습니다.');
    } finally {
      setIsDeletingItemId('');
    }
  }

  async function handleLogout() {
    await supabase.auth.signOut();
    router.push('/admin/login');
    router.refresh();
  }

  if (adminState === 'checking') {
    return (
      <main className="min-h-screen bg-neutral-100 px-4 py-10">
        <section className="mx-auto max-w-md rounded-3xl bg-white p-6 text-sm text-neutral-500 shadow-sm">
          관리자 권한을 확인하는 중입니다.
        </section>
      </main>
    );
  }

  if (adminState === 'signed-out') {
    return (
      <main className="min-h-screen bg-neutral-100 px-4 py-10">
        <section className="mx-auto max-w-md rounded-3xl bg-white p-6 shadow-sm">
          <h1 className="text-2xl font-black text-neutral-950">
            로그인이 필요합니다
          </h1>

          <p className="mt-2 text-sm leading-6 text-neutral-500">
            행사 관리는 관리자 로그인 후 이용할 수 있습니다.
          </p>

          <Link
            href="/admin/login"
            className="mt-6 inline-flex rounded-2xl bg-neutral-950 px-5 py-3 text-sm font-black text-white"
          >
            관리자 로그인
          </Link>
        </section>
      </main>
    );
  }

  if (adminState === 'not-admin') {
    return (
      <main className="min-h-screen bg-neutral-100 px-4 py-10">
        <section className="mx-auto max-w-md rounded-3xl bg-white p-6 shadow-sm">
          <h1 className="text-2xl font-black text-neutral-950">
            관리자 권한이 없습니다
          </h1>

          <p className="mt-2 text-sm leading-6 text-neutral-500">
            현재 로그인한 계정은 관리자 목록에 등록되어 있지 않습니다.
          </p>

          <button
            type="button"
            onClick={handleLogout}
            className="mt-6 rounded-2xl bg-neutral-950 px-5 py-3 text-sm font-black text-white"
          >
            로그아웃
          </button>
        </section>
      </main>
    );
  }

  return (
    <main className="min-h-screen bg-neutral-100 px-4 py-5">
      <section className="mx-auto w-full max-w-md sm:max-w-lg">
        <header className="rounded-3xl bg-white p-5 shadow-sm">
          <div className="flex items-center justify-between gap-3">
            <Link
              href="/admin/events"
              className="rounded-full border border-neutral-200 px-4 py-2 text-xs font-bold text-neutral-600"
            >
              ← 행사 목록
            </Link>

            {eventData ? (
              <Link
                href={`/trade/${eventData.slug}`}
                className="rounded-full border border-neutral-200 px-4 py-2 text-xs font-bold text-neutral-600"
              >
                교환판 보기
              </Link>
            ) : null}
          </div>

          <div className="mt-6">
            <p className="text-xs font-black uppercase tracking-[0.2em] text-neutral-500">
              Event Manager
            </p>

            <h1 className="mt-1 text-2xl font-black text-neutral-950">
              행사 관리
            </h1>

            <p className="mt-2 text-sm leading-6 text-neutral-500">
              행사 정보, 작품 목록, 굿즈 이미지를 관리합니다.
            </p>
          </div>
        </header>

        {message ? (
          <p className="mt-4 rounded-2xl bg-white px-4 py-3 text-sm leading-6 text-neutral-700 shadow-sm">
            {message}
          </p>
        ) : null}

        <form
          onSubmit={handleUpdateEvent}
          className="mt-5 rounded-3xl bg-white p-5 shadow-sm"
        >
          <h2 className="text-lg font-black text-neutral-950">행사 수정</h2>

          <div className="mt-5 space-y-5">
            <label className="block">
              <span className="text-sm font-bold text-neutral-800">
                행사 제목
              </span>

              <input
                value={title}
                onChange={(event) => setTitle(event.target.value)}
                className="mt-1 w-full rounded-2xl border border-neutral-200 px-4 py-3 text-sm outline-none focus:border-neutral-950"
                placeholder="예: 2026 여름 특전 교환판"
              />
            </label>

            <label className="block">
              <span className="text-sm font-bold text-neutral-800">
                행사 기간
              </span>

              <input
                value={period}
                onChange={(event) => setPeriod(event.target.value)}
                className="mt-1 w-full rounded-2xl border border-neutral-200 px-4 py-3 text-sm outline-none focus:border-neutral-950"
                placeholder="예: 2026.07.01 - 2026.07.31"
              />
            </label>

            <label className="block">
              <span className="text-sm font-bold text-neutral-800">Slug</span>

              <input
                value={slug}
                onChange={(event) => setSlug(event.target.value)}
                className="mt-1 w-full rounded-2xl border border-neutral-200 px-4 py-3 text-sm outline-none focus:border-neutral-950"
                placeholder="예: summer-event-2026"
              />

              <p className="mt-2 text-xs leading-5 text-neutral-400">
                실제 주소는 /trade/{normalizedSlug || 'slug'} 형태입니다.
                변경하면 기존 공유 링크가 바뀔 수 있습니다.
              </p>
            </label>

            <div className="grid grid-cols-2 gap-3">
              <label className="block">
                <span className="text-sm font-bold text-neutral-800">
                  상태 라벨
                </span>

                <input
                  value={statusLabel}
                  onChange={(event) => setStatusLabel(event.target.value)}
                  className="mt-1 w-full rounded-2xl border border-neutral-200 px-4 py-3 text-sm outline-none focus:border-neutral-950"
                  placeholder="OPEN"
                />
              </label>

              <label className="block">
                <span className="text-sm font-bold text-neutral-800">
                  정렬 순서
                </span>

                <input
                  type="number"
                  value={sortOrder}
                  onChange={(event) => setSortOrder(event.target.value)}
                  className="mt-1 w-full rounded-2xl border border-neutral-200 px-4 py-3 text-sm outline-none focus:border-neutral-950"
                  placeholder="0"
                />
              </label>
            </div>

            <label className="flex items-center justify-between gap-3 rounded-2xl bg-neutral-100 px-4 py-3">
              <span>
                <span className="block text-sm font-bold text-neutral-800">
                  공개 여부
                </span>
                <span className="mt-1 block text-xs text-neutral-500">
                  공개 상태여야 메인 페이지에 노출됩니다.
                </span>
              </span>

              <input
                type="checkbox"
                checked={isPublic}
                onChange={(event) => setIsPublic(event.target.checked)}
                className="h-5 w-5"
              />
            </label>

            <div>
              <span className="text-sm font-bold text-neutral-800">
                행사 썸네일
              </span>

              <label className="mt-1 flex cursor-pointer flex-col items-center justify-center rounded-2xl border border-dashed border-neutral-300 bg-neutral-50 px-4 py-8 text-center hover:border-neutral-950">
                {thumbnailPreviewUrl ? (
                  <img
                    src={thumbnailPreviewUrl}
                    alt="썸네일 미리보기"
                    className="aspect-[32/45] w-44 rounded-2xl object-cover shadow-sm"
                  />
                ) : (
                  <>
                    <span className="text-sm font-black text-neutral-700">
                      썸네일 이미지 선택
                    </span>
                    <span className="mt-2 text-xs leading-5 text-neutral-400">
                      포스터형 이미지는 32:45 비율을 추천합니다.
                    </span>
                  </>
                )}

                <input
                  type="file"
                  accept="image/*"
                  onChange={handleThumbnailChange}
                  className="hidden"
                />
              </label>
            </div>

            <button
              type="submit"
              disabled={isSubmittingEvent}
              className="w-full rounded-2xl bg-neutral-950 px-5 py-4 text-sm font-black text-white disabled:cursor-not-allowed disabled:bg-neutral-300"
            >
              {isSubmittingEvent ? '수정 중...' : '행사 수정 저장'}
            </button>
          </div>
        </form>

        <form
          onSubmit={handleAddWork}
          className="mt-5 rounded-3xl bg-white p-5 shadow-sm"
        >
          <h2 className="text-lg font-black text-neutral-950">작품명 등록</h2>

          <p className="mt-2 text-sm leading-6 text-neutral-500">
            굿즈 등록과 유저 이미지 제보에서 선택할 작품명을 미리 등록합니다.
          </p>

          <div className="mt-5 space-y-5">
            <label className="block">
              <span className="text-sm font-bold text-neutral-800">
                작품명
              </span>

              <input
                value={newWorkTitle}
                onChange={(event) => setNewWorkTitle(event.target.value)}
                className="mt-1 w-full rounded-2xl border border-neutral-200 px-4 py-3 text-sm outline-none focus:border-neutral-950"
                placeholder="예: 작품명 A"
              />
            </label>

            <label className="flex items-center justify-between gap-3 rounded-2xl bg-neutral-100 px-4 py-3">
              <span>
                <span className="block text-sm font-bold text-neutral-800">
                  공개
                </span>
                <span className="mt-1 block text-xs text-neutral-500">
                  유저 이미지 제보와 교환판 선택 목록에 노출합니다.
                </span>
              </span>

              <input
                type="checkbox"
                checked={newWorkIsVisible}
                onChange={(event) => setNewWorkIsVisible(event.target.checked)}
                className="h-5 w-5"
              />
            </label>

            <button
              type="submit"
              disabled={isSubmittingWork}
              className="w-full rounded-2xl bg-neutral-950 px-5 py-4 text-sm font-black text-white disabled:cursor-not-allowed disabled:bg-neutral-300"
            >
              {isSubmittingWork ? '등록 중...' : '작품명 등록'}
            </button>
          </div>

          <div className="mt-5 border-t border-neutral-100 pt-5">
            <h3 className="text-sm font-black text-neutral-950">
              등록된 작품명
            </h3>

            {works.length > 0 ? (
              <div className="mt-3 space-y-2">
                {sortKoreanTitles(works).map((work) => {
                  const isEditing = editingWorkId === work.id;
                  const isUpdating = isUpdatingWorkId === work.id;
                  const isDeleting = isDeletingWorkId === work.id;

                  return (
                    <div
                      key={work.id}
                      className="rounded-2xl bg-neutral-50 px-3 py-3"
                    >
                      {isEditing ? (
                        <div className="space-y-3">
                          <label className="block">
                            <span className="text-xs font-bold text-neutral-500">
                              작품명
                            </span>

                            <input
                              value={editingWorkTitle}
                              onChange={(event) =>
                                setEditingWorkTitle(event.target.value)
                              }
                              onKeyDown={(event) => {
                                if (event.key === 'Enter') {
                                  event.preventDefault();
                                }
                              }}
                              className="mt-1 w-full rounded-xl border border-neutral-200 bg-white px-3 py-2 text-sm outline-none focus:border-neutral-950"
                              placeholder="작품명"
                            />
                          </label>

                          <label className="flex items-center justify-between gap-2 rounded-xl bg-white px-3 py-3">
                            <span>
                              <span className="block text-xs font-bold text-neutral-600">
                                공개
                              </span>
                              <span className="mt-0.5 block text-[11px] text-neutral-400">
                                유저 선택 목록 노출
                              </span>
                            </span>

                            <input
                              type="checkbox"
                              checked={editingWorkIsVisible}
                              onChange={(event) =>
                                setEditingWorkIsVisible(event.target.checked)
                              }
                              className="h-5 w-5"
                            />
                          </label>

                          <div className="grid grid-cols-2 gap-2">
                            <button
                              type="button"
                              onClick={handleCancelEditWork}
                              disabled={isUpdating}
                              className="rounded-xl border border-neutral-300 bg-white px-3 py-2 text-xs font-black text-neutral-600 disabled:cursor-not-allowed disabled:opacity-50"
                            >
                              취소
                            </button>

                            <button
                              type="button"
                              onClick={() => handleUpdateWork(work)}
                              disabled={isUpdating}
                              className="rounded-xl bg-neutral-950 px-3 py-2 text-xs font-black text-white disabled:cursor-not-allowed disabled:bg-neutral-300"
                            >
                              {isUpdating ? '수정 중...' : '수정 저장'}
                            </button>
                          </div>
                        </div>
                      ) : (
                        <div className="flex items-center justify-between gap-3">
                          <div className="min-w-0">
                            <p className="truncate text-sm font-black text-neutral-950">
                              {work.title}
                            </p>
                            <p className="mt-0.5 text-[11px] text-neutral-400">
                              {work.is_visible ? '공개' : '숨김'}
                            </p>
                          </div>

                          <div className="flex shrink-0 items-center gap-1.5">
                            <button
                              type="button"
                              onClick={() => handleStartEditWork(work)}
                              className="rounded-full border border-neutral-200 bg-white px-3 py-1.5 text-[11px] font-black text-neutral-600"
                            >
                              수정
                            </button>

                            <button
                              type="button"
                              onClick={() => handleDeleteWork(work)}
                              disabled={isDeleting}
                              className="rounded-full border border-red-200 bg-red-50 px-3 py-1.5 text-[11px] font-black text-red-600 disabled:cursor-not-allowed disabled:opacity-50"
                            >
                              {isDeleting ? '삭제 중' : '삭제'}
                            </button>
                          </div>
                        </div>
                      )}
                    </div>
                  );
                })}
              </div>
            ) : (
              <p className="mt-3 rounded-2xl bg-neutral-50 px-4 py-6 text-center text-xs text-neutral-400">
                아직 등록된 작품명이 없습니다.
              </p>
            )}
          </div>
        </form>

        <form
          onSubmit={handleAddItem}
          className="mt-5 rounded-3xl bg-white p-5 shadow-sm"
        >
          <h2 className="text-lg font-black text-neutral-950">
            굿즈 이미지 등록
          </h2>

          <div className="mt-5 space-y-5">
            <label className="block">
              <span className="text-sm font-bold text-neutral-800">
                작품명
              </span>

              <select
                value={selectedWorkTitle}
                onChange={(event) => setSelectedWorkTitle(event.target.value)}
                disabled={visibleWorks.length === 0}
                className="mt-1 w-full rounded-2xl border border-neutral-200 bg-white px-4 py-3 text-sm outline-none focus:border-neutral-950 disabled:bg-neutral-100 disabled:text-neutral-400"
              >
                {visibleWorks.length > 0 ? (
                  visibleWorks.map((work) => (
                    <option key={work.id} value={work.title}>
                      {work.title}
                    </option>
                  ))
                ) : (
                  <option value="">등록된 작품명이 없습니다</option>
                )}
              </select>

              <p className="mt-2 text-xs leading-5 text-neutral-400">
                작품명 등록 영역에서 먼저 작품명을 추가해 주세요.
              </p>
            </label>

            <label className="block">
              <span className="text-sm font-bold text-neutral-800">
                굿즈 종류
              </span>

              <select
                value={category}
                onChange={(event) =>
                  setCategory(event.target.value as TradeCategory)
                }
                className="mt-1 w-full rounded-2xl border border-neutral-200 bg-white px-4 py-3 text-sm outline-none focus:border-neutral-950"
              >
                {TRADE_CATEGORIES.map((option) => (
                  <option key={option.id} value={option.id}>
                    {option.label}
                  </option>
                ))}
              </select>
            </label>

            <div className="space-y-3">
              <div className="flex items-center gap-3">
                <span className="shrink-0 text-sm font-bold text-neutral-800">
                  굿즈 이미지
                </span>

                <label className="flex min-h-[56px] flex-1 cursor-pointer items-center justify-between gap-3 rounded-2xl border border-dashed border-neutral-300 bg-neutral-50 px-4 py-3 hover:border-neutral-950">
                  {imagePreviewUrl ? (
                    <span className="flex items-center gap-3">
                      <img
                        src={imagePreviewUrl}
                        alt="굿즈 이미지 미리보기"
                        className="aspect-square w-12 rounded-xl bg-white object-contain p-1 shadow-sm"
                      />
                      <span className="text-xs font-bold text-neutral-500">
                        다른 이미지 선택
                      </span>
                    </span>
                  ) : (
                    <span className="text-sm font-black text-neutral-700">
                      이미지 선택
                    </span>
                  )}

                  <span className="hidden text-xs text-neutral-400 sm:inline">
                    교환판에 표시될 이미지를 업로드합니다.
                  </span>

                  <input
                    type="file"
                    accept="image/*"
                    onChange={handleImageChange}
                    className="hidden"
                  />
                </label>
              </div>

              <label className="flex items-center justify-between gap-3 rounded-2xl bg-neutral-100 px-4 py-3">
                <span>
                  <span className="block text-sm font-bold text-neutral-800">
                    공개
                  </span>
                  <span className="mt-1 block text-xs text-neutral-500">
                    교환판 노출
                  </span>
                </span>

                <input
                  type="checkbox"
                  checked={itemIsVisible}
                  onChange={(event) => setItemIsVisible(event.target.checked)}
                  className="h-5 w-5"
                />
              </label>
            </div>

            <button
              type="submit"
              disabled={isSubmittingItem || visibleWorks.length === 0}
              className="w-full rounded-2xl bg-neutral-950 px-5 py-4 text-sm font-black text-white disabled:cursor-not-allowed disabled:bg-neutral-300"
            >
              {isSubmittingItem ? '등록 중...' : '굿즈 등록'}
            </button>
          </div>
        </form>

        <section className="mt-5 rounded-3xl bg-white p-5 shadow-sm">
          <div>
            <h2 className="text-lg font-black text-neutral-950">
              등록된 굿즈
            </h2>
            <p className="mt-1 text-xs text-neutral-400">총 {items.length}개</p>
          </div>

          {items.length > 0 ? (
            <div className="mt-5 grid grid-cols-2 gap-3">
              {sortTradeItems(items).map((item) => {
                const categoryLabel = getCategoryLabel(item.category);
                const isEditing = editingItemId === item.id;
                const isUpdating = isUpdatingItemId === item.id;
                const isDeleting = isDeletingItemId === item.id;
                const shouldShowCurrentWork =
                  editingItemWorkTitle &&
                  !visibleWorks.some(
                    (work) => work.title === editingItemWorkTitle,
                  );

                return (
                  <article
                    key={item.id}
                    className="overflow-hidden rounded-2xl border border-neutral-200 bg-white"
                  >
                    <div className="relative aspect-square bg-neutral-100">
                      <img
                        src={getTradeAssetUrl(item.image_path)}
                        alt={item.work_title}
                        className="h-full w-full bg-white object-contain p-1"
                      />

                      <span
                        className={
                          item.is_visible
                            ? 'absolute right-2 top-2 rounded-full bg-white px-2 py-1 text-[10px] font-black text-neutral-950'
                            : 'absolute right-2 top-2 rounded-full bg-red-50 px-2 py-1 text-[10px] font-black text-red-600'
                        }
                      >
                        {item.is_visible ? '공개' : '숨김'}
                      </span>
                    </div>

                    <div className="p-3">
                      {isEditing ? (
                        <div className="space-y-2">
                          <label className="block">
                            <span className="text-[10px] font-bold text-neutral-500">
                              작품명
                            </span>

                            <select
                              value={editingItemWorkTitle}
                              onChange={(event) =>
                                setEditingItemWorkTitle(event.target.value)
                              }
                              className="mt-1 w-full rounded-xl border border-neutral-200 bg-white px-2 py-2 text-xs outline-none focus:border-neutral-950"
                            >
                              {shouldShowCurrentWork ? (
                                <option value={editingItemWorkTitle}>
                                  {editingItemWorkTitle} 현재값
                                </option>
                              ) : null}

                              {visibleWorks.map((work) => (
                                <option key={work.id} value={work.title}>
                                  {work.title}
                                </option>
                              ))}
                            </select>
                          </label>

                          <label className="block">
                            <span className="text-[10px] font-bold text-neutral-500">
                              굿즈 종류
                            </span>

                            <select
                              value={editingItemCategory}
                              onChange={(event) =>
                                setEditingItemCategory(
                                  event.target.value as TradeCategory,
                                )
                              }
                              className="mt-1 w-full rounded-xl border border-neutral-200 bg-white px-2 py-2 text-xs outline-none focus:border-neutral-950"
                            >
                              {TRADE_CATEGORIES.map((option) => (
                                <option key={option.id} value={option.id}>
                                  {option.label}
                                </option>
                              ))}
                            </select>
                          </label>

                          <label className="flex items-center justify-between gap-2 rounded-xl bg-neutral-50 px-3 py-2">
                            <span>
                              <span className="block text-[10px] font-bold text-neutral-600">
                                공개
                              </span>
                              <span className="mt-0.5 block text-[10px] text-neutral-400">
                                교환판 노출
                              </span>
                            </span>

                            <input
                              type="checkbox"
                              checked={editingItemIsVisible}
                              onChange={(event) =>
                                setEditingItemIsVisible(event.target.checked)
                              }
                              className="h-5 w-5"
                            />
                          </label>

                          <div className="grid grid-cols-2 gap-2 pt-1">
                            <button
                              type="button"
                              onClick={handleCancelEditItem}
                              disabled={isUpdating}
                              className="rounded-xl border border-neutral-300 bg-white px-3 py-2 text-[11px] font-black text-neutral-600 disabled:cursor-not-allowed disabled:opacity-50"
                            >
                              취소
                            </button>

                            <button
                              type="button"
                              onClick={() => handleUpdateItem(item)}
                              disabled={isUpdating}
                              className="rounded-xl bg-neutral-950 px-3 py-2 text-[11px] font-black text-white disabled:cursor-not-allowed disabled:bg-neutral-300"
                            >
                              {isUpdating ? '수정 중...' : '저장'}
                            </button>
                          </div>
                        </div>
                      ) : (
                        <>
                          <p className="line-clamp-1 text-[11px] font-black text-neutral-950">
                            {item.work_title}
                          </p>

                          <p className="mt-1 line-clamp-1 text-[10px] text-neutral-500">
                            {categoryLabel}
                          </p>

                          <div className="mt-3 grid grid-cols-2 gap-2">
                            <button
                              type="button"
                              onClick={() => handleStartEditItem(item)}
                              className="rounded-xl border border-neutral-200 bg-white px-3 py-2 text-[11px] font-black text-neutral-600"
                            >
                              수정
                            </button>

                            <button
                              type="button"
                              onClick={() => handleDeleteItem(item)}
                              disabled={isDeleting}
                              className="rounded-xl border border-red-200 bg-red-50 px-3 py-2 text-[11px] font-black text-red-600 disabled:cursor-not-allowed disabled:opacity-50"
                            >
                              {isDeleting ? '삭제 중...' : '삭제'}
                            </button>
                          </div>
                        </>
                      )}
                    </div>
                  </article>
                );
              })}
            </div>
          ) : (
            <div className="mt-5 rounded-2xl bg-neutral-50 px-4 py-10 text-center">
              <p className="text-sm font-bold text-neutral-400">
                아직 등록된 굿즈 이미지가 없습니다.
              </p>
            </div>
          )}
        </section>
      </section>
    </main>
  );
}
