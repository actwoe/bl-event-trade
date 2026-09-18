"use client";

import Link from "next/link";
import { useEffect, useMemo, useState } from "react";
import { useRouter } from "next/navigation";
import { AppBottomNav } from "@/components/ui/AppBottomNav";
import { AppFrame } from "@/components/ui/AppFrame";
import { AppTopBar } from "@/components/ui/AppTopBar";
import { TradeBuilder } from "@/components/trade/TradeBuilder";
import { getTradeAssetUrl, supabase } from "@/lib/supabase";
import { getTradeItemImageUrl } from "@/lib/trade-item-image";
import {
  categoryRowsToOptions,
  createCategoryOptionMap,
  getFallbackCategoryLabel,
  getFallbackCategorySortOrder,
  TradeItemCategoryRow,
} from "@/lib/trade-item-categories";
import {
  createBenefitSubcategoryOrderMap,
  getBenefitSubcategorySortOrder,
} from "@/lib/trade-benefit-subcategory-order";
import { MAX_TRADE_GROUPS } from "@/lib/trade-groups";
import {
  RegisteredTradeItem,
  TradeCategory,
  TradeCollectionSummary,
  TradeImageRatio,
  TradeReferenceImage,
} from "@/lib/trade-types";

type AuthState = "checking" | "signed-in" | "signed-out";

type CollectionRow = {
  id: string;
  slug: string;
  title: string;
  description: string | null;
  event_start_date: string | null;
  event_end_date: string | null;
  event_location: string | null;
  reference_section_enabled: boolean | null;
  reference_section_title: string | null;
  sort_order: number | null;
};

type SavedGroupSummary = {
  id: string;
  collection_id: string | null;
  name: string;
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
  sort_order: number | null;
  image_ratio: TradeImageRatio | null;
  benefit_subcategory: string | null;
};

type TradeBenefitSubcategoryRow = {
  collection_id: string;
  name: string;
  sort_order: number | null;
};

type TradeReferenceImageRow = {
  id: string;
  collection_id: string;
  image_path: string;
  sort_order: number | null;
};

type EditorData = {
  collection: TradeCollectionSummary;
  collections: TradeCollectionSummary[];
  registeredItems: RegisteredTradeItem[];
  referenceImages: TradeReferenceImage[];
};

function getSafeImageRatio(value?: string | null): TradeImageRatio {
  return value === "photocard" ? "photocard" : "square";
}

function getGlobalCollection(): TradeCollectionSummary {
  return {
    id: "__global_trade_board__",
    slug: "my-trades",
    title: "통합 교환/양도판",
    description: "굿즈를 추가할 때 행사를 골라 여러 행사의 굿즈를 한 교환판에 담을 수 있습니다.",
    referenceSectionEnabled: false,
    referenceSectionTitle: null,
  };
}

