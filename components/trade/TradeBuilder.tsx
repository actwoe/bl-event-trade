"use client";

import Link from "next/link";
import { useEffect, useMemo, useRef, useState } from "react";
import { toPng } from "html-to-image";
import { nanoid } from "nanoid";
import {
  RegisteredTradeItem,
  TradeReferenceImage,
  TRADE_CATEGORIES,
  TradeBoard,
  TradeCard,
  TradeCategory,
  TradeCategoryDisplayMode,
  TradeCollectionSummary,
  TradeImageRatio,
  TradeSide,
} from "@/lib/trade-types";
import { TradePreview } from "./TradePreview";

type TradeBuilderProps = {
  collection: TradeCollectionSummary;
  registeredItems: RegisteredTradeItem[];
  referenceImages: TradeReferenceImage[];
};

const PREVIEW_WIDTH = 560;
const EXPORT_IMAGE_WIDTH = 1200;
const ALL_WORKS_VALUE = "all";
const ALL_CATEGORIES_VALUE = "all";
const ALL_BENEFIT_SUBCATEGORIES_VALUE = "all";
const NO_BENEFIT_SUBCATEGORY_VALUE = "__none__";

type CategoryFilterValue = TradeCategory | typeof ALL_CATEGORIES_VALUE;
type BenefitSubcategoryFilterValue = string;

type QuantityTradeCard = TradeCard & {
  quantity?: number;
  registeredItemId?: string;
};

const TRADE_CONDITIONS = [
  "현장 직거래 가능",
  "N:1 가능",
  "반택 거래",
  "일택 거래",
  "양도 가능",
  "미세 하자 있음",
];

function createInitialBoard(): TradeBoard {
  return {
    nickname: "",
    contact: "",
    memo: "",
    cards: [],
    categoryDisplayMode: "grouped",
  };
}

function sortKoreanTitles(titles: string[]) {
  return [...titles].sort((a, b) =>
    a.localeCompare(b, "ko-KR", {
      numeric: true,
      sensitivity: "base",
    }),
  );
}

function getCardQuantity(card: TradeCard) {
  const quantity = (card as QuantityTradeCard).quantity ?? 1;

  if (!Number.isFinite(quantity)) return 1;

  return Math.max(1, Math.floor(quantity));
}

function isSameRegisteredCard(
  card: TradeCard,
  item: RegisteredTradeItem,
  side: TradeSide,
) {
  const quantityCard = card as QuantityTradeCard;

  if (quantityCard.registeredItemId) {
    return quantityCard.registeredItemId === item.id && card.side === side;
  }

  return (
    card.side === side &&
    card.category === item.category &&
    card.imageUrl === item.imageUrl &&
    card.workTitle === item.workTitle &&
    card.memo === item.itemName
  );
}

function getRegisteredItemQuantity(
  cards: TradeCard[],
  item: RegisteredTradeItem,
  side: TradeSide,
) {
  const selectedCard = cards.find((card) =>
    isSameRegisteredCard(card, item, side),
  );

  return selectedCard ? getCardQuantity(selectedCard) : 0;
}

function getCategoryLabel(category: TradeCategory) {
  return (
    TRADE_CATEGORIES.find((option) => option.id === category)?.label ?? category
  );
}

function getItemImageRatio(item: RegisteredTradeItem): TradeImageRatio {
  return item.imageRatio === "photocard" ? "photocard" : "square";
}

function getImageRatioClass(ratio: TradeImageRatio) {
  return ratio === "photocard" ? "aspect-[55/85]" : "aspect-square";
}

function getBenefitSubcategoryLabel(value?: string | null) {
  return value?.trim() || "";
}

function getItemMetaLabel(item: RegisteredTradeItem) {
  const categoryLabel = getCategoryLabel(item.category);
  const benefitSubcategory = getBenefitSubcategoryLabel(
    item.benefitSubcategory,
  );

  if (item.category === "benefit" && benefitSubcategory) {
    return `${categoryLabel} · ${benefitSubcategory}`;
  }

  return categoryLabel;
}

function getCardMetaLabel(card: TradeCard) {
  const categoryLabel = getCategoryLabel(card.category);
  const benefitSubcategory = getBenefitSubcategoryLabel(
    card.benefitSubcategory,
  );

  if (card.category === "benefit" && benefitSubcategory) {
    return `${categoryLabel} · ${benefitSubcategory}`;
  }

  return card.memo || categoryLabel;
}

function getCategorySortIndex(category: TradeCategory) {
  const index = TRADE_CATEGORIES.findIndex((option) => option.id === category);

  return index === -1 ? TRADE_CATEGORIES.length : index;
}

function sortRegisteredItems(items: RegisteredTradeItem[]) {
  return [...items].sort((a, b) => {
    const categoryDiff =
      getCategorySortIndex(a.category) - getCategorySortIndex(b.category);

    if (categoryDiff !== 0) {
      return categoryDiff;
    }

    if (a.category === "benefit" && b.category === "benefit") {
      const subcategoryDiff = getBenefitSubcategoryLabel(
        a.benefitSubcategory,
      ).localeCompare(
        getBenefitSubcategoryLabel(b.benefitSubcategory),
        "ko-KR",
        {
          numeric: true,
          sensitivity: "base",
        },
      );

      if (subcategoryDiff !== 0) {
        return subcategoryDiff;
      }
    }

    const titleDiff = a.workTitle.localeCompare(b.workTitle, "ko-KR", {
      numeric: true,
      sensitivity: "base",
    });

    if (titleDiff !== 0) {
      return titleDiff;
    }

    return a.sortOrder - b.sortOrder;
  });
}

