"use client";

import Link from "next/link";
import { ChangeEvent, FormEvent, useEffect, useMemo, useState } from "react";
import { nanoid } from "nanoid";
import { supabase } from "@/lib/supabase";
import { TRADE_CATEGORIES, TradeCategory } from "@/lib/trade-types";

type TradeCollectionRow = {
  id: string;
  slug: string;
  title: string;
  description: string | null;
};

type TradeWorkRow = {
  title: string;
};

type BenefitSubcategoryRow = {
  name: string;
  sort_order: number | null;
};

function getFileExtension(file: File) {
  const extension = file.name.split(".").pop()?.toLowerCase();

  if (!extension) {
    return "jpg";
  }

  if (extension === "jpeg") {
    return "jpg";
  }

  return extension;
}

function normalizePathPart(value: string) {
  const normalized = value
    .trim()
    .toLowerCase()
    .normalize("NFKD")
    .replace(/[\u0300-\u036f]/g, "")
    .replace(/[^a-z0-9-]/g, "-")
    .replace(/-+/g, "-")
    .replace(/^-|-$/g, "");

  return normalized || "submission";
}

function sortKoreanTitles(titles: string[]) {
  return [...titles].sort((a, b) =>
    a.localeCompare(b, "ko-KR", {
      numeric: true,
      sensitivity: "base",
    }),
  );
}

function sortBenefitSubcategories(rows: BenefitSubcategoryRow[]) {
  return [...rows].sort((a, b) => {
    const orderA = a.sort_order ?? 0;
    const orderB = b.sort_order ?? 0;

    if (orderA !== orderB) {
      return orderA - orderB;
    }

    return a.name.localeCompare(b.name, "ko-KR", {
      numeric: true,
      sensitivity: "base",
    });
  });
}

