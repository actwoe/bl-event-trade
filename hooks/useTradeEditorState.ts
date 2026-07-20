/* eslint-disable react-hooks/set-state-in-effect */
"use client";

import { useEffect, useMemo, useRef, useState } from "react";
import { nanoid } from "nanoid";
import { sortTradeCardsBySideAndGroup } from "@/lib/trade-card-order";
import {
  createInitialTradeBoard,
  getCardQuantity,
  getRegisteredItemQuantity,
  isSameRegisteredCard,
  QuantityTradeCard,
  updateTradeCardList,
} from "@/lib/trade-editor-core";
import {
  getBenefitSubcategoryLabel,
  getItemImageRatio,
  sortKoreanTitles,
  sortRegisteredItems,
} from "@/lib/trade-editor-display";
import type { UploadedCardMetadata } from "@/components/trade-editor/AddItemModal";
import {
  compareBenefitSubcategoryValues,
  normalizeBenefitSubcategorySortOrder,
} from "@/lib/trade-benefit-subcategory-order";
import type {
  RegisteredTradeItem,
  TradeBoard,
  TradeCategory,
  TradeCategoryDisplayMode,
  TradeSide,
} from "@/lib/trade-types";

export const ALL_WORKS_VALUE = "all";
export const ALL_CATEGORIES_VALUE = "all";
export const ALL_BENEFIT_SUBCATEGORIES_VALUE = "all";
export const NO_BENEFIT_SUBCATEGORY_VALUE = "__none__";

export type CategoryFilterValue =
  | TradeCategory
  | typeof ALL_CATEGORIES_VALUE;
export type BenefitSubcategoryFilterValue = string;