export function TradeBuilder({
  collection,
  registeredItems,
  referenceImages,
}: TradeBuilderProps) {
  const [board, setBoard] = useState<TradeBoard>(() => createInitialBoard());
  const [selectedConditions, setSelectedConditions] = useState<string[]>([]);
  const [isProfileOpen, setIsProfileOpen] = useState(false);
  const [isConditionsOpen, setIsConditionsOpen] = useState(false);
  const [selectedWorkTitle, setSelectedWorkTitle] = useState(ALL_WORKS_VALUE);
  const [selectedCategory, setSelectedCategory] =
    useState<CategoryFilterValue>(ALL_CATEGORIES_VALUE);
  const [selectedBenefitSubcategory, setSelectedBenefitSubcategory] =
    useState<BenefitSubcategoryFilterValue>(ALL_BENEFIT_SUBCATEGORIES_VALUE);
  const [addModalSide, setAddModalSide] = useState<TradeSide | null>(null);
  const [isExporting, setIsExporting] = useState(false);
  const [previewScale, setPreviewScale] = useState(0.6);
  const [previewHeight, setPreviewHeight] = useState(1000);

  const previewAreaRef = useRef<HTMLDivElement>(null);
  const previewRef = useRef<HTMLDivElement>(null);

  const workTitleOptions = useMemo(() => {
    const titles = registeredItems
      .map((item) => item.workTitle)
      .filter((title) => title.trim().length > 0);

    return sortKoreanTitles(Array.from(new Set(titles)));
  }, [registeredItems]);

  const benefitSubcategoryOptions = useMemo(() => {
    const subcategories = registeredItems
      .filter((item) => item.category === "benefit")
      .map((item) => getBenefitSubcategoryLabel(item.benefitSubcategory))
      .filter((subcategory) => subcategory.length > 0);

    return sortKoreanTitles(Array.from(new Set(subcategories)));
  }, [registeredItems]);

  const hasBenefitItemsWithoutSubcategory = useMemo(() => {
    return registeredItems.some((item) => {
      return (
        item.category === "benefit" &&
        !getBenefitSubcategoryLabel(item.benefitSubcategory)
      );
    });
  }, [registeredItems]);


  const filteredItems = useMemo(() => {
    const nextItems = registeredItems.filter((item) => {
      const matchesWorkTitle =
        selectedWorkTitle === ALL_WORKS_VALUE ||
        item.workTitle === selectedWorkTitle;

      const matchesCategory =
        selectedCategory === ALL_CATEGORIES_VALUE ||
        item.category === selectedCategory;

      const benefitSubcategory = getBenefitSubcategoryLabel(
        item.benefitSubcategory,
      );

      const matchesBenefitSubcategory =
        selectedBenefitSubcategory === ALL_BENEFIT_SUBCATEGORIES_VALUE ||
        (item.category === "benefit" &&
          selectedBenefitSubcategory === NO_BENEFIT_SUBCATEGORY_VALUE &&
          benefitSubcategory.length === 0) ||
        (item.category === "benefit" &&
          selectedBenefitSubcategory === benefitSubcategory);

      return matchesWorkTitle && matchesCategory && matchesBenefitSubcategory;
    });

    return sortRegisteredItems(nextItems);
  }, [
    registeredItems,
    selectedWorkTitle,
    selectedCategory,
    selectedBenefitSubcategory,
  ]);

  const haveCards = useMemo(() => {
    return board.cards.filter((card) => card.side === "have");
  }, [board.cards]);

  const wantCards = useMemo(() => {
    return board.cards.filter((card) => card.side === "want");
  }, [board.cards]);

  const haveCardCount = useMemo(() => {
    return haveCards.reduce((total, card) => total + getCardQuantity(card), 0);
  }, [haveCards]);

  const wantCardCount = useMemo(() => {
    return wantCards.reduce((total, card) => total + getCardQuantity(card), 0);
  }, [wantCards]);

  const totalSelectedCount = useMemo(() => {
    return board.cards.reduce(
      (total, card) => total + getCardQuantity(card),
      0,
    );
  }, [board.cards]);

  const canDownload = useMemo(() => {
    return board.cards.length > 0;
  }, [board.cards]);

  useEffect(() => {
    if (
      selectedCategory !== ALL_CATEGORIES_VALUE &&
      selectedCategory !== "benefit" &&
      selectedBenefitSubcategory !== ALL_BENEFIT_SUBCATEGORIES_VALUE
    ) {
      setSelectedBenefitSubcategory(ALL_BENEFIT_SUBCATEGORIES_VALUE);
    }
  }, [selectedCategory, selectedBenefitSubcategory]);

  useEffect(() => {
    if (
      selectedBenefitSubcategory !== ALL_BENEFIT_SUBCATEGORIES_VALUE &&
      selectedBenefitSubcategory !== NO_BENEFIT_SUBCATEGORY_VALUE &&
      !benefitSubcategoryOptions.includes(selectedBenefitSubcategory)
    ) {
      setSelectedBenefitSubcategory(ALL_BENEFIT_SUBCATEGORIES_VALUE);
    }
  }, [benefitSubcategoryOptions, selectedBenefitSubcategory]);

  useEffect(() => {
    setBoard((prev) => ({
      ...prev,
      memo: selectedConditions.join(" · "),
    }));
  }, [selectedConditions]);

  useEffect(() => {
    function updatePreviewSize() {
      const area = previewAreaRef.current;
      const preview = previewRef.current;

      if (!area || !preview) return;

      const areaWidth = area.clientWidth;
      const safeAreaWidth = Math.max(areaWidth - 6, 1);
      const nextScale = Math.min(safeAreaWidth / PREVIEW_WIDTH, 1);
      const nextHeight = preview.scrollHeight || preview.offsetHeight || 1000;

      setPreviewScale(nextScale);
      setPreviewHeight(nextHeight);
    }

    updatePreviewSize();

    const resizeObserver = new ResizeObserver(() => {
      updatePreviewSize();
    });

    if (previewAreaRef.current) {
      resizeObserver.observe(previewAreaRef.current);
    }

    if (previewRef.current) {
      resizeObserver.observe(previewRef.current);
    }

    window.addEventListener("resize", updatePreviewSize);

    const timer = window.setTimeout(() => {
      updatePreviewSize();
    }, 150);

    return () => {
      resizeObserver.disconnect();
      window.removeEventListener("resize", updatePreviewSize);
      window.clearTimeout(timer);
    };
  }, [board]);

  function updateBoardField<K extends keyof TradeBoard>(
    key: K,
    value: TradeBoard[K],
  ) {
    setBoard((prev) => ({
      ...prev,
      [key]: value,
    }));
  }

  function toggleCondition(condition: string) {
    setSelectedConditions((prev) => {
      if (prev.includes(condition)) {
        return prev.filter((item) => item !== condition);
      }

      return [...prev, condition];
    });
  }

  function updateCategoryDisplayMode(mode: TradeCategoryDisplayMode) {
    setBoard((prev) => ({
      ...prev,
      categoryDisplayMode: mode,
    }));
  }

  function changeCategoryFilter(value: CategoryFilterValue) {
    setSelectedCategory(value);

    if (value !== ALL_CATEGORIES_VALUE && value !== "benefit") {
      setSelectedBenefitSubcategory(ALL_BENEFIT_SUBCATEGORIES_VALUE);
    }
  }

  function changeBenefitSubcategoryFilter(
    value: BenefitSubcategoryFilterValue,
  ) {
    setSelectedBenefitSubcategory(value);
  }

  function setRegisteredItemQuantity(
    item: RegisteredTradeItem,
    side: TradeSide,
    nextQuantity: number,
  ) {
    const safeQuantity = Math.max(0, Math.floor(nextQuantity));

    setBoard((prev) => {
      const existingCard = prev.cards.find((card) =>
        isSameRegisteredCard(card, item, side),
      );

      if (safeQuantity <= 0) {
        return {
          ...prev,
          cards: existingCard
            ? prev.cards.filter((card) => card.id !== existingCard.id)
            : prev.cards,
        };
      }

      if (existingCard) {
        return {
          ...prev,
          cards: prev.cards.map((card) =>
            card.id === existingCard.id
              ? {
                  ...card,
                  category: item.category,
                  imageUrl: item.imageUrl,
                  workTitle: item.workTitle,
                  memo: item.itemName,
                  imageRatio: getItemImageRatio(item),
                  benefitSubcategory: item.benefitSubcategory ?? null,
                  quantity: safeQuantity,
                  registeredItemId: item.id,
                }
              : card,
          ),
        };
      }

      const newCard: QuantityTradeCard = {
        id: nanoid(),
        side,
        category: item.category,
        imageUrl: item.imageUrl,
        workTitle: item.workTitle,
        memo: item.itemName,
        imageRatio: getItemImageRatio(item),
        benefitSubcategory: item.benefitSubcategory ?? null,
        quantity: safeQuantity,
        registeredItemId: item.id,
      };

      return {
        ...prev,
        cards: [...prev.cards, newCard],
      };
    });
  }

  function increaseRegisteredItemQuantity(
    item: RegisteredTradeItem,
    side: TradeSide,
  ) {
    const currentQuantity = getRegisteredItemQuantity(board.cards, item, side);
    setRegisteredItemQuantity(item, side, currentQuantity + 1);
  }

  function decreaseRegisteredItemQuantity(
    item: RegisteredTradeItem,
    side: TradeSide,
  ) {
    const currentQuantity = getRegisteredItemQuantity(board.cards, item, side);
    setRegisteredItemQuantity(item, side, currentQuantity - 1);
  }

  function addUploadedCards(side: TradeSide, files: FileList) {
    const uploadCategory =
      selectedCategory === ALL_CATEGORIES_VALUE ? "benefit" : selectedCategory;
    const uploadBenefitSubcategory =
      uploadCategory === "benefit" &&
      selectedBenefitSubcategory !== ALL_BENEFIT_SUBCATEGORIES_VALUE &&
      selectedBenefitSubcategory !== NO_BENEFIT_SUBCATEGORY_VALUE
        ? selectedBenefitSubcategory
        : null;

    const newCards: QuantityTradeCard[] = Array.from(files)
      .filter((file) => file.type.startsWith("image/"))
      .map((file) => ({
        id: nanoid(),
        side,
        category: uploadCategory,
        imageUrl: URL.createObjectURL(file),
        workTitle: file.name.replace(/\.[^/.]+$/, ""),
        memo: "",
        imageRatio: "square",
        benefitSubcategory: uploadBenefitSubcategory,
        quantity: 1,
      }));

    if (newCards.length === 0) return;

    setBoard((prev) => ({
      ...prev,
      cards: [...prev.cards, ...newCards],
    }));
  }

  function updateCard(cardId: string, patch: Partial<QuantityTradeCard>) {
    setBoard((prev) => ({
      ...prev,
      cards: prev.cards.map((card) =>
        card.id === cardId ? { ...card, ...patch } : card,
      ),
    }));
  }

  function removeCard(cardId: string) {
    setBoard((prev) => ({
      ...prev,
      cards: prev.cards.filter((card) => card.id !== cardId),
    }));
  }

  function openAddModal(side: TradeSide) {
    setAddModalSide(side);
  }

  function closeAddModal() {
    setAddModalSide(null);
  }

  async function downloadImage() {
    if (!previewRef.current) return;

    try {
      setIsExporting(true);

      const dataUrl = await toPng(previewRef.current, {
        pixelRatio: EXPORT_IMAGE_WIDTH / PREVIEW_WIDTH,
        backgroundColor: "#ffffff",
        cacheBust: true,
      });

      const link = document.createElement("a");
      link.download = `${collection.slug}-trade-board.png`;
      link.href = dataUrl;
      link.click();
    } finally {
      setIsExporting(false);
    }
  }

  function resetBoard() {
    setSelectedConditions([]);
    setBoard(createInitialBoard());
  }

  const scaledPreviewHeight = Math.ceil(previewHeight * previewScale);

  return (
    <section className="w-full bg-neutral-100 px-4 pb-4 pt-5 sm:pb-5 sm:pt-6">
      <div className="mx-auto flex w-full max-w-md flex-col gap-5 sm:max-w-lg">
        <div className="w-full overflow-hidden rounded-[2rem] border border-neutral-200/70 bg-white p-5 shadow-[0_8px_26px_rgba(15,23,42,0.032)]">
          <div className="-mx-5 -mt-5 border-b border-neutral-200/70 bg-[linear-gradient(135deg,#efe7ff_0%,#d8efff_48%,#ffe1f2_100%)] px-5 pb-5 pt-5">
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

            <h1 className="text-2xl font-black text-neutral-950">
              {collection.title}
            </h1>

            {collection.description ? (
              <p className="mt-2 text-sm leading-6 text-neutral-500">
                {collection.description}
              </p>
            ) : (
              <p className="mt-2 text-sm leading-6 text-neutral-500">
                등록된 굿즈 이미지를 선택해 있어요 / 구해요 팝업 & 콜카 굿즈
                교환판을 만들 수 있습니다.
              </p>
            )}
          </div>

          <div className="mt-6 space-y-3">
            <section className="rounded-2xl border border-neutral-200 bg-neutral-50 p-4">
              <button
                type="button"
                onClick={() => setIsProfileOpen((prev) => !prev)}
                className="flex w-full items-center justify-between gap-3 text-left"
                aria-expanded={isProfileOpen}
              >
                <div>
                  <p className="text-sm font-black text-neutral-950">
                    닉네임 / SNS ID
                  </p>
                  <p className="mt-1 text-xs text-neutral-400">
                    필요할 때만 입력하시면 됩니다.
                  </p>
                </div>
              </button>

              {isProfileOpen ? (
                <div className="mt-4 grid grid-cols-2 gap-3">
                  <label className="block">
                    <span className="text-xs font-black text-neutral-500">
                      닉네임
                    </span>
                    <input
                      value={board.nickname}
                      onChange={(event) =>
                        updateBoardField("nickname", event.target.value)
                      }
                      className="mt-1 w-full rounded-2xl border border-neutral-200 bg-white px-3 py-3 text-sm outline-none focus:border-neutral-900"
                      placeholder="닉네임"
                    />
                  </label>

                  <label className="block">
                    <span className="text-xs font-black text-neutral-500">
                      SNS ID
                    </span>
                    <input
                      value={board.contact}
                      onChange={(event) =>
                        updateBoardField("contact", event.target.value)
                      }
                      className="mt-1 w-full rounded-2xl border border-neutral-200 bg-white px-3 py-3 text-sm outline-none focus:border-neutral-900"
                      placeholder="@example"
                    />
                  </label>
                </div>
              ) : null}
            </section>

            <section className="rounded-2xl border border-neutral-200 bg-neutral-50 p-4">
              <button
                type="button"
                onClick={() => setIsConditionsOpen((prev) => !prev)}
                className="flex w-full items-center justify-between gap-3 text-left"
                aria-expanded={isConditionsOpen}
              >
                <div>
                  <p className="text-sm font-black text-neutral-950">
                    거래 조건 선택
                  </p>
                  <p className="mt-1 text-xs text-neutral-400">
                    원하는 교환 조건을 선택할 수 있습니다
                  </p>
                </div>
              </button>

              {isConditionsOpen ? (
                <div className="mt-4 grid grid-cols-2 gap-2">
                  {TRADE_CONDITIONS.map((condition) => {
                    const checked = selectedConditions.includes(condition);

                    return (
                      <label
                        key={condition}
                        className={
                          checked
                            ? "flex cursor-pointer items-center gap-2 rounded-2xl bg-neutral-950 px-3 py-3 text-xs font-black text-white"
                            : "flex cursor-pointer items-center gap-2 rounded-2xl bg-white px-3 py-3 text-xs font-bold text-neutral-600 ring-1 ring-neutral-200"
                        }
                      >
                        <input
                          type="checkbox"
                          checked={checked}
                          onChange={() => toggleCondition(condition)}
                          className="h-4 w-4"
                        />
                        <span>{condition}</span>
                      </label>
                    );
                  })}
                </div>
              ) : null}
            </section>

            <section className="rounded-2xl border border-neutral-200 bg-neutral-50 p-4">
              <div className="flex items-start justify-between gap-3">
                <div>
                  <p className="text-sm font-black text-neutral-950">
                    교환판 구분 방식
                  </p>
                  <p className="mt-1 text-xs text-neutral-400">
                    굿즈 분류별로 나누거나, 한 번에 모아볼 수 있습니다.
                  </p>
                </div>
              </div>

              <div className="mt-3 grid grid-cols-2 gap-2">
                <button
                  type="button"
                  onClick={() => updateCategoryDisplayMode("grouped")}
                  className={
                    board.categoryDisplayMode !== "simple"
                      ? "rounded-2xl bg-neutral-950 px-3 py-3 text-xs font-black text-white"
                      : "rounded-2xl bg-white px-3 py-3 text-xs font-bold text-neutral-500 ring-1 ring-neutral-200"
                  }
                >
                  분류별 구분
                </button>

                <button
                  type="button"
                  onClick={() => updateCategoryDisplayMode("simple")}
                  className={
                    board.categoryDisplayMode === "simple"
                      ? "rounded-2xl bg-neutral-950 px-3 py-3 text-xs font-black text-white"
                      : "rounded-2xl bg-white px-3 py-3 text-xs font-bold text-neutral-500 ring-1 ring-neutral-200"
                  }
                >
                  구분 없이 보기
                </button>
              </div>
            </section>
          </div>

          <div className="mt-8 border-t border-neutral-100 pt-6">
            <h2 className="text-sm font-black text-neutral-950">
              교환 이미지 추가
            </h2>

            <div className="mt-4 grid grid-cols-2 gap-3">
              <AddSideButton
                title="있어요"
                emoji="🙋🏻‍♀️"
                count={haveCardCount}
                onClick={() => openAddModal("have")}
              />

              <AddSideButton
                title="구해요"
                emoji="❤️"
                count={wantCardCount}
                onClick={() => openAddModal("want")}
              />
            </div>
          </div>

          <div className="mt-8 border-t border-neutral-100 pt-6">
            <div className="flex items-center justify-between gap-3">
              <h2 className="text-sm font-black text-neutral-950">
                선택된 이미지
              </h2>

              <p className="text-xs font-bold text-neutral-400">
                총 {totalSelectedCount}개
              </p>
            </div>

            <div className="mt-4 space-y-3">
              {board.cards.length > 0 ? (
                board.cards.map((card) => (
                  <CardEditor
                    key={card.id}
                    card={card}
                    onUpdate={(patch) => updateCard(card.id, patch)}
                    onRemove={() => removeCard(card.id)}
                  />
                ))
              ) : (
                <p className="rounded-xl bg-neutral-50 px-3 py-6 text-center text-xs text-neutral-400">
                  아직 선택된 이미지가 없습니다.
                </p>
              )}
            </div>
          </div>

          <div className="mt-6 grid grid-cols-2 gap-2">
            <button
              type="button"
              onClick={resetBoard}
              className="rounded-2xl border border-neutral-300 bg-white px-5 py-4 text-sm font-bold text-neutral-700"
            >
              초기화
            </button>

            <button
              type="button"
              onClick={downloadImage}
              disabled={!canDownload || isExporting}
              className="rounded-2xl bg-neutral-950 px-5 py-4 text-sm font-black text-white disabled:cursor-not-allowed disabled:bg-neutral-300"
            >
              {isExporting ? "저장 중..." : "PNG 저장"}
            </button>
          </div>
        </div>

        <div className="w-full overflow-hidden rounded-[2rem] border border-neutral-200/80 bg-white p-4 shadow-[0_10px_28px_rgba(15,23,42,0.045)]">
          <div className="mb-3">
            <div className="text-sm font-black text-neutral-950">미리보기</div>
            <p className="mt-1 text-xs leading-5 text-neutral-400">
              화면에서는 모바일
              폭에 맞게 축소되어 보입니다.
            </p>
          </div>

          <div
            ref={previewAreaRef}
            className="w-full min-w-0 overflow-hidden rounded-2xl bg-white"
          >
            <div
              className="relative w-full"
              style={{
                height: scaledPreviewHeight,
              }}
            >
              <div
                style={{
                  width: PREVIEW_WIDTH,
                  transform: `scale(${previewScale})`,
                  transformOrigin: "top left",
                }}
              >
                <TradePreview
                  ref={previewRef}
                  board={board}
                  collectionTitle={collection.title}
                />
              </div>
            </div>
          </div>
        </div>
      </div>

      {addModalSide ? (
        <AddItemModal
          side={addModalSide}
          selectedWorkTitle={selectedWorkTitle}
          selectedCategory={selectedCategory}
          selectedBenefitSubcategory={selectedBenefitSubcategory}
          workTitleOptions={workTitleOptions}
          benefitSubcategoryOptions={benefitSubcategoryOptions}
          hasBenefitItemsWithoutSubcategory={hasBenefitItemsWithoutSubcategory}
          referenceImages={referenceImages}
          selectedCards={board.cards}
          filteredItems={filteredItems}
          onClose={closeAddModal}
          onChangeWorkTitle={setSelectedWorkTitle}
          onChangeCategory={changeCategoryFilter}
          onChangeBenefitSubcategory={changeBenefitSubcategoryFilter}
          onIncreaseItem={(item) =>
            increaseRegisteredItemQuantity(item, addModalSide)
          }
          onDecreaseItem={(item) =>
            decreaseRegisteredItemQuantity(item, addModalSide)
          }
          onUpload={(files) => addUploadedCards(addModalSide, files)}
        />
      ) : null}
    </section>
  );
}

