"use client";

import { useState, type ReactNode } from "react";
import {
  RegisteredTradeItem,
  TradeReferenceImage,
  TradeCollectionSummary,
} from "@/lib/trade-types";
import { UiLabPreview } from "@/components/ui-lab/UiLabPreview";
import { TRADE_BOARD_MODES, TRADE_CONDITIONS } from "@/lib/trade-editor-core";
import {
  renderTradePreviewToPngBlob,
  saveTradePngBlob,
} from "@/lib/trade-png-export";
import { SelectedTradeCards } from "@/components/trade-editor/SelectedTradeCards";
import { AddItemModal } from "@/components/trade-editor/AddItemModal";
import {
  AddSideButton,
  ExportPreviewModal,
} from "@/components/trade-editor/TradeEditorShared";
import { useTradeEditorState } from "@/hooks/useTradeEditorState";

export type TradeEditorProps = {
  collection: TradeCollectionSummary & {
    eventStartDate?: string | null;
    eventEndDate?: string | null;
  };
  registeredItems: RegisteredTradeItem[];
  referenceImages: TradeReferenceImage[];
};

export type TradeEditorViewProps = TradeEditorProps & {
  editorState: ReturnType<typeof useTradeEditorState>;
  variant: "lab" | "production";
  embedded?: boolean;
  header?: ReactNode;
  saveSection?: ReactNode;
  onReset?: () => void;
};

const TRADE_LAB_FONT_FAMILY = "'Pretendard', Arial, sans-serif";

