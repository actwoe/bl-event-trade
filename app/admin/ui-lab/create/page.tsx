"use client";

import Link from "next/link";
import { useSearchParams } from "next/navigation";
import { Suspense, useEffect, useState } from "react";
import { UiLabBuilder } from "@/components/ui-lab/UiLabBuilder";
import { AppBottomNav } from "@/components/ui/AppBottomNav";
import { AppTopBar } from "@/components/ui/AppTopBar";
import { getTradeAssetUrl, supabase } from "@/lib/supabase";
import {
  createBenefitSubcategoryOrderMap,
  getBenefitSubcategorySortOrder,
} from "@/lib/trade-benefit-subcategory-order";
import { getEventStatus, getEventStatusLabel, getKoreaTodayDateString } from "@/lib/event-status";
import {
  RegisteredTradeItem,
  TradeCategory,
  TradeCollectionSummary,
  TradeImageRatio,
  TradeReferenceImage,
} from "@/lib/trade-types";

type AdminState = "checking" | "admin" | "not-admin" | "signed-out";

type TradeCollectionRow = {
  id: string;
  slug: string;
  title: string;
  description: string | null;
  is_public: boolean;
  sort_order: number | null;
  created_at: string | null;
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
  return value === "photocard" ? "photocard" : "square";
}

function sortCollections(rows: TradeCollectionRow[]) {
  return [...rows].sort((a, b) => {
    const sortDiff = (a.sort_order ?? 0) - (b.sort_order ?? 0);

    if (sortDiff !== 0) {
      return sortDiff;
    }

    return a.title.localeCompare(b.title, "ko-KR", {
      numeric: true,
      sensitivity: "base",
    });
  });
}