type AddSideButtonProps = {
  title: string;
  emoji: string;
  count: number;
  onClick: () => void;
};

function AddSideButton({ title, emoji, count, onClick }: AddSideButtonProps) {
  return (
    <button
      type="button"
      onClick={onClick}
      aria-label={`${title} 이미지 추가${count > 0 ? `, 현재 ${count}개 선택됨` : ""}`}
      className="rounded-2xl border border-neutral-200 bg-neutral-50 px-3 py-2.5 text-left transition hover:border-neutral-950 hover:bg-white"
    >
      <div className="flex items-center justify-between gap-2">
        <span className="flex min-w-0 items-center gap-1.5">
          <span className="text-sm" aria-hidden="true">
            {emoji}
          </span>
          <span className="text-sm font-black text-neutral-950">{title}</span>
        </span>

        <span className="shrink-0 rounded-full bg-white px-2 py-0.5 text-[10px] font-black text-neutral-500 ring-1 ring-neutral-200">
          {count}개
        </span>
      </div>

      <p className="mt-1 text-[11px] font-black text-neutral-500">+ 추가</p>
    </button>
  );
}

type AddItemModalProps = {
  side: TradeSide;
  selectedWorkTitle: string;
  selectedCategory: CategoryFilterValue;
  selectedBenefitSubcategory: BenefitSubcategoryFilterValue;
  workTitleOptions: string[];
  benefitSubcategoryOptions: string[];
  hasBenefitItemsWithoutSubcategory: boolean;
  referenceImages: TradeReferenceImage[];
  selectedCards: TradeCard[];
  filteredItems: RegisteredTradeItem[];
  onClose: () => void;
  onChangeWorkTitle: (value: string) => void;
  onChangeCategory: (value: CategoryFilterValue) => void;
  onChangeBenefitSubcategory: (value: BenefitSubcategoryFilterValue) => void;
  onIncreaseItem: (item: RegisteredTradeItem) => void;
  onDecreaseItem: (item: RegisteredTradeItem) => void;
  onUpload: (files: FileList) => void;
};