export function TradeEditorView({
  collection,
  registeredItems,
  referenceImages,
  editorState,
  variant,
  embedded = false,
  header,
  saveSection,
  onReset,
}: TradeEditorViewProps) {
  const [isSelectedImagesOpen, setIsSelectedImagesOpen] = useState(true);

  const {
    board,
    selectedConditions,
    isProfileOpen,
    setIsProfileOpen,
    isConditionsOpen,
    setIsConditionsOpen,
    selectedWorkTitle,
    setSelectedWorkTitle,
    selectedCategory,
    selectedBenefitSubcategory,
    addModalSide,
    isExporting,
    setIsExporting,
    exportPreviewUrl,
    setExportPreviewUrl,
    previewRef,
    workTitleOptions,
    benefitSubcategoryOptions,
    hasBenefitItemsWithoutSubcategory,
    filteredItems,
    haveCards,
    wantCards,
    haveCardCount,
    wantCardCount,
    totalSelectedCount,
    canDownload,
    updateBoardField,
    toggleCondition,
    updateCategoryDisplayMode,
    updateBoardMode,
    changeCategoryFilter,
    changeBenefitSubcategoryFilter,
    increaseRegisteredItemQuantity,
    decreaseRegisteredItemQuantity,
    addUploadedCards,
    updateCard,
    removeCard,
    openAddModal,
    closeAddModal,
    resetEditor,
  } = editorState;

  const boardMode = board.boardMode ?? "trade";
  const activeBoardMode =
    TRADE_BOARD_MODES.find((mode) => mode.id === boardMode) ??
    TRADE_BOARD_MODES[0];

  async function downloadImage() {
    if (!canDownload) return;

    try {
      setIsExporting(true);
      const previewNode = previewRef.current;
      if (!previewNode) throw new Error("미리보기 영역을 찾지 못했습니다.");
      const blob = await renderTradePreviewToPngBlob(previewNode);

      await saveTradePngBlob(
        blob,
        `${collection.slug}-${boardMode}-board.png`,
        setExportPreviewUrl,
      );
    } catch (error) {
      console.error("교환판 PNG 저장에 실패했습니다.", error);
      const message =
        error instanceof Error ? error.message : "알 수 없는 오류";
      window.alert(`이미지 저장에 실패했습니다.\n${message}`);
    } finally {
      setIsExporting(false);
    }
  }

  function resetBoard() {
    if (onReset) {
      onReset();
      return;
    }
    resetEditor();
  }

  return (
    <section
      data-ui-lab-version={variant === "lab" ? "2026-07-11-b" : undefined}
      className={
        variant === "lab"
          ? "w-full bg-white"
          : embedded
            ? "w-full min-w-0 overflow-x-hidden"
            : "w-full bg-neutral-100 px-4 pb-4 pt-5 sm:pb-5 sm:pt-6"
      }
      style={variant === "lab" ? { fontFamily: TRADE_LAB_FONT_FAMILY } : undefined}
    >
      <div
        className={
          variant === "lab"
            ? "w-full"
            : embedded
              ? "w-full min-w-0 overflow-x-hidden"
              : "mx-auto flex w-full max-w-md flex-col gap-5 sm:max-w-lg"
        }
      >
        <div
          className={
            variant === "lab"
              ? "w-full bg-white px-5 pb-5 pt-3"
              : embedded
                ? "w-full min-w-0 overflow-x-hidden bg-white px-5 pb-5 pt-3"
                : "w-full overflow-hidden rounded-[2rem] border border-neutral-200/70 bg-white p-5 shadow-[0_8px_26px_rgba(15,23,42,0.032)]"
          }
        >
          {header}
          <div className={variant === "production" && !embedded ? "mt-6 space-y-3" : "space-y-3"}>
            <section className="border-b border-neutral-100 pb-4">
              <div className="mb-3">
                <h2 className="text-sm font-black text-neutral-950">
                  만들 판 유형
                </h2>
                <p className="mt-1 text-xs leading-5 text-neutral-400">
                  용도에 맞는 판을 선택해 주세요. 선택한 굿즈는 유형에 맞게 한쪽으로 정리됩니다.
                </p>
              </div>

              <div
                className="grid grid-cols-3 rounded-2xl bg-neutral-100 p-1"
                role="group"
                aria-label="굿즈판 유형"
              >
                {TRADE_BOARD_MODES.map((mode) => {
                  const active = mode.id === boardMode;

                  return (
                    <button
                      key={mode.id}
                      type="button"
                      onClick={() => updateBoardMode(mode.id)}
                      aria-pressed={active}
                      className={
                        active
                          ? "rounded-xl bg-white px-2 py-2.5 text-xs font-black text-neutral-950 shadow-[0_1px_4px_rgba(15,23,42,0.10)] ring-1 ring-neutral-200"
                          : "rounded-xl px-2 py-2.5 text-xs font-bold text-neutral-500"
                      }
                    >
                      {mode.label}
                    </button>
                  );
                })}
              </div>

              <p className="mt-2 text-center text-[11px] font-semibold leading-4 text-neutral-400">
                {activeBoardMode.description}
              </p>
            </section>

            <section className="rounded-2xl border border-neutral-200 bg-neutral-50 p-4">
              <div className="flex items-start justify-between gap-3">
                <button
                  type="button"
                  onClick={() => setIsProfileOpen((prev) => !prev)}
                  className="min-w-0 flex-1 text-left"
                  aria-expanded={isProfileOpen}
                >
                  <p className="text-sm font-black text-neutral-950">
                    닉네임 / SNS ID
                  </p>
                  <p className="mt-1 text-xs text-neutral-400">
                    필요할 때만 입력하시면 됩니다.
                  </p>
                </button>

                {isProfileOpen ? (
                  <button
                    type="button"
                    onClick={() => setIsProfileOpen(false)}
                    className="shrink-0 rounded-full bg-white px-3 py-1.5 text-[11px] font-black text-neutral-500 ring-1 ring-neutral-200"
                  >
                    접기
                  </button>
                ) : null}
              </div>

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
                      className="mt-1 w-full rounded-2xl border border-neutral-200 bg-white px-3 py-3 text-sm outline-none focus:border-[#7C5CFC]"
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
                      className="mt-1 w-full rounded-2xl border border-neutral-200 bg-white px-3 py-3 text-sm outline-none focus:border-[#7C5CFC]"
                      placeholder="@example"
                    />
                  </label>
                </div>
              ) : null}
            </section>

            <section className="rounded-2xl border border-neutral-200 bg-neutral-50 p-4">
              <div className="flex items-start justify-between gap-3">
                <button
                  type="button"
                  onClick={() => setIsConditionsOpen((prev) => !prev)}
                  className="min-w-0 flex-1 text-left"
                  aria-expanded={isConditionsOpen}
                >
                  <p className="text-sm font-black text-neutral-950">
                    거래 조건 선택
                  </p>
                  <p className="mt-1 text-xs text-neutral-400">
                    원하는 교환 조건을 선택할 수 있습니다
                  </p>
                </button>

                {isConditionsOpen ? (
                  <button
                    type="button"
                    onClick={() => setIsConditionsOpen(false)}
                    className="shrink-0 rounded-full bg-white px-3 py-1.5 text-[11px] font-black text-neutral-500 ring-1 ring-neutral-200"
                  >
                    접기
                  </button>
                ) : null}
              </div>

              {isConditionsOpen ? (
                <div className="mt-4 grid grid-cols-2 gap-2">
                  {TRADE_CONDITIONS.map((condition) => {
                    const checked = selectedConditions.includes(condition);

                    return (
                      <label
                        key={condition}
                        className={
                          checked
                            ? "flex min-h-[44px] cursor-pointer items-center gap-2 rounded-2xl bg-neutral-950 px-3 py-2.5 text-[11px] font-black text-white"
                            : "flex min-h-[44px] cursor-pointer items-center gap-2 rounded-2xl bg-white px-3 py-2.5 text-[11px] font-bold text-neutral-600 ring-1 ring-neutral-200"
                        }
                      >
                        <input
                          type="checkbox"
                          checked={checked}
                          onChange={() => toggleCondition(condition)}
                          className="h-4 w-4 accent-[#7C5CFC]"
                        />
                        <span className="whitespace-nowrap leading-4">
                          {condition}
                        </span>
                      </label>
                    );
                  })}
                </div>
              ) : null}
            </section>
          </div>

          <div className="mt-6 border-t border-neutral-100 pt-5">
            <h2 className="text-sm font-black text-neutral-950">
              {boardMode === "sell"
                ? "양도 이미지 추가"
                : boardMode === "wanted"
                  ? "구해요 이미지 추가"
                  : "교환 이미지 추가"}
            </h2>

            <div
              className={`mt-4 grid gap-3 ${
                boardMode === "trade" ? "grid-cols-2" : "grid-cols-1"
              }`}
            >
              {boardMode !== "wanted" ? (
                <AddSideButton
                  koreanTitle={boardMode === "sell" ? "양도해요" : "있어요"}
                  englishTitle={boardMode === "sell" ? "SELL" : "Have"}
                  iconSrc="/trade-icons/have.png"
                  count={haveCardCount}
                  onClick={() => openAddModal("have")}
                />
              ) : null}

              {boardMode !== "sell" ? (
                <AddSideButton
                  koreanTitle="구해요"
                  englishTitle="Want"
                  iconSrc="/trade-icons/want.png"
                  count={wantCardCount}
                  onClick={() => openAddModal("want")}
                />
              ) : null}
            </div>
          </div>

          <div className="mt-6 border-t border-neutral-100 pt-5">
            <div className="flex items-start justify-between gap-3">
              <button
                type="button"
                onClick={() => setIsSelectedImagesOpen((prev) => !prev)}
                className="min-w-0 flex-1 text-left"
                aria-expanded={isSelectedImagesOpen}
              >
                <h2 className="text-sm font-black text-neutral-950">
                  선택된 이미지
                </h2>
                <p className="mt-1 text-xs font-bold text-neutral-400">
                  총 {totalSelectedCount}개
                </p>
              </button>

              <button
                type="button"
                onClick={() => setIsSelectedImagesOpen((prev) => !prev)}
                className="shrink-0 rounded-full bg-white px-3 py-1.5 text-[11px] font-black text-neutral-500 ring-1 ring-neutral-200"
                aria-expanded={isSelectedImagesOpen}
              >
                {isSelectedImagesOpen ? "접기" : "펼치기"}
              </button>
            </div>

            {isSelectedImagesOpen ? (
              <div className="mt-4 space-y-5">
                {board.cards.length > 0 ? (
                  <>
                    {haveCards.length > 0 && boardMode !== "wanted" ? (
                      <SelectedTradeCards
                        title={boardMode === "sell" ? "양도해요" : "있어요"}
                        cards={haveCards}
                        boardMode={boardMode}
                        onUpdate={updateCard}
                        onRemove={removeCard}
                        sideLabelMode="bilingual"
                      />
                    ) : null}

                    {wantCards.length > 0 && boardMode !== "sell" ? (
                      <SelectedTradeCards
                        title="구해요"
                        cards={wantCards}
                        boardMode={boardMode}
                        onUpdate={updateCard}
                        onRemove={removeCard}
                        sideLabelMode="bilingual"
                      />
                    ) : null}
                  </>
                ) : (
                  <p className="rounded-xl bg-neutral-50 px-3 py-6 text-center text-xs text-neutral-400">
                    아직 선택된 이미지가 없습니다.
                  </p>
                )}
              </div>
            ) : null}
          </div>

          {saveSection}

          <div className="mt-5">
            <button
              type="button"
              onClick={resetBoard}
              className="w-full rounded-xl border border-neutral-300 bg-white px-4 py-3 text-xs font-bold text-neutral-700"
            >
              초기화
            </button>
          </div>
          <section className="-mx-5 mt-7 border-t border-neutral-200 px-5 pb-1 pt-5">
          <div className="mb-3">
            <div className="text-sm font-black text-neutral-950">미리보기</div>
            <p className="mt-1 text-xs leading-5 text-neutral-400">
              화면에서는 모바일 폭에 맞게 축소되어 보입니다.
            </p>
          </div>

          {boardMode === "trade" ? (
            <div className="mb-4 mt-3 grid grid-cols-2 rounded-full bg-neutral-100 p-1">
              <button
                type="button"
                onClick={() => updateCategoryDisplayMode("grouped")}
                aria-pressed={board.categoryDisplayMode !== "simple"}
                className={
                  board.categoryDisplayMode !== "simple"
                    ? "rounded-full bg-white px-3 py-2.5 text-xs font-black text-neutral-950 shadow-[0_1px_4px_rgba(15,23,42,0.10)] ring-1 ring-neutral-200"
                    : "rounded-full px-3 py-2.5 text-xs font-bold text-neutral-500"
                }
              >
                같은 종류끼리 교환
              </button>
              <button
                type="button"
                onClick={() => updateCategoryDisplayMode("simple")}
                aria-pressed={board.categoryDisplayMode === "simple"}
                className={
                  board.categoryDisplayMode === "simple"
                    ? "rounded-full bg-white px-3 py-2.5 text-xs font-black text-neutral-950 shadow-[0_1px_4px_rgba(15,23,42,0.10)] ring-1 ring-neutral-200"
                    : "rounded-full px-3 py-2.5 text-xs font-bold text-neutral-500"
                }
              >
                종류 구분 없이 교환 (교차)
              </button>
            </div>
          ) : (
            <p className="mb-4 mt-3 rounded-2xl bg-neutral-50 px-4 py-3 text-center text-xs font-bold leading-5 text-neutral-500 ring-1 ring-neutral-200">
              특전 하위 분류와 굿즈 종류별로 자동 구분됩니다.
            </p>
          )}

          <div className="w-full min-w-0 max-w-full overflow-hidden bg-white">
            <UiLabPreview
              ref={previewRef}
              responsive
              board={board}
              collectionTitle={collection.title}
            />
          </div>

          <button
            type="button"
            onClick={downloadImage}
            disabled={!canDownload || isExporting}
            className="mt-4 flex w-full items-center justify-center gap-2 rounded-xl border border-[#7C5CFC] bg-[#F8F6FF] px-4 py-3 text-sm font-black text-[#7C5CFC] shadow-sm transition hover:bg-[#F1ECFF] disabled:cursor-not-allowed disabled:border-neutral-200 disabled:bg-neutral-100 disabled:text-neutral-400"
          >
            {isExporting ? (
              "저장 중..."
            ) : (
              <>
                <svg
                  viewBox="0 0 24 24"
                  aria-hidden="true"
                  className="h-5 w-5 fill-none stroke-current"
                  strokeWidth="1.9"
                >
                  <path d="M12 3v11m0 0 4-4m-4 4-4-4" />
                  <path d="M5 17.5v2h14v-2" />
                </svg>
                <span>PNG 저장</span>
              </>
            )}
          </button>
          </section>
        </div>
      </div>

      {addModalSide ? (
        <AddItemModal
          side={addModalSide}
          boardMode={boardMode}
          variant={variant === "lab" ? "lab" : "default"}
          selectedWorkTitle={selectedWorkTitle}
          selectedCategory={selectedCategory}
          selectedBenefitSubcategory={selectedBenefitSubcategory}
          workTitleOptions={workTitleOptions}
          benefitSubcategoryOptions={benefitSubcategoryOptions}
          hasBenefitItemsWithoutSubcategory={hasBenefitItemsWithoutSubcategory}
          referenceImages={referenceImages}
          registeredItems={registeredItems}
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
          onUpload={(files, metadata) =>
            addUploadedCards(addModalSide, files, metadata)
          }
        />
      ) : null}

      {exportPreviewUrl ? (
        <ExportPreviewModal
          imageUrl={exportPreviewUrl}
          onClose={() => setExportPreviewUrl(null)}
        />
      ) : null}
    </section>
  );
}


export function TradeEditor(props: TradeEditorProps) {
  const editorState = useTradeEditorState(props.registeredItems);

  return (
    <TradeEditorView
      {...props}
      editorState={editorState}
      variant="lab"
    />
  );
}
