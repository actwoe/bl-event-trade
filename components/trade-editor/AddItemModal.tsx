"use client";

import { useMemo, useState } from "react";
import { QuantityBadge } from "@/components/trade/QuantityBadge";
import { GoodsWorkReference } from "@/components/trade-editor/TradeEditorShared";
import { ProtectedGoodsImage } from "@/components/trade-editor/ProtectedGoodsImage";
import { getRegisteredItemQuantity } from "@/lib/trade-editor-core";
import {
  getBenefitSubcategoryLabel,
  getImageRatioClass,
  getItemImageRatio,
  getItemMetaLabel,
  sortKoreanTitles,
} from "@/lib/trade-editor-display";
import {
  RegisteredTradeItem,
  TradeCard,
  TradeCategory,
  TradeReferenceImage,
  TradeSide,
  TRADE_CATEGORIES,
} from "@/lib/trade-types";

const ALL_WORKS_VALUE = "all";
const ALL_CATEGORIES_VALUE = "all";
const ALL_BENEFIT_SUBCATEGORIES_VALUE = "all";
const NO_BENEFIT_SUBCATEGORY_VALUE = "__none__";

export type CategoryFilterValue = TradeCategory | typeof ALL_CATEGORIES_VALUE;
export type BenefitSubcategoryFilterValue = string;

export type UploadedCardMetadata = {
  workTitle: string;
  category: TradeCategory;
  benefitSubcategory: string | null;
};

export type AddItemModalProps = {
  side: TradeSide;
  selectedWorkTitle: string;
  selectedCategory: CategoryFilterValue;
  selectedBenefitSubcategory: BenefitSubcategoryFilterValue;
  workTitleOptions: string[];
  benefitSubcategoryOptions: string[];
  hasBenefitItemsWithoutSubcategory: boolean;
  referenceImages: TradeReferenceImage[];
  registeredItems: RegisteredTradeItem[];
  selectedCards: TradeCard[];
  filteredItems: RegisteredTradeItem[];
  onClose: () => void;
  onChangeWorkTitle: (value: string) => void;
  onChangeCategory: (value: CategoryFilterValue) => void;
  onChangeBenefitSubcategory: (value: BenefitSubcategoryFilterValue) => void;
  onIncreaseItem: (item: RegisteredTradeItem) => void;
  onDecreaseItem: (item: RegisteredTradeItem) => void;
  onUpload: (files: FileList, metadata: UploadedCardMetadata) => void;
  variant?: "lab" | "default";
};

