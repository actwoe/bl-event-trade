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
  addBenefitSubcategoryItemOrderFallback,
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
};

type CollectionOption = Pick<CollectionRow, "id" | "slug" | "title">;

type SavedGroupSummary = {
  id: string;
  collection_id: string;
  name: string;
  created_at: string;
};

type TradeItemRow = {
  id: string;
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
  name: string;
  sort_order: number | null;
};

type TradeReferenceImageRow = {
  id: string;
  image_path: string;
  sort_order: number | null;
};

type EditorData = {
  collection: TradeCollectionSummary;
  registeredItems: RegisteredTradeItem[];
  referenceImages: TradeReferenceImage[];
};

function getSafeImageRatio(value?: string | null): TradeImageRatio {
  return value === "photocard" ? "photocard" : "square";
}

export default function MyTradesPage() {
  const router = useRouter();
  const [authState, setAuthState] = useState<AuthState>("checking");
  const [groups, setGroups] = useState<SavedGroupSummary[]>([]);
  const [collections, setCollections] = useState<CollectionOption[]>([]);
  const [selectedCollectionId, setSelectedCollectionId] = useState("");
  const [activeGroupId, setActiveGroupId] = useState("");
  const [editorData, setEditorData] = useState<EditorData | null>(null);
  const [isLoadingGroups, setIsLoadingGroups] = useState(true);
  const [isLoadingEditor, setIsLoadingEditor] = useState(false);
  const [editorError, setEditorError] = useState("");
  const [editorRetry, setEditorRetry] = useState(0);
  const [message, setMessage] = useState("");
  const [view, setView] = useState<"manage" | "edit">("manage");
  const [isDeletingGroupId, setIsDeletingGroupId] = useState("");

  useEffect(() => {
    let isMounted = true;

    async function loadPageData() {
      const { data: sessionData } = await supabase.auth.getSession();
      const user = sessionData.session?.user;

      if (!isMounted) return;

      if (!user) {
        setAuthState("signed-out");
        setIsLoadingGroups(false);
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
          .select("id, slug, title")
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
      const nextCollections = (collectionResult.data ?? []) as CollectionOption[];
      setGroups(nextGroups);
      setCollections(nextCollections);

      const params = new URLSearchParams(window.location.search);
      const requestedGroupId = params.get("group");
      if (requestedGroupId || params.get("collection")) setView("edit");
      const requestedCollectionId = params.get("collection");
      const requestedGroup = nextGroups.find(
        (group) => group.id === requestedGroupId,
      );
      const requestedCollection = nextCollections.find(
        (collection) => collection.id === requestedCollectionId,
      );
      const firstSavedCollection = nextCollections.find((collection) =>
        nextGroups.some((group) => group.collection_id === collection.id),
      );
      const initialCollection =
        requestedCollection ??
        nextCollections.find(
          (collection) => collection.id === requestedGroup?.collection_id,
        ) ??
        firstSavedCollection ??
        nextCollections[0];

      const initialCollectionId = initialCollection?.id ?? "";
      const initialGroup =
        requestedGroup?.collection_id === initialCollectionId
          ? requestedGroup
          : nextGroups.find(
              (group) => group.collection_id === initialCollectionId,
            );

      setSelectedCollectionId(initialCollectionId);
      setActiveGroupId(initialGroup?.id ?? "");
      setIsLoadingGroups(false);
    }

    void loadPageData();

    return () => {
      isMounted = false;
    };
  }, []);

  const selectedCollection = useMemo(
    () =>
      collections.find((collection) => collection.id === selectedCollectionId) ??
      null,
    [collections, selectedCollectionId],
  );

  const groupsForSelectedCollection = useMemo(
    () => groups.filter((group) => group.collection_id === selectedCollectionId),
    [groups, selectedCollectionId],
  );

  const activeGroup = useMemo(
    () =>
      groupsForSelectedCollection.find((group) => group.id === activeGroupId) ??
      null,
    [activeGroupId, groupsForSelectedCollection],
  );

  useEffect(() => {
    let isMounted = true;

    async function loadEditor() {
      if (view !== "edit" || !selectedCollectionId) {
        setIsLoadingEditor(false);
        return;
      }

      setIsLoadingEditor(true);
      setEditorError("");
      setMessage("");
      try {

      const [
        collectionResult,
        itemResult,
        referenceResult,
        subcategoryResult,
        categoryResult,
      ] = await Promise.race([
        Promise.all([
        supabase
          .from("trade_collections")
          .select(
            "id, slug, title, description, event_start_date, event_end_date, event_location, reference_section_enabled, reference_section_title",
          )
          .eq("id", selectedCollectionId)
          .eq("is_public", true)
          .maybeSingle(),
        supabase
          .from("trade_items")
          .select(
            "id, category, work_title, item_name, show_item_name, image_path, sort_order, image_ratio, benefit_subcategory",
          )
          .eq("collection_id", selectedCollectionId)
          .eq("is_visible", true)
          .order("created_at", { ascending: true }),
        supabase
          .from("trade_reference_images")
          .select("id, image_path, sort_order")
          .eq("collection_id", selectedCollectionId)
          .order("sort_order", { ascending: true })
          .order("created_at", { ascending: true }),
        supabase
          .from("trade_benefit_subcategories")
          .select("name, sort_order")
          .eq("collection_id", selectedCollectionId)
          .eq("is_visible", true)
          .order("sort_order", { ascending: true })
          .order("name", { ascending: true }),
        supabase
          .from("trade_item_categories")
          .select("category_key, label, category_kind, is_visible, sort_order")
          .eq("collection_id", selectedCollectionId)
          .eq("is_visible", true)
          .order("sort_order", { ascending: true })
          .order("created_at", { ascending: true }),
        ]),
        new Promise<never>((_, reject) => {
          setTimeout(() => reject(new Error("교환판 조회 시간 초과")), 15000);
        }),
      ]);

      if (!isMounted) return;

      if (collectionResult.error || !collectionResult.data) {
        if (collectionResult.error) console.error(collectionResult.error);
        setEditorData(null);
        setEditorError("행사 정보를 불러오지 못했습니다. 행사가 공개 상태인지 확인해 주세요.");
        return;
      }

      if (itemResult.error) console.error(itemResult.error);
      if (referenceResult.error) console.error(referenceResult.error);
      if (subcategoryResult.error) console.error(subcategoryResult.error);
      if (categoryResult.error) console.error(categoryResult.error);

      const categoryOptions = categoryResult.error
        ? undefined
        : categoryRowsToOptions(
            (categoryResult.data ?? []) as TradeItemCategoryRow[],
          );
      const categoryOptionMap = createCategoryOptionMap(categoryOptions);

      const collectionRow = collectionResult.data as CollectionRow;
      const collection: TradeCollectionSummary = {
        id: collectionRow.id,
        slug: collectionRow.slug,
        title: collectionRow.title,
        description: collectionRow.description,
        eventStartDate: collectionRow.event_start_date,
        eventEndDate: collectionRow.event_end_date,
        location: collectionRow.event_location,
        referenceSectionEnabled:
          collectionRow.reference_section_enabled === true,
        referenceSectionTitle: collectionRow.reference_section_title,
        categoryOptions,
      };

      const itemRows = (itemResult.data ?? []) as TradeItemRow[];
      const benefitSubcategoryOrderMap = createBenefitSubcategoryOrderMap(
        (subcategoryResult.data ?? []) as TradeBenefitSubcategoryRow[],
      );
      addBenefitSubcategoryItemOrderFallback(
        benefitSubcategoryOrderMap,
        itemRows,
      );

      const registeredItems: RegisteredTradeItem[] = itemRows
        .filter(
          (item) => categoryResult.error || categoryOptionMap.has(item.category),
        )
        .map((item, catalogOrder) => {
          const categoryOption = categoryOptionMap.get(item.category);

          return {
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
            catalogOrder,
            imageRatio: getSafeImageRatio(item.image_ratio),
            benefitSubcategory: item.benefit_subcategory ?? null,
            benefitSubcategorySortOrder: getBenefitSubcategorySortOrder(
              benefitSubcategoryOrderMap,
              item.benefit_subcategory,
            ),
          };
        });

      const referenceImages: TradeReferenceImage[] = (
        (referenceResult.data ?? []) as TradeReferenceImageRow[]
      )
        .filter((image) => image.image_path)
        .map((image) => ({
          id: image.id,
          imageUrl: getTradeAssetUrl(image.image_path),
          sortOrder: image.sort_order ?? 0,
        }));

      setEditorData({ collection, registeredItems, referenceImages });
      } catch (error) {
        console.error("교환판 편집 데이터 로딩 실패", error);
        if (isMounted) {
          setEditorData(null);
          setEditorError("교환판 편집 정보를 불러오는 중 문제가 발생했습니다. 다시 시도해 주세요.");
        }
      } finally {
        if (isMounted) setIsLoadingEditor(false);
      }
    }

    void loadEditor();

    return () => {
      isMounted = false;
    };
  }, [selectedCollectionId, view, editorRetry]);

  function updateUrl(collectionId: string, groupId?: string) {
    const nextUrl = new URL(window.location.href);
    nextUrl.searchParams.set("collection", collectionId);

    if (groupId) {
      nextUrl.searchParams.set("group", groupId);
    } else {
      nextUrl.searchParams.delete("group");
    }

    window.history.replaceState({}, "", nextUrl);
  }

  function selectCollection(collectionId: string) {
    if (collectionId === selectedCollectionId) return;

    const firstGroup = groups.find(
      (group) => group.collection_id === collectionId,
    );

    setSelectedCollectionId(collectionId);
    setActiveGroupId(firstGroup?.id ?? "");
    setEditorData(null);
    updateUrl(collectionId, firstGroup?.id);
  }

  function selectGroup(groupId: string) {
    if (groupId === activeGroupId) return;

    setActiveGroupId(groupId);
    updateUrl(selectedCollectionId, groupId);
  }

  function startFreshBoard() {
    setActiveGroupId("");
    updateUrl(selectedCollectionId);
  }

  function handleSavedGroupChange(group: {
    id: string;
    name: string;
    collectionId: string;
  }) {
    setGroups((current) => {
      const existing = current.find((item) => item.id === group.id);

      if (existing) {
        return current.map((item) =>
          item.id === group.id ? { ...item, name: group.name } : item,
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

    setSelectedCollectionId(group.collectionId);
    setActiveGroupId(group.id);
    updateUrl(group.collectionId, group.id);
  }

  function openSavedBoard(group: SavedGroupSummary) {
    const matchingCollection = collections.find(
      (collection) => collection.id === group.collection_id,
    );
    if (!matchingCollection) {
      setMessage("현재 공개되지 않은 행사의 교환판은 수정할 수 없습니다.");
      return;
    }
    setMessage("");
    setSelectedCollectionId(matchingCollection.id);
    setActiveGroupId(group.id);
    setEditorData(null);
    setView("edit");
    updateUrl(matchingCollection.id, group.id);
  }

  function openNewBoard() {
    if (groups.length >= MAX_TRADE_GROUPS) {
      setMessage(`저장 가능한 교환판은 최대 ${MAX_TRADE_GROUPS}개입니다. 기존 교환판을 삭제한 후 새로 만들어 주세요.`);
      return;
    }
    if (!selectedCollectionId) {
      setMessage("현재 새 교환판을 만들 수 있는 공개 행사가 없습니다.");
      return;
    }
    setMessage("");
    setActiveGroupId("");
    setView("edit");
    updateUrl(selectedCollectionId);
  }

  function backToManagement() {
    setView("manage");
    setMessage("");
    window.history.replaceState({}, "", "/my-trades");
  }

  async function deleteSavedBoard(group: SavedGroupSummary) {
    if (!window.confirm(`‘${group.name}’ 교환판을 삭제할까요? 삭제한 교환판은 복구할 수 없습니다.`)) return;
    setIsDeletingGroupId(group.id);
    setMessage("");
    try {
      const { data: userData, error: authError } = await supabase.auth.getUser();
      if (authError || !userData.user) throw authError ?? new Error("로그인이 필요합니다.");
      const { data, error } = await supabase
        .from("trade_groups")
        .delete()
        .eq("id", group.id)
        .eq("user_id", userData.user.id)
        .select("id");
      if (error) throw error;
      if (!data?.some((deleted) => deleted.id === group.id)) {
        throw new Error("교환판 삭제 권한을 확인해 주세요.");
      }
      setGroups((current) => current.filter((saved) => saved.id !== group.id));
      if (activeGroupId === group.id) {
        setActiveGroupId("");
        setEditorData(null);
      }
      setView("manage");
      window.history.replaceState({}, "", "/my-trades");
      setMessage("교환판을 삭제했습니다.");
    } catch (error) {
      console.error(error);
      setMessage("교환판을 삭제하지 못했습니다. 로그인 상태와 삭제 권한을 확인해 주세요.");
    } finally {
      setIsDeletingGroupId("");
    }
  }

  async function handleLogout() {
    await supabase.auth.signOut();
    router.push("/");
    router.refresh();
  }

  if (authState === "checking" || isLoadingGroups) {
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
            <h1 className="text-xl font-black text-neutral-950">
              로그인이 필요합니다
            </h1>
            <p className="mt-2 text-sm leading-6 text-neutral-500">
              교환판 그룹은 로그인한 사용자만 저장하고 불러올 수 있습니다.
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
            작품과 행사에 관계없이 저장한 교환판을 한곳에서 관리할 수 있습니다.
          </p>
        </section>

        {view === "manage" ? (
          <section className="space-y-4 px-4 py-5">
            <div className="rounded-2xl border border-neutral-200 bg-white p-4">
              <div className="flex items-center justify-between gap-3">
                <p className="text-sm font-black text-neutral-900">저장한 교환판</p>
                <span className="rounded-full bg-[#F1EDFF] px-3 py-1 text-xs font-black text-[#7C5CFC]">
                  {groups.length} / {MAX_TRADE_GROUPS}개
                </span>
              </div>
              <p className="mt-2 text-xs leading-5 text-neutral-500">
                모든 작품의 교환판을 확인하고 수정하거나 삭제할 수 있습니다.
              </p>
            </div>
            {message ? (
              <p role="status" className="rounded-xl bg-neutral-100 px-4 py-3 text-sm text-neutral-700">{message}</p>
            ) : null}
            {groups.length === 0 ? (
              <div className="rounded-2xl border border-dashed border-neutral-200 p-7 text-center text-sm text-neutral-500">
                아직 저장된 교환판이 없습니다.
              </div>
            ) : (
              <div className="space-y-3">
                {groups.map((group) => {
                  const collection = collections.find((item) => item.id === group.collection_id);
                  return (
                    <article key={group.id} className="rounded-2xl border border-neutral-200 bg-white p-4">
                      <p className="text-xs font-bold text-[#7C5CFC]">{collection?.title ?? "현재 비공개된 행사"}</p>
                      <h3 className="mt-1 break-words text-base font-black text-neutral-950">{group.name}</h3>
                      <p className="mt-1 text-xs text-neutral-400">저장일 {new Date(group.created_at).toLocaleDateString("ko-KR")}</p>
                      <div className="mt-4 flex gap-2">
                        <button type="button" onClick={() => openSavedBoard(group)} disabled={!collection}
                          className="min-w-0 flex-1 rounded-xl bg-neutral-950 px-3 py-2.5 text-sm font-black text-white disabled:cursor-not-allowed disabled:opacity-40">
                          열기 · 수정
                        </button>
                        <button type="button" onClick={() => void deleteSavedBoard(group)} disabled={Boolean(isDeletingGroupId)}
                          className="rounded-xl border border-red-200 px-4 py-2.5 text-sm font-bold text-red-600 disabled:opacity-40">
                          {isDeletingGroupId === group.id ? "삭제 중" : "삭제"}
                        </button>
                      </div>
                    </article>
                  );
                })}
              </div>
            )}
            <div className="rounded-2xl border border-neutral-200 bg-neutral-50 p-4">
              <p className="text-sm font-black text-neutral-900">새 교환판 만들기</p>
              {groups.length >= MAX_TRADE_GROUPS ? (
                <p className="mt-2 text-xs leading-5 text-neutral-600">
                  최대 {MAX_TRADE_GROUPS}개를 저장했습니다. 위 목록에서 사용하지 않는 교환판을 삭제하면 새로 만들 수 있습니다.
                </p>
              ) : (
                <>
                  <label className="mt-3 block text-xs font-bold text-neutral-700" htmlFor="new-trade-collection">행사 선택</label>
                  <select id="new-trade-collection" value={selectedCollectionId}
                    onChange={(event) => selectCollection(event.target.value)}
                    className="mt-1 w-full rounded-xl border border-neutral-200 bg-white px-3 py-2.5 text-sm text-neutral-700">
                    {collections.map((collection) => <option key={collection.id} value={collection.id}>{collection.title}</option>)}
                  </select>
                </>
              )}
              <button type="button" disabled={groups.length >= MAX_TRADE_GROUPS || collections.length === 0}
                onClick={openNewBoard}
                className="mt-3 w-full rounded-xl bg-neutral-950 px-4 py-3 text-sm font-black text-white disabled:cursor-not-allowed disabled:bg-neutral-300">
                + 새 교환판
              </button>
            </div>
          </section>
        ) : collections.length > 0 ? (
          <> 
            <div className="border-b border-neutral-100 bg-white px-4 py-3">
              <button type="button" onClick={backToManagement} className="text-sm font-black text-[#7C5CFC]">
                ← 전체 교환판 관리로 돌아가기
              </button>
            </div>
            <div className="sticky top-0 z-20 space-y-3 border-b border-neutral-100 bg-white/95 px-4 py-3 backdrop-blur">
              <label className="block">
                <span className="text-xs font-black text-neutral-700">행사 선택</span>
                <select
                  value={selectedCollectionId}
                  onChange={(event) => selectCollection(event.target.value)}
                  className="mt-1 w-full rounded-xl border border-neutral-200 bg-white px-3 py-2.5 text-sm font-bold text-neutral-700 outline-none focus:border-neutral-950"
                >
                  {collections.map((collection) => (
                    <option key={collection.id} value={collection.id}>
                      {collection.title}
                    </option>
                  ))}
                </select>
              </label>

              <div>
                <div className="mb-2 flex items-center justify-between gap-3">
                  <p className="text-xs font-black text-neutral-700">
                    {selectedCollection?.title ?? "선택한 행사"} 저장 그룹
                  </p>
                  <span className="rounded-full bg-neutral-100 px-2.5 py-1 text-[11px] font-black text-neutral-500">
                    전체 {groups.length}/{MAX_TRADE_GROUPS}
                  </span>
                </div>

                <div className="flex items-center gap-2 overflow-x-auto pb-1 [scrollbar-width:none] [&::-webkit-scrollbar]:hidden">
                  {groupsForSelectedCollection.map((group) => {
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
                        {group.name}
                      </button>
                    );
                  })}

                  <button
                    type="button"
                    onClick={groups.length >= MAX_TRADE_GROUPS ? backToManagement : startFreshBoard}
                    className={
                      activeGroupId
                        ? "shrink-0 rounded-full border border-dashed border-neutral-300 bg-white px-4 py-2.5 text-xs font-black text-neutral-500"
                        : "shrink-0 rounded-full bg-neutral-950 px-4 py-2.5 text-xs font-black text-white"
                    }
                  >
                    {groups.length >= MAX_TRADE_GROUPS ? "저장 공간 관리" : "+ 새 교환판"}
                  </button>
                </div>
              </div>
            </div>

            {message ? (
              <p className="mx-5 mt-4 rounded-2xl bg-neutral-100 px-4 py-3 text-sm leading-6 text-neutral-700">
                {message}
              </p>
            ) : null}

            {isLoadingEditor ? (
              <div className="p-6 text-center text-sm text-neutral-400">
                교환판 편집 화면을 불러오는 중입니다.
              </div>
            ) : !editorData ? (
              <div className="space-y-3 p-6 text-center">
                <p role="alert" className="text-sm text-red-600">
                  {editorError || "교환판 편집 정보를 표시할 수 없습니다."}
                </p>
                <button type="button" onClick={() => setEditorRetry((count) => count + 1)}
                  className="rounded-xl bg-neutral-950 px-5 py-3 text-sm font-bold text-white">
                  다시 시도
                </button>
              </div>
            ) : (
              <TradeBuilder
                key={`${selectedCollectionId}:${activeGroupId || "new"}:${activeGroup?.name ?? ""}`}
                collection={editorData.collection}
                registeredItems={editorData.registeredItems}
                referenceImages={editorData.referenceImages}
                initialGroupId={activeGroupId}
                embedded
                onSavedGroupChange={handleSavedGroupChange}
              />
            )}
          </>
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
