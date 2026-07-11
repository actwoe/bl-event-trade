'use client';

import Link from 'next/link';
import { ChangeEvent, FormEvent, useEffect, useMemo, useState } from 'react';
import { useParams, useRouter } from 'next/navigation';
import { getTradeAssetUrl, supabase } from '@/lib/supabase';
import {
  TRADE_CATEGORIES,
  TradeCategory,
  TradeImageRatio,
} from '@/lib/trade-types';

type AdminState = 'checking' | 'admin' | 'not-admin' | 'signed-out';

type TradeCollectionRow = {
  id: string;
  slug: string;
  title: string;
  description: string | null;
  event_start_date: string | null;
  event_end_date: string | null;
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

type TradeBenefitSubcategoryRow = {
  id: string;
  collection_id: string;
  name: string;
  is_visible: boolean;
  sort_order: number;
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
  image_ratio: TradeImageRatio | null;
  benefit_subcategory: string | null;
  created_at: string;
};

type TradeReferenceImageRow = {
  id: string;
  collection_id: string;
  image_path: string;
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

function sortBenefitSubcategories(rows: TradeBenefitSubcategoryRow[]) {
  return [...rows].sort((a, b) => {
    const sortDiff = (a.sort_order ?? 0) - (b.sort_order ?? 0);

    if (sortDiff !== 0) {
      return sortDiff;
    }

    return a.name.localeCompare(b.name, 'ko-KR', {
      numeric: true,
      sensitivity: 'base',
    });
  });
}

function getCategoryLabel(category: TradeCategory) {
  return (
    TRADE_CATEGORIES.find((option) => option.id === category)?.label ?? category
  );
}

function getSafeImageRatio(value?: string | null): TradeImageRatio {
  return value === 'photocard' ? 'photocard' : 'square';
}

function getImageRatioClass(ratio?: string | null) {
  return getSafeImageRatio(ratio) === 'photocard'
    ? 'aspect-[55/85]'
    : 'aspect-square';
}

function getBenefitSubcategoryLabel(value?: string | null) {
  return value?.trim() || '';
}

function getTradeItemMetaLabel(item: TradeItemRow) {
  const categoryLabel = getCategoryLabel(item.category);
  const subcategory = getBenefitSubcategoryLabel(item.benefit_subcategory);

  if (item.category === 'benefit' && subcategory) {
    return `${categoryLabel} · ${subcategory}`;
  }

  return categoryLabel;
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

    if (a.category === 'benefit' && b.category === 'benefit') {
      const subcategoryDiff = getBenefitSubcategoryLabel(
        a.benefit_subcategory,
      ).localeCompare(getBenefitSubcategoryLabel(b.benefit_subcategory), 'ko-KR', {
        numeric: true,
        sensitivity: 'base',
      });

      if (subcategoryDiff !== 0) {
        return subcategoryDiff;
      }
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
  const [benefitSubcategories, setBenefitSubcategories] = useState<
    TradeBenefitSubcategoryRow[]
  >([]);
  const [items, setItems] = useState<TradeItemRow[]>([]);
  const [referenceImages, setReferenceImages] = useState<TradeReferenceImageRow[]>([]);

  const [title, setTitle] = useState('');
  const [slug, setSlug] = useState('');
  const [eventStartDate, setEventStartDate] = useState('');
  const [eventEndDate, setEventEndDate] = useState('');
  const [isPublic, setIsPublic] = useState(true);
  const [sortOrder, setSortOrder] = useState('0');

  const [thumbnailFile, setThumbnailFile] = useState<File | null>(null);
  const [thumbnailPreviewUrl, setThumbnailPreviewUrl] = useState('');

  const [newWorkTitle, setNewWorkTitle] = useState('');
  const [newWorkIsVisible, setNewWorkIsVisible] = useState(true);

  const [editingWorkId, setEditingWorkId] = useState('');
  const [editingWorkTitle, setEditingWorkTitle] = useState('');
  const [editingWorkIsVisible, setEditingWorkIsVisible] = useState(true);

  const [newBenefitSubcategoryName, setNewBenefitSubcategoryName] =
    useState('');
  const [newBenefitSubcategoryIsVisible, setNewBenefitSubcategoryIsVisible] =
    useState(true);

  const [editingBenefitSubcategoryId, setEditingBenefitSubcategoryId] =
    useState('');
  const [editingBenefitSubcategoryName, setEditingBenefitSubcategoryName] =
    useState('');
  const [editingBenefitSubcategoryIsVisible, setEditingBenefitSubcategoryIsVisible] =
    useState(true);

  const [selectedWorkTitle, setSelectedWorkTitle] = useState('');
  const [category, setCategory] = useState<TradeCategory>('benefit');
  const [benefitSubcategory, setBenefitSubcategory] = useState('');
  const [imageRatio, setImageRatio] = useState<TradeImageRatio>('square');
  const [itemIsVisible, setItemIsVisible] = useState(true);
  const [imageFile, setImageFile] = useState<File | null>(null);
  const [imagePreviewUrl, setImagePreviewUrl] = useState('');

  const [referenceImageFiles, setReferenceImageFiles] = useState<File[]>([]);
  const [referenceImagePreviewUrls, setReferenceImagePreviewUrls] = useState<string[]>([]);

  const [editingItemId, setEditingItemId] = useState('');
  const [editingItemWorkTitle, setEditingItemWorkTitle] = useState('');
  const [editingItemCategory, setEditingItemCategory] =
    useState<TradeCategory>('benefit');
  const [editingItemBenefitSubcategory, setEditingItemBenefitSubcategory] =
    useState('');
  const [editingItemImageRatio, setEditingItemImageRatio] =
    useState<TradeImageRatio>('square');
  const [editingItemIsVisible, setEditingItemIsVisible] = useState(true);
  const [editingItemImageFile, setEditingItemImageFile] =
    useState<File | null>(null);
  const [editingItemImagePreviewUrl, setEditingItemImagePreviewUrl] =
    useState('');

  const [itemFilterWorkTitle, setItemFilterWorkTitle] = useState('all');
  const [itemFilterCategory, setItemFilterCategory] =
    useState<'all' | TradeCategory>('all');
  const [itemFilterBenefitSubcategory, setItemFilterBenefitSubcategory] =
    useState('all');

  const [isWorkSectionOpen, setIsWorkSectionOpen] = useState(false);
  const [isBenefitSubcategorySectionOpen, setIsBenefitSubcategorySectionOpen] =
    useState(false);
  const [isItemCreateSectionOpen, setIsItemCreateSectionOpen] =
    useState(false);
  const [isReferenceImageSectionOpen, setIsReferenceImageSectionOpen] =
    useState(false);

  const [message, setMessage] = useState('');
  const [isSubmittingEvent, setIsSubmittingEvent] = useState(false);
  const [isSubmittingWork, setIsSubmittingWork] = useState(false);
  const [isUpdatingWorkId, setIsUpdatingWorkId] = useState('');
  const [isSubmittingBenefitSubcategory, setIsSubmittingBenefitSubcategory] =
    useState(false);
  const [isUpdatingBenefitSubcategoryId, setIsUpdatingBenefitSubcategoryId] =
    useState('');
  const [isDeletingBenefitSubcategoryId, setIsDeletingBenefitSubcategoryId] =
    useState('');
  const [isSubmittingItem, setIsSubmittingItem] = useState(false);
  const [isSubmittingReferenceImages, setIsSubmittingReferenceImages] =
    useState(false);
  const [isUpdatingItemId, setIsUpdatingItemId] = useState('');
  const [isDeletingWorkId, setIsDeletingWorkId] = useState('');
  const [isDeletingItemId, setIsDeletingItemId] = useState('');
  const [isDeletingReferenceImageId, setIsDeletingReferenceImageId] =
    useState('');

  const normalizedSlug = useMemo(() => {
    return normalizeSlug(slug);
  }, [slug]);

  const visibleWorks = useMemo(() => {
    return sortKoreanTitles(works.filter((work) => work.is_visible));
  }, [works]);

  const visibleBenefitSubcategories = useMemo(() => {
    return sortBenefitSubcategories(
      benefitSubcategories.filter((subcategory) => subcategory.is_visible),
    );
  }, [benefitSubcategories]);

  const itemFilterWorks = useMemo(() => {
    const titles = Array.from(
      new Set(
        items
          .map((item) => item.work_title)
          .filter((title): title is string => Boolean(title)),
      ),
    );

    return titles.sort((a, b) =>
      a.localeCompare(b, 'ko-KR', {
        numeric: true,
        sensitivity: 'base',
      }),
    );
  }, [items]);

  const itemFilterBenefitSubcategories = useMemo(() => {
    const labels = Array.from(
      new Set(
        items
          .filter((item) => item.category === 'benefit')
          .map((item) => getBenefitSubcategoryLabel(item.benefit_subcategory))
          .filter(Boolean),
      ),
    );

    return labels.sort((a, b) =>
      a.localeCompare(b, 'ko-KR', {
        numeric: true,
        sensitivity: 'base',
      }),
    );
  }, [items]);

  const hasUncategorizedBenefitItems = useMemo(() => {
    return items.some(
      (item) =>
        item.category === 'benefit' &&
        !getBenefitSubcategoryLabel(item.benefit_subcategory),
    );
  }, [items]);

  const hasBenefitSubcategoryFilterOptions =
    itemFilterBenefitSubcategories.length > 0 || hasUncategorizedBenefitItems;

  const filteredItems = useMemo(() => {
    return sortTradeItems(items).filter((item) => {
      const matchesWork =
        itemFilterWorkTitle === 'all' || item.work_title === itemFilterWorkTitle;
      const matchesCategory =
        itemFilterCategory === 'all' || item.category === itemFilterCategory;
      const itemBenefitSubcategory = getBenefitSubcategoryLabel(
        item.benefit_subcategory,
      );
      const matchesBenefitSubcategory =
        itemFilterBenefitSubcategory === 'all' ||
        (item.category === 'benefit' &&
          (itemFilterBenefitSubcategory === '__none__'
            ? !itemBenefitSubcategory
            : itemBenefitSubcategory === itemFilterBenefitSubcategory));

      return matchesWork && matchesCategory && matchesBenefitSubcategory;
    });
  }, [
    items,
    itemFilterWorkTitle,
    itemFilterCategory,
    itemFilterBenefitSubcategory,
  ]);

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
          'id, slug, title, description, event_start_date, event_end_date, thumbnail_path, status_label, is_public, sort_order',
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
      setEventStartDate(typedEvent.event_start_date ?? '');
      setEventEndDate(typedEvent.event_end_date ?? '');
      setIsPublic(typedEvent.is_public);
      setSortOrder(String(typedEvent.sort_order ?? 0));
      setThumbnailPreviewUrl(getTradeAssetUrl(typedEvent.thumbnail_path));

      await Promise.all([
        loadWorks(),
        loadBenefitSubcategories(),
        loadItems(),
        loadReferenceImages(),
      ]);
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

      if (editingItemImagePreviewUrl.startsWith('blob:')) {
        URL.revokeObjectURL(editingItemImagePreviewUrl);
      }

      referenceImagePreviewUrls.forEach((url) => {
        if (url.startsWith('blob:')) {
          URL.revokeObjectURL(url);
        }
      });
    };
  }, [
    thumbnailPreviewUrl,
    imagePreviewUrl,
    editingItemImagePreviewUrl,
    referenceImagePreviewUrls,
  ]);

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

  async function loadBenefitSubcategories() {
    const { data, error } = await supabase
      .from('trade_benefit_subcategories')
      .select('id, collection_id, name, is_visible, sort_order, created_at')
      .eq('collection_id', eventId)
      .order('sort_order', { ascending: true })
      .order('name', { ascending: true });

    if (error) {
      console.error(error);
      setMessage('특전 하위 분류 목록을 불러오지 못했습니다. SQL 추가 여부를 확인해 주세요.');
      return;
    }

    setBenefitSubcategories(
      sortBenefitSubcategories((data ?? []) as TradeBenefitSubcategoryRow[]),
    );
  }

  async function loadItems() {
    const { data, error } = await supabase
      .from('trade_items')
      .select(
        'id, collection_id, category, work_title, item_name, image_path, is_visible, sort_order, image_ratio, benefit_subcategory, created_at',
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

  async function loadReferenceImages() {
    const { data, error } = await supabase
      .from('trade_reference_images')
      .select('id, collection_id, image_path, sort_order, created_at')
      .eq('collection_id', eventId)
      .order('sort_order', { ascending: true })
      .order('created_at', { ascending: true });

    if (error) {
      console.error(error);
      setMessage('공지용 이미지 목록을 불러오지 못했습니다. SQL 추가 여부를 확인해 주세요.');
      return;
    }

    setReferenceImages((data ?? []) as TradeReferenceImageRow[]);
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

  function clearReferenceImagePreviews() {
    referenceImagePreviewUrls.forEach((url) => {
      if (url.startsWith('blob:')) {
        URL.revokeObjectURL(url);
      }
    });

    setReferenceImageFiles([]);
    setReferenceImagePreviewUrls([]);
  }

  function handleReferenceImagesChange(event: ChangeEvent<HTMLInputElement>) {
    const files = Array.from(event.target.files ?? []).filter((file) =>
      file.type.startsWith('image/'),
    );

    if (files.length === 0) {
      setMessage('이미지 파일만 업로드할 수 있습니다.');
      return;
    }

    clearReferenceImagePreviews();
    setReferenceImageFiles(files);
    setReferenceImagePreviewUrls(files.map((file) => URL.createObjectURL(file)));
  }

  function handleEditingItemImageChange(event: ChangeEvent<HTMLInputElement>) {
    const file = event.target.files?.[0];

    if (!file) {
      return;
    }

    if (!file.type.startsWith('image/')) {
      setMessage('이미지 파일만 업로드할 수 있습니다.');
      return;
    }

    if (editingItemImagePreviewUrl.startsWith('blob:')) {
      URL.revokeObjectURL(editingItemImagePreviewUrl);
    }

    setEditingItemImageFile(file);
    setEditingItemImagePreviewUrl(URL.createObjectURL(file));
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

    if (eventStartDate && eventEndDate && eventEndDate < eventStartDate) {
      setMessage('종료일은 시작일보다 빠를 수 없습니다.');
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
          event_start_date: eventStartDate || null,
          event_end_date: eventEndDate || null,
          thumbnail_path: nextThumbnailPath,
          status_label: null,
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
          'id, slug, title, description, event_start_date, event_end_date, thumbnail_path, status_label, is_public, sort_order',
        )
        .eq('id', eventData.id)
        .single();

      if (data) {
        const refreshedEvent = data as TradeCollectionRow;

        setEventData(refreshedEvent);
        setTitle(refreshedEvent.title);
        setSlug(refreshedEvent.slug);
        setEventStartDate(refreshedEvent.event_start_date ?? '');
        setEventEndDate(refreshedEvent.event_end_date ?? '');
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

  async function handleAddBenefitSubcategory(event: FormEvent<HTMLFormElement>) {
    event.preventDefault();

    if (!eventData) {
      setMessage('행사 정보를 불러온 뒤 다시 시도해 주세요.');
      return;
    }

    const nextName = newBenefitSubcategoryName.trim();

    if (!nextName) {
      setMessage('특전 하위 분류명을 입력해 주세요.');
      return;
    }

    try {
      setIsSubmittingBenefitSubcategory(true);
      setMessage('');

      const { error } = await supabase
        .from('trade_benefit_subcategories')
        .insert({
          collection_id: eventData.id,
          name: nextName,
          sort_order: benefitSubcategories.length,
          is_visible: newBenefitSubcategoryIsVisible,
        });

      if (error) {
        console.error(error);
        setMessage('특전 하위 분류 등록에 실패했습니다. 이미 등록된 이름일 수 있습니다.');
        return;
      }

      setNewBenefitSubcategoryName('');
      setNewBenefitSubcategoryIsVisible(true);

      await loadBenefitSubcategories();
      setMessage('특전 하위 분류가 등록되었습니다.');
    } catch (error) {
      console.error(error);
      setMessage('특전 하위 분류 등록 중 오류가 발생했습니다.');
    } finally {
      setIsSubmittingBenefitSubcategory(false);
    }
  }

  function handleStartEditBenefitSubcategory(
    subcategory: TradeBenefitSubcategoryRow,
  ) {
    setEditingBenefitSubcategoryId(subcategory.id);
    setEditingBenefitSubcategoryName(subcategory.name);
    setEditingBenefitSubcategoryIsVisible(subcategory.is_visible);
  }

  function handleCancelEditBenefitSubcategory() {
    setEditingBenefitSubcategoryId('');
    setEditingBenefitSubcategoryName('');
    setEditingBenefitSubcategoryIsVisible(true);
  }

  async function handleUpdateBenefitSubcategory(
    subcategory: TradeBenefitSubcategoryRow,
  ) {
    const nextName = editingBenefitSubcategoryName.trim();

    if (!nextName) {
      setMessage('수정할 특전 하위 분류명을 입력해 주세요.');
      return;
    }

    try {
      setIsUpdatingBenefitSubcategoryId(subcategory.id);
      setMessage('');

      const oldName = subcategory.name;
      const nameChanged = oldName !== nextName;

      const { error: updateError } = await supabase
        .from('trade_benefit_subcategories')
        .update({
          name: nextName,
          is_visible: editingBenefitSubcategoryIsVisible,
        })
        .eq('id', subcategory.id);

      if (updateError) {
        console.error(updateError);
        setMessage('특전 하위 분류 수정에 실패했습니다. 이미 등록된 이름일 수 있습니다.');
        return;
      }

      if (nameChanged) {
        const { error: updateItemsError } = await supabase
          .from('trade_items')
          .update({
            benefit_subcategory: nextName,
          })
          .eq('collection_id', subcategory.collection_id)
          .eq('category', 'benefit')
          .eq('benefit_subcategory', oldName);

        if (updateItemsError) {
          console.error(updateItemsError);
          setMessage(
            '하위 분류명은 수정됐지만, 기존 특전 이미지 반영에 실패했습니다.',
          );
          return;
        }

        if (benefitSubcategory === oldName) {
          setBenefitSubcategory(nextName);
        }

        if (editingItemBenefitSubcategory === oldName) {
          setEditingItemBenefitSubcategory(nextName);
        }
      }

      handleCancelEditBenefitSubcategory();

      await Promise.all([loadBenefitSubcategories(), loadItems()]);

      setMessage('특전 하위 분류가 수정되었습니다.');
      router.refresh();
    } catch (error) {
      console.error(error);
      setMessage('특전 하위 분류 수정 중 오류가 발생했습니다.');
    } finally {
      setIsUpdatingBenefitSubcategoryId('');
    }
  }

  async function handleDeleteBenefitSubcategory(
    subcategory: TradeBenefitSubcategoryRow,
  ) {
    const ok = window.confirm(
      '이 특전 하위 분류를 삭제할까요? 이미 등록된 해당 특전 이미지는 일반 특전으로 이동합니다.',
    );

    if (!ok) {
      return;
    }

    try {
      setIsDeletingBenefitSubcategoryId(subcategory.id);
      setMessage('');

      const { error: updateItemsError } = await supabase
        .from('trade_items')
        .update({
          benefit_subcategory: null,
        })
        .eq('collection_id', subcategory.collection_id)
        .eq('category', 'benefit')
        .eq('benefit_subcategory', subcategory.name);

      if (updateItemsError) {
        console.error(updateItemsError);
        setMessage('기존 특전 이미지의 하위 분류 해제에 실패했습니다.');
        return;
      }

      const { error: deleteError } = await supabase
        .from('trade_benefit_subcategories')
        .delete()
        .eq('id', subcategory.id);

      if (deleteError) {
        console.error(deleteError);
        setMessage('특전 하위 분류 삭제에 실패했습니다.');
        return;
      }

      if (benefitSubcategory === subcategory.name) {
        setBenefitSubcategory('');
      }

      if (editingItemBenefitSubcategory === subcategory.name) {
        setEditingItemBenefitSubcategory('');
      }

      await Promise.all([loadBenefitSubcategories(), loadItems()]);

      setMessage('특전 하위 분류가 삭제되었습니다.');
      router.refresh();
    } catch (error) {
      console.error(error);
      setMessage('특전 하위 분류 삭제 중 오류가 발생했습니다.');
    } finally {
      setIsDeletingBenefitSubcategoryId('');
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
      const safeBenefitSubcategory = normalizePathPart(
        benefitSubcategory || 'benefit',
      );
      const fileNamePrefix =
        category === 'benefit'
          ? `${category}-${safeBenefitSubcategory}-${safeWorkTitle}`
          : `${category}-${safeWorkTitle}`;
      const fileName = `${fileNamePrefix}-${Date.now()}.${fileExtension}`;
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
        image_ratio: imageRatio,
        benefit_subcategory:
          category === 'benefit' ? benefitSubcategory.trim() || null : null,
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
      setBenefitSubcategory('');
      setImageRatio('square');
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

  function clearEditingItemImagePreview() {
    if (editingItemImagePreviewUrl.startsWith('blob:')) {
      URL.revokeObjectURL(editingItemImagePreviewUrl);
    }

    setEditingItemImageFile(null);
    setEditingItemImagePreviewUrl('');
  }

  function handleStartEditItem(item: TradeItemRow) {
    clearEditingItemImagePreview();
    setEditingItemId(item.id);
    setEditingItemWorkTitle(item.work_title);
    setEditingItemCategory(item.category);
    setEditingItemBenefitSubcategory(item.benefit_subcategory ?? '');
    setEditingItemImageRatio(getSafeImageRatio(item.image_ratio));
    setEditingItemIsVisible(item.is_visible);
  }

  function handleCancelEditItem() {
    clearEditingItemImagePreview();
    setEditingItemId('');
    setEditingItemWorkTitle('');
    setEditingItemCategory('benefit');
    setEditingItemBenefitSubcategory('');
    setEditingItemImageRatio('square');
    setEditingItemIsVisible(true);
  }

  async function handleUpdateItem(item: TradeItemRow) {
    if (!eventData) {
      setMessage('행사 정보를 불러온 뒤 다시 시도해 주세요.');
      return;
    }

    if (!editingItemWorkTitle) {
      setMessage('작품명을 선택해 주세요.');
      return;
    }

    try {
      setIsUpdatingItemId(item.id);
      setMessage('');

      let nextImagePath = item.image_path;

      if (editingItemImageFile) {
        const fileExtension = getFileExtension(editingItemImageFile);
        const safeWorkTitle = normalizePathPart(editingItemWorkTitle);
        const safeBenefitSubcategory = normalizePathPart(
          editingItemBenefitSubcategory || 'benefit',
        );
        const fileNamePrefix =
          editingItemCategory === 'benefit'
            ? `${editingItemCategory}-${safeBenefitSubcategory}-${safeWorkTitle}`
            : `${editingItemCategory}-${safeWorkTitle}`;
        const fileName = `${fileNamePrefix}-replace-${Date.now()}.${fileExtension}`;
        nextImagePath = `${eventData.slug}/${fileName}`;

        const { error: uploadError } = await supabase.storage
          .from('trade-assets')
          .upload(nextImagePath, editingItemImageFile, {
            cacheControl: '3600',
            upsert: false,
            contentType: editingItemImageFile.type,
          });

        if (uploadError) {
          console.error(uploadError);
          setMessage(
            '교체 이미지 업로드에 실패했습니다. Storage 정책과 trade-assets 버킷을 확인해 주세요.',
          );
          return;
        }
      }

      const { error } = await supabase
        .from('trade_items')
        .update({
          work_title: editingItemWorkTitle,
          category: editingItemCategory,
          item_name: null,
          image_path: nextImagePath,
          image_ratio: editingItemImageRatio,
          benefit_subcategory:
            editingItemCategory === 'benefit'
              ? editingItemBenefitSubcategory.trim() || null
              : null,
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

      setMessage(
        editingItemImageFile
          ? '굿즈 정보와 이미지가 수정되었습니다.'
          : '굿즈 정보가 수정되었습니다.',
      );
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

  async function handleAddReferenceImages(event: FormEvent<HTMLFormElement>) {
    event.preventDefault();

    if (!eventData) {
      setMessage('행사 정보를 불러온 뒤 다시 시도해 주세요.');
      return;
    }

    if (referenceImageFiles.length === 0) {
      setMessage('등록할 공지용 이미지를 선택해 주세요.');
      return;
    }

    try {
      setIsSubmittingReferenceImages(true);
      setMessage('');

      const now = Date.now();
      const rows: {
        collection_id: string;
        image_path: string;
        sort_order: number;
      }[] = [];

      for (const [index, file] of referenceImageFiles.entries()) {
        const fileExtension = getFileExtension(file);
        const imagePath = `${eventData.slug}/reference/reference-${now}-${index}.${fileExtension}`;

        const { error: uploadError } = await supabase.storage
          .from('trade-assets')
          .upload(imagePath, file, {
            cacheControl: '3600',
            upsert: false,
            contentType: file.type,
          });

        if (uploadError) {
          console.error(uploadError);
          setMessage('공지용 이미지 업로드에 실패했습니다. Storage 정책을 확인해 주세요.');
          return;
        }

        rows.push({
          collection_id: eventData.id,
          image_path: imagePath,
          sort_order: referenceImages.length + index,
        });
      }

      const { error: insertError } = await supabase
        .from('trade_reference_images')
        .insert(rows);

      if (insertError) {
        console.error(insertError);
        setMessage('공지용 이미지 등록에 실패했습니다. DB 정책을 확인해 주세요.');
        return;
      }

      clearReferenceImagePreviews();
      await loadReferenceImages();
      setMessage('공지용 이미지가 등록되었습니다.');
      router.refresh();
    } catch (error) {
      console.error(error);
      setMessage('공지용 이미지 등록 중 오류가 발생했습니다.');
    } finally {
      setIsSubmittingReferenceImages(false);
    }
  }

  async function handleDeleteReferenceImage(image: TradeReferenceImageRow) {
    const ok = window.confirm('이 공지용 이미지를 삭제할까요?');

    if (!ok) {
      return;
    }

    try {
      setIsDeletingReferenceImageId(image.id);
      setMessage('');

      const { error: storageError } = await supabase.storage
        .from('trade-assets')
        .remove([image.image_path]);

      if (storageError) {
        console.error(storageError);
      }

      const { error: deleteError } = await supabase
        .from('trade_reference_images')
        .delete()
        .eq('id', image.id);

      if (deleteError) {
        console.error(deleteError);
        setMessage('공지용 이미지 삭제에 실패했습니다.');
        return;
      }

      await loadReferenceImages();
      setMessage('공지용 이미지가 삭제되었습니다.');
      router.refresh();
    } catch (error) {
      console.error(error);
      setMessage('공지용 이미지 삭제 중 오류가 발생했습니다.');
    } finally {
      setIsDeletingReferenceImageId('');
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
        <section className="mx-auto max-w-md rounded-3xl border border-neutral-200 bg-white p-6 text-sm text-neutral-500 shadow-sm">
          관리자 권한을 확인하는 중입니다.
        </section>
      </main>
    );
  }

  if (adminState === 'signed-out') {
    return (
      <main className="min-h-screen bg-neutral-100 px-4 py-10">
        <section className="mx-auto max-w-md rounded-3xl border border-neutral-200 bg-white p-6 shadow-sm">
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
        <section className="mx-auto max-w-md rounded-3xl border border-neutral-200 bg-white p-6 shadow-sm">
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
        <div className="overflow-hidden rounded-[28px] border border-neutral-200/70 bg-white shadow-[0_8px_26px_rgba(15,23,42,0.032)]">
          <header className="border-b border-neutral-200/70 bg-[linear-gradient(135deg,#efe7ff_0%,#d8efff_48%,#ffe1f2_100%)] p-5">
          <div className="mb-6 flex items-center justify-between gap-3">
            <Link
              href="/admin/events"
              className="rounded-full border border-white/70 bg-white/75 px-4 py-2 text-xs font-bold text-neutral-600 shadow-[0_4px_12px_rgba(15,23,42,0.025)] transition hover:border-white hover:bg-white hover:text-neutral-950"
            >
              ← 행사 목록
            </Link>

            <div className="flex shrink-0 items-center gap-2">
              {eventData ? (
                <Link
                  href={`/trade/${eventData.slug}`}
                  className="rounded-full border border-white/70 bg-white/75 px-4 py-2 text-xs font-bold text-neutral-600 shadow-[0_4px_12px_rgba(15,23,42,0.025)] transition hover:border-white hover:bg-white hover:text-neutral-950"
                >
                  교환판 보기
                </Link>
              ) : null}

              <button
                type="button"
                onClick={handleLogout}
                className="rounded-full border border-white/70 bg-white/75 px-4 py-2 text-xs font-bold text-neutral-600 shadow-[0_4px_12px_rgba(15,23,42,0.025)] transition hover:border-white hover:bg-white hover:text-neutral-950"
              >
                로그아웃
              </button>
            </div>
          </div>

          <div className="mt-6">
            <p className="text-xs font-black uppercase tracking-[0.2em] text-neutral-500">
              Popup & Callabo Cafe Trade Board
            </p>

            <h1 className="mt-1 text-2xl font-black text-neutral-950">
              행사 관리
            </h1>

            <p className="mt-2 text-sm leading-6 text-neutral-500">
              팝업 & 콜카 굿즈 교환판의 행사 정보, 작품 목록, 굿즈 이미지를 관리합니다.
            </p>
          </div>
          </header>

          {message ? (
            <p className="mx-5 mt-5 rounded-2xl border border-neutral-200/70 bg-neutral-50/80 px-4 py-3 text-sm leading-6 text-neutral-700">
            {message}
          </p>
        ) : null}

        <form
          onSubmit={handleUpdateEvent}
          className="p-5"
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
                placeholder="예: 2026 여름 팝업 & 콜카 굿즈 교환판"
              />
            </label>

            <div className="grid grid-cols-2 gap-3">
              <label className="block">
                <span className="text-sm font-bold text-neutral-800">시작일</span>

                <input
                  type="date"
                  value={eventStartDate}
                  onChange={(event) => setEventStartDate(event.target.value)}
                  className="mt-1 w-full rounded-2xl border border-neutral-200 px-4 py-3 text-sm outline-none focus:border-neutral-950"
                />
              </label>

              <label className="block">
                <span className="text-sm font-bold text-neutral-800">종료일</span>

                <input
                  type="date"
                  value={eventEndDate}
                  onChange={(event) => setEventEndDate(event.target.value)}
                  className="mt-1 w-full rounded-2xl border border-neutral-200 px-4 py-3 text-sm outline-none focus:border-neutral-950"
                />
              </label>
            </div>

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
        </div>

        <form
          onSubmit={handleAddWork}
          className="mt-5 rounded-3xl border border-neutral-200 bg-white p-5 shadow-sm"
        >
          <div className="flex items-start justify-between gap-4">
            <div className="min-w-0">
              <h2 className="text-lg font-black text-neutral-950">
                작품명 등록
              </h2>
              <p className="mt-2 text-sm leading-6 text-neutral-500">
                굿즈 등록과 유저 이미지 제보에서 선택할 작품명을 미리 등록합니다.
              </p>
              <p className="mt-1 text-xs font-bold text-neutral-400">
                등록된 작품명 {works.length}개
              </p>
            </div>

            <button
              type="button"
              onClick={() => setIsWorkSectionOpen((prev) => !prev)}
              className="shrink-0 rounded-full border border-neutral-200 bg-white px-4 py-2 text-xs font-black text-neutral-600"
            >
              {isWorkSectionOpen ? '접기' : '펼치기'}
            </button>
          </div>

          {isWorkSectionOpen ? (
            <>
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
                      유저 이미지 제보와 팝업 & 콜카 굿즈 교환판 선택 목록에 노출합니다.
                    </span>
                  </span>

                  <input
                    type="checkbox"
                    checked={newWorkIsVisible}
                    onChange={(event) =>
                      setNewWorkIsVisible(event.target.checked)
                    }
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
            </>
          ) : null}
        </form>

        <form
          onSubmit={handleAddBenefitSubcategory}
          className="mt-5 rounded-3xl border border-neutral-200 bg-white p-5 shadow-sm"
        >
          <div className="flex items-start justify-between gap-4">
            <div className="min-w-0">
              <h2 className="text-lg font-black text-neutral-950">
                특전 하위 분류 관리
              </h2>
              <p className="mt-2 text-sm leading-6 text-neutral-500">
                행사별 특전 분류를 미리 만들어두면, 특전 등록 시 선택할 수 있습니다.
              </p>
              <p className="mt-1 text-xs font-bold text-neutral-400">
                등록된 하위 분류 {benefitSubcategories.length}개
              </p>
            </div>

            <button
              type="button"
              onClick={() =>
                setIsBenefitSubcategorySectionOpen((prev) => !prev)
              }
              className="shrink-0 rounded-full border border-neutral-200 bg-white px-4 py-2 text-xs font-black text-neutral-600"
            >
              {isBenefitSubcategorySectionOpen ? '접기' : '펼치기'}
            </button>
          </div>

          {isBenefitSubcategorySectionOpen ? (
            <>
              <div className="mt-5 grid gap-3 md:grid-cols-[1fr_auto]">
                <label className="block">
                  <span className="text-sm font-bold text-neutral-800">
                    하위 분류명
                  </span>

                  <input
                    value={newBenefitSubcategoryName}
                    onChange={(event) =>
                      setNewBenefitSubcategoryName(event.target.value)
                    }
                    className="mt-1 w-full rounded-2xl border border-neutral-200 bg-white px-4 py-3 text-sm outline-none focus:border-neutral-950"
                    placeholder="예: 입장 특전, 구매 특전, 선착 특전"
                  />
                </label>

                <label className="flex items-center justify-between gap-3 rounded-2xl bg-neutral-100 px-4 py-3 md:mt-6">
                  <span>
                    <span className="block text-sm font-bold text-neutral-800">
                      사용
                    </span>
                    <span className="mt-1 block text-xs text-neutral-500">
                      등록 선택지 노출
                    </span>
                  </span>

                  <input
                    type="checkbox"
                    checked={newBenefitSubcategoryIsVisible}
                    onChange={(event) =>
                      setNewBenefitSubcategoryIsVisible(event.target.checked)
                    }
                    className="h-5 w-5"
                  />
                </label>
              </div>

              <button
                type="submit"
                disabled={isSubmittingBenefitSubcategory}
                className="mt-4 w-full rounded-2xl bg-neutral-950 px-5 py-3 text-sm font-black text-white disabled:cursor-not-allowed disabled:bg-neutral-300"
              >
                {isSubmittingBenefitSubcategory
                  ? '등록 중...'
                  : '하위 분류 등록'}
              </button>

              {benefitSubcategories.length > 0 ? (
                <div className="mt-5 space-y-2">
                  {benefitSubcategories.map((subcategory) => {
                    const isEditing =
                      editingBenefitSubcategoryId === subcategory.id;
                    const isUpdating =
                      isUpdatingBenefitSubcategoryId === subcategory.id;
                    const isDeleting =
                      isDeletingBenefitSubcategoryId === subcategory.id;

                    return (
                      <div
                        key={subcategory.id}
                        className="rounded-2xl border border-neutral-200 bg-neutral-50 p-3"
                      >
                        {isEditing ? (
                          <div className="space-y-3">
                            <label className="block">
                              <span className="text-[10px] font-bold text-neutral-500">
                                하위 분류명
                              </span>

                              <input
                                value={editingBenefitSubcategoryName}
                                onChange={(event) =>
                                  setEditingBenefitSubcategoryName(
                                    event.target.value,
                                  )
                                }
                                className="mt-1 w-full rounded-xl border border-neutral-200 bg-white px-3 py-2 text-xs outline-none focus:border-neutral-950"
                              />
                            </label>

                            <label className="flex items-center justify-between gap-2 rounded-xl bg-white px-3 py-2">
                              <span>
                                <span className="block text-[10px] font-bold text-neutral-600">
                                  사용
                                </span>
                                <span className="mt-0.5 block text-[10px] text-neutral-400">
                                  특전 등록 선택지 노출
                                </span>
                              </span>

                              <input
                                type="checkbox"
                                checked={editingBenefitSubcategoryIsVisible}
                                onChange={(event) =>
                                  setEditingBenefitSubcategoryIsVisible(
                                    event.target.checked,
                                  )
                                }
                                className="h-5 w-5"
                              />
                            </label>

                            <div className="grid grid-cols-2 gap-2">
                              <button
                                type="button"
                                onClick={handleCancelEditBenefitSubcategory}
                                disabled={isUpdating}
                                className="rounded-xl border border-neutral-300 bg-white px-3 py-2 text-[11px] font-black text-neutral-600 disabled:cursor-not-allowed disabled:opacity-50"
                              >
                                취소
                              </button>

                              <button
                                type="button"
                                onClick={() =>
                                  handleUpdateBenefitSubcategory(subcategory)
                                }
                                disabled={isUpdating}
                                className="rounded-xl bg-neutral-950 px-3 py-2 text-[11px] font-black text-white disabled:cursor-not-allowed disabled:bg-neutral-300"
                              >
                                {isUpdating ? '수정 중...' : '저장'}
                              </button>
                            </div>
                          </div>
                        ) : (
                          <div className="flex items-center justify-between gap-3">
                            <div className="min-w-0">
                              <p className="line-clamp-1 text-sm font-black text-neutral-950">
                                {subcategory.name}
                              </p>
                              <p className="mt-1 text-[10px] font-bold text-neutral-400">
                                {subcategory.is_visible
                                  ? '특전 등록 선택지에 표시'
                                  : '숨김'}
                              </p>
                            </div>

                            <div className="flex shrink-0 items-center gap-2">
                              <button
                                type="button"
                                onClick={() =>
                                  handleStartEditBenefitSubcategory(subcategory)
                                }
                                className="rounded-full border border-neutral-200 bg-white px-3 py-1.5 text-[11px] font-black text-neutral-600"
                              >
                                수정
                              </button>

                              <button
                                type="button"
                                onClick={() =>
                                  handleDeleteBenefitSubcategory(subcategory)
                                }
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
                <p className="mt-5 rounded-2xl bg-neutral-50 px-4 py-6 text-center text-xs text-neutral-400">
                  아직 등록된 특전 하위 분류가 없습니다. 필요할 때만 추가해 주세요.
                </p>
              )}
            </>
          ) : null}
        </form>

        <form
          onSubmit={handleAddReferenceImages}
          className="mt-5 rounded-3xl border border-neutral-200 bg-white p-5 shadow-sm"
        >
          <div className="flex items-start justify-between gap-4">
            <div className="min-w-0">
              <h2 className="text-lg font-black text-neutral-950">
                공지용 이미지 등록
              </h2>
              <p className="mt-2 text-sm leading-6 text-neutral-500">
                행사 공지에 올라온 특전 안내 이미지를 그대로 등록합니다. 교환판 만들기에서 “내가 뽑은 굿즈가 어떤 작품인지 모르겠다면?” 영역에 순서대로 표시됩니다.
              </p>
              <p className="mt-1 text-xs font-bold text-neutral-400">
                등록된 공지 이미지 {referenceImages.length}개
              </p>
            </div>

            <button
              type="button"
              onClick={() => setIsReferenceImageSectionOpen((prev) => !prev)}
              className="shrink-0 rounded-full border border-neutral-200 bg-white px-4 py-2 text-xs font-black text-neutral-600"
            >
              {isReferenceImageSectionOpen ? '접기' : '펼치기'}
            </button>
          </div>

          {isReferenceImageSectionOpen ? (
            <>
              <label className="mt-5 flex cursor-pointer flex-col items-center justify-center rounded-2xl border border-dashed border-neutral-300 bg-neutral-50 px-4 py-7 text-center hover:border-neutral-950">
                <span className="text-sm font-black text-neutral-700">
                  공지용 이미지 선택
                </span>
                <span className="mt-2 text-xs leading-5 text-neutral-400">
                  여러 장을 한 번에 선택할 수 있습니다.
                </span>

                <input
                  type="file"
                  accept="image/*"
                  multiple
                  onChange={handleReferenceImagesChange}
                  className="hidden"
                />
              </label>

              {referenceImagePreviewUrls.length > 0 ? (
                <div className="mt-4 space-y-3">
                  {referenceImagePreviewUrls.map((url, index) => (
                    <img
                      key={url}
                      src={url}
                      alt={`공지용 이미지 미리보기 ${index + 1}`}
                      className="w-full rounded-2xl bg-white object-contain ring-1 ring-neutral-200"
                    />
                  ))}
                </div>
              ) : null}

              <button
                type="submit"
                disabled={isSubmittingReferenceImages}
                className="mt-4 w-full rounded-2xl bg-neutral-950 px-5 py-4 text-sm font-black text-white disabled:cursor-not-allowed disabled:bg-neutral-300"
              >
                {isSubmittingReferenceImages ? '등록 중...' : '공지용 이미지 등록'}
              </button>

              <div className="mt-5 border-t border-neutral-100 pt-5">
                <h3 className="text-sm font-black text-neutral-950">
                  등록된 공지용 이미지
                </h3>

                {referenceImages.length > 0 ? (
                  <div className="mt-3 space-y-3">
                    {referenceImages.map((image, index) => {
                      const isDeleting = isDeletingReferenceImageId === image.id;

                      return (
                        <article
                          key={image.id}
                          className="rounded-2xl border border-neutral-200 bg-neutral-50 p-3"
                        >
                          <img
                            src={getTradeAssetUrl(image.image_path)}
                            alt={`등록된 공지용 이미지 ${index + 1}`}
                            className="w-full rounded-xl bg-white object-contain ring-1 ring-neutral-200"
                          />

                          <div className="mt-3 flex items-center justify-between gap-3">
                            <p className="text-xs font-bold text-neutral-400">
                              {index + 1}번째 이미지
                            </p>

                            <button
                              type="button"
                              onClick={() => handleDeleteReferenceImage(image)}
                              disabled={isDeleting}
                              className="rounded-full border border-red-200 bg-red-50 px-3 py-1.5 text-[11px] font-black text-red-600 disabled:cursor-not-allowed disabled:opacity-50"
                            >
                              {isDeleting ? '삭제 중' : '삭제'}
                            </button>
                          </div>
                        </article>
                      );
                    })}
                  </div>
                ) : (
                  <p className="mt-3 rounded-2xl bg-neutral-50 px-4 py-6 text-center text-xs text-neutral-400">
                    아직 등록된 공지용 이미지가 없습니다.
                  </p>
                )}
              </div>
            </>
          ) : null}
        </form>

        <form
          onSubmit={handleAddItem}
          className="mt-5 rounded-3xl border border-neutral-200 bg-white p-5 shadow-sm"
        >
          <div className="flex items-start justify-between gap-4">
            <div className="min-w-0">
              <h2 className="text-lg font-black text-neutral-950">
                굿즈 이미지 등록
              </h2>
              <p className="mt-2 text-sm leading-6 text-neutral-500">
                작품명, 굿즈 종류, 특전 하위 분류와 이미지 비율을 설정해 굿즈 이미지를 등록합니다.
              </p>
              <p className="mt-1 text-xs font-bold text-neutral-400">
                등록된 굿즈 {items.length}개
              </p>
            </div>

            <button
              type="button"
              onClick={() => setIsItemCreateSectionOpen((prev) => !prev)}
              className="shrink-0 rounded-full border border-neutral-200 bg-white px-4 py-2 text-xs font-black text-neutral-600"
            >
              {isItemCreateSectionOpen ? '접기' : '펼치기'}
            </button>
          </div>

          {isItemCreateSectionOpen ? (
            <>
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

            <div className="grid grid-cols-2 gap-3">
              <label className="block">
                <span className="text-sm font-bold text-neutral-800">
                  굿즈 종류
                </span>

                <select
                  value={category}
                  onChange={(event) => {
                    const nextCategory = event.target.value as TradeCategory;
                    setCategory(nextCategory);
                    if (nextCategory !== 'benefit') {
                      setBenefitSubcategory('');
                    }
                  }}
                  className="mt-1 w-full rounded-2xl border border-neutral-200 bg-white px-4 py-3 text-sm outline-none focus:border-neutral-950"
                >
                  {TRADE_CATEGORIES.map((option) => (
                    <option key={option.id} value={option.id}>
                      {option.label}
                    </option>
                  ))}
                </select>
              </label>

              <label className="block">
                <span className="text-sm font-bold text-neutral-800">
                  특전 하위 분류
                </span>

                <select
                  value={benefitSubcategory}
                  onChange={(event) => setBenefitSubcategory(event.target.value)}
                  disabled={
                    category !== 'benefit' || visibleBenefitSubcategories.length === 0
                  }
                  className="mt-1 w-full rounded-2xl border border-neutral-200 bg-white px-3 py-3 text-sm outline-none focus:border-neutral-950 disabled:bg-neutral-100 disabled:text-neutral-400"
                >
                  {category !== 'benefit' ? (
                    <option value="">해당 없음</option>
                  ) : visibleBenefitSubcategories.length === 0 ? (
                    <option value="">등록된 하위 분류 없음</option>
                  ) : (
                    <>
                      <option value="">하위 분류 없음</option>

                      {visibleBenefitSubcategories.map((subcategory) => (
                        <option key={subcategory.id} value={subcategory.name}>
                          {subcategory.name}
                        </option>
                      ))}
                    </>
                  )}
                </select>
              </label>
            </div>

            <p className="-mt-3 text-xs leading-5 text-neutral-400">
              특전 하위 분류는 굿즈 종류가 특전이고 등록된 하위 분류가 있을 때만 선택할 수 있습니다.
            </p>

            <label className="flex items-center justify-between gap-3 rounded-2xl bg-neutral-100 px-4 py-3">
              <span>
                <span className="block text-sm font-bold text-neutral-800">
                  포토카드 비율로 표시
                </span>
                <span className="mt-1 block text-xs text-neutral-500">
                  정방형이 아닌 세로형 특전/굿즈에 사용합니다.
                </span>
              </span>

              <input
                type="checkbox"
                checked={imageRatio === 'photocard'}
                onChange={(event) =>
                  setImageRatio(event.target.checked ? 'photocard' : 'square')
                }
                className="h-5 w-5"
              />
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
                        className={`${getImageRatioClass(imageRatio)} w-12 rounded-xl bg-white object-contain p-1 shadow-sm`}
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
                    팝업 & 콜카 굿즈 교환판에 표시될 이미지를 업로드합니다.
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

            </>
          ) : null}
        </form>

        <section className="mt-5 rounded-3xl border border-neutral-200 bg-white p-5 shadow-sm">
          <div>
            <h2 className="text-lg font-black text-neutral-950">
              등록된 굿즈
            </h2>
            <p className="mt-1 text-xs text-neutral-400">
              총 {items.length}개 · 현재 표시 {filteredItems.length}개
            </p>
          </div>

          {items.length > 0 ? (
            <div className="mt-4 grid grid-cols-1 gap-3 sm:grid-cols-3">
              <label className="block">
                <span className="text-xs font-bold text-neutral-500">
                  작품별 보기
                </span>

                <select
                  value={itemFilterWorkTitle}
                  onChange={(event) => setItemFilterWorkTitle(event.target.value)}
                  className="mt-1 w-full rounded-2xl border border-neutral-200 bg-white px-3 py-2.5 text-xs font-bold text-neutral-700 outline-none focus:border-neutral-950"
                >
                  <option value="all">전체 작품</option>

                  {itemFilterWorks.map((workTitle) => (
                    <option key={workTitle} value={workTitle}>
                      {workTitle}
                    </option>
                  ))}
                </select>
              </label>

              <label className="block">
                <span className="text-xs font-bold text-neutral-500">
                  굿즈 종류별 보기
                </span>

                <select
                  value={itemFilterCategory}
                  onChange={(event) => {
                    const nextCategory =
                      event.target.value === 'all'
                        ? 'all'
                        : (event.target.value as TradeCategory);

                    setItemFilterCategory(nextCategory);

                    if (nextCategory !== 'all' && nextCategory !== 'benefit') {
                      setItemFilterBenefitSubcategory('all');
                    }
                  }}
                  className="mt-1 w-full rounded-2xl border border-neutral-200 bg-white px-3 py-2.5 text-xs font-bold text-neutral-700 outline-none focus:border-neutral-950"
                >
                  <option value="all">전체 종류</option>

                  {TRADE_CATEGORIES.map((option) => (
                    <option key={option.id} value={option.id}>
                      {option.label}
                    </option>
                  ))}
                </select>
              </label>

              <label className="block">
                <span className="text-xs font-bold text-neutral-500">
                  특전 하위 분류 보기
                </span>

                <select
                  value={itemFilterBenefitSubcategory}
                  onChange={(event) =>
                    setItemFilterBenefitSubcategory(event.target.value)
                  }
                  disabled={
                    (itemFilterCategory !== 'all' &&
                      itemFilterCategory !== 'benefit') ||
                    !hasBenefitSubcategoryFilterOptions
                  }
                  className="mt-1 w-full rounded-2xl border border-neutral-200 bg-white px-3 py-2.5 text-xs font-bold text-neutral-700 outline-none focus:border-neutral-950 disabled:bg-neutral-100 disabled:text-neutral-400"
                >
                  <option value="all">전체 하위 분류</option>

                  {hasUncategorizedBenefitItems ? (
                    <option value="__none__">하위 분류 없음</option>
                  ) : null}

                  {itemFilterBenefitSubcategories.map((subcategory) => (
                    <option key={subcategory} value={subcategory}>
                      {subcategory}
                    </option>
                  ))}
                </select>
              </label>
            </div>
          ) : null}

          {items.length > 0 ? (
            filteredItems.length > 0 ? (
              <div className="mt-5 grid grid-cols-2 gap-3">
                {filteredItems.map((item) => {
                  const categoryLabel = getTradeItemMetaLabel(item);
                  const isEditing = editingItemId === item.id;
                  const isUpdating = isUpdatingItemId === item.id;
                  const isDeleting = isDeletingItemId === item.id;
                  const shouldShowCurrentWork =
                    editingItemWorkTitle &&
                    !visibleWorks.some(
                      (work) => work.title === editingItemWorkTitle,
                    );

                  const shouldShowCurrentBenefitSubcategory =
                    editingItemBenefitSubcategory &&
                    !benefitSubcategories.some(
                      (subcategory) =>
                        subcategory.name === editingItemBenefitSubcategory,
                    );

                  return (
                    <article
                      key={item.id}
                      className="overflow-hidden rounded-2xl border border-neutral-200 bg-white"
                    >
                      <div className={`relative ${getImageRatioClass(item.image_ratio)} bg-neutral-100`}>
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
                                onChange={(event) => {
                                  const nextCategory =
                                    event.target.value as TradeCategory;
                                  setEditingItemCategory(nextCategory);
                                  if (nextCategory !== 'benefit') {
                                    setEditingItemBenefitSubcategory('');
                                  }
                                }}
                                className="mt-1 w-full rounded-xl border border-neutral-200 bg-white px-2 py-2 text-xs outline-none focus:border-neutral-950"
                              >
                                {TRADE_CATEGORIES.map((option) => (
                                  <option key={option.id} value={option.id}>
                                    {option.label}
                                  </option>
                                ))}
                              </select>
                            </label>

                            {editingItemCategory === 'benefit' ? (
                              <label className="block">
                                <span className="text-[10px] font-bold text-neutral-500">
                                  특전 하위 분류
                                </span>

                                <select
                                  value={editingItemBenefitSubcategory}
                                  onChange={(event) =>
                                    setEditingItemBenefitSubcategory(
                                      event.target.value,
                                    )
                                  }
                                  className="mt-1 w-full rounded-xl border border-neutral-200 bg-white px-2 py-2 text-xs outline-none focus:border-neutral-950"
                                >
                                  <option value="">하위 분류 없음</option>

                                  {shouldShowCurrentBenefitSubcategory ? (
                                    <option value={editingItemBenefitSubcategory}>
                                      {editingItemBenefitSubcategory} 현재값
                                    </option>
                                  ) : null}

                                  {visibleBenefitSubcategories.map((subcategory) => (
                                    <option key={subcategory.id} value={subcategory.name}>
                                      {subcategory.name}
                                    </option>
                                  ))}
                                </select>
                              </label>
                            ) : null}

                            <label className="block rounded-xl bg-neutral-50 p-3">
                              <span className="text-[10px] font-bold text-neutral-600">
                                이미지 교체
                              </span>

                              <div className="mt-2 flex items-center gap-3">
                                <img
                                  src={
                                    editingItemImagePreviewUrl ||
                                    getTradeAssetUrl(item.image_path)
                                  }
                                  alt={item.work_title}
                                  className="h-16 w-16 rounded-xl bg-white object-contain p-1 ring-1 ring-neutral-200"
                                />

                                <span className="min-w-0 flex-1 text-[10px] leading-4 text-neutral-400">
                                  새 이미지를 선택하면 저장 시 기존 굿즈 이미지가 교체됩니다.
                                </span>
                              </div>

                              <span className="mt-2 inline-flex cursor-pointer rounded-xl border border-neutral-200 bg-white px-3 py-2 text-[11px] font-black text-neutral-600">
                                새 이미지 선택
                              </span>

                              {editingItemImageFile ? (
                                <span className="ml-2 text-[10px] font-bold text-neutral-500">
                                  {editingItemImageFile.name}
                                </span>
                              ) : null}

                              <input
                                type="file"
                                accept="image/*"
                                onChange={handleEditingItemImageChange}
                                className="hidden"
                              />
                            </label>

                            <label className="flex items-center justify-between gap-2 rounded-xl bg-neutral-50 px-3 py-2">
                              <span>
                                <span className="block text-[10px] font-bold text-neutral-600">
                                  포토카드 비율
                                </span>
                                <span className="mt-0.5 block text-[10px] text-neutral-400">
                                  세로형 표시
                                </span>
                              </span>

                              <input
                                type="checkbox"
                                checked={editingItemImageRatio === 'photocard'}
                                onChange={(event) =>
                                  setEditingItemImageRatio(
                                    event.target.checked ? 'photocard' : 'square',
                                  )
                                }
                                className="h-5 w-5"
                              />
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

                            <p className="mt-0.5 text-[10px] font-bold text-neutral-400">
                              {getSafeImageRatio(item.image_ratio) === 'photocard'
                                ? '포토카드 비율'
                                : '정방형'}
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
                  선택한 조건에 맞는 굿즈 이미지가 없습니다.
                </p>
              </div>
            )
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