export default function MyTradesPage() {
  const router = useRouter();
  const [authState, setAuthState] = useState<AuthState>("checking");
  const [groups, setGroups] = useState<SavedGroupSummary[]>([]);
  const [activeGroupId, setActiveGroupId] = useState("");
  const [editorData, setEditorData] = useState<EditorData | null>(null);
  const [isLoading, setIsLoading] = useState(true);
  const [message, setMessage] = useState("");

  useEffect(() => {
    let isMounted = true;

    async function loadPageData() {
      const { data: sessionData } = await supabase.auth.getSession();
      const user = sessionData.session?.user;

      if (!isMounted) return;

      if (!user) {
        setAuthState("signed-out");
        setIsLoading(false);
        return;
      }

      setAuthState("signed-in");

      const [groupResult, collectionResult] = await Promise.all([
        supabase
          .from("trade_groups")
          .select("id, collection_id, name, created_at")
          .eq("user_id", user.id)
          .order("created_at", { ascending: true }),
        supabase
          .from("trade_collections")
          .select(
            "id, slug, title, description, event_start_date, event_end_date, event_location, reference_section_enabled, reference_section_title, sort_order",
          )
          .eq("is_public", true)
          .order("sort_order", { ascending: true })
          .order("title", { ascending: true }),
      ]);

      if (!isMounted) return;

      if (groupResult.error) {
        console.error(groupResult.error);
        setMessage("저장한 교환판을 불러오지 못했습니다.");
      }

      if (collectionResult.error) {
        console.error(collectionResult.error);
        setMessage("행사 목록을 불러오지 못했습니다.");
      }

      const nextGroups = (groupResult.data ?? []) as SavedGroupSummary[];
      const collectionRows = (collectionResult.data ?? []) as CollectionRow[];
      setGroups(nextGroups);

      const requestedGroupId = new URLSearchParams(window.location.search).get(
        "group",
      );
      const initialGroup =
        nextGroups.find((group) => group.id === requestedGroupId) ??
        nextGroups[0] ??
        null;
      setActiveGroupId(initialGroup?.id ?? "");

      const collectionIds = collectionRows.map((collection) => collection.id);
      if (collectionIds.length === 0) {
        setEditorData({
          collection: getGlobalCollection(),
          collections: [],
          registeredItems: [],
          referenceImages: [],
        });
        setIsLoading(false);
        return;
      }

      const [itemResult, referenceResult, subcategoryResult, categoryResult] =
        await Promise.all([
          supabase
            .from("trade_items")
            .select(
              "id, collection_id, category, work_title, item_name, show_item_name, image_path, sort_order, image_ratio, benefit_subcategory",
            )
            .in("collection_id", collectionIds)
            .eq("is_visible", true)
            .order("created_at", { ascending: true }),
          supabase
            .from("trade_reference_images")
            .select("id, collection_id, image_path, sort_order")
            .in("collection_id", collectionIds)
            .order("sort_order", { ascending: true })
            .order("created_at", { ascending: true }),
          supabase
            .from("trade_benefit_subcategories")
            .select("collection_id, name, sort_order")
            .in("collection_id", collectionIds)
            .eq("is_visible", true)
            .order("sort_order", { ascending: true })
            .order("name", { ascending: true }),
          supabase
            .from("trade_item_categories")
            .select(
              "collection_id, category_key, label, category_kind, is_visible, sort_order",
            )
            .in("collection_id", collectionIds)
            .eq("is_visible", true)
            .order("sort_order", { ascending: true })
            .order("created_at", { ascending: true }),
        ]);

      if (!isMounted) return;

      if (itemResult.error) console.error(itemResult.error);
      if (referenceResult.error) console.error(referenceResult.error);
      if (subcategoryResult.error) console.error(subcategoryResult.error);
      if (categoryResult.error) console.error(categoryResult.error);

      const categoryRows = (categoryResult.data ?? []) as TradeItemCategoryRow[];
      const categoryOptionsByCollection = new Map(
        collectionIds.map((collectionId) => [
          collectionId,
          categoryRowsToOptions(
            categoryRows.filter((row) => row.collection_id === collectionId),
          ),
        ]),
      );

      const collections: TradeCollectionSummary[] = collectionRows.map((row) => ({
        id: row.id,
        slug: row.slug,
        title: row.title,
        description: row.description,
        eventStartDate: row.event_start_date,
        eventEndDate: row.event_end_date,
        location: row.event_location,
        referenceSectionEnabled: row.reference_section_enabled === true,
        referenceSectionTitle: row.reference_section_title,
        categoryOptions: categoryResult.error
          ? undefined
          : categoryOptionsByCollection.get(row.id) ?? [],
        sortOrder: row.sort_order ?? 0,
      }));
      const collectionMap = new Map(collections.map((row) => [row.id, row]));

      const subcategoryRows = (subcategoryResult.data ?? []) as TradeBenefitSubcategoryRow[];
      const subcategoryOrderByCollection = new Map(
        collectionIds.map((collectionId) => [
          collectionId,
          createBenefitSubcategoryOrderMap(
            subcategoryRows.filter((row) => row.collection_id === collectionId),
          ),
        ]),
      );

      const registeredItems: RegisteredTradeItem[] = (
        (itemResult.data ?? []) as TradeItemRow[]
      ).flatMap((item) => {
        const collection = collectionMap.get(item.collection_id);
        if (!collection) return [];

        const categoryOptions = categoryOptionsByCollection.get(item.collection_id);
        const categoryOption = createCategoryOptionMap(categoryOptions).get(
          item.category,
        );

        return [
          {
            id: item.id,
            category: item.category,
            categoryLabel:
              categoryOption?.label ?? getFallbackCategoryLabel(item.category),
            categorySortOrder:
              categoryOption?.sortOrder ??
              getFallbackCategorySortOrder(item.category),
            categoryKind: categoryOption?.kind,
            workTitle: item.work_title,
            itemName: item.item_name || "",
            showItemName: item.show_item_name === true,
            imageUrl: getTradeItemImageUrl(
              item.image_path,
              item.item_name,
              getSafeImageRatio(item.image_ratio),
            ),
            sortOrder: item.sort_order ?? 0,
            catalogOrder: item.sort_order ?? 0,
            imageRatio: getSafeImageRatio(item.image_ratio),
            benefitSubcategory: item.benefit_subcategory ?? null,
            benefitSubcategorySortOrder: getBenefitSubcategorySortOrder(
              subcategoryOrderByCollection.get(item.collection_id) ?? new Map(),
              item.benefit_subcategory,
            ),
            collectionId: collection.id,
            collectionTitle: collection.title,
            collectionSortOrder: collection.sortOrder ?? 0,
          },
        ];
      });

      const referenceImages: TradeReferenceImage[] = (
        (referenceResult.data ?? []) as TradeReferenceImageRow[]
      )
        .filter((image) => image.image_path)
        .map((image) => ({
          id: image.id,
          imageUrl: getTradeAssetUrl(image.image_path),
          sortOrder: image.sort_order ?? 0,
          collectionId: image.collection_id,
        }));

      setEditorData({
        collection: getGlobalCollection(),
        collections,
        registeredItems,
        referenceImages,
      });
      setIsLoading(false);
    }

    void loadPageData();

    return () => {
      isMounted = false;
    };
  }, []);

  const activeGroup = useMemo(
    () => groups.find((group) => group.id === activeGroupId) ?? null,
    [activeGroupId, groups],
  );

  function updateUrl(groupId?: string) {
    const nextUrl = new URL(window.location.href);
    nextUrl.searchParams.delete("collection");
    if (groupId) nextUrl.searchParams.set("group", groupId);
    else nextUrl.searchParams.delete("group");
    window.history.replaceState({}, "", nextUrl);
  }

  function selectGroup(groupId: string) {
    if (groupId === activeGroupId) return;
    setActiveGroupId(groupId);
    updateUrl(groupId);
  }

  function startFreshBoard() {
    if (!activeGroupId && groups.length < MAX_TRADE_GROUPS) return;
    setActiveGroupId("");
    updateUrl();
  }

  function handleSavedGroupChange(group: {
    id: string;
    name: string;
    collectionId: string | null;
  }) {
    setGroups((current) => {
      const existing = current.find((item) => item.id === group.id);
      if (existing) {
        return current.map((item) =>
          item.id === group.id
            ? { ...item, name: group.name, collection_id: group.collectionId }
            : item,
        );
      }

      return [
        ...current,
        {
          id: group.id,
          collection_id: group.collectionId,
          name: group.name,
          created_at: new Date().toISOString(),
        },
      ];
    });
    setActiveGroupId(group.id);
    updateUrl(group.id);
  }

  async function handleLogout() {
    await supabase.auth.signOut();
    router.push("/");
    router.refresh();
  }

  if (authState === "checking" || isLoading) {
    return (
      <AppFrame>
        <AppTopBar title="내 교환/양도판" backHref="/" />
        <div className="flex min-h-0 flex-1 items-center justify-center px-6 text-sm text-neutral-500">
          저장한 교환판과 행사 목록을 불러오는 중입니다.
        </div>
        <AppBottomNav active="trades" />
      </AppFrame>
    );
  }

  if (authState === "signed-out") {
    return (
      <AppFrame>
        <AppTopBar title="내 교환/양도판" backHref="/" />
        <div className="min-h-0 flex-1 overflow-y-auto p-5">
          <section className="rounded-3xl border border-dashed border-neutral-200 bg-neutral-50 px-5 py-12 text-center">
            <h1 className="text-xl font-black text-neutral-950">로그인이 필요합니다</h1>
            <p className="mt-2 text-sm leading-6 text-neutral-500">
              교환판은 로그인한 사용자만 최대 {MAX_TRADE_GROUPS}개까지 저장하고 불러올 수 있습니다.
            </p>
            <Link
              href="/login?next=/my-trades"
              className="mt-6 inline-flex rounded-2xl bg-neutral-950 px-5 py-3 text-sm font-black text-white"
            >
              로그인
            </Link>
          </section>
        </div>
        <AppBottomNav active="trades" />
      </AppFrame>
    );
  }

  return (
    <AppFrame>
      <AppTopBar
        title="내 교환/양도판"
        backHref="/"
        onAccountClick={handleLogout}
        accountLabel="로그아웃"
      />

      <div className="min-h-0 flex-1 overflow-x-hidden overflow-y-auto overscroll-contain">
        <section className="border-b border-neutral-100 bg-white px-5 py-4">
          <p className="text-[12px] font-black tracking-[0.04em] text-[#7C5CFC]">
            BL GOODS TRADE
          </p>
          <h2 className="mt-1 text-[24px] font-black leading-tight tracking-[-0.03em] text-neutral-950">
            내 교환/양도판
          </h2>
          <p className="mt-2 text-sm leading-6 text-neutral-500">
            한 계정당 교환판은 최대 {MAX_TRADE_GROUPS}개입니다. 굿즈를 추가할 때 행사를 선택해 서로 다른 행사 굿즈도 한 판에 담을 수 있습니다.
          </p>
        </section>

        <div className="sticky top-0 z-20 border-b border-neutral-100 bg-white/95 px-4 py-3 backdrop-blur">
          <div className="mb-2 flex items-center justify-between gap-3">
            <p className="text-xs font-black text-neutral-700">내 교환판</p>
            <span className="rounded-full bg-neutral-100 px-2.5 py-1 text-[11px] font-black text-neutral-500">
              {groups.length}/{MAX_TRADE_GROUPS}
            </span>
          </div>

          <div className="flex items-center gap-2 overflow-x-auto pb-1 [scrollbar-width:none] [&::-webkit-scrollbar]:hidden">
            {groups.map((group, index) => {
              const active = group.id === activeGroupId;
              return (
                <button
                  key={group.id}
                  type="button"
                  onClick={() => selectGroup(group.id)}
                  className={
                    active
                      ? "shrink-0 rounded-full bg-neutral-950 px-4 py-2.5 text-xs font-black text-white"
                      : "shrink-0 rounded-full border border-neutral-200 bg-white px-4 py-2.5 text-xs font-bold text-neutral-500"
                  }
                >
                  {index + 1}. {group.name}
                </button>
              );
            })}

            {groups.length < MAX_TRADE_GROUPS ? (
              <button
                type="button"
                onClick={startFreshBoard}
                className={
                  activeGroupId
                    ? "shrink-0 rounded-full border border-dashed border-neutral-300 bg-white px-4 py-2.5 text-xs font-black text-neutral-500"
                    : "shrink-0 rounded-full bg-[#F1EDFF] px-4 py-2.5 text-xs font-black text-[#7C5CFC] ring-1 ring-[#DED5FF]"
                }
              >
                + 새 교환판
              </button>
            ) : null}
          </div>
        </div>

        {message ? (
          <p className="mx-5 mt-4 rounded-2xl bg-neutral-100 px-4 py-3 text-sm leading-6 text-neutral-700">
            {message}
          </p>
        ) : null}

        {editorData && editorData.collections.length > 0 ? (
          <TradeBuilder
            key={`${activeGroupId || "new"}:${activeGroup?.name ?? ""}`}
            collection={editorData.collection}
            collectionOptions={editorData.collections}
            registeredItems={editorData.registeredItems}
            referenceImages={editorData.referenceImages}
            initialGroupId={activeGroupId}
            embedded
            globalGroupMode
            onSavedGroupChange={handleSavedGroupChange}
          />
        ) : (
          <div className="p-5">
            <div className="rounded-3xl border border-dashed border-neutral-200 bg-neutral-50 px-5 py-12 text-center">
              <p className="text-sm font-bold text-neutral-500">
                현재 선택할 수 있는 공개 행사가 없습니다.
              </p>
              <Link
                href="/"
                className="mt-5 inline-flex rounded-2xl bg-neutral-950 px-5 py-3 text-xs font-black text-white"
              >
                메인으로 이동
              </Link>
            </div>
          </div>
        )}
      </div>

      <AppBottomNav active="trades" />
    </AppFrame>
  );
}
