"use client";

import Link from "next/link";
import { useEffect, useMemo, useState } from "react";
import { useRouter } from "next/navigation";
import { AppBottomNav } from "@/components/ui/AppBottomNav";
import { AppFrame } from "@/components/ui/AppFrame";
import { AppTopBar } from "@/components/ui/AppTopBar";
import { TradeBuilder } from "@/components/trade/TradeBuilder";
import { getTradeAssetUrl, supabase } from "@/lib/supabase";
import {
  addBenefitSubcategoryItemOrderFallback,
  createBenefitSubcategoryOrderMap,
  getBenefitSubcategorySortOrder,
} from "@/lib/trade-benefit-subcategory-order";
import { MAX_TRADE_GROUPS, TradeGroupRow } from "@/lib/trade-groups";
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
  const [groups, setGroups] = useState<TradeGroupRow[]>([]);
  const [activeGroupId, setActiveGroupId] = useState("");
  const [editorData, setEditorData] = useState<EditorData | null>(null);
  const [isLoadingGroups, setIsLoadingGroups] = useState(true);
  const [isLoadingEditor, setIsLoadingEditor] = useState(false);
  const [message, setMessage] = useState("");

  useEffect(() => {
    let isMounted = true;

    async function loadGroups() {
      const { data: sessionData } = await supabase.auth.getSession();
      const user = sessionData.session?.user;

      if (!isMounted) return;

      if (!user) {
        setAuthState("signed-out");
        setIsLoadingGroups(false);
        return;
      }

      setAuthState("signed-in");

      const { data, error } = await supabase
        .from("trade_groups")
        .select(
          "id, user_id, collection_id, name, board_data, created_at, updated_at",
        )
        .eq("user_id", user.id)
        .order("created_at", { ascending: true });

      if (!isMounted) return;

      if (error) {
        console.error(error);
        setMessage("저장한 교환판을 불러오지 못했습니다.");
        setIsLoadingGroups(false);
        return;
      }

      const nextGroups = (data ?? []) as TradeGroupRow[];
      setGroups(nextGroups);

      const requestedGroupId = new URLSearchParams(window.location.search).get(
        "group",
      );
      const initialGroup =
        nextGroups.find((group) => group.id === requestedGroupId) ??
        nextGroups[0];

      setActiveGroupId(initialGroup?.id ?? "");
      setIsLoadingGroups(false);
    }

    void loadGroups();

    return () => {
      isMounted = false;
    };
  }, []);

  const activeGroup = useMemo(
    () => groups.find((group) => group.id === activeGroupId) ?? null,
    [activeGroupId, groups],
  );


  useEffect(() => {
    let isMounted = true;

    async function loadEditor() {
      if (!activeGroup) {
        setEditorData(null);
        return;
      }

      setIsLoadingEditor(true);
      setMessage("");

      const [
        collectionResult,
        itemResult,
        referenceResult,
        subcategoryResult,
      ] = await Promise.all([
        supabase
          .from("trade_collections")
          .select("id, slug, title, description, event_start_date, event_end_date, event_location")
          .eq("id", activeGroup.collection_id)
          .maybeSingle(),
        supabase
          .from("trade_items")
          .select(
            "id, category, work_title, item_name, image_path, sort_order, image_ratio, benefit_subcategory",
          )
          .eq("collection_id", activeGroup.collection_id)
          .eq("is_visible", true)
          .order("created_at", { ascending: true }),
        supabase
          .from("trade_reference_images")
          .select("id, image_path, sort_order")
          .eq("collection_id", activeGroup.collection_id)
          .order("sort_order", { ascending: true })
          .order("created_at", { ascending: true }),
        supabase
          .from("trade_benefit_subcategories")
          .select("name, sort_order")
          .eq("collection_id", activeGroup.collection_id)
          .eq("is_visible", true)
          .order("sort_order", { ascending: true })
          .order("name", { ascending: true }),
      ]);

      if (!isMounted) return;

      if (collectionResult.error || !collectionResult.data) {
        if (collectionResult.error) console.error(collectionResult.error);
        setEditorData(null);
        setMessage("이 교환판의 행사 정보를 불러오지 못했습니다.");
        setIsLoadingEditor(false);
        return;
      }

      if (itemResult.error) console.error(itemResult.error);
      if (referenceResult.error) console.error(referenceResult.error);
      if (subcategoryResult.error) console.error(subcategoryResult.error);

      const collectionRow = collectionResult.data as CollectionRow;
      const collection: TradeCollectionSummary = {
        id: collectionRow.id,
        slug: collectionRow.slug,
        title: collectionRow.title,
        description: collectionRow.description,
        eventStartDate: collectionRow.event_start_date,
        eventEndDate: collectionRow.event_end_date,
        location: collectionRow.event_location,
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
        .filter((item) => item.image_path)
        .map((item, catalogOrder) => ({
          id: item.id,
          category: item.category,
          workTitle: item.work_title,
          itemName: item.item_name || "",
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
        (referenceResult.data ?? []) as TradeReferenceImageRow[]
      )
        .filter((image) => image.image_path)
        .map((image) => ({
          id: image.id,
          imageUrl: getTradeAssetUrl(image.image_path),
          sortOrder: image.sort_order ?? 0,
        }));

      setEditorData({ collection, registeredItems, referenceImages });
      setIsLoadingEditor(false);
    }

    void loadEditor();

    return () => {
      isMounted = false;
    };
  }, [activeGroup]);

  function selectGroup(groupId: string) {
    if (groupId === activeGroupId) return;

    setActiveGroupId(groupId);
    setEditorData(null);

    const nextUrl = new URL(window.location.href);
    nextUrl.searchParams.set("group", groupId);
    window.history.replaceState({}, "", nextUrl);
  }

  function handleSavedGroupChange(group: { id: string; name: string }) {
    setGroups((current) => {
      const existing = current.find((item) => item.id === group.id);

      if (existing) {
        return current.map((item) =>
          item.id === group.id ? { ...item, name: group.name } : item,
        );
      }

      return current;
    });
  }

  async function handleLogout() {
    await supabase.auth.signOut();
    router.push("/");
    router.refresh();
  }

  if (authState === "checking" || isLoadingGroups) {
    return (
      <AppFrame>
      <AppTopBar title="내 교환판" backHref="/" />
        <div className="flex min-h-0 flex-1 items-center justify-center px-6 text-sm text-neutral-500">
          저장한 교환판을 불러오는 중입니다.
        </div>
        <AppBottomNav active="trades" />
      </AppFrame>
    );
  }

  if (authState === "signed-out") {
    return (
      <AppFrame>
      <AppTopBar title="내 교환판" backHref="/" />
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
          title="내 교환판"
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
              내 교환판
            </h2>
            <p className="mt-2 text-sm leading-6 text-neutral-500">
              저장한 그룹을 선택해 교환판을 바로 수정할 수 있습니다.
            </p>
          </section>

          {groups.length > 0 ? (
            <>
              <div className="sticky top-0 z-20 border-b border-neutral-100 bg-white/95 px-4 py-3 backdrop-blur">
                <div className="mb-2 flex items-center justify-between gap-3">
                  <p className="text-xs font-black text-neutral-700">교환판 그룹</p>
                  <span className="rounded-full bg-neutral-100 px-2.5 py-1 text-[11px] font-black text-neutral-500">
                    {groups.length}/{MAX_TRADE_GROUPS}
                  </span>
                </div>
                <div className="flex items-center gap-2 overflow-x-auto pb-1 [scrollbar-width:none] [&::-webkit-scrollbar]:hidden">
                  {groups.map((group) => {
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

                  {groups.length < MAX_TRADE_GROUPS ? (
                    <Link
                      href="/"
                      className="flex h-9 w-9 shrink-0 items-center justify-center rounded-full border border-dashed border-neutral-300 text-lg font-light text-neutral-500"
                      aria-label="새 교환판 만들기"
                    >
                      +
                    </Link>
                  ) : null}
                </div>
              </div>

              {message ? (
                <p className="mx-5 mt-4 rounded-2xl bg-neutral-100 px-4 py-3 text-sm leading-6 text-neutral-700">
                  {message}
                </p>
              ) : null}

              {isLoadingEditor || !editorData ? (
                <div className="p-6 text-center text-sm text-neutral-400">
                  교환판 편집 화면을 불러오는 중입니다.
                </div>
              ) : (
                <TradeBuilder
                  key={`${activeGroupId}:${activeGroup?.name ?? ""}`}
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
                  아직 저장한 교환판이 없습니다.
                </p>
                <p className="mt-2 text-xs leading-5 text-neutral-400">
                  행사 굿즈를 선택해 교환판을 만든 뒤 이름을 정해 저장해 주세요.
                </p>
                <Link
                  href="/"
                  className="mt-5 inline-flex rounded-2xl bg-neutral-950 px-5 py-3 text-xs font-black text-white"
                >
                  새 교환판 만들기
                </Link>
              </div>
            </div>
          )}
      </div>

      <AppBottomNav active="trades" />
    </AppFrame>
  );
}
