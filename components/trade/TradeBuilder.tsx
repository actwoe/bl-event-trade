"use client";

import { useEffect, useMemo, useRef, useState } from "react";
import { toPng } from "html-to-image";
import { nanoid } from "nanoid";
import {
  RegisteredTradeItem,
  TRADE_CATEGORIES,
  TradeBoard,
  TradeCard,
  TradeCategory,
  TradeCollectionSummary,
  TradeSide,
} from "@/lib/trade-types";
import { TradePreview } from "./TradePreview";

type TradeBuilderProps = {
  collection: TradeCollectionSummary;
  registeredItems: RegisteredTradeItem[];
};

const PREVIEW_WIDTH = 560;
const ALL_WORKS_VALUE = "all";
const ALL_CATEGORIES_VALUE = "all";

type CategoryFilterValue = TradeCategory | typeof ALL_CATEGORIES_VALUE;

type QuantityTradeCard = TradeCard & {
  quantity?: number;
  registeredItemId?: string;
};

const TRADE_CONDITIONS = [
  "현장 직거래 가능",
  "N:1 가능",
  "반택 거래",
  "일택 거래",
  "미세 하자 있음",
];

function createInitialBoard(): TradeBoard {
  return {
    nickname: "",
    contact: "",
    memo: "",
    cards: [],
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

export function TradeBuilder({
  collection,
  registeredItems,
}: TradeBuilderProps) {
  const [board, setBoard] = useState<TradeBoard>(() => createInitialBoard());
  const [selectedConditions, setSelectedConditions] = useState<string[]>([]);
  const [isProfileOpen, setIsProfileOpen] = useState(false);
  const [isConditionsOpen, setIsConditionsOpen] = useState(false);
  const [selectedWorkTitle, setSelectedWorkTitle] = useState(ALL_WORKS_VALUE);
  const [selectedCategory, setSelectedCategory] =
    useState<CategoryFilterValue>(ALL_CATEGORIES_VALUE);
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

  const filteredItems = useMemo(() => {
    return registeredItems.filter((item) => {
      const matchesWorkTitle =
        selectedWorkTitle === ALL_WORKS_VALUE ||
        item.workTitle === selectedWorkTitle;

      const matchesCategory =
        selectedCategory === ALL_CATEGORIES_VALUE ||
        item.category === selectedCategory;

      return matchesWorkTitle && matchesCategory;
    });
  }, [registeredItems, selectedWorkTitle, selectedCategory]);

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
    return board.cards.reduce((total, card) => total + getCardQuantity(card), 0);
  }, [board.cards]);

  const canDownload = useMemo(() => {
    return board.cards.length > 0;
  }, [board.cards]);

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

  function addRegisteredItem(item: RegisteredTradeItem, side: TradeSide) {
    setBoard((prev) => {
      const existingCard = prev.cards.find((card) =>
        isSameRegisteredCard(card, item, side),
      );

      if (existingCard) {
        return {
          ...prev,
          cards: prev.cards.map((card) =>
            card.id === existingCard.id
              ? {
                  ...card,
                  quantity: getCardQuantity(card) + 1,
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
        quantity: 1,
        registeredItemId: item.id,
      };

      return {
        ...prev,
        cards: [...prev.cards, newCard],
      };
    });
  }

  function addUploadedCards(side: TradeSide, files: FileList) {
    const newCards: QuantityTradeCard[] = Array.from(files)
      .filter((file) => file.type.startsWith("image/"))
      .map((file) => ({
        id: nanoid(),
        side,
        category:
          selectedCategory === ALL_CATEGORIES_VALUE
            ? "benefit"
            : selectedCategory,
        imageUrl: URL.createObjectURL(file),
        workTitle: file.name.replace(/\.[^/.]+$/, ""),
        memo: "",
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
        pixelRatio: 2,
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
    <section className="mx-auto flex w-full max-w-md flex-col gap-5 px-4 py-5 sm:max-w-lg">
      <div className="w-full overflow-hidden rounded-3xl bg-white p-5 shadow-sm">
        <div>
          <p className="text-xs font-black uppercase tracking-[0.2em] text-neutral-500">
            Trade Board Maker
          </p>

          <h1 className="mt-1 text-2xl font-black text-neutral-950">
            {collection.title}
          </h1>

          {collection.description ? (
            <p className="mt-2 text-sm leading-6 text-neutral-500">
              {collection.description}
            </p>
          ) : (
            <p className="mt-2 text-sm leading-6 text-neutral-500">
              등록된 굿즈 이미지를 선택해 있어요 / 구해요 교환판을 만들 수
              있습니다.
            </p>
          )}
        </div>

        <div className="mt-5 rounded-2xl bg-neutral-100 p-4 text-xs leading-6 text-neutral-600">
          <p>선택한 이미지는 교환판 생성 목적으로만 사용됩니다.</p>
          <p>완성된 이미지를 저장한 뒤 본인의 SNS에 직접 업로드해 주세요.</p>
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
                  필요할 때만 입력해 주세요.
                </p>
              </div>
              <span className="rounded-full bg-white px-3 py-1 text-xs font-black text-neutral-500">
                {isProfileOpen ? "접기" : "선택 입력"}
              </span>
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
                  체크한 조건만 교환판에 표시됩니다.
                </p>
              </div>
              <span className="rounded-full bg-white px-3 py-1 text-xs font-black text-neutral-500">
                {isConditionsOpen
                  ? "접기"
                  : `${selectedConditions.length}개 선택`}
              </span>
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

      <div className="w-full overflow-hidden rounded-3xl bg-white p-4 shadow-sm">
        <div className="mb-3">
          <div className="text-sm font-black text-neutral-950">미리보기</div>
          <p className="mt-1 text-xs leading-5 text-neutral-400">
            세로형 교환판으로 저장됩니다. 화면에서는 모바일 폭에 맞게 축소되어
            보입니다.
          </p>
        </div>

        <div
          ref={previewAreaRef}
          className="w-full min-w-0 overflow-hidden rounded-2xl bg-neutral-100"
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

      {addModalSide ? (
        <AddItemModal
          side={addModalSide}
          selectedWorkTitle={selectedWorkTitle}
          selectedCategory={selectedCategory}
          workTitleOptions={workTitleOptions}
          filteredItems={filteredItems}
          onClose={closeAddModal}
          onChangeWorkTitle={setSelectedWorkTitle}
          onChangeCategory={setSelectedCategory}
          onAddItem={(item) => addRegisteredItem(item, addModalSide)}
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
      className="rounded-3xl border border-neutral-200 bg-neutral-50 p-4 text-left transition hover:border-neutral-950 hover:bg-white"
    >
      <div className="flex items-center justify-between gap-3">
        <span className="text-2xl">{emoji}</span>
        <span className="rounded-full bg-white px-3 py-1 text-xs font-black text-neutral-500">
          {count}개
        </span>
      </div>

      <p className="mt-4 text-lg font-black text-neutral-950">{title}</p>

      <p className="mt-1 text-sm font-black text-neutral-500">+ 추가</p>
    </button>
  );
}

type AddItemModalProps = {
  side: TradeSide;
  selectedWorkTitle: string;
  selectedCategory: CategoryFilterValue;
  workTitleOptions: string[];
  filteredItems: RegisteredTradeItem[];
  onClose: () => void;
  onChangeWorkTitle: (value: string) => void;
  onChangeCategory: (value: CategoryFilterValue) => void;
  onAddItem: (item: RegisteredTradeItem) => void;
  onUpload: (files: FileList) => void;
};

function AddItemModal({
  side,
  selectedWorkTitle,
  selectedCategory,
  workTitleOptions,
  filteredItems,
  onClose,
  onChangeWorkTitle,
  onChangeCategory,
  onAddItem,
  onUpload,
}: AddItemModalProps) {
  const sideLabel = side === "have" ? "있어요" : "구해요";

  return (
    <div className="fixed inset-0 z-50 bg-neutral-950/50 px-4 py-5">
      <div className="mx-auto flex h-full w-full max-w-md flex-col overflow-hidden rounded-3xl bg-white shadow-xl sm:max-w-lg">
        <header className="shrink-0 border-b border-neutral-100 p-5">
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

          <div className="mt-5 grid grid-cols-2 gap-3">
            <label className="block">
              <span className="text-xs font-black text-neutral-500">
                굿즈 종류
              </span>

              <select
                value={selectedCategory}
                onChange={(event) =>
                  onChangeCategory(event.target.value as CategoryFilterValue)
                }
                className="mt-1 w-full rounded-2xl border border-neutral-200 bg-white px-3 py-3 text-sm outline-none focus:border-neutral-950"
              >
                <option value={ALL_CATEGORIES_VALUE}>전체</option>

                {TRADE_CATEGORIES.map((category) => (
                  <option key={category.id} value={category.id}>
                    {category.label}
                  </option>
                ))}
              </select>
            </label>

            <label className="block">
              <span className="text-xs font-black text-neutral-500">
                작품 선택
              </span>

              <select
                value={selectedWorkTitle}
                onChange={(event) => onChangeWorkTitle(event.target.value)}
                className="mt-1 w-full rounded-2xl border border-neutral-200 bg-white px-3 py-3 text-sm outline-none focus:border-neutral-950"
              >
                <option value={ALL_WORKS_VALUE}>전체</option>

                {workTitleOptions.map((workTitle) => (
                  <option key={workTitle} value={workTitle}>
                    {workTitle}
                  </option>
                ))}
              </select>
            </label>
          </div>
        </header>

        <div className="flex-1 overflow-y-auto p-5">
          {filteredItems.length > 0 ? (
            <div className="grid grid-cols-3 gap-3">
              {filteredItems.map((item) => (
                <RegisteredItemCard
                  key={item.id}
                  item={item}
                  onAdd={() => onAddItem(item)}
                />
              ))}
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
              등록되지 않은 이미지를 임시로 넣고 싶을 때만 사용해 주세요.
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

type RegisteredItemCardProps = {
  item: RegisteredTradeItem;
  onAdd: () => void;
};

function RegisteredItemCard({ item, onAdd }: RegisteredItemCardProps) {
  return (
    <button
      type="button"
      onClick={onAdd}
      className="overflow-hidden rounded-2xl border border-neutral-200 bg-white text-left transition hover:border-neutral-950"
    >
      <div className="relative bg-neutral-100">
        <img
          src={item.imageUrl}
          alt={item.itemName}
          className="aspect-[3/4] w-full bg-white object-contain p-1"
        />
      </div>

      <div className="p-2">
        <p className="line-clamp-1 text-[11px] font-black text-neutral-950">
          {item.workTitle}
        </p>
        <p className="mt-0.5 line-clamp-1 text-[10px] text-neutral-500">
          {item.itemName || "굿즈명 없음"}
        </p>

        <p className="mt-2 rounded-lg bg-neutral-950 px-2 py-1.5 text-center text-[10px] font-black text-white">
          추가
        </p>
      </div>
    </button>
  );
}

type CardEditorProps = {
  card: TradeCard;
  onUpdate: (patch: Partial<QuantityTradeCard>) => void;
  onRemove: () => void;
};

function CardEditor({ card, onUpdate, onRemove }: CardEditorProps) {
  const categoryLabel =
    TRADE_CATEGORIES.find((category) => category.id === card.category)?.label ??
    card.category;
  const quantity = getCardQuantity(card);

  function decreaseQuantity() {
    if (quantity <= 1) return;

    onUpdate({ quantity: quantity - 1 });
  }

  function increaseQuantity() {
    onUpdate({ quantity: quantity + 1 });
  }

  return (
    <div className="relative grid grid-cols-[64px_1fr] gap-3 rounded-xl bg-neutral-50 p-3 pr-10">
      <button
        type="button"
        onClick={onRemove}
        aria-label="선택한 이미지 삭제"
        className="absolute right-2 top-2 flex h-7 w-7 items-center justify-center rounded-full bg-white text-sm font-black text-neutral-400 shadow-sm ring-1 ring-neutral-200 hover:bg-red-50 hover:text-red-500 hover:ring-red-200"
      >
        ×
      </button>

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
        <div className="grid grid-cols-2 gap-2 pr-7">
          <select
            value={card.side}
            onChange={(event) =>
              onUpdate({
                side: event.target.value as TradeSide,
              })
            }
            className="rounded-lg border border-neutral-200 bg-white px-2 py-1.5 text-xs outline-none"
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
            className="rounded-lg border border-neutral-200 bg-white px-2 py-1.5 text-xs outline-none"
            aria-label="굿즈 종류"
          >
            {TRADE_CATEGORIES.map((category) => (
              <option key={category.id} value={category.id}>
                {category.label}
              </option>
            ))}
          </select>
        </div>

        <div className="flex items-center justify-between gap-3 pr-7">
          <div className="min-w-0 space-y-0.5 text-xs leading-5">
            <p className="truncate font-black text-neutral-950">
              {card.workTitle || "작품명 없음"}
            </p>
            <p className="truncate text-neutral-500">
              {card.memo || categoryLabel}
            </p>
          </div>

          <div className="flex shrink-0 items-center overflow-hidden rounded-full border border-neutral-200 bg-white">
            <button
              type="button"
              onClick={decreaseQuantity}
              disabled={quantity <= 1}
              className="flex h-8 w-8 items-center justify-center text-sm font-black text-neutral-500 disabled:text-neutral-200"
              aria-label="수량 줄이기"
            >
              −
            </button>
            <span className="min-w-8 px-1 text-center text-xs font-black text-neutral-950">
              {quantity}
            </span>
            <button
              type="button"
              onClick={increaseQuantity}
              className="flex h-8 w-8 items-center justify-center text-sm font-black text-neutral-500"
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