export function AddItemModal({
  side,
  selectedWorkTitle,
  selectedCategory,
  selectedBenefitSubcategory,
  workTitleOptions,
  benefitSubcategoryOptions,
  hasBenefitItemsWithoutSubcategory,
  referenceImages,
  registeredItems,
  selectedCards,
  filteredItems,
  onClose,
  onChangeWorkTitle,
  onChangeCategory,
  onChangeBenefitSubcategory,
  onIncreaseItem,
  onDecreaseItem,
  onUpload,
  variant = "default",
}: AddItemModalProps) {
  const sideKoreanLabel = side === "have" ? "있어요" : "구해요";
  const sideEnglishLabel = side === "have" ? "Have" : "Want";
  const sideLabel =
    variant === "lab"
      ? `${sideKoreanLabel} (${sideEnglishLabel})`
      : sideKoreanLabel;
  const canUseBenefitSubcategoryFilter =
    (selectedCategory === ALL_CATEGORIES_VALUE ||
      selectedCategory === "benefit") &&
    (benefitSubcategoryOptions.length > 0 || hasBenefitItemsWithoutSubcategory);
  const initialUploadWorkTitle =
    selectedWorkTitle !== ALL_WORKS_VALUE
      ? selectedWorkTitle
      : workTitleOptions[0] ?? "";
  const initialUploadCategory: TradeCategory =
    selectedCategory !== ALL_CATEGORIES_VALUE ? selectedCategory : "benefit";
  const [uploadWorkTitle, setUploadWorkTitle] = useState(initialUploadWorkTitle);
  const [uploadCategory, setUploadCategory] =
    useState<TradeCategory>(initialUploadCategory);
  const [uploadBenefitSubcategory, setUploadBenefitSubcategory] = useState(
    selectedBenefitSubcategory !== ALL_BENEFIT_SUBCATEGORIES_VALUE &&
      selectedBenefitSubcategory !== NO_BENEFIT_SUBCATEGORY_VALUE
      ? selectedBenefitSubcategory
      : "",
  );
  const [uploadedFileCount, setUploadedFileCount] = useState(0);
  const [uploadedPreviewUrls, setUploadedPreviewUrls] = useState<string[]>([]);
  const uploadBenefitSubcategoryOptions = useMemo(() => {
    const values = registeredItems
      .filter(
        (item) =>
          item.category === "benefit" &&
          (!uploadWorkTitle || item.workTitle === uploadWorkTitle),
      )
      .map((item) => getBenefitSubcategoryLabel(item.benefitSubcategory))
      .filter(Boolean);

    return sortKoreanTitles(Array.from(new Set(values)));
  }, [registeredItems, uploadWorkTitle]);

  return (
    <div className="fixed inset-0 z-50 bg-neutral-950/50 px-4 py-5">
      <div className="mx-auto flex h-full w-full max-w-md flex-col overflow-hidden rounded-3xl bg-white shadow-xl sm:max-w-lg">
        <header className="shrink-0 p-5 pb-3">
          <div className="flex items-start justify-between gap-4">
            <div>
              <p className="text-xs font-black uppercase tracking-[0.2em] text-neutral-400">
                {variant === "lab" ? `Add ${sideEnglishLabel} Item` : "Add Item"}
              </p>

              <h2 className="mt-1 text-2xl font-black text-neutral-950">
                {sideKoreanLabel} 이미지 추가
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

                {variant === "default" && hasBenefitItemsWithoutSubcategory ? (
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

          <details className="mb-4 rounded-2xl border border-neutral-200 bg-neutral-50 p-4">
            <summary className="flex cursor-pointer list-none items-center justify-between gap-3 text-sm font-black text-neutral-950 [&::-webkit-details-marker]:hidden">
              <span>직접 이미지 업로드</span>
              {uploadedFileCount > 0 ? (
                <span className="shrink-0 rounded-full bg-emerald-100 px-2.5 py-1 text-[10px] font-black text-emerald-700">
                  {uploadedFileCount}장 추가 완료
                </span>
              ) : (
                <span className="shrink-0 rounded-full bg-white px-2.5 py-1 text-[10px] font-black text-neutral-400 ring-1 ring-neutral-200">
                  열기
                </span>
              )}
            </summary>

            <p className="mt-2 text-xs leading-5 text-neutral-500">
              직접 찍은 이미지를 교환판에 넣고 싶을 때 사용해 주세요.
              {variant === "default"
                ? " 파일명 대신 아래에서 선택한 작품명과 분류가 표시됩니다."
                : null}
            </p>

            <div className="mt-4 grid grid-cols-2 gap-2">
              <label className="block min-w-0">
                <span className="text-[11px] font-black text-neutral-500">작품명</span>
                <select
                  value={uploadWorkTitle}
                  onChange={(event) => {
                    setUploadWorkTitle(event.target.value);
                    setUploadBenefitSubcategory("");
                  }}
                  className="mt-1 w-full rounded-xl border border-neutral-200 bg-white px-3 py-2.5 text-xs outline-none focus:border-neutral-950"
                >
                  <option value="">작품 선택</option>
                  {workTitleOptions.map((workTitle) => (
                    <option key={workTitle} value={workTitle}>
                      {workTitle}
                    </option>
                  ))}
                </select>
              </label>

              <label className="block min-w-0">
                <span className="text-[11px] font-black text-neutral-500">굿즈 종류</span>
                <select
                  value={uploadCategory}
                  onChange={(event) => {
                    const category = event.target.value as TradeCategory;
                    setUploadCategory(category);
                    if (category !== "benefit") setUploadBenefitSubcategory("");
                  }}
                  className="mt-1 w-full rounded-xl border border-neutral-200 bg-white px-3 py-2.5 text-xs outline-none focus:border-neutral-950"
                >
                  {TRADE_CATEGORIES.map((category) => (
                    <option key={category.id} value={category.id}>
                      {category.label}
                    </option>
                  ))}
                </select>
              </label>
            </div>

            {uploadCategory === "benefit" ? (
              <label className="mt-2 block">
                <span className="text-[11px] font-black text-neutral-500">
                  특전 하위 분류
                </span>
                <select
                  value={uploadBenefitSubcategory}
                  onChange={(event) =>
                    setUploadBenefitSubcategory(event.target.value)
                  }
                  className="mt-1 w-full rounded-xl border border-neutral-200 bg-white px-3 py-2.5 text-xs outline-none focus:border-neutral-950"
                >
                  {variant === "default" ? (
                    <option value="">하위 분류 없음</option>
                  ) : null}
                  {uploadBenefitSubcategoryOptions.map((subcategory) => (
                    <option key={subcategory} value={subcategory}>
                      {subcategory}
                    </option>
                  ))}
                </select>
              </label>
            ) : null}

            <label
              className={`mt-4 flex items-center justify-center rounded-xl border border-dashed px-3 py-4 text-xs font-bold ${
                uploadWorkTitle
                  ? "cursor-pointer border-neutral-300 bg-white text-neutral-600 hover:border-neutral-900 hover:text-neutral-950"
                  : "cursor-not-allowed border-neutral-200 bg-neutral-100 text-neutral-300"
              }`}
            >
              {sideLabel}에 직접 추가
              <input
                type="file"
                accept="image/*"
                multiple
                disabled={!uploadWorkTitle}
                className="hidden"
                onChange={(event) => {
                  const files = event.target.files;
                  if (!files || files.length === 0 || !uploadWorkTitle) return;

                  onUpload(files, {
                    workTitle: uploadWorkTitle,
                    category: uploadCategory,
                    benefitSubcategory:
                      uploadCategory === "benefit"
                        ? uploadBenefitSubcategory || null
                        : null,
                  });

                  setUploadedPreviewUrls((currentUrls) => {
                    currentUrls.forEach((url) => URL.revokeObjectURL(url));
                    return Array.from(files)
                      .filter((file) => file.type.startsWith("image/"))
                      .slice(0, 4)
                      .map((file) => URL.createObjectURL(file));
                  });
                  setUploadedFileCount(files.length);
                  event.target.value = "";
                }}
              />
            </label>

            {uploadedFileCount > 0 ? (
              <div className="mt-3 rounded-xl bg-emerald-50 p-3 ring-1 ring-emerald-200">
                <p className="text-center text-xs font-black text-emerald-700">
                  이미지 {uploadedFileCount}장이 {sideLabel}에 추가되었습니다.
                </p>
                {uploadedPreviewUrls.length > 0 ? (
                  <div className="mt-3 flex justify-center gap-2 overflow-hidden">
                    {uploadedPreviewUrls.map((url, index) => (
                      <img
                        key={url}
                        src={url}
                        alt={`추가된 직접 이미지 ${index + 1}`}
                        className="h-14 w-14 rounded-lg bg-white object-cover ring-1 ring-emerald-200"
                      />
                    ))}
                  </div>
                ) : null}
              </div>
            ) : null}
          </details>

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
                    variant={variant}
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
  quantity: number;
  onIncrease: () => void;
  onDecrease: () => void;
  variant: "lab" | "default";
};

function RegisteredItemCard({
  item,
  quantity,
  onIncrease,
  onDecrease,
  variant,
}: RegisteredItemCardProps) {
  const selected = quantity > 0;
  const metaLabel = getItemMetaLabel(item);
  const imageRatio = getItemImageRatio(item);

  return (
    <article
      role="button"
      tabIndex={0}
      onClick={onIncrease}
      onKeyDown={(event) => {
        if (event.key === "Enter" || event.key === " ") {
          event.preventDefault();
          onIncrease();
        }
      }}
      aria-label={`${item.workTitle} 수량 늘리기`}
      className={
        selected
          ? "cursor-pointer overflow-hidden rounded-2xl border-2 border-neutral-950 bg-neutral-50 text-left shadow-sm"
          : "cursor-pointer overflow-hidden rounded-2xl border border-neutral-300 bg-neutral-50 text-left shadow-sm"
      }
    >
      <div className="w-full text-left">
        <div
          className={`relative border-b border-neutral-200 bg-neutral-50 p-2 ${
            variant === "lab" ? "leading-none" : ""
          }`}
        >
          <ProtectedGoodsImage
            src={item.imageUrl}
            alt={item.itemName}
            loading="lazy"
            decoding="async"
            className={`${getImageRatioClass(imageRatio)} ${
              variant === "lab" ? "block align-top" : ""
            } w-full rounded-xl bg-white object-contain`}
          />

          <QuantityBadge quantity={quantity} />
        </div>

        <div className="p-2">
          <p className="line-clamp-1 text-center text-[11px] font-black text-neutral-950">
            {item.workTitle}
          </p>
          <p className="mt-0.5 line-clamp-1 text-center text-[10px] text-neutral-500">
            {metaLabel}
          </p>
        </div>
      </div>

      <div className="px-2 pb-2" onClick={(event) => event.stopPropagation()}>
        {selected ? (
          <div className="flex items-center overflow-hidden rounded-lg border border-neutral-200 bg-neutral-50">
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
        ) : (
          <button
            type="button"
            onClick={onIncrease}
            className="flex h-8 w-full items-center justify-center rounded-lg bg-neutral-950 text-sm font-black text-white"
            aria-label="수량 늘리기"
          >
            +
          </button>
        )}
      </div>
    </article>
  );
}