function AddItemModal({
  side,
  selectedWorkTitle,
  selectedCategory,
  selectedBenefitSubcategory,
  workTitleOptions,
  benefitSubcategoryOptions,
  hasBenefitItemsWithoutSubcategory,
  referenceImages,
  selectedCards,
  filteredItems,
  onClose,
  onChangeWorkTitle,
  onChangeCategory,
  onChangeBenefitSubcategory,
  onIncreaseItem,
  onDecreaseItem,
  onUpload,
}: AddItemModalProps) {
  const sideLabel = side === "have" ? "있어요" : "구해요";
  const canUseBenefitSubcategoryFilter =
    (selectedCategory === ALL_CATEGORIES_VALUE ||
      selectedCategory === "benefit") &&
    (benefitSubcategoryOptions.length > 0 || hasBenefitItemsWithoutSubcategory);

  return (
    <div className="fixed inset-0 z-50 bg-neutral-950/50 px-4 py-5">
      <div className="mx-auto flex h-full w-full max-w-md flex-col overflow-hidden rounded-3xl bg-white shadow-xl sm:max-w-lg">
        <header className="shrink-0 p-5 pb-3">
          <div className="flex items-start justify-between gap-4">
            <div>
              <p className="text-xs font-black uppercase tracking-[0.2em] text-neutral-400">
                Add Item
              </p>

              <h2 className="mt-1 text-2xl font-black text-neutral-950">
                {sideLabel} 이미지 추가
              </h2>
            </div>

            <button
              type="button"
              onClick={onClose}
              className="flex h-10 w-10 items-center justify-center rounded-full bg-neutral-100 text-xl font-black text-neutral-500"
              aria-label="닫기"
            >
              ×
            </button>
          </div>

          <div className="mt-5 grid grid-cols-3 gap-2">
            <label className="block min-w-0">
              <span className="text-xs font-black text-neutral-500">
                작품별
              </span>

              <select
                value={selectedWorkTitle}
                onChange={(event) => onChangeWorkTitle(event.target.value)}
                className="mt-1 w-full rounded-2xl border border-neutral-200 bg-white px-2 py-3 text-xs outline-none focus:border-neutral-950"
              >
                <option value={ALL_WORKS_VALUE}>전체</option>

                {workTitleOptions.map((workTitle) => (
                  <option key={workTitle} value={workTitle}>
                    {workTitle}
                  </option>
                ))}
              </select>
            </label>

            <label className="block min-w-0">
              <span className="text-xs font-black text-neutral-500">
                굿즈 종류
              </span>

              <select
                value={selectedCategory}
                onChange={(event) =>
                  onChangeCategory(event.target.value as CategoryFilterValue)
                }
                className="mt-1 w-full rounded-2xl border border-neutral-200 bg-white px-2 py-3 text-xs outline-none focus:border-neutral-950"
              >
                <option value={ALL_CATEGORIES_VALUE}>전체</option>

                {TRADE_CATEGORIES.map((category) => (
                  <option key={category.id} value={category.id}>
                    {category.label}
                  </option>
                ))}
              </select>
            </label>

            <label className="block min-w-0">
              <span className="text-xs font-black text-neutral-500">
                특전 하위 분류
              </span>

              <select
                value={selectedBenefitSubcategory}
                onChange={(event) =>
                  onChangeBenefitSubcategory(event.target.value)
                }
                disabled={!canUseBenefitSubcategoryFilter}
                className="mt-1 w-full rounded-2xl border border-neutral-200 bg-white px-2 py-3 text-xs outline-none focus:border-neutral-950 disabled:cursor-not-allowed disabled:bg-neutral-100 disabled:text-neutral-300"
              >
                <option value={ALL_BENEFIT_SUBCATEGORIES_VALUE}>전체</option>

                {hasBenefitItemsWithoutSubcategory ? (
                  <option value={NO_BENEFIT_SUBCATEGORY_VALUE}>
                    하위 분류 없음
                  </option>
                ) : null}

                {benefitSubcategoryOptions.map((subcategory) => (
                  <option key={subcategory} value={subcategory}>
                    {subcategory}
                  </option>
                ))}
              </select>
            </label>
          </div>
        </header>

        <div className="flex-1 overflow-y-auto px-5 pb-5 pt-1">
          <GoodsWorkReference referenceImages={referenceImages} />

          {filteredItems.length > 0 ? (
            <div className="grid grid-cols-2 gap-3">
              {filteredItems.map((item) => {
                const quantity = getRegisteredItemQuantity(
                  selectedCards,
                  item,
                  side,
                );

                return (
                  <RegisteredItemCard
                    key={item.id}
                    item={item}
                    quantity={quantity}
                    onIncrease={() => onIncreaseItem(item)}
                    onDecrease={() => onDecreaseItem(item)}
                  />
                );
              })}
            </div>
          ) : (
            <p className="rounded-2xl bg-neutral-50 px-4 py-10 text-center text-xs text-neutral-400">
              선택한 조건에 등록된 이미지가 없습니다.
            </p>
          )}

          <details className="mt-6 rounded-2xl border border-neutral-200 bg-neutral-50 p-4">
            <summary className="cursor-pointer text-sm font-black text-neutral-950">
              직접 이미지 업로드
            </summary>

            <p className="mt-2 text-xs leading-5 text-neutral-500">
              직접 찍은 이미지를 교환판에 넣고 싶을 때 사용해 주세요.
              업로드한 이미지는 서버에 저장되지 않습니다.
            </p>

            <label className="mt-4 flex cursor-pointer items-center justify-center rounded-xl border border-dashed border-neutral-300 bg-white px-3 py-4 text-xs font-bold text-neutral-600 hover:border-neutral-900 hover:text-neutral-950">
              {sideLabel}에 직접 추가
              <input
                type="file"
                accept="image/*"
                multiple
                className="hidden"
                onChange={(event) => {
                  const files = event.target.files;
                  if (!files || files.length === 0) return;

                  onUpload(files);
                  event.target.value = "";
                }}
              />
            </label>
          </details>
        </div>

        <footer className="shrink-0 border-t border-neutral-100 p-4">
          <button
            type="button"
            onClick={onClose}
            className="w-full rounded-2xl bg-neutral-950 px-5 py-4 text-sm font-black text-white"
          >
            선택 완료
          </button>
        </footer>
      </div>
    </div>
  );
}