function AdminUiLabCreatePageContent() {
  const searchParams = useSearchParams();
  const requestedCollectionId = searchParams.get("collection") ?? "";
  const [adminState, setAdminState] = useState<AdminState>("checking");
  const [collections, setCollections] = useState<TradeCollectionRow[]>([]);
  const [selectedCollectionId, setSelectedCollectionId] = useState("");
  const [collection, setCollection] = useState<TradeCollectionSummary | null>(
    null,
  );
  const [registeredItems, setRegisteredItems] = useState<RegisteredTradeItem[]>(
    [],
  );
  const [referenceImages, setReferenceImages] = useState<TradeReferenceImage[]>(
    [],
  );
  const [isLoadingCollection, setIsLoadingCollection] = useState(false);
  const [message, setMessage] = useState("");

  useEffect(() => {
    async function checkAdminAndLoadCollections() {
      const { data: sessionData } = await supabase.auth.getSession();
      const user = sessionData.session?.user;

      if (!user) {
        setAdminState("signed-out");
        return;
      }

      const { data: adminUser, error: adminError } = await supabase
        .from("admin_users")
        .select("user_id")
        .eq("user_id", user.id)
        .maybeSingle();

      if (adminError || !adminUser) {
        setAdminState("not-admin");
        return;
      }

      setAdminState("admin");

      const { data, error } = await supabase
        .from("trade_collections")
        .select(
          "id, slug, title, description, is_public, sort_order, created_at, event_start_date, event_end_date, event_location",
        )
        .order("sort_order", { ascending: true })
        .order("created_at", { ascending: false });

      if (error) {
        console.error(error);
        setMessage("테스트할 행사 목록을 불러오지 못했습니다.");
        return;
      }

      const nextCollections = sortCollections(
        (data ?? []) as TradeCollectionRow[],
      );
      setCollections(nextCollections);
      const requestedExists = nextCollections.some(
        (item) => item.id === requestedCollectionId,
      );
      setSelectedCollectionId(
        requestedExists
          ? requestedCollectionId
          : (nextCollections[0]?.id ?? ""),
      );
    }

    checkAdminAndLoadCollections();
  }, [requestedCollectionId]);

  useEffect(() => {
    if (adminState !== "admin" || !selectedCollectionId) {
      return;
    }

    let isCancelled = false;

    async function loadCollectionData() {
      setIsLoadingCollection(true);
      setMessage("");

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

      const [itemsResult, referencesResult, subcategoriesResult] = await Promise.all([
        supabase
          .from("trade_items")
          .select(
            "id, category, work_title, item_name, image_path, sort_order, image_ratio, benefit_subcategory",
          )
          .eq("collection_id", selectedCollection.id)
          .eq("is_visible", true)
          .order("created_at", { ascending: true }),
        supabase
          .from("trade_reference_images")
          .select("id, image_path, sort_order")
          .eq("collection_id", selectedCollection.id)
          .order("sort_order", { ascending: true })
          .order("created_at", { ascending: true }),
        supabase
          .from("trade_benefit_subcategories")
          .select("name, sort_order")
          .eq("collection_id", selectedCollection.id)
          .eq("is_visible", true)
          .order("sort_order", { ascending: true })
          .order("name", { ascending: true }),
      ]);

      if (isCancelled) {
        return;
      }

      if (itemsResult.error) {
        console.error(itemsResult.error);
        setMessage("행사의 굿즈 목록을 불러오지 못했습니다.");
        setCollection(null);
        setRegisteredItems([]);
        setReferenceImages([]);
        setIsLoadingCollection(false);
        return;
      }

      if (referencesResult.error) {
        console.error(referencesResult.error);
      }

      if (subcategoriesResult.error) {
        console.error(subcategoriesResult.error);
      }

      const benefitSubcategoryOrderMap = createBenefitSubcategoryOrderMap(
        (subcategoriesResult.data ?? []) as TradeBenefitSubcategoryRow[],
      );

      setCollection({
        id: selectedCollection.id,
        slug: selectedCollection.slug,
        title: selectedCollection.title,
        description: selectedCollection.description,
        eventStartDate: selectedCollection.event_start_date,
        eventEndDate: selectedCollection.event_end_date,
        location: selectedCollection.event_location,
      } as TradeCollectionSummary & {
        eventStartDate?: string | null;
        eventEndDate?: string | null;
      });

      setRegisteredItems(
        ((itemsResult.data ?? []) as TradeItemRow[])
          .filter((item) => item.image_path)
          .map((item) => ({
            id: item.id,
            category: item.category,
            workTitle: item.work_title,
            itemName: item.item_name || "",
            imageUrl: getTradeAssetUrl(item.image_path),
            sortOrder: item.sort_order ?? 0,
            imageRatio: getSafeImageRatio(item.image_ratio),
            benefitSubcategory: item.benefit_subcategory ?? null,
            benefitSubcategorySortOrder: getBenefitSubcategorySortOrder(
              benefitSubcategoryOrderMap,
              item.benefit_subcategory,
            ),
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

  if (adminState === "checking") {
    return (
      <main className="w-full bg-neutral-100 px-4 py-5 sm:py-6">
        <section className="mx-auto max-w-[520px] rounded-[28px] border border-neutral-200/70 bg-white p-5 text-sm text-neutral-500 shadow-[0_8px_26px_rgba(15,23,42,0.032)]">
          관리자 권한을 확인하는 중입니다.
        </section>
      </main>
    );
  }

  if (adminState === "signed-out") {
    return (
      <main className="w-full bg-neutral-100 px-4 py-5 sm:py-6">
        <section className="mx-auto max-w-[520px] rounded-[28px] border border-neutral-200/70 bg-white p-5 shadow-[0_8px_26px_rgba(15,23,42,0.032)]">
          <h1 className="text-2xl font-bold text-neutral-950">
            로그인이 필요합니다
          </h1>
          <p className="mt-2 text-sm leading-6 text-neutral-500">
            UI 랩 교환판 생성 페이지는 관리자 로그인 후 이용할 수 있습니다.
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

  if (adminState === "not-admin") {
    return (
      <main className="w-full bg-neutral-100 px-4 py-5 sm:py-6">
        <section className="mx-auto max-w-[520px] rounded-[28px] border border-neutral-200/70 bg-white p-5 shadow-[0_8px_26px_rgba(15,23,42,0.032)]">
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

  const formatDate = (value?: string | null) => {
    if (!value) return "";
    const [year, month, day] = value.split("-");
    return year && month && day ? `${year}.${month}.${day}` : value;
  };

  const today = getKoreaTodayDateString();
  const eventStatus = collection
    ? getEventStatus(collection.eventStartDate ?? null, collection.eventEndDate ?? null, today)
    : "ongoing";
  const eventStatusLabel = getEventStatusLabel(eventStatus);

  const eventPeriod = collection
    ? (() => {
        const start = formatDate(collection.eventStartDate);
        const end = formatDate(collection.eventEndDate);
        if (start && end) {
          const [, endMonth, endDay] = end.split(".");
          return `${start} ~ ${endMonth && endDay ? `${endMonth}.${endDay}` : end}`;
        }
        return start || end;
      })()
    : "";

  return (
    <main className="flex h-[100dvh] w-full items-center justify-center bg-neutral-100 px-3 py-3 sm:px-6 sm:py-6">
      <section className="flex h-full max-h-[860px] w-full max-w-[520px] flex-col overflow-hidden rounded-[28px] border border-neutral-200/70 bg-white shadow-[0_8px_26px_rgba(15,23,42,0.04)]">
        <AppTopBar title="교환판 만들기" backHref="/admin/ui-lab" />
        <div className="min-h-0 flex-1 overflow-y-auto overscroll-contain">
          <section className="border-b border-neutral-100 bg-white px-5 py-4">
            <p className="text-[12px] font-black tracking-[0.04em] text-[#7C5CFC]">
              BL GOODS TRADE
            </p>
            <div className="mt-1 flex items-start justify-between gap-3">
              <h2 className="min-w-0 break-keep text-[24px] font-black leading-tight tracking-[-0.03em] text-neutral-950">
                {collection?.title ?? "교환판 만들기"}
              </h2>
              {collection ? (
                <span className={
                  eventStatus === "ongoing"
                    ? "shrink-0 rounded-full bg-[#F1EDFF] px-3 py-1.5 text-[11px] font-black text-[#7C5CFC]"
                    : "shrink-0 rounded-full bg-neutral-100 px-3 py-1.5 text-[11px] font-black text-neutral-500"
                }>
                  {eventStatusLabel}
                </span>
              ) : null}
            </div>
            {eventPeriod || collection?.location ? (
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
                {eventPeriod ? <span>{eventPeriod}</span> : null}
                {eventPeriod && collection?.location ? <span className="text-neutral-300">|</span> : null}
                {collection?.location ? (
                  <>
                    <svg viewBox="0 0 24 24" aria-hidden="true" className="h-4 w-4 shrink-0 fill-none stroke-current" strokeWidth="1.8">
                      <path d="M12 21s6-5.1 6-11a6 6 0 1 0-12 0c0 5.9 6 11 6 11Z" />
                      <circle cx="12" cy="10" r="2.2" />
                    </svg>
                    <span>{collection.location}</span>
                  </>
                ) : null}
              </p>
            ) : null}

            {message ? (
              <p className="mt-3 rounded-2xl bg-neutral-100 px-4 py-3 text-sm leading-6 text-neutral-700">
                {message}
              </p>
            ) : null}
          </section>
          {isLoadingCollection ? (
            <div className="p-5 text-sm text-neutral-500">
              행사와 굿즈 데이터를 불러오는 중입니다.
            </div>
          ) : null}

          {!isLoadingCollection && collection ? (
            <UiLabBuilder
              key={collection.id}
              collection={collection}
              registeredItems={registeredItems}
              referenceImages={referenceImages}
            />
          ) : null}
        </div>
        <AppBottomNav active="home" homeHref="/admin/ui-lab" />
      </section>
    </main>
  );
}


function AdminUiLabCreatePageFallback() {
  return (
    <main className="flex h-[100dvh] w-full items-center justify-center bg-neutral-100 px-3 py-3 sm:px-6 sm:py-6">
      <section className="w-full max-w-[520px] rounded-[28px] border border-neutral-200/70 bg-white p-5 text-sm text-neutral-500 shadow-[0_8px_26px_rgba(15,23,42,0.032)]">
        교환판 만들기 화면을 불러오는 중입니다.
      </section>
    </main>
  );
}

export default function AdminUiLabCreatePage() {
  return (
    <Suspense fallback={<AdminUiLabCreatePageFallback />}>
      <AdminUiLabCreatePageContent />
    </Suspense>
  );
}