export function useTradeEditorState(registeredItems: RegisteredTradeItem[]) {
  const [board, setBoard] = useState<TradeBoard>(() => createInitialTradeBoard());
  const [selectedConditions, setSelectedConditions] = useState<string[]>([]);
  const [isProfileOpen, setIsProfileOpen] = useState(false);
  const [isConditionsOpen, setIsConditionsOpen] = useState(false);
  const [selectedWorkTitle, setSelectedWorkTitle] = useState(ALL_WORKS_VALUE);
  const [selectedCategory, setSelectedCategory] =
    useState<CategoryFilterValue>(ALL_CATEGORIES_VALUE);
  const [selectedBenefitSubcategory, setSelectedBenefitSubcategory] =
    useState<BenefitSubcategoryFilterValue>(
      ALL_BENEFIT_SUBCATEGORIES_VALUE,
    );
  const [addModalSide, setAddModalSide] = useState<TradeSide | null>(null);
  const [isExporting, setIsExporting] = useState(false);
  const [exportPreviewUrl, setExportPreviewUrl] = useState<string | null>(null);
  const previewRef = useRef<HTMLDivElement>(null);

  const workTitleOptions = useMemo(() => {
    const titles = registeredItems
      .map((item) => item.workTitle)
      .filter((title) => title.trim().length > 0);

    return sortKoreanTitles(Array.from(new Set(titles)));
  }, [registeredItems]);

  const benefitSubcategoryOrderMap = useMemo(() => {
    const orderMap = new Map<string, number>();

    for (const item of registeredItems) {
      if (item.category !== "benefit") continue;

      const subcategory = getBenefitSubcategoryLabel(item.benefitSubcategory);
      if (!subcategory) continue;

      const sortOrder = normalizeBenefitSubcategorySortOrder(
        item.benefitSubcategorySortOrder,
      );
      const currentOrder = orderMap.get(subcategory);

      if (currentOrder === undefined || sortOrder < currentOrder) {
        orderMap.set(subcategory, sortOrder);
      }
    }

    return orderMap;
  }, [registeredItems]);

  const benefitSubcategoryOptions = useMemo(() => {
    return [...benefitSubcategoryOrderMap.entries()]
      .sort(([leftName, leftOrder], [rightName, rightOrder]) =>
        compareBenefitSubcategoryValues(
          leftName,
          leftOrder,
          rightName,
          rightOrder,
        ),
      )
      .map(([subcategory]) => subcategory);
  }, [benefitSubcategoryOrderMap]);

  const hasBenefitItemsWithoutSubcategory = useMemo(() => {
    return registeredItems.some(
      (item) =>
        item.category === "benefit" &&
        !getBenefitSubcategoryLabel(item.benefitSubcategory),
    );
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

  const sortedCards = useMemo(
    () => sortTradeCardsBySideAndGroup(board.cards),
    [board.cards],
  );
  const haveCards = useMemo(
    () => sortedCards.filter((card) => card.side === "have"),
    [sortedCards],
  );
  const wantCards = useMemo(
    () => sortedCards.filter((card) => card.side === "want"),
    [sortedCards],
  );
  const haveCardCount = useMemo(
    () => haveCards.reduce((total, card) => total + getCardQuantity(card), 0),
    [haveCards],
  );
  const wantCardCount = useMemo(
    () => wantCards.reduce((total, card) => total + getCardQuantity(card), 0),
    [wantCards],
  );
  const totalSelectedCount = useMemo(
    () => board.cards.reduce((total, card) => total + getCardQuantity(card), 0),
    [board.cards],
  );
  const canDownload = board.cards.length > 0;
  const directUploadCardCount = useMemo(
    () =>
      board.cards.filter(
        (card) => !(card as QuantityTradeCard).registeredItemId,
      ).length,
    [board.cards],
  );

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

  function updateBoardField<K extends keyof TradeBoard>(
    key: K,
    value: TradeBoard[K],
  ) {
    setBoard((prev) => ({ ...prev, [key]: value }));
  }

  function toggleCondition(condition: string) {
    const nextConditions = selectedConditions.includes(condition)
      ? selectedConditions.filter((item) => item !== condition)
      : [...selectedConditions, condition];

    setSelectedConditions(nextConditions);
    setBoard((currentBoard) => ({
      ...currentBoard,
      memo: nextConditions.join(" · "),
    }));
  }

  function updateCategoryDisplayMode(mode: TradeCategoryDisplayMode) {
    updateBoardField("categoryDisplayMode", mode);
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
          cards: sortTradeCardsBySideAndGroup(
            prev.cards.map((card) =>
              card.id === existingCard.id
                ? {
                    ...card,
                    category: item.category,
                    imageUrl: item.imageUrl,
                    workTitle: item.workTitle,
                    memo: item.itemName,
                    imageRatio: getItemImageRatio(item),
                    benefitSubcategory: item.benefitSubcategory ?? null,
                    benefitSubcategorySortOrder:
                      item.benefitSubcategorySortOrder ?? null,
                    quantity: safeQuantity,
                    registeredItemId: item.id,
                    registeredSortOrder: item.sortOrder,
                    registeredCatalogOrder: item.catalogOrder ?? null,
                  }
                : card,
            ),
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
        benefitSubcategorySortOrder:
          item.benefitSubcategorySortOrder ?? null,
        quantity: safeQuantity,
        registeredItemId: item.id,
        registeredSortOrder: item.sortOrder,
        registeredCatalogOrder: item.catalogOrder ?? null,
        isPriority: false,
        isForSale: false,
      };

      return {
        ...prev,
        cards: sortTradeCardsBySideAndGroup([...prev.cards, newCard]),
      };
    });
  }

  function increaseRegisteredItemQuantity(
    item: RegisteredTradeItem,
    side: TradeSide,
  ) {
    setRegisteredItemQuantity(
      item,
      side,
      getRegisteredItemQuantity(board.cards, item, side) + 1,
    );
  }

  function decreaseRegisteredItemQuantity(
    item: RegisteredTradeItem,
    side: TradeSide,
  ) {
    setRegisteredItemQuantity(
      item,
      side,
      getRegisteredItemQuantity(board.cards, item, side) - 1,
    );
  }

  function addUploadedCards(
    side: TradeSide,
    files: FileList,
    metadata: UploadedCardMetadata,
  ) {
    const workTitle = metadata.workTitle.trim();
    if (!workTitle) return;

    const newCards: QuantityTradeCard[] = Array.from(files)
      .filter((file) => file.type.startsWith("image/"))
      .map((file) => ({
        id: nanoid(),
        side,
        category: metadata.category,
        imageUrl: URL.createObjectURL(file),
        workTitle,
        memo: "",
        imageRatio: "square",
        benefitSubcategory:
          metadata.category === "benefit"
            ? metadata.benefitSubcategory
            : null,
        benefitSubcategorySortOrder:
          metadata.category === "benefit" && metadata.benefitSubcategory
            ? (benefitSubcategoryOrderMap.get(
                metadata.benefitSubcategory.trim(),
              ) ?? null)
            : null,
        quantity: 1,
        registeredSortOrder: Number.MAX_SAFE_INTEGER,
        registeredCatalogOrder: null,
        isPriority: false,
        isForSale: false,
      }));

    if (newCards.length === 0) return;
    setBoard((prev) => ({
      ...prev,
      cards: sortTradeCardsBySideAndGroup([...prev.cards, ...newCards]),
    }));
  }

  function updateCard(cardId: string, patch: Partial<QuantityTradeCard>) {
    setBoard((prev) => ({
      ...prev,
      cards: updateTradeCardList(prev.cards, cardId, patch),
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

  function resetEditor() {
    setSelectedConditions([]);
    setBoard(createInitialTradeBoard());
  }

  return {
    board,
    setBoard,
    selectedConditions,
    setSelectedConditions,
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
    directUploadCardCount,
    updateBoardField,
    toggleCondition,
    updateCategoryDisplayMode,
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
  };
}