type GoodsWorkReferenceProps = {
  referenceImages: TradeReferenceImage[];
};

function GoodsWorkReference({ referenceImages }: GoodsWorkReferenceProps) {
  return (
    <details className="mb-4 border-b border-neutral-100 pb-4 pt-1">
      <summary className="flex cursor-pointer list-none items-center justify-between gap-3 rounded-2xl bg-neutral-50 px-3 py-2.5 text-left ring-1 ring-neutral-200 [&::-webkit-details-marker]:hidden">
        <span className="flex min-w-0 items-center gap-1.5">
          <span aria-hidden="true" className="shrink-0 text-xs leading-none">
            🔍
          </span>
          <span className="text-xs font-black leading-4 text-neutral-950">
            내가 뽑은 굿즈가 어떤 작품인지 모르겠다면?
          </span>
        </span>

        <span className="shrink-0 rounded-full bg-white px-2.5 py-1 text-[10px] font-black text-neutral-500 ring-1 ring-neutral-200">
          보기
        </span>
      </summary>

      {referenceImages.length > 0 ? (
        <div className="mt-3 max-h-80 space-y-3 overflow-y-auto pr-1">
          {referenceImages.map((image) => (
            <img
              key={image.id}
              src={image.imageUrl}
              alt="굿즈 작품 확인용 공지 이미지"
              className="w-full rounded-2xl bg-white object-contain ring-1 ring-neutral-200"
            />
          ))}
        </div>
      ) : (
        <p className="mt-3 rounded-xl bg-neutral-50 px-4 py-5 text-center text-xs leading-5 text-neutral-400 ring-1 ring-neutral-200">
          아직 작품 확인용 공지 이미지가 등록되어 있지 않습니다.
        </p>
      )}
    </details>
  );
}

