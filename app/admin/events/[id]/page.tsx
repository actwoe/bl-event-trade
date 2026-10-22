'use client';

import Link from 'next/link';
import {
  ChangeEvent,
  FormEvent,
  PointerEvent as ReactPointerEvent,
  useEffect,
  useMemo,
  useRef,
  useState,
} from 'react';
import { useParams, useRouter } from 'next/navigation';
import { getTradeAssetUrl, supabase } from '@/lib/supabase';
import { getTradeItemImageUrl } from '@/lib/trade-item-image';
import {
  createCustomCategoryKey,
  getFallbackCategoryLabel,
  getFallbackCategorySortOrder,
  normalizeCategoryKind,
} from '@/lib/trade-item-categories';
import {
  compareBenefitSubcategoryValues,
  createBenefitSubcategoryOrderMap,
  getBenefitSubcategorySortOrder,
} from '@/lib/trade-benefit-subcategory-order';
import {
  COLLECTION_PHOTO_CARD_VARIANTS,
  CollectionPhotoCardVariant,
  getCollectionPhotoCardSortOrder,
  getCollectionPhotoCardVariant,
  normalizeCollectionPhotoCardSortOrder,
} from '@/lib/trade-collection-photo-card-order';
import {
  TradeCategory,
  TradeCategoryKind,
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
  event_location: string | null;
  reference_section_enabled: boolean | null;
  reference_section_title: string | null;
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

type TradeItemCategoryRow = {
  id: string;
  collection_id: string;
  category_key: string;
  label: string;
  category_kind: TradeCategoryKind;
  is_visible: boolean;
  sort_order: number;
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
  show_item_name: boolean | null;
  image_path: string;
  is_visible: boolean;
  sort_order: number;
  display_order: number | null;
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

function sortItemCategories(rows: TradeItemCategoryRow[]) {
  return [...rows].sort((a, b) => {
    const sortDiff = (a.sort_order ?? 0) - (b.sort_order ?? 0);
    if (sortDiff !== 0) return sortDiff;
    return a.label.localeCompare(b.label, 'ko-KR', {
      numeric: true,
      sensitivity: 'base',
    });
  });
}

function getCategoryLabel(
  category: TradeCategory,
  categoryMap?: ReadonlyMap<string, TradeItemCategoryRow>,
) {
  return categoryMap?.get(category)?.label ?? getFallbackCategoryLabel(category);
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

function getCategoryKind(
  category: TradeCategory,
  categoryMap?: ReadonlyMap<string, TradeItemCategoryRow>,
) {
  const categoryKind = categoryMap?.get(category)?.category_kind;
  if (categoryKind) return normalizeCategoryKind(categoryKind);
  if (category === 'benefit' || category === 'collection_photo_card') {
    return category;
  }
  return 'standard';
}

function getTradeItemMetaLabel(
  item: TradeItemRow,
  categoryMap?: ReadonlyMap<string, TradeItemCategoryRow>,
) {
  const categoryLabel = getCategoryLabel(item.category, categoryMap);
  const categoryKind = getCategoryKind(item.category, categoryMap);
  const subcategory = getBenefitSubcategoryLabel(item.benefit_subcategory);

  if (categoryKind === 'benefit' && subcategory) {
    return `${categoryLabel} · ${subcategory}`;
  }

  if (categoryKind === 'collection_photo_card') {
    return `${categoryLabel} · ${getCollectionPhotoCardVariant(item.sort_order)}`;
  }

  return categoryLabel;
}

function getCategorySortIndex(
  category: TradeCategory,
  categoryOrderMap?: ReadonlyMap<string, number>,
) {
  return categoryOrderMap?.get(category) ?? getFallbackCategorySortOrder(category);
}

function sortTradeItems(
  rows: TradeItemRow[],
  benefitSubcategoryOrderMap: ReadonlyMap<string, number>,
  categoryOrderMap?: ReadonlyMap<string, number>,
  categoryMap?: ReadonlyMap<string, TradeItemCategoryRow>,
) {
  const workTitlesByCategory = new Map<string, Set<string>>();
  for (const row of rows) {
    if (getCategoryKind(row.category, categoryMap) !== 'collection_photo_card') continue;
    if (!row.work_title.trim()) continue;
    const titles = workTitlesByCategory.get(row.category) ?? new Set<string>();
    titles.add(row.work_title.trim());
    workTitlesByCategory.set(row.category, titles);
  }

  return [...rows].sort((a, b) => {
    const categoryDiff =
      getCategorySortIndex(a.category, categoryOrderMap) -
      getCategorySortIndex(b.category, categoryOrderMap);

    if (categoryDiff !== 0) {
      return categoryDiff;
    }

    if (
      getCategoryKind(a.category, categoryMap) === 'benefit' &&
      getCategoryKind(b.category, categoryMap) === 'benefit'
    ) {
      const leftName = getBenefitSubcategoryLabel(a.benefit_subcategory);
      const rightName = getBenefitSubcategoryLabel(b.benefit_subcategory);
      const subcategoryDiff = compareBenefitSubcategoryValues(
        leftName,
        getBenefitSubcategorySortOrder(benefitSubcategoryOrderMap, leftName),
        rightName,
        getBenefitSubcategorySortOrder(benefitSubcategoryOrderMap, rightName),
      );

      if (subcategoryDiff !== 0) {
        return subcategoryDiff;
      }
    }

    const isCollectionPhotoCard =
      a.category === b.category &&
      getCategoryKind(a.category, categoryMap) === 'collection_photo_card' &&
      getCategoryKind(b.category, categoryMap) === 'collection_photo_card';
    const workFirst = !isCollectionPhotoCard ||
      (workTitlesByCategory.get(a.category)?.size ?? 0) > 1;

    if (workFirst) {
      const titleDiff = a.work_title.localeCompare(b.work_title, 'ko-KR', {
        numeric: true,
        sensitivity: 'base',
      });
      if (titleDiff !== 0) return titleDiff;
    }

    if (isCollectionPhotoCard) {
      const variantDiff =
        normalizeCollectionPhotoCardSortOrder(a.sort_order) -
        normalizeCollectionPhotoCardSortOrder(b.sort_order);
      if (variantDiff !== 0) return variantDiff;
    }

    const displayDiff = (a.display_order ?? Number.MAX_SAFE_INTEGER) - (b.display_order ?? Number.MAX_SAFE_INTEGER);
    if (displayDiff !== 0) return displayDiff;
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
  const [itemCategories, setItemCategories] = useState<TradeItemCategoryRow[]>([]);
  const [benefitSubcategories, setBenefitSubcategories] = useState<
    TradeBenefitSubcategoryRow[]
  >([]);
  const [items, setItems] = useState<TradeItemRow[]>([]);
  const [referenceImages, setReferenceImages] = useState<TradeReferenceImageRow[]>([]);

  const [title, setTitle] = useState('');
  const [slug, setSlug] = useState('');
  const [eventStartDate, setEventStartDate] = useState('');
  const [eventEndDate, setEventEndDate] = useState('');
  const [eventLocation, setEventLocation] = useState('');
  const [referenceSectionEnabled, setReferenceSectionEnabled] = useState(false);
  const [referenceSectionTitle, setReferenceSectionTitle] = useState(
    '내가 뽑은 굿즈가 어떤 작품인지 모르겠다면?',
  );
  const [isPublic, setIsPublic] = useState(true);
  const [sortOrder, setSortOrder] = useState('0');
  const [draggingItemId, setDraggingItemId] = useState('');
  const [isSavingItemOrder, setIsSavingItemOrder] = useState(false);

  const [thumbnailFile, setThumbnailFile] = useState<File | null>(null);
  const [thumbnailPreviewUrl, setThumbnailPreviewUrl] = useState('');

  const [newWorkTitle, setNewWorkTitle] = useState('');
  const [newWorkIsVisible, setNewWorkIsVisible] = useState(true);

  const [editingWorkId, setEditingWorkId] = useState('');
  const [editingWorkTitle, setEditingWorkTitle] = useState('');
  const [editingWorkIsVisible, setEditingWorkIsVisible] = useState(true);

  const [newCategoryName, setNewCategoryName] = useState('');
  const [newCategoryKind, setNewCategoryKind] =
    useState<TradeCategoryKind>('standard');
  const [newCategoryIsVisible, setNewCategoryIsVisible] = useState(true);
  const [editingCategoryId, setEditingCategoryId] = useState('');
  const [editingCategoryName, setEditingCategoryName] = useState('');
  const [editingCategoryKind, setEditingCategoryKind] =
    useState<TradeCategoryKind>('standard');
  const [editingCategoryIsVisible, setEditingCategoryIsVisible] = useState(true);

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
  const [itemName, setItemName] = useState('');
  const [category, setCategory] = useState<TradeCategory>('benefit');
  const [benefitSubcategory, setBenefitSubcategory] = useState('');
  const [collectionPhotoCardVariant, setCollectionPhotoCardVariant] =
    useState<CollectionPhotoCardVariant>('A');
  const [imageRatio, setImageRatio] = useState<TradeImageRatio>('square');
  const [itemIsVisible, setItemIsVisible] = useState(true);
  const [itemShowName, setItemShowName] = useState(true);
  const [imageFile, setImageFile] = useState<File | null>(null);
  const [imagePreviewUrl, setImagePreviewUrl] = useState('');

  const [referenceImageFiles, setReferenceImageFiles] = useState<File[]>([]);
  const [referenceImagePreviewUrls, setReferenceImagePreviewUrls] = useState<string[]>([]);

  const [editingItemId, setEditingItemId] = useState('');
  const [editingItemWorkTitle, setEditingItemWorkTitle] = useState('');
  const [editingItemName, setEditingItemName] = useState('');
  const [editingItemCategory, setEditingItemCategory] =
    useState<TradeCategory>('benefit');
  const [editingItemBenefitSubcategory, setEditingItemBenefitSubcategory] =
    useState('');
  const [editingItemCollectionPhotoCardVariant, setEditingItemCollectionPhotoCardVariant] =
    useState<CollectionPhotoCardVariant>('A');
  const [editingItemImageRatio, setEditingItemImageRatio] =
    useState<TradeImageRatio>('square');
  const [editingItemIsVisible, setEditingItemIsVisible] = useState(true);
  const [editingItemShowName, setEditingItemShowName] = useState(false);
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
  const [isCategorySectionOpen, setIsCategorySectionOpen] = useState(true);
  const [isBenefitSubcategorySectionOpen, setIsBenefitSubcategorySectionOpen] =
    useState(false);
  const [isItemCreateSectionOpen, setIsItemCreateSectionOpen] =
    useState(false);
  const [isReferenceImageSectionOpen, setIsReferenceImageSectionOpen] =
    useState(false);

  const [message, setMessage] = useState('');
  const [itemFormMessage, setItemFormMessage] = useState('');
  const [isSubmittingEvent, setIsSubmittingEvent] = useState(false);
  const [isSubmittingWork, setIsSubmittingWork] = useState(false);
  const [isUpdatingWorkId, setIsUpdatingWorkId] = useState('');
  const [isSubmittingCategory, setIsSubmittingCategory] = useState(false);
  const [isUpdatingCategoryId, setIsUpdatingCategoryId] = useState('');
  const [isDeletingCategoryId, setIsDeletingCategoryId] = useState('');
  const [isReorderingCategoryId, setIsReorderingCategoryId] = useState('');
  const [isSubmittingBenefitSubcategory, setIsSubmittingBenefitSubcategory] =
    useState(false);
  const [isUpdatingBenefitSubcategoryId, setIsUpdatingBenefitSubcategoryId] =
    useState('');
  const [isDeletingBenefitSubcategoryId, setIsDeletingBenefitSubcategoryId] =
    useState('');
  const [draggingBenefitSubcategoryId, setDraggingBenefitSubcategoryId] =
    useState('');
  const [isSavingBenefitSubcategoryOrder, setIsSavingBenefitSubcategoryOrder] =
    useState(false);
  const benefitSubcategoriesRef = useRef<TradeBenefitSubcategoryRow[]>([]);
  const benefitSubcategoryDragStartRef = useRef<
    TradeBenefitSubcategoryRow[]
  >([]);
  const benefitSubcategoryDraggingIdRef = useRef('');
  const [isSubmittingItem, setIsSubmittingItem] = useState(false);
  const [isSubmittingReferenceImages, setIsSubmittingReferenceImages] =
    useState(false);
  const [isSavingReferenceSettings, setIsSavingReferenceSettings] =
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

  const sortedItemCategories = useMemo(
    () => sortItemCategories(itemCategories),
    [itemCategories],
  );

  const visibleItemCategories = useMemo(
    () => sortedItemCategories.filter((itemCategory) => itemCategory.is_visible),
    [sortedItemCategories],
  );

  const itemCategoryMap = useMemo(
    () =>
      new Map(
        itemCategories.map((itemCategory) => [
          itemCategory.category_key,
          itemCategory,
        ]),
      ),
    [itemCategories],
  );

  const itemCategoryOrderMap = useMemo(
    () =>
      new Map(
        itemCategories.map((itemCategory) => [
          itemCategory.category_key,
          itemCategory.sort_order ?? 0,
        ]),
      ),
    [itemCategories],
  );

  const selectedItemCategoryKind =
    itemCategoryMap.get(category)?.category_kind ?? 'standard';
  const editingItemCategoryKind =
    itemCategoryMap.get(editingItemCategory)?.category_kind ?? 'standard';

  const hasBenefitCategory = itemCategoryMap.has('benefit');

  const visibleBenefitSubcategories = useMemo(() => {
    return sortBenefitSubcategories(
      benefitSubcategories.filter((subcategory) => subcategory.is_visible),
    );
  }, [benefitSubcategories]);

  const benefitSubcategoryOrderMap = useMemo(() => {
    return createBenefitSubcategoryOrderMap(benefitSubcategories);
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
      compareBenefitSubcategoryValues(
        a,
        getBenefitSubcategorySortOrder(benefitSubcategoryOrderMap, a),
        b,
        getBenefitSubcategorySortOrder(benefitSubcategoryOrderMap, b),
      ),
    );
  }, [benefitSubcategoryOrderMap, items]);

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
    return sortTradeItems(
      items,
      benefitSubcategoryOrderMap,
      itemCategoryOrderMap,
      itemCategoryMap,
    ).filter((item) => {
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
    benefitSubcategoryOrderMap,
    itemCategoryOrderMap,
    itemCategoryMap,
    itemFilterWorkTitle,
    itemFilterCategory,
    itemFilterBenefitSubcategory,
  ]);

  useEffect(() => {
    benefitSubcategoriesRef.current = benefitSubcategories;
  }, [benefitSubcategories]);

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
          'id, slug, title, description, event_start_date, event_end_date, event_location, reference_section_enabled, reference_section_title, thumbnail_path, status_label, is_public, sort_order',
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
      setEventLocation(typedEvent.event_location ?? '');
      setReferenceSectionEnabled(typedEvent.reference_section_enabled === true);
      setReferenceSectionTitle(
        typedEvent.reference_section_title?.trim() ||
          '내가 뽑은 굿즈가 어떤 작품인지 모르겠다면?',
      );
      setIsPublic(typedEvent.is_public);
      setSortOrder(String(typedEvent.sort_order ?? 0));
      setThumbnailPreviewUrl(getTradeAssetUrl(typedEvent.thumbnail_path));

      await Promise.all([
        loadWorks(),
        loadItemCategories(),
        loadBenefitSubcategories(),
        loadItems(),
        loadReferenceImages(),
      ]);
    }

    loadPageData();
    // 각 로더는 행사 ID가 바뀔 때만 한 번 실행합니다.
    // eslint-disable-next-line react-hooks/exhaustive-deps
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

    setSelectedWorkTitle((prev) => {
      if (prev && nextWorks.some((work) => work.title === prev)) {
        return prev;
      }

      return '';
    });
  }

  async function loadItemCategories() {
    const { data, error } = await supabase
      .from('trade_item_categories')
      .select(
        'id, collection_id, category_key, label, category_kind, is_visible, sort_order, created_at',
      )
      .eq('collection_id', eventId)
      .order('sort_order', { ascending: true })
      .order('created_at', { ascending: true });

    if (error) {
      console.error(error);
      setMessage(
        '행사별 굿즈 종류를 불러오지 못했습니다. trade_item_categories SQL 적용 여부를 확인해 주세요.',
      );
      return;
    }

    const nextItemCategories = sortItemCategories(
      ((data ?? []) as Array<Omit<TradeItemCategoryRow, 'category_kind'> & {
        category_kind: string;
      }>).map((row) => ({
        ...row,
        category_kind: normalizeCategoryKind(row.category_kind),
      })),
    );
    const nextVisibleItemCategories = nextItemCategories.filter(
      (itemCategory) => itemCategory.is_visible,
    );
    const firstVisibleCategory = nextVisibleItemCategories[0]?.category_key ?? '';

    setItemCategories(nextItemCategories);
    setCategory((current) =>
      nextVisibleItemCategories.some(
        (itemCategory) => itemCategory.category_key === current,
      )
        ? current
        : firstVisibleCategory,
    );
    setEditingItemCategory((current) =>
      nextItemCategories.some((itemCategory) => itemCategory.category_key === current)
        ? current
        : firstVisibleCategory,
    );
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
        'id, collection_id, category, work_title, item_name, show_item_name, image_path, is_visible, sort_order, display_order, image_ratio, benefit_subcategory, created_at',
      )
      .eq('collection_id', eventId)
      .order('created_at', { ascending: true });

    if (error) {
      console.error(error);
      setMessage('굿즈 이미지 목록을 불러오지 못했습니다.');
      return;
    }

    setItems((data ?? []) as TradeItemRow[]);
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
      const feedback = '이미지 파일만 업로드할 수 있습니다.';
      setItemFormMessage(feedback);
      setMessage(feedback);
      return;
    }

    if (imagePreviewUrl.startsWith('blob:')) {
      URL.revokeObjectURL(imagePreviewUrl);
    }

    setImageFile(file);
    setImagePreviewUrl(URL.createObjectURL(file));
    setItemFormMessage('');
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
          event_location: eventLocation.trim() || null,
          reference_section_enabled: referenceSectionEnabled,
          reference_section_title:
            referenceSectionTitle.trim() ||
            '내가 뽑은 굿즈가 어떤 작품인지 모르겠다면?',
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
          'id, slug, title, description, event_start_date, event_end_date, event_location, reference_section_enabled, reference_section_title, thumbnail_path, status_label, is_public, sort_order',
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
        setEventLocation(refreshedEvent.event_location ?? '');
        setReferenceSectionEnabled(refreshedEvent.reference_section_enabled === true);
        setReferenceSectionTitle(
          refreshedEvent.reference_section_title?.trim() ||
            '내가 뽑은 굿즈가 어떤 작품인지 모르겠다면?',
        );
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
      '이 작품명을 작품 선택 목록에서 삭제할까요? 이미 등록된 굿즈는 삭제되지 않습니다.',
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

  async function handleAddItemCategory(event: FormEvent<HTMLFormElement>) {
    event.preventDefault();

    if (!eventData) {
      setMessage('행사 정보를 불러온 뒤 다시 시도해 주세요.');
      return;
    }

    const label = newCategoryName.trim();
    if (!label) {
      setMessage('굿즈 종류명을 입력해 주세요.');
      return;
    }

    if (
      itemCategories.some(
        (itemCategory) =>
          itemCategory.label.localeCompare(label, 'ko-KR', {
            sensitivity: 'base',
          }) === 0,
      )
    ) {
      setMessage('이미 등록된 굿즈 종류명입니다.');
      return;
    }

    const hasLegacyCollectionPhotoCardKey = itemCategories.some(
      (itemCategory) => itemCategory.category_key === 'collection_photo_card',
    );
    const categoryKey =
      newCategoryKind === 'benefit'
        ? 'benefit'
        : newCategoryKind === 'collection_photo_card' &&
            !hasLegacyCollectionPhotoCardKey
          ? 'collection_photo_card'
          : createCustomCategoryKey();

    if (
      newCategoryKind === 'benefit' &&
      itemCategories.some(
        (itemCategory) => itemCategory.category_key === categoryKey,
      )
    ) {
      setMessage(
        '특전 기능을 사용하는 굿즈 종류는 행사당 하나만 등록할 수 있습니다.',
      );
      return;
    }

    const nextSortOrder =
      itemCategories.reduce(
        (max, itemCategory) => Math.max(max, itemCategory.sort_order ?? 0),
        -1,
      ) + 1;

    try {
      setIsSubmittingCategory(true);
      setMessage('');

      const { error } = await supabase.from('trade_item_categories').insert({
        collection_id: eventData.id,
        category_key: categoryKey,
        label,
        category_kind: newCategoryKind,
        is_visible: newCategoryIsVisible,
        sort_order: nextSortOrder,
      });

      if (error) {
        console.error(error);
        setMessage('굿즈 종류 등록에 실패했습니다. DB 정책 또는 중복명을 확인해 주세요.');
        return;
      }

      setNewCategoryName('');
      setNewCategoryKind('standard');
      setNewCategoryIsVisible(true);
      await loadItemCategories();
      setMessage('굿즈 종류가 등록되었습니다.');
    } catch (error) {
      console.error(error);
      setMessage('굿즈 종류 등록 중 오류가 발생했습니다.');
    } finally {
      setIsSubmittingCategory(false);
    }
  }

  function handleStartEditItemCategory(itemCategory: TradeItemCategoryRow) {
    setEditingCategoryId(itemCategory.id);
    setEditingCategoryName(itemCategory.label);
    setEditingCategoryKind(itemCategory.category_kind);
    setEditingCategoryIsVisible(itemCategory.is_visible);
  }

  function handleCancelEditItemCategory() {
    setEditingCategoryId('');
    setEditingCategoryName('');
    setEditingCategoryKind('standard');
    setEditingCategoryIsVisible(true);
  }

  async function handleUpdateItemCategory(itemCategory: TradeItemCategoryRow) {
    const label = editingCategoryName.trim();
    if (!label) {
      setMessage('수정할 굿즈 종류명을 입력해 주세요.');
      return;
    }

    if (
      itemCategories.some(
        (row) =>
          row.id !== itemCategory.id &&
          row.label.localeCompare(label, 'ko-KR', { sensitivity: 'base' }) === 0,
      )
    ) {
      setMessage('이미 등록된 굿즈 종류명입니다.');
      return;
    }

    try {
      setIsUpdatingCategoryId(itemCategory.id);
      setMessage('');
      const { error } = await supabase
        .from('trade_item_categories')
        .update({
          label,
          category_kind:
            itemCategory.category_kind === 'benefit'
              ? 'benefit'
              : editingCategoryKind,
          is_visible: editingCategoryIsVisible,
        })
        .eq('id', itemCategory.id);

      if (error) {
        console.error(error);
        setMessage('굿즈 종류 수정에 실패했습니다.');
        return;
      }

      handleCancelEditItemCategory();
      await loadItemCategories();
      setMessage('굿즈 종류가 수정되었습니다.');
      router.refresh();
    } catch (error) {
      console.error(error);
      setMessage('굿즈 종류 수정 중 오류가 발생했습니다.');
    } finally {
      setIsUpdatingCategoryId('');
    }
  }

  async function handleDeleteItemCategory(itemCategory: TradeItemCategoryRow) {
    if (
      itemCategory.category_key === 'benefit' &&
      benefitSubcategories.length > 0
    ) {
      const feedback =
        '특전 하위 분류를 먼저 삭제한 뒤 특전 종류를 삭제해 주세요.';
      setMessage(feedback);
      window.alert(feedback);
      return;
    }

    const ok = window.confirm(`'${itemCategory.label}' 굿즈 종류를 삭제할까요?`);
    if (!ok) return;

    try {
      setIsDeletingCategoryId(itemCategory.id);
      setMessage('굿즈 종류가 사용 중인지 확인하고 있습니다.');

      const [
        { count: itemCount, error: itemCountError },
        { count: submissionCount, error: submissionCountError },
      ] = await Promise.all([
        supabase
          .from('trade_items')
          .select('id', { count: 'exact', head: true })
          .eq('collection_id', eventId)
          .eq('category', itemCategory.category_key),
        supabase
          .from('card_submissions')
          .select('id', { count: 'exact', head: true })
          .eq('collection_id', eventId)
          .eq('category', itemCategory.category_key),
      ]);

      if (itemCountError || submissionCountError) {
        if (itemCountError) console.error(itemCountError);
        if (submissionCountError) console.error(submissionCountError);
        const feedback =
          '굿즈 종류의 사용 여부를 확인하지 못했습니다. DB 조회 권한을 확인한 뒤 다시 시도해 주세요.';
        setMessage(feedback);
        window.alert(feedback);
        return;
      }

      if ((itemCount ?? 0) > 0 || (submissionCount ?? 0) > 0) {
        const feedback =
          '이 종류를 사용하는 굿즈 또는 제보 기록이 있어 삭제할 수 없습니다. 먼저 해당 굿즈/제보를 다른 종류로 변경하거나 삭제해 주세요.';
        setMessage(feedback);
        window.alert(feedback);
        return;
      }

      setMessage('굿즈 종류를 삭제하고 있습니다.');
      const { data: deletedRows, error } = await supabase
        .from('trade_item_categories')
        .delete()
        .eq('id', itemCategory.id)
        .select('id');

      if (error || !deletedRows?.some((row) => row.id === itemCategory.id)) {
        console.error(error);
        const feedback =
          '굿즈 종류가 삭제되지 않았습니다. 관리자 DELETE/SELECT RLS 정책과 권한을 확인해 주세요.';
        setMessage(feedback);
        window.alert(feedback);
        return;
      }

      if (itemFilterCategory === itemCategory.category_key) {
        setItemFilterCategory('all');
      }
      await loadItemCategories();
      setMessage('굿즈 종류가 삭제되었습니다.');
      router.refresh();
    } catch (error) {
      console.error(error);
      const feedback = '굿즈 종류 삭제 중 오류가 발생했습니다.';
      setMessage(feedback);
      window.alert(feedback);
    } finally {
      setIsDeletingCategoryId('');
    }
  }

  async function handleMoveItemCategory(
    itemCategory: TradeItemCategoryRow,
    direction: -1 | 1,
  ) {
    const rows = sortedItemCategories;
    const index = rows.findIndex((row) => row.id === itemCategory.id);
    const target = rows[index + direction];
    if (index < 0 || !target) return;

    try {
      setIsReorderingCategoryId(itemCategory.id);
      setMessage('');
      const currentOrder = itemCategory.sort_order ?? index;
      const targetOrder = target.sort_order ?? index + direction;

      const [currentResult, targetResult] = await Promise.all([
        supabase
          .from('trade_item_categories')
          .update({ sort_order: targetOrder })
          .eq('id', itemCategory.id),
        supabase
          .from('trade_item_categories')
          .update({ sort_order: currentOrder })
          .eq('id', target.id),
      ]);

      if (currentResult.error || targetResult.error) {
        console.error(currentResult.error ?? targetResult.error);
        setMessage('굿즈 종류 순서 저장에 실패했습니다.');
        return;
      }

      await loadItemCategories();
      setMessage('굿즈 종류 순서가 변경되었습니다.');
      router.refresh();
    } catch (error) {
      console.error(error);
      setMessage('굿즈 종류 순서 변경 중 오류가 발생했습니다.');
    } finally {
      setIsReorderingCategoryId('');
    }
  }

  function moveBenefitSubcategory(activeId: string, targetId: string) {
    if (!activeId || activeId === targetId) return;

    const currentRows = benefitSubcategoriesRef.current;
    const activeIndex = currentRows.findIndex((row) => row.id === activeId);
    const targetIndex = currentRows.findIndex((row) => row.id === targetId);

    if (activeIndex === -1 || targetIndex === -1) return;

    const nextRows = [...currentRows];
    const [movedRow] = nextRows.splice(activeIndex, 1);
    nextRows.splice(targetIndex, 0, movedRow);

    benefitSubcategoriesRef.current = nextRows;
    setBenefitSubcategories(nextRows);
  }

  function handleBenefitSubcategoryPointerDown(
    event: ReactPointerEvent<HTMLButtonElement>,
    subcategoryId: string,
  ) {
    if (isSavingBenefitSubcategoryOrder) return;

    event.preventDefault();
    event.currentTarget.setPointerCapture(event.pointerId);
    benefitSubcategoryDragStartRef.current = [
      ...benefitSubcategoriesRef.current,
    ];
    benefitSubcategoryDraggingIdRef.current = subcategoryId;
    setDraggingBenefitSubcategoryId(subcategoryId);
  }

  function handleBenefitSubcategoryPointerMove(
    event: ReactPointerEvent<HTMLButtonElement>,
  ) {
    const activeId = benefitSubcategoryDraggingIdRef.current;
    if (!activeId) return;

    event.preventDefault();
    const target = document
      .elementFromPoint(event.clientX, event.clientY)
      ?.closest<HTMLElement>('[data-benefit-subcategory-id]');
    const targetId = target?.dataset.benefitSubcategoryId ?? '';

    if (targetId) {
      moveBenefitSubcategory(activeId, targetId);
    }
  }

  async function saveBenefitSubcategoryOrder() {
    const previousRows = benefitSubcategoryDragStartRef.current;
    const currentRows = benefitSubcategoriesRef.current;
    benefitSubcategoryDraggingIdRef.current = '';
    setDraggingBenefitSubcategoryId('');

    if (
      previousRows.length === currentRows.length &&
      previousRows.every((row, index) => row.id === currentRows[index]?.id)
    ) {
      benefitSubcategoryDragStartRef.current = [];
      return;
    }

    const normalizedRows = currentRows.map((row, index) => ({
      ...row,
      sort_order: index,
    }));

    benefitSubcategoriesRef.current = normalizedRows;
    setBenefitSubcategories(normalizedRows);

    try {
      setIsSavingBenefitSubcategoryOrder(true);
      setMessage('');

      const updateResults = await Promise.all(
        normalizedRows.map((row, index) =>
          supabase
            .from('trade_benefit_subcategories')
            .update({ sort_order: index })
            .eq('id', row.id),
        ),
      );
      const failedResult = updateResults.find((result) => result.error);

      if (failedResult?.error) {
        console.error(failedResult.error);
        await loadBenefitSubcategories();
        setMessage('특전 하위 분류 순서 저장에 실패했습니다.');
        return;
      }

      const itemOrderUpdateResults = await Promise.all(
        normalizedRows.map((row, index) =>
          supabase
            .from('trade_items')
            .update({ sort_order: index })
            .eq('collection_id', row.collection_id)
            .eq('category', 'benefit')
            .eq('benefit_subcategory', row.name),
        ),
      );
      const failedItemOrderResult = itemOrderUpdateResults.find(
        (result) => result.error,
      );

      if (failedItemOrderResult?.error) {
        console.error(failedItemOrderResult.error);
        setMessage(
          '특전 하위 분류 순서는 저장됐지만 굿즈 정렬값 동기화에 실패했습니다.',
        );
        return;
      }

      await loadItems();

      setMessage('특전 하위 분류 순서가 저장되었습니다.');
      router.refresh();
    } catch (error) {
      console.error(error);
      await loadBenefitSubcategories();
      setMessage('특전 하위 분류 순서 저장 중 오류가 발생했습니다.');
    } finally {
      setIsSavingBenefitSubcategoryOrder(false);
      benefitSubcategoryDragStartRef.current = [];
    }
  }

  function cancelBenefitSubcategoryDrag() {
    const previousRows = benefitSubcategoryDragStartRef.current;

    if (previousRows.length > 0) {
      benefitSubcategoriesRef.current = previousRows;
      setBenefitSubcategories(previousRows);
    }

    benefitSubcategoryDragStartRef.current = [];
    benefitSubcategoryDraggingIdRef.current = '';
    setDraggingBenefitSubcategoryId('');
  }

  async function handleAddBenefitSubcategory(event: FormEvent<HTMLFormElement>) {
    event.preventDefault();

    if (!hasBenefitCategory) {
      setMessage('굿즈 종류 관리에서 특전 기능을 사용하는 종류를 먼저 등록해 주세요.');
      return;
    }

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

    const showItemFeedback = (feedback: string) => {
      setItemFormMessage(feedback);
      setMessage(feedback);
    };

    if (!eventData) {
      showItemFeedback('행사 정보를 불러온 뒤 다시 시도해 주세요.');
      return;
    }

    const normalizedItemName = itemName.trim();
    const selectedItemCategory =
      visibleItemCategories.find(
        (itemCategory) => itemCategory.category_key === category,
      ) ?? visibleItemCategories[0];

    if (!selectedItemCategory) {
      showItemFeedback('굿즈 종류를 먼저 등록하고 선택해 주세요.');
      return;
    }

    const resolvedCategory = selectedItemCategory.category_key;
    if (resolvedCategory !== category) {
      setCategory(resolvedCategory);
    }

    if (!imageFile && !normalizedItemName) {
      showItemFeedback('이미지가 없으면 굿즈명을 입력해 주세요.');
      return;
    }

    const selectedCategoryKind = selectedItemCategory.category_kind;

    try {
      setIsSubmittingItem(true);
      setItemFormMessage('굿즈를 등록하고 있습니다.');
      setMessage('');

      let imagePath = '';

      if (imageFile) {
        const fileExtension = getFileExtension(imageFile);
        const safeWorkTitle = normalizePathPart(
          selectedWorkTitle || normalizedItemName || 'event',
        );
        const safeBenefitSubcategory = normalizePathPart(
          benefitSubcategory || 'benefit',
        );
        const fileNamePrefix =
          selectedCategoryKind === 'benefit'
            ? `${resolvedCategory}-${safeBenefitSubcategory}-${safeWorkTitle}`
            : `${resolvedCategory}-${safeWorkTitle}`;
        const fileName = `${fileNamePrefix}-${Date.now()}.${fileExtension}`;
        imagePath = `${eventData.slug}/${fileName}`;

        const { error: uploadError } = await supabase.storage
          .from('trade-assets')
          .upload(imagePath, imageFile, {
            cacheControl: '3600',
            upsert: false,
            contentType: imageFile.type,
          });

        if (uploadError) {
          console.error(uploadError);
          showItemFeedback(
            `이미지 업로드에 실패했습니다. ${uploadError.message}`,
          );
          return;
        }
      }

      const { error: insertError } = await supabase.from('trade_items').insert({
        collection_id: eventData.id,
        category: resolvedCategory,
        work_title: selectedWorkTitle.trim(),
        item_name: normalizedItemName || null,
        show_item_name: normalizedItemName ? itemShowName : false,
        image_path: imagePath,
        image_ratio: imageRatio,
        benefit_subcategory:
          selectedCategoryKind === 'benefit'
            ? benefitSubcategory.trim() || null
            : null,
        is_visible: itemIsVisible,
        sort_order:
          selectedCategoryKind === 'collection_photo_card'
            ? getCollectionPhotoCardSortOrder(collectionPhotoCardVariant)
            : selectedCategoryKind === 'benefit'
              ? (getBenefitSubcategorySortOrder(
                  benefitSubcategoryOrderMap,
                  benefitSubcategory,
                ) ?? 0)
              : 0,
      });

      if (insertError) {
        console.error(insertError);
        showItemFeedback(`굿즈 등록에 실패했습니다. ${insertError.message}`);
        return;
      }

      setImageFile(null);
      setImagePreviewUrl('');
      setItemName('');
      setBenefitSubcategory('');
      setCollectionPhotoCardVariant('A');
      setImageRatio('square');
      setItemIsVisible(true);
      setItemShowName(true);

      await loadItems();

      const successMessage = imageFile
        ? '굿즈가 등록되었습니다.'
        : '텍스트 굿즈가 등록되었습니다.';
      setItemFormMessage(successMessage);
      setMessage(successMessage);
      router.refresh();
    } catch (error) {
      console.error(error);
      const errorMessage =
        error instanceof Error ? error.message : '알 수 없는 오류';
      showItemFeedback(`굿즈 등록 중 오류가 발생했습니다. ${errorMessage}`);
    } finally {
      setIsSubmittingItem(false);
    }
  }

  // 그룹 간 이동은 기존 작품/특전/A-B-C 정렬을 훼손하므로 허용하지 않습니다.
  function getItemOrderGroup(item: TradeItemRow) {
    const kind = getCategoryKind(item.category, itemCategoryMap);
    return JSON.stringify([
      item.category,
      kind === 'benefit' ? getBenefitSubcategoryLabel(item.benefit_subcategory) : '',
      item.work_title.trim(),
      kind === 'collection_photo_card' ? normalizeCollectionPhotoCardSortOrder(item.sort_order) : '',
    ]);
  }

  async function handleDropItem(target: TradeItemRow) {
    const sourceId = draggingItemId;
    setDraggingItemId('');
    if (!sourceId || sourceId === target.id || isSavingItemOrder) return;
    const source = items.find((row) => row.id === sourceId);
    if (!source) return;
    if (getItemOrderGroup(source) !== getItemOrderGroup(target)) {
      setMessage('같은 작품·굿즈 종류·그룹 안에서만 순서를 변경할 수 있습니다.');
      return;
    }
    const siblings = sortTradeItems(items, benefitSubcategoryOrderMap, itemCategoryOrderMap, itemCategoryMap)
      .filter((row) => getItemOrderGroup(row) === getItemOrderGroup(source));
    const from = siblings.findIndex((row) => row.id === sourceId);
    const to = siblings.findIndex((row) => row.id === target.id);
    if (from < 0 || to < 0) return;
    const reordered = [...siblings];
    const [moved] = reordered.splice(from, 1);
    reordered.splice(to, 0, moved);
    setIsSavingItemOrder(true);
    setMessage('');
    try {
      // 다른 그룹은 변경하지 않으며 순서를 영속적으로 저장합니다.
      for (const [index, row] of reordered.entries()) {
        const { data, error } = await supabase.from('trade_items')
          .update({ display_order: index }).eq('id', row.id).select('id');
        if (error) throw error;
        if (!data?.length) throw new Error('굿즈 순서 저장 권한을 확인해 주세요.');
      }
      await loadItems();
      setMessage('굿즈 순서가 저장되었습니다. 사용자 교환판에도 같은 순서가 적용됩니다.');
    } catch (error) {
      console.error(error);
      await loadItems();
      setMessage(`순서 저장 실패: ${error instanceof Error ? error.message : '알 수 없는 오류'}`);
    } finally {
      setIsSavingItemOrder(false);
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
    setEditingItemName(item.item_name ?? '');
    setEditingItemCategory(item.category);
    setEditingItemBenefitSubcategory(item.benefit_subcategory ?? '');
    setEditingItemCollectionPhotoCardVariant(
      getCollectionPhotoCardVariant(item.sort_order),
    );
    setEditingItemImageRatio(getSafeImageRatio(item.image_ratio));
    setEditingItemIsVisible(item.is_visible);
    setEditingItemShowName(item.show_item_name === true);
  }

  function handleCancelEditItem() {
    clearEditingItemImagePreview();
    setEditingItemId('');
    setEditingItemWorkTitle('');
    setEditingItemName('');
    setEditingItemCategory(visibleItemCategories[0]?.category_key ?? '');
    setEditingItemBenefitSubcategory('');
    setEditingItemCollectionPhotoCardVariant('A');
    setEditingItemImageRatio('square');
    setEditingItemIsVisible(true);
    setEditingItemShowName(false);
  }

  async function handleUpdateItem(item: TradeItemRow) {
    if (!eventData) {
      setMessage('행사 정보를 불러온 뒤 다시 시도해 주세요.');
      return;
    }

    const normalizedEditingItemName = editingItemName.trim();

    if (!editingItemCategory) {
      setMessage('굿즈 종류를 선택해 주세요.');
      return;
    }

    if (!item.image_path && !editingItemImageFile && !normalizedEditingItemName) {
      setMessage('이미지가 없으면 굿즈명을 입력해 주세요.');
      return;
    }

    try {
      setIsUpdatingItemId(item.id);
      setMessage('');

      let nextImagePath = item.image_path;

      if (editingItemImageFile) {
        const fileExtension = getFileExtension(editingItemImageFile);
        const safeWorkTitle = normalizePathPart(
          editingItemWorkTitle || normalizedEditingItemName || 'event',
        );
        const safeBenefitSubcategory = normalizePathPart(
          editingItemBenefitSubcategory || 'benefit',
        );
        const fileNamePrefix =
          editingItemCategoryKind === 'benefit'
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
          work_title: editingItemWorkTitle.trim(),
          category: editingItemCategory,
          item_name: normalizedEditingItemName || null,
          show_item_name: normalizedEditingItemName
            ? editingItemShowName
            : false,
          image_path: nextImagePath,
          image_ratio: editingItemImageRatio,
          benefit_subcategory:
            editingItemCategoryKind === 'benefit'
              ? editingItemBenefitSubcategory.trim() || null
              : null,
          sort_order:
            editingItemCategoryKind === 'collection_photo_card'
              ? getCollectionPhotoCardSortOrder(
                  editingItemCollectionPhotoCardVariant,
                )
              : editingItemCategoryKind === 'benefit'
                ? (getBenefitSubcategorySortOrder(
                    benefitSubcategoryOrderMap,
                    editingItemBenefitSubcategory,
                  ) ?? 0)
                : 0,
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
    const ok = window.confirm('이 굿즈를 삭제할까요?');

    if (!ok) {
      return;
    }

    try {
      setIsDeletingItemId(item.id);
      setMessage('');

      if (item.image_path) {
        const { error: storageError } = await supabase.storage
          .from('trade-assets')
          .remove([item.image_path]);

        if (storageError) {
          console.error(storageError);
        }
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
      setMessage('굿즈가 삭제되었습니다.');
      router.refresh();
    } catch (error) {
      console.error(error);
      setMessage('굿즈 삭제 중 오류가 발생했습니다.');
    } finally {
      setIsDeletingItemId('');
    }
  }

  async function handleSaveReferenceSettings() {
    if (!eventData) {
      setMessage('행사 정보를 불러온 뒤 다시 시도해 주세요.');
      return;
    }

    try {
      setIsSavingReferenceSettings(true);
      setMessage('');

      const normalizedTitle =
        referenceSectionTitle.trim() ||
        '내가 뽑은 굿즈가 어떤 작품인지 모르겠다면?';

      const { error } = await supabase
        .from('trade_collections')
        .update({
          reference_section_enabled: referenceSectionEnabled,
          reference_section_title: normalizedTitle,
        })
        .eq('id', eventData.id);

      if (error) {
        console.error(error);
        setMessage('행사 공지 설정 저장에 실패했습니다.');
        return;
      }

      setReferenceSectionTitle(normalizedTitle);
      setEventData((prev) =>
        prev
          ? {
              ...prev,
              reference_section_enabled: referenceSectionEnabled,
              reference_section_title: normalizedTitle,
            }
          : prev,
      );
      setMessage('행사 공지 설정이 저장되었습니다.');
    } catch (error) {
      console.error(error);
      setMessage('행사 공지 설정 저장 중 오류가 발생했습니다.');
    } finally {
      setIsSavingReferenceSettings(false);
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
        setMessage('행사 공지 이미지 등록에 실패했습니다. DB 정책을 확인해 주세요.');
        return;
      }

      clearReferenceImagePreviews();
      await loadReferenceImages();
      setMessage('공지용 이미지가 등록되었습니다.');
      router.refresh();
    } catch (error) {
      console.error(error);
      setMessage('행사 공지 이미지 등록 중 오류가 발생했습니다.');
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
              <span className="text-sm font-bold text-neutral-800">행사 장소</span>
              <input
                value={eventLocation}
                onChange={(event) => setEventLocation(event.target.value)}
                className="mt-1 w-full rounded-2xl border border-neutral-200 px-4 py-3 text-sm outline-none focus:border-neutral-950"
                placeholder="예: 서울 · 더현대 서울 5F / 온라인"
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
                여러 작품이 함께하는 행사에서만 등록하면 됩니다. 단독 행사는 작품명 없이 사용할 수 있습니다.
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
          onSubmit={handleAddItemCategory}
          className="mt-5 rounded-3xl border border-neutral-200 bg-white p-5 shadow-sm"
        >
          <div className="flex items-start justify-between gap-4">
            <div className="min-w-0">
              <h2 className="text-lg font-black text-neutral-950">
                굿즈 종류 관리
              </h2>
              <p className="mt-2 text-sm leading-6 text-neutral-500">
                행사마다 실제 판매·배포되는 굿즈 종류만 등록해 주세요.
              </p>
              <p className="mt-1 text-xs font-bold text-neutral-400">
                등록된 종류 {itemCategories.length}개
              </p>
            </div>

            <button
              type="button"
              onClick={() => setIsCategorySectionOpen((prev) => !prev)}
              className="shrink-0 rounded-full border border-neutral-200 bg-white px-4 py-2 text-xs font-black text-neutral-600"
            >
              {isCategorySectionOpen ? '접기' : '펼치기'}
            </button>
          </div>

          {isCategorySectionOpen ? (
            <>
              <div className="mt-5 space-y-3">
                <label className="block">
                  <span className="text-sm font-bold text-neutral-800">
                    굿즈 종류명
                  </span>
                  <input
                    value={newCategoryName}
                    onChange={(event) => setNewCategoryName(event.target.value)}
                    className="mt-1 w-full rounded-2xl border border-neutral-200 bg-white px-4 py-3 text-sm outline-none focus:border-neutral-950"
                    placeholder="예: 포토카드, 아크릴 스탠드, 인형"
                  />
                </label>

                <label className="block">
                  <span className="text-sm font-bold text-neutral-800">
                    종류 기능
                  </span>
                  <select
                    value={newCategoryKind}
                    onChange={(event) =>
                      setNewCategoryKind(event.target.value as TradeCategoryKind)
                    }
                    className="mt-1 w-full rounded-2xl border border-neutral-200 bg-white px-4 py-3 text-sm outline-none focus:border-neutral-950"
                  >
                    <option value="standard">일반 굿즈</option>
                    <option value="benefit">특전 · 하위 분류 사용</option>
                    <option value="collection_photo_card">
                      컬렉션 포토카드 · A/B/C/D 내부 정렬
                    </option>
                  </select>
                  <p className="mt-2 text-xs leading-5 text-neutral-400">
                    대부분은 일반 굿즈를 선택하면 됩니다. 컬렉션 포토카드 A/B/C/D 기능은 ver.1, ver.2처럼 여러 굿즈 종류에 각각 사용할 수 있습니다.
                  </p>
                </label>

                <label className="flex items-center justify-between gap-3 rounded-2xl bg-neutral-100 px-4 py-3">
                  <span>
                    <span className="block text-sm font-bold text-neutral-800">
                      공개
                    </span>
                    <span className="mt-1 block text-xs text-neutral-500">
                      교환판과 이미지 제보의 굿즈 종류 목록에 노출합니다.
                    </span>
                  </span>
                  <input
                    type="checkbox"
                    checked={newCategoryIsVisible}
                    onChange={(event) => setNewCategoryIsVisible(event.target.checked)}
                    className="h-5 w-5"
                  />
                </label>

                <button
                  type="submit"
                  disabled={isSubmittingCategory}
                  className="w-full rounded-2xl bg-neutral-950 px-5 py-4 text-sm font-black text-white disabled:cursor-not-allowed disabled:bg-neutral-300"
                >
                  {isSubmittingCategory ? '등록 중...' : '굿즈 종류 등록'}
                </button>
              </div>

              <div className="mt-5 border-t border-neutral-100 pt-5">
                <div className="flex items-center justify-between gap-3">
                  <h3 className="text-sm font-black text-neutral-950">
                    등록된 굿즈 종류
                  </h3>
                  <span className="text-[11px] font-bold text-neutral-400">
                    위/아래 버튼으로 표시 순서 변경
                  </span>
                </div>

                {sortedItemCategories.length > 0 ? (
                  <div className="mt-3 space-y-2">
                    {sortedItemCategories.map((itemCategory, index) => {
                      const isEditing = editingCategoryId === itemCategory.id;
                      const isUpdating = isUpdatingCategoryId === itemCategory.id;
                      const isDeleting = isDeletingCategoryId === itemCategory.id;
                      const isReordering = isReorderingCategoryId === itemCategory.id;
                      const kindLabel =
                        itemCategory.category_kind === 'benefit'
                          ? '특전 기능'
                          : itemCategory.category_kind === 'collection_photo_card'
                            ? 'A/B/C/D 정렬'
                            : '일반';

                      return (
                        <div
                          key={itemCategory.id}
                          className="rounded-2xl bg-neutral-50 px-3 py-3"
                        >
                          {isEditing ? (
                            <div className="space-y-3">
                              <label className="block">
                                <span className="text-xs font-bold text-neutral-500">
                                  굿즈 종류명
                                </span>
                                <input
                                  value={editingCategoryName}
                                  onChange={(event) =>
                                    setEditingCategoryName(event.target.value)
                                  }
                                  className="mt-1 w-full rounded-xl border border-neutral-200 bg-white px-3 py-2 text-sm outline-none focus:border-neutral-950"
                                />
                              </label>

                              <label className="block">
                                <span className="text-xs font-bold text-neutral-500">
                                  종류 기능
                                </span>
                                {itemCategory.category_kind === 'benefit' ? (
                                  <div className="mt-1 rounded-xl border border-neutral-200 bg-neutral-100 px-3 py-2 text-sm font-bold text-neutral-500">
                                    특전 · 하위 분류 사용
                                  </div>
                                ) : (
                                  <>
                                    <select
                                      value={editingCategoryKind}
                                      onChange={(event) =>
                                        setEditingCategoryKind(
                                          event.target.value as TradeCategoryKind,
                                        )
                                      }
                                      className="mt-1 w-full rounded-xl border border-neutral-200 bg-white px-3 py-2 text-sm outline-none focus:border-neutral-950"
                                    >
                                      <option value="standard">일반 굿즈</option>
                                      <option value="collection_photo_card">
                                        컬렉션 포토카드 · A/B/C/D 내부 정렬
                                      </option>
                                    </select>
                                    <p className="mt-1 text-[11px] leading-5 text-neutral-400">
                                      기존 일반 굿즈를 A/B/C/D 기능으로 바꾸면 기존 등록 굿즈는 우선 A로 취급됩니다.
                                    </p>
                                  </>
                                )}
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
                                  checked={editingCategoryIsVisible}
                                  onChange={(event) =>
                                    setEditingCategoryIsVisible(event.target.checked)
                                  }
                                  className="h-5 w-5"
                                />
                              </label>

                              <div className="grid grid-cols-2 gap-2">
                                <button
                                  type="button"
                                  onClick={handleCancelEditItemCategory}
                                  disabled={isUpdating}
                                  className="rounded-xl border border-neutral-300 bg-white px-3 py-2 text-xs font-black text-neutral-600"
                                >
                                  취소
                                </button>
                                <button
                                  type="button"
                                  onClick={() => handleUpdateItemCategory(itemCategory)}
                                  disabled={isUpdating}
                                  className="rounded-xl bg-neutral-950 px-3 py-2 text-xs font-black text-white disabled:bg-neutral-300"
                                >
                                  {isUpdating ? '수정 중...' : '수정 저장'}
                                </button>
                              </div>
                            </div>
                          ) : (
                            <div className="flex items-center gap-2">
                              <div className="flex shrink-0 items-center gap-1">
                                <button
                                  type="button"
                                  onClick={() => handleMoveItemCategory(itemCategory, -1)}
                                  disabled={index === 0 || isReordering}
                                  className="flex h-8 w-8 items-center justify-center rounded-full border border-neutral-200 bg-white text-xs font-black text-neutral-500 disabled:opacity-30"
                                  aria-label={`${itemCategory.label} 위로 이동`}
                                >
                                  ↑
                                </button>
                                <button
                                  type="button"
                                  onClick={() => handleMoveItemCategory(itemCategory, 1)}
                                  disabled={index === sortedItemCategories.length - 1 || isReordering}
                                  className="flex h-8 w-8 items-center justify-center rounded-full border border-neutral-200 bg-white text-xs font-black text-neutral-500 disabled:opacity-30"
                                  aria-label={`${itemCategory.label} 아래로 이동`}
                                >
                                  ↓
                                </button>
                              </div>

                              <div className="min-w-0 flex-1">
                                <p className="truncate text-sm font-black text-neutral-950">
                                  {itemCategory.label}
                                </p>
                                <p className="mt-0.5 text-[11px] text-neutral-400">
                                  {kindLabel} · {itemCategory.is_visible ? '공개' : '숨김'}
                                </p>
                              </div>

                              <div className="flex shrink-0 items-center gap-1.5">
                                <button
                                  type="button"
                                  onClick={() => handleStartEditItemCategory(itemCategory)}
                                  className="rounded-full border border-neutral-200 bg-white px-3 py-1.5 text-[11px] font-black text-neutral-600"
                                >
                                  수정
                                </button>
                                <button
                                  type="button"
                                  onClick={() => handleDeleteItemCategory(itemCategory)}
                                  disabled={isDeleting}
                                  className="rounded-full border border-red-200 bg-red-50 px-3 py-1.5 text-[11px] font-black text-red-600 disabled:opacity-50"
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
                  <p className="mt-3 rounded-2xl bg-neutral-50 px-4 py-6 text-center text-xs leading-5 text-neutral-400">
                    아직 등록된 굿즈 종류가 없습니다. 굿즈를 등록하기 전에 이 행사에서 사용하는 종류를 먼저 추가해 주세요.
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

          {!hasBenefitCategory ? (
            <p className="mt-4 rounded-2xl bg-amber-50 px-4 py-3 text-xs font-bold leading-5 text-amber-700">
              이 행사에는 특전 기능 굿즈 종류가 없습니다. 먼저 위의 굿즈 종류 관리에서 종류 기능을 ‘특전 · 하위 분류 사용’으로 등록해 주세요.
            </p>
          ) : null}

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
                disabled={isSubmittingBenefitSubcategory || !hasBenefitCategory}
                className="mt-4 w-full rounded-2xl bg-neutral-950 px-5 py-3 text-sm font-black text-white disabled:cursor-not-allowed disabled:bg-neutral-300"
              >
                {isSubmittingBenefitSubcategory
                  ? '등록 중...'
                  : '하위 분류 등록'}
              </button>

              {benefitSubcategories.length > 0 ? (
                <div className="mt-5 space-y-2">
                  <div className="flex items-center justify-between gap-3 px-1 pb-1">
                    <p className="text-[11px] font-bold text-neutral-500">
                      왼쪽 핸들을 누른 채 드래그해 표시 순서를 바꿔 주세요.
                    </p>
                    {isSavingBenefitSubcategoryOrder ? (
                      <span className="shrink-0 text-[10px] font-black text-[#7C5CFC]">
                        순서 저장 중...
                      </span>
                    ) : null}
                  </div>

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
                        data-benefit-subcategory-id={subcategory.id}
                        className={`rounded-2xl border p-3 transition ${
                          draggingBenefitSubcategoryId === subcategory.id
                            ? 'border-[#7C5CFC] bg-[#F7F5FF] shadow-sm'
                            : 'border-neutral-200 bg-neutral-50'
                        }`}
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
                            <button
                              type="button"
                              aria-label={`${subcategory.name} 순서 이동`}
                              disabled={isSavingBenefitSubcategoryOrder}
                              onPointerDown={(event) =>
                                handleBenefitSubcategoryPointerDown(
                                  event,
                                  subcategory.id,
                                )
                              }
                              onPointerMove={handleBenefitSubcategoryPointerMove}
                              onPointerUp={() =>
                                void saveBenefitSubcategoryOrder()
                              }
                              onPointerCancel={cancelBenefitSubcategoryDrag}
                              className="grid h-10 w-9 shrink-0 touch-none cursor-grab place-items-center rounded-xl border border-neutral-200 bg-white text-neutral-400 active:cursor-grabbing disabled:cursor-not-allowed disabled:opacity-40"
                            >
                              <svg
                                viewBox="0 0 24 24"
                                aria-hidden="true"
                                className="h-5 w-5 fill-current"
                              >
                                <circle cx="8" cy="6" r="1.4" />
                                <circle cx="16" cy="6" r="1.4" />
                                <circle cx="8" cy="12" r="1.4" />
                                <circle cx="16" cy="12" r="1.4" />
                                <circle cx="8" cy="18" r="1.4" />
                                <circle cx="16" cy="18" r="1.4" />
                              </svg>
                            </button>

                            <div className="min-w-0 flex-1">
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
                행사 공지
              </h2>
              <p className="mt-2 text-sm leading-6 text-neutral-500">
                행사 공지에 올라온 특전 안내 이미지를 그대로 등록합니다. 교환/양도판 만들기에서 “내가 뽑은 굿즈가 어떤 작품인지 모르겠다면?” 영역에 순서대로 표시됩니다.
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
              <div className="mt-5 rounded-2xl border border-neutral-200 bg-neutral-50 p-4">
                <label className="flex items-center justify-between gap-3">
                  <span>
                    <span className="block text-sm font-black text-neutral-800">
                      행사 공지 표시
                    </span>
                    <span className="mt-1 block text-xs leading-5 text-neutral-500">
                      끄면 공지용 이미지 안내 영역 전체가 사용자에게 보이지 않습니다.
                    </span>
                  </span>
                  <input
                    type="checkbox"
                    checked={referenceSectionEnabled}
                    onChange={(event) =>
                      setReferenceSectionEnabled(event.target.checked)
                    }
                    className="h-5 w-5"
                  />
                </label>

                <label className="mt-4 block">
                  <span className="text-sm font-bold text-neutral-800">
                    공지명
                  </span>
                  <input
                    value={referenceSectionTitle}
                    onChange={(event) =>
                      setReferenceSectionTitle(event.target.value)
                    }
                    disabled={!referenceSectionEnabled}
                    className="mt-1 w-full rounded-xl border border-neutral-200 bg-white px-3 py-2.5 text-sm outline-none focus:border-neutral-950 disabled:bg-neutral-100 disabled:text-neutral-400"
                    placeholder="내가 뽑은 굿즈가 어떤 작품인지 모르겠다면?"
                  />
                </label>

                <button
                  type="button"
                  onClick={handleSaveReferenceSettings}
                  disabled={isSavingReferenceSettings}
                  className="mt-3 w-full rounded-xl border border-neutral-300 bg-white px-4 py-2.5 text-xs font-black text-neutral-700 disabled:cursor-not-allowed disabled:opacity-50"
                >
                  {isSavingReferenceSettings ? '저장 중...' : '행사 공지 설정 저장'}
                </button>
              </div>

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
                {isSubmittingReferenceImages ? '등록 중...' : '공지 이미지 등록'}
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
                굿즈 등록
              </h2>
              <p className="mt-2 text-sm leading-6 text-neutral-500">
                작품명은 선택사항입니다. 이미지가 없어도 굿즈명만으로 먼저 등록할 수 있습니다.
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
                작품명 <span className="text-neutral-400">(선택)</span>
              </span>

              <select
                value={selectedWorkTitle}
                onChange={(event) => setSelectedWorkTitle(event.target.value)}
                className="mt-1 w-full rounded-2xl border border-neutral-200 bg-white px-4 py-3 text-sm outline-none focus:border-neutral-950"
              >
                <option value="">작품명 없음 · 단독/공통 행사</option>
                {visibleWorks.length > 0 ? (
                  visibleWorks.map((work) => (
                    <option key={work.id} value={work.title}>
                      {work.title}
                    </option>
                  ))
                ) : null}
              </select>

              <p className="mt-2 text-xs leading-5 text-neutral-400">
                여러 작품이 함께하는 행사에서만 선택하면 됩니다. 단독 행사는 비워둘 수 있습니다.
              </p>
            </label>

            <label className="block">
              <span className="text-sm font-bold text-neutral-800">
                굿즈명 <span className="text-neutral-400">(이미지 없을 때 필수)</span>
              </span>

              <input
                value={itemName}
                onChange={(event) => {
                  setItemName(event.target.value);
                  setItemFormMessage('');
                }}
                placeholder="예: 입장 특전 포토카드 A / 아크릴 스탠드"
                className="mt-1 w-full rounded-2xl border border-neutral-200 bg-white px-4 py-3 text-sm outline-none focus:border-neutral-950"
              />

              <p className="mt-2 text-xs leading-5 text-neutral-400">
                이미지가 아직 공개되지 않았다면 굿즈명만 입력해서 먼저 등록할 수 있습니다.
              </p>
            </label>

            <label className="flex items-center justify-between gap-3 rounded-2xl bg-neutral-100 px-4 py-3">
              <span>
                <span className="block text-sm font-bold text-neutral-800">
                  굿즈명 표시
                </span>
                <span className="mt-1 block text-xs leading-5 text-neutral-500">
                  A, B, C 같은 임시 이름을 교환판에 보이거나 숨길 수 있습니다.
                </span>
              </span>

              <input
                type="checkbox"
                checked={itemShowName}
                onChange={(event) => setItemShowName(event.target.checked)}
                disabled={!itemName.trim()}
                className="h-5 w-5"
              />
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
                    setItemFormMessage('');
                    const nextCategoryKind =
                      itemCategoryMap.get(nextCategory)?.category_kind ?? 'standard';
                    if (nextCategoryKind !== 'benefit') {
                      setBenefitSubcategory('');
                    }
                  }}
                  className="mt-1 w-full rounded-2xl border border-neutral-200 bg-white px-4 py-3 text-sm outline-none focus:border-neutral-950"
                >
                  {visibleItemCategories.length > 0 ? (
                    visibleItemCategories.map((option) => (
                      <option key={option.id} value={option.category_key}>
                        {option.label}
                      </option>
                    ))
                  ) : (
                    <option value="">굿즈 종류를 먼저 등록해 주세요</option>
                  )}
                </select>
              </label>

              {selectedItemCategoryKind === 'benefit' ? (
                <label className="block">
                  <span className="text-sm font-bold text-neutral-800">
                    특전 하위 분류
                  </span>

                  <select
                    value={benefitSubcategory}
                    onChange={(event) =>
                      setBenefitSubcategory(event.target.value)
                    }
                    disabled={visibleBenefitSubcategories.length === 0}
                    className="mt-1 w-full rounded-2xl border border-neutral-200 bg-white px-3 py-3 text-sm outline-none focus:border-neutral-950 disabled:bg-neutral-100 disabled:text-neutral-400"
                  >
                    {visibleBenefitSubcategories.length === 0 ? (
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
              ) : selectedItemCategoryKind === 'collection_photo_card' ? (
                <label className="block">
                  <span className="text-sm font-bold text-neutral-800">
                    컬렉션 하위 분류
                  </span>

                  <select
                    value={collectionPhotoCardVariant}
                    onChange={(event) =>
                      setCollectionPhotoCardVariant(
                        event.target.value as CollectionPhotoCardVariant,
                      )
                    }
                    className="mt-1 w-full rounded-2xl border border-neutral-200 bg-white px-3 py-3 text-sm outline-none focus:border-neutral-950"
                  >
                    {COLLECTION_PHOTO_CARD_VARIANTS.map((variant) => (
                      <option key={variant} value={variant}>
                        {variant}
                      </option>
                    ))}
                  </select>
                </label>
              ) : (
                <label className="block">
                  <span className="text-sm font-bold text-neutral-800">
                    하위 분류
                  </span>
                  <select
                    disabled
                    className="mt-1 w-full rounded-2xl border border-neutral-200 bg-neutral-100 px-3 py-3 text-sm text-neutral-400"
                  >
                    <option>해당 없음</option>
                  </select>
                </label>
              )}
            </div>

            <p className="-mt-3 text-xs leading-5 text-neutral-400">
              {selectedItemCategoryKind === 'collection_photo_card'
                ? 'A/B/C/D는 관리자 정렬용 값이며 일반 사용자 화면에는 표시되지 않습니다.'
                : '특전 하위 분류는 굿즈 종류가 특전이고 등록된 하위 분류가 있을 때만 선택할 수 있습니다.'}
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
                  굿즈 이미지 <span className="text-neutral-400">(선택)</span>
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
                    이미지가 공개된 경우에만 업로드하면 됩니다.
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

            {itemFormMessage ? (
              <p
                className="rounded-2xl border border-neutral-200 bg-neutral-50 px-4 py-3 text-sm font-bold leading-6 text-neutral-700"
                role="status"
                aria-live="polite"
              >
                {itemFormMessage}
              </p>
            ) : null}

            <button
              type="submit"
              disabled={isSubmittingItem}
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
              총 {items.length}개 · 현재 표시 {filteredItems.length}개 · 같은 그룹 내에서 카드를 끌어 순서 변경
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

                  {sortedItemCategories.map((option) => (
                    <option key={option.id} value={option.category_key}>
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
                  const categoryLabel = getTradeItemMetaLabel(item, itemCategoryMap);
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
                      draggable={!isSavingItemOrder && !editingItemId}
                      onDragStart={(event) => {
                        setDraggingItemId(item.id);
                        event.dataTransfer.effectAllowed = 'move';
                        event.dataTransfer.setData('text/plain', item.id);
                      }}
                      onDragOver={(event) => {
                        if (draggingItemId && !isSavingItemOrder) event.preventDefault();
                      }}
                      onDrop={(event) => { event.preventDefault(); void handleDropItem(item); }}
                      onDragEnd={() => setDraggingItemId('')}
                      className={`overflow-hidden rounded-2xl border bg-white ${draggingItemId === item.id ? 'border-blue-500 opacity-50' : 'border-neutral-200'}`}
                    >
                      <div className={`relative ${getImageRatioClass(item.image_ratio)} bg-neutral-100`}>
                        <img
                          src={getTradeItemImageUrl(
                            item.image_path,
                            item.item_name,
                            getSafeImageRatio(item.image_ratio),
                          )}
                          alt={item.item_name || item.work_title || '굿즈'}
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
                                작품명 (선택)
                              </span>

                              <select
                                value={editingItemWorkTitle}
                                onChange={(event) =>
                                  setEditingItemWorkTitle(event.target.value)
                                }
                                className="mt-1 w-full rounded-xl border border-neutral-200 bg-white px-2 py-2 text-xs outline-none focus:border-neutral-950"
                              >
                                <option value="">작품명 없음 · 단독/공통</option>

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
                                굿즈명
                              </span>
                              <input
                                value={editingItemName}
                                onChange={(event) =>
                                  setEditingItemName(event.target.value)
                                }
                                placeholder="이미지가 없으면 필수"
                                className="mt-1 w-full rounded-xl border border-neutral-200 bg-white px-2 py-2 text-xs outline-none focus:border-neutral-950"
                              />
                            </label>

                            <label className="flex items-center justify-between gap-2 rounded-xl bg-neutral-50 px-3 py-2">
                              <span>
                                <span className="block text-[10px] font-bold text-neutral-600">
                                  굿즈명 표시
                                </span>
                                <span className="mt-0.5 block text-[10px] text-neutral-400">
                                  이미지 등록 후 이름 숨김 가능
                                </span>
                              </span>
                              <input
                                type="checkbox"
                                checked={editingItemShowName}
                                onChange={(event) =>
                                  setEditingItemShowName(event.target.checked)
                                }
                                disabled={!editingItemName.trim()}
                                className="h-5 w-5"
                              />
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
                                {sortedItemCategories.map((option) => (
                                  <option key={option.id} value={option.category_key}>
                                    {option.label}
                                  </option>
                                ))}
                              </select>
                            </label>

                            {editingItemCategoryKind === 'benefit' ? (
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
                            ) : editingItemCategoryKind === 'collection_photo_card' ? (
                              <label className="block">
                                <span className="text-[10px] font-bold text-neutral-500">
                                  컬렉션 하위 분류
                                </span>

                                <select
                                  value={editingItemCollectionPhotoCardVariant}
                                  onChange={(event) =>
                                    setEditingItemCollectionPhotoCardVariant(
                                      event.target.value as CollectionPhotoCardVariant,
                                    )
                                  }
                                  className="mt-1 w-full rounded-xl border border-neutral-200 bg-white px-2 py-2 text-xs outline-none focus:border-neutral-950"
                                >
                                  {COLLECTION_PHOTO_CARD_VARIANTS.map((variant) => (
                                    <option key={variant} value={variant}>
                                      {variant}
                                    </option>
                                  ))}
                                </select>
                                <span className="mt-1 block text-[10px] leading-4 text-neutral-400">
                                  일반 사용자에게는 표시되지 않고 정렬에만 사용됩니다.
                                </span>
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
                                    getTradeItemImageUrl(
                                      item.image_path,
                                      editingItemName || item.item_name,
                                      editingItemImageRatio,
                                    )
                                  }
                                  alt={editingItemName || editingItemWorkTitle || '굿즈'}
                                  className="h-16 w-16 rounded-xl bg-white object-contain p-1 ring-1 ring-neutral-200"
                                />

                                <span className="min-w-0 flex-1 text-[10px] leading-4 text-neutral-400">
                                  이미지가 없는 텍스트 굿즈에도 나중에 이미지를 추가할 수 있습니다.
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
                              {item.work_title || item.item_name || (visibleWorks.length > 1 ? '행사 공통' : '')}
                            </p>

                            {item.work_title && item.item_name ? (
                              <p className="mt-0.5 line-clamp-1 text-[10px] font-bold text-neutral-400">
                                {item.item_name}
                              </p>
                            ) : null}

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
                  선택한 조건에 맞는 굿즈가 없습니다.
                </p>
              </div>
            )
          ) : (
            <div className="mt-5 rounded-2xl bg-neutral-50 px-4 py-10 text-center">
              <p className="text-sm font-bold text-neutral-400">
                아직 등록된 굿즈가 없습니다.
              </p>
            </div>
          )}
        </section>
      </section>
    </main>
  );
}