export default function CardFormPage() {
  const [collections, setCollections] = useState<TradeCollectionRow[]>([]);
  const [collectionId, setCollectionId] = useState("");
  const [workTitles, setWorkTitles] = useState<string[]>([]);
  const [workTitle, setWorkTitle] = useState("");
  const [category, setCategory] = useState<TradeCategory>("benefit");
  const [benefitSubcategories, setBenefitSubcategories] = useState<string[]>(
    [],
  );
  const [benefitSubcategory, setBenefitSubcategory] = useState("");

  const [imageFile, setImageFile] = useState<File | null>(null);
  const [imagePreviewUrl, setImagePreviewUrl] = useState("");

  const [message, setMessage] = useState("");
  const [isSubmitting, setIsSubmitting] = useState(false);
  const [isSubmitted, setIsSubmitted] = useState(false);

  const selectedCollection = useMemo(() => {
    return collections.find((collection) => collection.id === collectionId);
  }, [collections, collectionId]);

  const canSelectBenefitSubcategory =
    category === "benefit" && benefitSubcategories.length > 0;

  useEffect(() => {
    async function loadCollections() {
      const { data, error } = await supabase
        .from("trade_collections")
        .select("id, slug, title, description")
        .eq("is_public", true)
        .order("published_at", { ascending: false })
        .order("sort_order", { ascending: true });

      if (error) {
        console.error(error);
        setMessage("행사 목록을 불러오지 못했습니다.");
        return;
      }

      const nextCollections = (data ?? []) as TradeCollectionRow[];

      setCollections(nextCollections);

      if (nextCollections[0]) {
        setCollectionId(nextCollections[0].id);
      }
    }

    loadCollections();
  }, []);

  useEffect(() => {
    async function loadWorkTitles() {
      if (!collectionId) {
        setWorkTitles([]);
        setWorkTitle("");
        return;
      }

      const { data, error } = await supabase
        .from("trade_collection_works")
        .select("title")
        .eq("collection_id", collectionId)
        .eq("is_visible", true)
        .order("title", { ascending: true });

      if (error) {
        console.error(error);
        setMessage("작품 목록을 불러오지 못했습니다.");
        setWorkTitles([]);
        setWorkTitle("");
        return;
      }

      const rows = (data ?? []) as TradeWorkRow[];

      const uniqueWorkTitles = sortKoreanTitles(
        Array.from(
          new Set(
            rows
              .map((row) => row.title)
              .filter((title) => title.trim().length > 0),
          ),
        ),
      );

      setWorkTitles(uniqueWorkTitles);
      setWorkTitle(uniqueWorkTitles[0] ?? "");
    }

    loadWorkTitles();
  }, [collectionId]);

  useEffect(() => {
    async function loadBenefitSubcategories() {
      if (!collectionId) {
        setBenefitSubcategories([]);
        setBenefitSubcategory("");
        return;
      }

      const { data, error } = await supabase
        .from("trade_benefit_subcategories")
        .select("name, sort_order")
        .eq("collection_id", collectionId)
        .eq("is_visible", true)
        .order("sort_order", { ascending: true })
        .order("name", { ascending: true });

      if (error) {
        console.error(error);
        setMessage(
          "특전 하위 분류 목록을 불러오지 못했습니다. SQL 추가 여부를 확인해 주세요.",
        );
        setBenefitSubcategories([]);
        setBenefitSubcategory("");
        return;
      }

      const nextSubcategories = sortBenefitSubcategories(
        (data ?? []) as BenefitSubcategoryRow[],
      )
        .map((row) => row.name.trim())
        .filter(Boolean);

      setBenefitSubcategories(nextSubcategories);
      setBenefitSubcategory((prev) => {
        if (prev && nextSubcategories.includes(prev)) {
          return prev;
        }

        return nextSubcategories[0] ?? "";
      });
    }

    loadBenefitSubcategories();
  }, [collectionId]);

  useEffect(() => {
    if (category !== "benefit") {
      setBenefitSubcategory("");
      return;
    }

    setBenefitSubcategory((prev) => {
      if (prev && benefitSubcategories.includes(prev)) {
        return prev;
      }

      return benefitSubcategories[0] ?? "";
    });
  }, [category, benefitSubcategories]);

  useEffect(() => {
    return () => {
      if (imagePreviewUrl) {
        URL.revokeObjectURL(imagePreviewUrl);
      }
    };
  }, [imagePreviewUrl]);

  function handleCategoryChange(nextCategory: TradeCategory) {
    setCategory(nextCategory);

    if (nextCategory !== "benefit") {
      setBenefitSubcategory("");
    }
  }

  function handleImageChange(event: ChangeEvent<HTMLInputElement>) {
    const file = event.target.files?.[0];

    if (!file) {
      return;
    }

    if (!file.type.startsWith("image/")) {
      setMessage("이미지 파일만 업로드할 수 있습니다.");
      return;
    }

    if (imagePreviewUrl) {
      URL.revokeObjectURL(imagePreviewUrl);
    }

    setImageFile(file);
    setImagePreviewUrl(URL.createObjectURL(file));
    setMessage("");
  }

  async function handleSubmit(event: FormEvent<HTMLFormElement>) {
    event.preventDefault();

    if (!selectedCollection) {
      setMessage("행사를 선택해 주세요.");
      return;
    }

    if (!workTitle) {
      setMessage("작품을 선택해 주세요.");
      return;
    }

    if (!imageFile) {
      setMessage("제보할 이미지를 업로드해 주세요.");
      return;
    }

    try {
      setIsSubmitting(true);
      setMessage("");

      const fileExtension = getFileExtension(imageFile);
      const safeWorkTitle = normalizePathPart(workTitle);
      const fileName = `${safeWorkTitle}-${Date.now()}-${nanoid(
        8,
      )}.${fileExtension}`;
      const imagePath = `${selectedCollection.slug}/${fileName}`;

      const { error: uploadError } = await supabase.storage
        .from("trade-submissions")
        .upload(imagePath, imageFile, {
          cacheControl: "3600",
          upsert: false,
          contentType: imageFile.type,
        });

      if (uploadError) {
        console.error(uploadError);
        setMessage("이미지 업로드에 실패했습니다. 잠시 후 다시 시도해 주세요.");
        return;
      }

      const { error: insertError } = await supabase
        .from("card_submissions")
        .insert({
          collection_id: selectedCollection.id,
          collection_slug: selectedCollection.slug,
          collection_title: selectedCollection.title,
          category,
          work_title: workTitle,
          item_name: null,
          benefit_subcategory:
            category === "benefit" && benefitSubcategory.trim()
              ? benefitSubcategory.trim()
              : null,
          image_path: imagePath,
          submitter_contact: null,
          note: null,
          status: "pending",
        });

      if (insertError) {
        console.error(insertError);
        setMessage("제보 등록에 실패했습니다. 잠시 후 다시 시도해 주세요.");
        return;
      }

      setIsSubmitted(true);
      setImageFile(null);
      setImagePreviewUrl("");
      setBenefitSubcategory("");
    } catch (error) {
      console.error(error);
      setMessage("제보 중 오류가 발생했습니다.");
    } finally {
      setIsSubmitting(false);
    }
  }

  return (
    <main className="w-full bg-neutral-100 px-4 pb-5 pt-5 sm:pb-6 sm:pt-6">
      <section className="mx-auto w-full max-w-md sm:max-w-lg">
        <div className="overflow-hidden rounded-[28px] border border-neutral-200/70 bg-white shadow-[0_8px_26px_rgba(15,23,42,0.032)]">
          <header className="border-b border-neutral-200/70 bg-[linear-gradient(135deg,#f8fafc_0%,#eef2ff_52%,#fdf2f8_100%)] p-5">
            <div className="mb-6 flex items-center justify-between gap-3">
              <Link
                href="/"
                className="rounded-full border border-white/70 bg-white/75 px-4 py-2 text-xs font-bold text-neutral-600 shadow-[0_4px_12px_rgba(15,23,42,0.025)] transition hover:border-white hover:bg-white hover:text-neutral-950"
              >
                ← 메인으로
              </Link>

              <Link
                href="/cardform"
                className="rounded-full border border-white/70 bg-white/75 px-4 py-2 text-xs font-bold text-neutral-600 shadow-[0_4px_12px_rgba(15,23,42,0.025)] transition hover:border-white hover:bg-white hover:text-neutral-950"
              >
                이미지 제보하기
              </Link>
            </div>

            <p className="text-xs font-bold uppercase tracking-[0.2em] text-neutral-500">
              Popup & Callabo Cafe Trade Board
            </p>

            <h1 className="mt-1 text-2xl font-black text-neutral-950">
              이미지 제보
            </h1>

            <div className="mt-5 rounded-2xl border border-white/60 bg-white/65 p-4 text-xs leading-6 text-neutral-600 shadow-[0_8px_20px_rgba(15,23,42,0.025)]">
              <p>팝업 & 콜카 굿즈 교환판에 없는 굿즈 이미지를 제보해 주세요.</p>
              <p>가급적 빛 반사가 없는 정방형 이미지를 권장합니다.</p>
              <p>제보 이미지는 관리자 검수 후 교환판에 추가됩니다.</p>
            </div>
          </header>

          {isSubmitted ? (
            <section className="p-5 text-center">
            <h2 className="text-xl font-black text-neutral-950">
              제보가 접수되었습니다
            </h2>

            <p className="mt-2 text-sm leading-6 text-neutral-500">
              관리자가 확인한 뒤 팝업 & 콜카 굿즈 교환판에 반영됩니다.
            </p>

            <button
              type="button"
              onClick={() => setIsSubmitted(false)}
              className="mt-6 w-full rounded-2xl bg-neutral-950 px-5 py-4 text-sm font-bold text-white transition hover:bg-neutral-800"
            >
              다른 이미지 제보하기
            </button>
          </section>
        ) : (
          <form
            onSubmit={handleSubmit}
            className="p-5"
          >
            <div className="space-y-5">
              <label className="block">
                <span className="text-sm font-semibold text-neutral-800">
                  행사 선택
                </span>

                <select
                  value={collectionId}
                  onChange={(event) => setCollectionId(event.target.value)}
                  className="mt-1 w-full rounded-2xl border border-neutral-200 bg-white px-4 py-3 text-sm outline-none focus:border-neutral-900"
                >
                  {collections.length > 0 ? (
                    collections.map((collection) => (
                      <option key={collection.id} value={collection.id}>
                        {collection.title}
                      </option>
                    ))
                  ) : (
                    <option value="">등록된 행사가 없습니다</option>
                  )}
                </select>
              </label>

              <label className="block">
                <span className="text-sm font-semibold text-neutral-800">
                  작품 선택
                </span>

                <select
                  value={workTitle}
                  onChange={(event) => setWorkTitle(event.target.value)}
                  disabled={workTitles.length === 0}
                  className="mt-1 w-full rounded-2xl border border-neutral-200 bg-white px-4 py-3 text-sm outline-none focus:border-neutral-900 disabled:bg-neutral-100 disabled:text-neutral-400"
                >
                  {workTitles.length > 0 ? (
                    workTitles.map((title) => (
                      <option key={title} value={title}>
                        {title}
                      </option>
                    ))
                  ) : (
                    <option value="">등록된 작품이 없습니다</option>
                  )}
                </select>

                <p className="mt-2 text-xs leading-5 text-neutral-400">
                  작품 목록은 관리자가 해당 행사에 등록한 작품 기준으로
                  표시됩니다.
                </p>
              </label>

              <div className="grid grid-cols-2 gap-3">
                <label className="block">
                  <span className="text-sm font-semibold text-neutral-800">
                    굿즈 종류
                  </span>

                  <select
                    value={category}
                    onChange={(event) =>
                      handleCategoryChange(event.target.value as TradeCategory)
                    }
                    className="mt-1 w-full rounded-2xl border border-neutral-200 bg-white px-4 py-3 text-sm outline-none focus:border-neutral-900"
                  >
                    {TRADE_CATEGORIES.map((option) => (
                      <option key={option.id} value={option.id}>
                        {option.label}
                      </option>
                    ))}
                  </select>
                </label>

                <label className="block">
                  <span className="text-sm font-semibold text-neutral-800">
                    특전 하위 분류
                  </span>

                  <select
                    value={benefitSubcategory}
                    onChange={(event) =>
                      setBenefitSubcategory(event.target.value)
                    }
                    disabled={!canSelectBenefitSubcategory}
                    className="mt-1 w-full rounded-2xl border border-neutral-200 bg-white px-4 py-3 text-sm outline-none focus:border-neutral-900 disabled:bg-neutral-100 disabled:text-neutral-400"
                  >
                    {category !== "benefit" ? (
                      <option value="">특전 선택 시 사용</option>
                    ) : benefitSubcategories.length > 0 ? (
                      <>
                        {benefitSubcategories.map((subcategory) => (
                          <option key={subcategory} value={subcategory}>
                            {subcategory}
                          </option>
                        ))}
                      </>
                    ) : (
                      <option value="">등록된 하위 분류 없음</option>
                    )}
                  </select>
                </label>
              </div>

              <div>
                <span className="text-sm font-semibold text-neutral-800">
                  이미지
                </span>

                <label className="mt-1 flex cursor-pointer flex-col items-center justify-center rounded-2xl border border-dashed border-neutral-300 bg-neutral-50 px-4 py-8 text-center hover:border-neutral-950">
                  {imagePreviewUrl ? (
                    <img
                      src={imagePreviewUrl}
                      alt="제보 이미지 미리보기"
                      className="aspect-square w-32 rounded-2xl bg-white object-contain p-1 shadow-[0_6px_18px_rgba(15,23,42,0.04)]"
                    />
                  ) : (
                    <>
                      <span className="text-sm font-bold text-neutral-700">
                        이미지 선택
                      </span>
                      <span className="mt-2 text-xs leading-5 text-neutral-400">
                        빛 반사가 적은 정방형 이미지를 권장합니다.
                      </span>
                    </>
                  )}

                  <input
                    type="file"
                    accept="image/*"
                    onChange={handleImageChange}
                    className="hidden"
                  />
                </label>
              </div>

              {message ? (
                <p className="rounded-2xl border border-neutral-200/70 bg-neutral-50/80 px-4 py-3 text-sm leading-6 text-neutral-600">
                  {message}
                </p>
              ) : null}

              <button
                type="submit"
                disabled={
                  isSubmitting ||
                  collections.length === 0 ||
                  workTitles.length === 0
                }
                className="w-full rounded-2xl bg-neutral-950 px-5 py-4 text-sm font-bold text-white transition hover:bg-neutral-800 disabled:cursor-not-allowed disabled:bg-neutral-300"
              >
                {isSubmitting ? "제보 중..." : "이미지 제보하기"}
              </button>
            </div>
          </form>
          )}
        </div>
      </section>
    </main>
  );
}