type RegisteredItemCardProps = {
  item: RegisteredTradeItem;
  quantity: number;
  onIncrease: () => void;
  onDecrease: () => void;
};

function RegisteredItemCard({
  item,
  quantity,
  onIncrease,
  onDecrease,
}: RegisteredItemCardProps) {
  const selected = quantity > 0;
  const metaLabel = getItemMetaLabel(item);
  const imageRatio = getItemImageRatio(item);

  return (
    <article
      className={
        selected
          ? "overflow-hidden rounded-2xl border-2 border-neutral-950 bg-neutral-50 text-left shadow-sm"
          : "overflow-hidden rounded-2xl border border-neutral-300 bg-neutral-50 text-left shadow-sm"
      }
    >
      <div className="relative border-b border-neutral-200 bg-neutral-100">
        <img
          src={item.imageUrl}
          alt={item.itemName}
          className={`${getImageRatioClass(imageRatio)} w-full bg-white object-contain p-1.5`}
        />

        <button
          type="button"
          onClick={onIncrease}
          className="absolute right-1.5 top-1.5 rounded-full bg-neutral-950 px-2.5 py-1 text-[10px] font-black leading-none text-white shadow-sm"
          aria-label="이미지 추가"
        >
          + 추가
        </button>
      </div>

      <div className="p-2">
        <p className="line-clamp-1 text-[11px] font-black text-neutral-950">
          {item.workTitle}
        </p>
        <p className="mt-0.5 line-clamp-1 text-[10px] text-neutral-500">
          {metaLabel}
        </p>

        {selected ? (
          <div className="mt-2 flex items-center overflow-hidden rounded-lg border border-neutral-200 bg-neutral-50">
            <button
              type="button"
              onClick={onDecrease}
              className="flex h-8 flex-1 items-center justify-center text-sm font-black text-neutral-600"
              aria-label="수량 줄이기"
            >
              −
            </button>
            <span className="min-w-8 px-1 text-center text-xs font-black text-neutral-950">
              {quantity}
            </span>
            <button
              type="button"
              onClick={onIncrease}
              className="flex h-8 flex-1 items-center justify-center text-sm font-black text-neutral-600"
              aria-label="수량 늘리기"
            >
              +
            </button>
          </div>
        ) : null}
      </div>
    </article>
  );
}

type CardEditorProps = {
  card: TradeCard;
  onUpdate: (patch: Partial<QuantityTradeCard>) => void;
  onRemove: () => void;
};

function CardEditor({ card, onUpdate, onRemove }: CardEditorProps) {
  const quantity = getCardQuantity(card);
  const metaLabel = getCardMetaLabel(card);

  function decreaseQuantity() {
    if (quantity <= 1) {
      onRemove();
      return;
    }

    onUpdate({ quantity: quantity - 1 });
  }

  function increaseQuantity() {
    onUpdate({ quantity: quantity + 1 });
  }

  return (
    <div className="grid grid-cols-[64px_1fr] gap-3 rounded-xl bg-neutral-50 p-3">
      <div className="relative h-16 w-16 overflow-hidden rounded-lg bg-white">
        <img
          src={card.imageUrl}
          alt=""
          className="h-full w-full object-contain p-1"
        />

        {quantity > 1 ? (
          <span className="absolute right-1 top-1 rounded-full bg-neutral-950 px-1.5 py-0.5 text-[10px] font-black text-white">
            ×{quantity}
          </span>
        ) : null}
      </div>

      <div className="min-w-0 space-y-2">
        <div className="flex items-start gap-2">
          <div className="grid min-w-0 flex-1 grid-cols-2 gap-2">
            <select
              value={card.side}
              onChange={(event) =>
                onUpdate({
                  side: event.target.value as TradeSide,
                })
              }
              className="min-w-0 rounded-lg border border-neutral-200 bg-white px-2 py-1.5 text-xs outline-none"
              aria-label="있어요 또는 구해요"
            >
              <option value="have">있어요</option>
              <option value="want">구해요</option>
            </select>

            <select
              value={card.category}
              onChange={(event) =>
                onUpdate({
                  category: event.target.value as TradeCategory,
                })
              }
              className="min-w-0 rounded-lg border border-neutral-200 bg-white px-2 py-1.5 text-xs outline-none"
              aria-label="굿즈 종류"
            >
              {TRADE_CATEGORIES.map((category) => (
                <option key={category.id} value={category.id}>
                  {category.label}
                </option>
              ))}
            </select>
          </div>

          <button
            type="button"
            onClick={onRemove}
            aria-label="선택한 이미지 삭제"
            className="flex h-8 w-8 shrink-0 items-center justify-center rounded-full bg-white text-sm font-black text-neutral-400 shadow-sm ring-1 ring-neutral-200 hover:bg-red-50 hover:text-red-500 hover:ring-red-200"
          >
            ×
          </button>
        </div>

        <div className="flex min-w-0 items-start gap-2">
          <div className="min-w-0 flex-1 space-y-0.5 text-xs leading-5">
            <p className="truncate font-black text-neutral-950">
              {card.workTitle || "작품명 없음"}
            </p>
            <p className="truncate text-neutral-500">{metaLabel}</p>
          </div>

          <div className="flex h-8 shrink-0 items-center overflow-hidden rounded-full border border-neutral-200 bg-white">
            <button
              type="button"
              onClick={decreaseQuantity}
              className="flex h-8 w-7 items-center justify-center text-sm font-black text-neutral-500"
              aria-label="수량 줄이기"
            >
              −
            </button>
            <span className="min-w-6 px-0.5 text-center text-xs font-black text-neutral-950">
              {quantity}
            </span>
            <button
              type="button"
              onClick={increaseQuantity}
              className="flex h-8 w-7 items-center justify-center text-sm font-black text-neutral-500"
              aria-label="수량 늘리기"
            >
              +
            </button>
          </div>
        </div>
      </div>
    </div>
  );
}
