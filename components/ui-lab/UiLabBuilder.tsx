/* eslint-disable react-hooks/set-state-in-effect */
"use client";

import Link from "next/link";
import { useEffect, useMemo, useRef, useState } from "react";
import { nanoid } from "nanoid";
import { toBlob } from "html-to-image";
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
import { UiLabPreview } from "./UiLabPreview";
import { QuantityBadge } from "@/components/trade/QuantityBadge";

type UiLabBuilderProps = {
  collection: TradeCollectionSummary & {
    eventStartDate?: string | null;
    eventEndDate?: string | null;
  };
  registeredItems: RegisteredTradeItem[];
  referenceImages: TradeReferenceImage[];
};

const TRADE_LAB_FONT_FAMILY = "'Pretendard', Arial, sans-serif";
const ALL_WORKS_VALUE = "all";
const ALL_CATEGORIES_VALUE = "all";
const ALL_BENEFIT_SUBCATEGORIES_VALUE = "all";
const NO_BENEFIT_SUBCATEGORY_VALUE = "__none__";

type CategoryFilterValue = TradeCategory | typeof ALL_CATEGORIES_VALUE;
type BenefitSubcategoryFilterValue = string;

type QuantityTradeCard = TradeCard & {
  quantity?: number;
  registeredItemId?: string;
  registeredSortOrder?: number;
};

type UploadedCardMetadata = {
  workTitle: string;
  category: TradeCategory;
  benefitSubcategory: string | null;
};

const TRADE_CONDITIONS = [
  "같은 종류끼리만 교환",
  "교차 교환 가능",
  "현장 직거래 가능",
  "반택/일택 거래 가능",
  "N:1 가능",
  "양도 가능",
];

function prefersTouchSaveFlow() {
  const userAgent = navigator.userAgent;
  const isPhoneOrTabletUa = /iPhone|iPad|iPod|Android/i.test(userAgent);
  const isIpadDesktopUa =
    navigator.maxTouchPoints > 1 && /Macintosh/i.test(userAgent);

  // 터치 모니터·2-in-1 노트북·작게 줄인 PC 브라우저는 모바일로 취급하지 않습니다.
  return isPhoneOrTabletUa || isIpadDesktopUa;
}

async function renderPreviewNodeToPngBlob(node: HTMLDivElement) {
  await ensureTradeLabFontReady();
  const previousTransform = node.style.transform;
  const previousTransformOrigin = node.style.transformOrigin;

  try {
    node.style.transform = "none";
    node.style.transformOrigin = "top left";
    await new Promise<void>((resolve) => requestAnimationFrame(() => resolve()));

    const blob = await toBlob(node, {
      cacheBust: true,
      pixelRatio: 2000 / 840,
      width: 840,
      height: node.scrollHeight,
      backgroundColor: "transparent",
      style: {
        transform: "none",
        transformOrigin: "top left",
      },
    });

    if (!blob) throw new Error("PNG 파일을 생성하지 못했습니다.");
    return blob;
  } finally {
    node.style.transform = previousTransform;
    node.style.transformOrigin = previousTransformOrigin;
  }
}

async function savePngBlob(
  blob: Blob,
  filename: string,
  onShowPreview: (previewUrl: string) => void,
) {
  const isTouchSaveFlow = prefersTouchSaveFlow();
  const previewUrl = URL.createObjectURL(blob);

  if (!isTouchSaveFlow) {
    const link = document.createElement("a");
    link.download = filename;
    link.href = previewUrl;
    link.rel = "noopener";
    document.body.appendChild(link);
    link.click();
    link.remove();
    window.setTimeout(() => URL.revokeObjectURL(previewUrl), 30_000);
    return;
  }

  const file = new File([blob], filename, { type: "image/png" });

  if (navigator.canShare?.({ files: [file] })) {
    try {
      await navigator.share({ files: [file], title: filename });
      URL.revokeObjectURL(previewUrl);
      return;
    } catch (error) {
      if (error instanceof Error && error.name === "AbortError") {
        URL.revokeObjectURL(previewUrl);
        return;
      }
    }
  }

  onShowPreview(previewUrl);
}

function roundedRect(
  context: CanvasRenderingContext2D,
  x: number,
  y: number,
  width: number,
  height: number,
  radius: number,
) {
  const safeRadius = Math.min(radius, width / 2, height / 2);
  context.beginPath();
  context.roundRect(x, y, width, height, safeRadius);
}

function drawCenteredText(
  context: CanvasRenderingContext2D,
  value: string,
  centerX: number,
  y: number,
  maxWidth: number,
  font: string,
  color: string,
) {
  context.save();
  context.font = font;
  context.fillStyle = color;
  context.textAlign = "center";
  context.textBaseline = "alphabetic";

  let nextValue = value;
  while (
    nextValue.length > 1 &&
    context.measureText(nextValue).width > maxWidth
  ) {
    nextValue = nextValue.slice(0, -1);
  }
  if (nextValue !== value) nextValue = `${nextValue.slice(0, -1)}…`;

  context.fillText(nextValue, centerX, y);
  context.restore();
}

function drawTwoLineCenteredText(
  context: CanvasRenderingContext2D,
  value: string,
  centerX: number,
  bottomY: number,
  maxWidth: number,
  font: string,
  color: string,
) {
  context.save();
  context.font = font;
  context.fillStyle = color;
  context.textAlign = "center";
  context.textBaseline = "alphabetic";

  const chars = Array.from(value.trim());
  const lines: string[] = [];
  let current = "";

  for (const char of chars) {
    const candidate = current + char;
    if (current && context.measureText(candidate).width > maxWidth) {
      lines.push(current);
      current = char;
      if (lines.length === 2) break;
    } else {
      current = candidate;
    }
  }
  if (lines.length < 2 && current) lines.push(current);

  const consumed = lines.join("").length;
  if (consumed < chars.length && lines.length > 0) {
    let last = lines[lines.length - 1];
    while (last.length > 1 && context.measureText(`${last}…`).width > maxWidth) {
      last = last.slice(0, -1);
    }
    lines[lines.length - 1] = `${last}…`;
  }

  const lineHeight = 11;
  const startY = bottomY - (lines.length - 1) * lineHeight;
  lines.slice(0, 2).forEach((line, index) => {
    context.fillText(line, centerX, startY + index * lineHeight);
  });
  context.restore();
}

const canvasImageCache = new Map<string, Promise<HTMLImageElement>>();

function loadImageElement(source: string, useCors: boolean) {
  return new Promise<HTMLImageElement>((resolve, reject) => {
    const image = new Image();

    if (useCors) {
      image.crossOrigin = "anonymous";
    }

    image.decoding = "async";
    image.onload = () => resolve(image);
    image.onerror = () =>
      reject(new Error("굿즈 이미지를 불러오지 못했습니다."));
    image.src = source;
  });
}

function isLocalCanvasImageSource(source: string) {
  return (
    source.startsWith("data:") ||
    source.startsWith("blob:") ||
    source.startsWith("/")
  );
}

async function loadCanvasImageWithoutCache(source: string) {
  if (isLocalCanvasImageSource(source)) {
    return loadImageElement(source, false);
  }

  try {
    // Supabase Storage가 CORS를 허용하면 Vercel Function을 거치지 않고 직접 사용합니다.
    return await loadImageElement(source, true);
  } catch {
    // 직접 로드가 막힌 환경에서만 서버 프록시를 한 번 사용합니다.
    return loadImageElement(
      `/api/image-proxy?url=${encodeURIComponent(source)}`,
      false,
    );
  }
}

function loadCanvasImage(source: string) {
  const cachedImage = canvasImageCache.get(source);
  if (cachedImage) return cachedImage;

  const imagePromise = loadCanvasImageWithoutCache(source).catch((error) => {
    canvasImageCache.delete(source);
    throw error;
  });

  canvasImageCache.set(source, imagePromise);
  return imagePromise;
}

function drawContainedImage(
  context: CanvasRenderingContext2D,
  image: HTMLImageElement,
  x: number,
  y: number,
  width: number,
  height: number,
) {
  const scale = Math.min(
    width / image.naturalWidth,
    height / image.naturalHeight,
  );
  const drawWidth = image.naturalWidth * scale;
  const drawHeight = image.naturalHeight * scale;
  const drawX = x + (width - drawWidth) / 2;
  const drawY = y + (height - drawHeight) / 2;
  context.drawImage(image, drawX, drawY, drawWidth, drawHeight);
}

async function ensureTradeLabFontReady() {
  if (typeof document === "undefined" || !("fonts" in document)) return;

  await document.fonts.load(`900 22px ${TRADE_LAB_FONT_FAMILY}`);
  await document.fonts.ready;
}

async function renderBoardToPngBlob(
  board: TradeBoard,
  collectionTitle: string,
  eventStartDate?: string | null,
  eventEndDate?: string | null,
) {
  await ensureTradeLabFontReady();

  const width = 840;
  const scale = 2000 / width;
  const sideWidth = 372;
  const sideLeft = { have: 36, want: 432 } as const;
  const cardWidth = 112;
  const cardGap = 12;
  const rowGap = 18;
  const grouped = board.categoryDisplayMode !== "simple";
  const [cardsWithImages, sideIcons] = await Promise.all([
    Promise.all(
      board.cards.map(async (card) => ({
        card,
        image: await loadCanvasImage(card.imageUrl),
      })),
    ),
    Promise.all([
      loadCanvasImage("/trade-icons/have.png"),
      loadCanvasImage("/trade-icons/want.png"),
    ]),
  ]);

  const getGroups = () => {
    const groups: Array<{ key: string; label: string }> = [];
    for (const card of board.cards) {
      const subcategory = getBenefitSubcategoryLabel(card.benefitSubcategory);
      const key =
        card.category === "benefit" && subcategory
          ? `benefit:${subcategory}`
          : card.category;
      const label =
        card.category === "benefit" && subcategory
          ? subcategory
          : getCategoryLabel(card.category);
      if (!groups.some((group) => group.key === key))
        groups.push({ key, label });
    }
    return groups;
  };

  const cardGroupKey = (card: TradeCard) => {
    const subcategory = getBenefitSubcategoryLabel(card.benefitSubcategory);
    return card.category === "benefit" && subcategory
      ? `benefit:${subcategory}`
      : card.category;
  };

  const getCardImageHeight = (card: TradeCard) =>
    card.imageRatio === "photocard"
      ? Math.round((cardWidth * 85) / 55)
      : cardWidth;

  const cardHeight = (card: TradeCard, showMeta: boolean) =>
    getCardImageHeight(card) + 24 + (showMeta ? 16 : 0);

  const gridHeight = (cards: TradeCard[], showMeta: boolean) => {
    if (cards.length === 0) return 0;
    let height = 0;
    for (let index = 0; index < cards.length; index += 3) {
      const rowCards = cards.slice(index, index + 3);
      height += Math.max(...rowCards.map((card) => cardHeight(card, showMeta)));
      if (index + 3 < cards.length) height += rowGap;
    }
    return height;
  };

  const headerBottom = 112;
  const sideHeaderY = 124;
  const contentStartY = 172;
  let contentHeight = contentStartY;
  if (grouped) {
    for (const group of getGroups()) {
      const have = board.cards.filter(
        (card) => card.side === "have" && cardGroupKey(card) === group.key,
      );
      const want = board.cards.filter(
        (card) => card.side === "want" && cardGroupKey(card) === group.key,
      );
      contentHeight +=
        25 +
        Math.max(gridHeight(have, false), gridHeight(want, false), cardWidth) +
        24;
    }
  } else {
    const have = board.cards.filter((card) => card.side === "have");
    const want = board.cards.filter((card) => card.side === "want");
    const gridHeightFour = (cards: TradeCard[]) => {
      if (cards.length === 0) return cardWidth;
      let total = 0;
      for (let index = 0; index < cards.length; index += 6) {
        const rowCards = cards.slice(index, index + 6);
        total += Math.max(...rowCards.map((card) => cardHeight(card, true)));
        if (index + 6 < cards.length) total += rowGap;
      }
      return total;
    };
    contentHeight +=
      34 + gridHeightFour(have) + 34 + 34 + gridHeightFour(want) + 24;
  }
  const copyrightFooterHeight = 52;
  const height = Math.max(300, contentHeight + copyrightFooterHeight);

  const canvas = document.createElement("canvas");
  canvas.width = width * scale;
  canvas.height = height * scale;
  const context = canvas.getContext("2d");
  if (!context) throw new Error("이미지 생성 도구를 사용할 수 없습니다.");
  context.scale(scale, scale);
  context.fillStyle = "#ffffff";
  context.fillRect(0, 0, width, height);

  context.save();
  context.shadowColor = "rgba(15, 23, 42, 0.12)";
  context.shadowBlur = 24;
  context.shadowOffsetY = 8;
  roundedRect(context, 20, 20, 800, height - 40, 26);
  context.fillStyle = "#ffffff";
  context.fill();
  context.restore();

  roundedRect(context, 20, 20, 800, headerBottom - 20, 26);
  context.fillStyle = "#0a0a0a";
  context.fill();
  context.fillRect(20, headerBottom - 26, 800, 26);

  const koreanFont = TRADE_LAB_FONT_FAMILY;
  context.fillStyle = "#a3a3a3";
  context.font = `900 9px ${koreanFont}`;
  context.fillText("TRADE BOARD MAKER", 40, 46);
  context.fillStyle = "#ffffff";
  context.font = `900 22px ${koreanFont}`;
  context.fillText(collectionTitle, 40, 73);
  const nickname = board.nickname.trim();
  if (nickname) {
    context.fillStyle = "#d4d4d4";
    context.font = `600 11px ${koreanFont}`;
    context.fillText(nickname, 40, 94);
  }

  const conditionChips = board.memo
    .split(" · ")
    .map((value) => value.trim())
    .filter(Boolean)
    .slice(0, 6);

  if (conditionChips.length > 0) {
    context.save();
    context.font = `800 9px ${koreanFont}`;

    const rows: Array<Array<{ text: string; width: number }>> = [[]];
    let rowWidth = 0;
    for (const chip of conditionChips) {
      const chipWidth = Math.min(context.measureText(chip).width + 20, 112);
      const nextWidth = rowWidth + (rows[rows.length - 1].length ? 6 : 0) + chipWidth;
      if (nextWidth > 360 && rows.length < 2) {
        rows.push([]);
        rowWidth = 0;
      }
      if (rows.length > 2) break;
      rows[rows.length - 1].push({ text: chip, width: chipWidth });
      rowWidth += (rows[rows.length - 1].length > 1 ? 6 : 0) + chipWidth;
    }

    const chipHeight = 30;
    const rowGap = 5;
    const totalHeight = rows.length * chipHeight + (rows.length - 1) * rowGap;
    let chipY = headerBottom - 12 - totalHeight;

    for (const row of rows.slice(0, 2)) {
      let chipRight = 804;
      for (const chip of [...row].reverse()) {
        roundedRect(context, chipRight - chip.width, chipY, chip.width, chipHeight, 12);
        context.fillStyle = "#ffffff";
        context.fill();
        drawTwoLineCenteredText(
          context,
          chip.text,
          chipRight - chip.width / 2,
          chipY + chipHeight - 7,
          chip.width - 14,
          `800 9px ${koreanFont}`,
          "#171717",
        );
        chipRight -= chip.width + 6;
      }
      chipY += chipHeight + rowGap;
    }
    context.restore();
  }

  if (grouped)
    for (const side of ["have", "want"] as const) {
      const label = side === "have" ? "있어요 (Have)" : "구해요 (Want)";
      const count = board.cards.filter((card) => card.side === side).length;
      context.fillStyle = "#7C5CFC";
      context.font = `900 14px ${koreanFont}`;
      context.textAlign = "left";
      context.fillText(label, sideLeft[side], sideHeaderY + 14);
      context.fillStyle = "#a3a3a3";
      context.font = `700 11px ${koreanFont}`;
      context.textAlign = "right";
      context.fillText(
        String(count),
        sideLeft[side] + sideWidth,
        sideHeaderY + 14,
      );
      context.strokeStyle = "#e5e5e5";
      context.lineWidth = 1;
      context.beginPath();
      context.moveTo(sideLeft[side], sideHeaderY + 25);
      context.lineTo(sideLeft[side] + sideWidth, sideHeaderY + 25);
      context.stroke();
      context.strokeStyle = "#7C5CFC";
      context.beginPath();
      context.moveTo(sideLeft[side], sideHeaderY + 25);
      context.lineTo(sideLeft[side] + 40, sideHeaderY + 25);
      context.stroke();
      context.textAlign = "start";
    }

  const imageMap = new Map(
    cardsWithImages.map(({ card, image }) => [card.id, image]),
  );

  const drawCard = (
    card: TradeCard,
    x: number,
    y: number,
    showMeta: boolean,
  ) => {
    const imageHeight = getCardImageHeight(card);
    roundedRect(context, x, y, cardWidth, imageHeight, 12);
    context.fillStyle = "#ffffff";
    context.fill();
    context.save();
    roundedRect(context, x, y, cardWidth, imageHeight, 12);
    context.clip();
    const image = imageMap.get(card.id);
    if (image) drawContainedImage(context, image, x, y, cardWidth, imageHeight);
    context.restore();

    const quantity = getCardQuantity(card);
    if (quantity > 1) {
      context.beginPath();
      context.arc(x + cardWidth - 12, y + 14, 8, 0, Math.PI * 2);
      context.fillStyle = "#171717";
      context.fill();
      drawCenteredText(
        context,
        `×${quantity}`,
        x + cardWidth - 12,
        y + 17,
        14,
        "900 7px Arial, sans-serif",
        "#ffffff",
      );
    }

    drawCenteredText(
      context,
      card.workTitle || "작품명",
      x + cardWidth / 2,
      y + imageHeight + 17,
      cardWidth,
      "800 11px Arial, 'Apple SD Gothic Neo', sans-serif",
      "#171717",
    );
    if (showMeta) {
      drawCenteredText(
        context,
        getCardMetaLabel(card),
        x + cardWidth / 2,
        y + imageHeight + 32,
        cardWidth,
        "500 9px Arial, 'Apple SD Gothic Neo', sans-serif",
        "#737373",
      );
    }
  };

  const drawGrid = (
    cards: TradeCard[],
    side: "have" | "want",
    startY: number,
    showMeta: boolean,
  ) => {
    let y = startY;
    for (let index = 0; index < cards.length; index += 3) {
      const rowCards = cards.slice(index, index + 3);
      rowCards.forEach((card, col) =>
        drawCard(
          card,
          sideLeft[side] + col * (cardWidth + cardGap),
          y,
          showMeta,
        ),
      );
      y +=
        Math.max(...rowCards.map((card) => cardHeight(card, showMeta))) +
        rowGap;
    }
    return cards.length ? y - startY - rowGap : 0;
  };

  let y = contentStartY;
  if (grouped) {
    for (const group of getGroups()) {
      context.fillStyle = "#7C5CFC";
      roundedRect(context, 36, y + 1, 4, 16, 2);
      context.fill();
      context.fillStyle = "#262626";
      context.font = `900 11px ${koreanFont}`;
      context.fillText(group.label, 48, y + 13);
      const groupLabelWidth = context.measureText(group.label).width;
      context.strokeStyle = "#e5e5e5";
      context.lineWidth = 1;
      context.beginPath();
      context.moveTo(Math.min(60 + groupLabelWidth, 780), y + 9);
      context.lineTo(804, y + 9);
      context.stroke();

      const gridY = y + 28;
      const have = board.cards.filter(
        (card) => card.side === "have" && cardGroupKey(card) === group.key,
      );
      const want = board.cards.filter(
        (card) => card.side === "want" && cardGroupKey(card) === group.key,
      );
      const groupHeight = Math.max(
        gridHeight(have, false),
        gridHeight(want, false),
        112,
      );

      context.strokeStyle = "#e5e5e5";
      context.beginPath();
      context.moveTo(420, gridY);
      context.lineTo(420, gridY + groupHeight);
      context.stroke();

      drawGrid(have, "have", gridY, false);
      drawGrid(want, "want", gridY, false);
      y = gridY + groupHeight + 34;
    }
  } else {
    const drawSimpleHeader = (
      label: string,
      count: number,
      headerY: number,
    ) => {
      context.fillStyle = "#7C5CFC";
      context.font = `900 14px ${koreanFont}`;
      context.textAlign = "left";
      context.fillText(label, 36, headerY + 14);
      context.fillStyle = "#a3a3a3";
      context.font = `700 11px ${koreanFont}`;
      context.textAlign = "right";
      context.fillText(String(count), 804, headerY + 14);
      context.strokeStyle = "#e5e5e5";
      context.lineWidth = 1;
      context.beginPath();
      context.moveTo(36, headerY + 26);
      context.lineTo(804, headerY + 26);
      context.stroke();
      context.strokeStyle = "#7C5CFC";
      context.beginPath();
      context.moveTo(36, headerY + 26);
      context.lineTo(76, headerY + 26);
      context.stroke();
      context.textAlign = "start";
    };

    const drawGridSix = (cards: TradeCard[], startY: number) => {
      let rowY = startY;
      const simpleGap = 8;
      const simpleLeft = 48;
      for (let index = 0; index < cards.length; index += 6) {
        const rowCards = cards.slice(index, index + 6);
        rowCards.forEach((card, col) =>
          drawCard(
            card,
            simpleLeft + col * (cardWidth + simpleGap),
            rowY,
            true,
          ),
        );
        rowY +=
          Math.max(...rowCards.map((card) => cardHeight(card, true))) + rowGap;
      }
      return cards.length ? rowY - startY - rowGap : cardWidth;
    };

    const have = board.cards.filter((card) => card.side === "have");
    const want = board.cards.filter((card) => card.side === "want");
    drawSimpleHeader("있어요 (Have)", have.length, y);
    y += 36;
    y += drawGridSix(have, y) + 30;
    drawSimpleHeader("구해요 (Want)", want.length, y);
    y += 36;
    y += drawGridSix(want, y) + 24;
  }

  context.fillStyle = "#F7F7FA";
  context.fillRect(
    20,
    height - copyrightFooterHeight - 20,
    800,
    copyrightFooterHeight,
  );
  context.strokeStyle = "#f5f5f5";
  context.beginPath();
  context.moveTo(20, height - copyrightFooterHeight - 20);
  context.lineTo(820, height - copyrightFooterHeight - 20);
  context.stroke();
  drawCenteredText(
    context,
    "업로드된 모든 이미지의 저작권은 각 플랫폼과 작가님께 있습니다.",
    width / 2,
    height - 43,
    490,
    `500 8px ${koreanFont}`,
    "#a3a3a3",
  );
  drawCenteredText(
    context,
    "제작 NP @ru1ned1over",
    width / 2,
    height - 28,
    490,
    `700 8px ${koreanFont}`,
    "#737373",
  );

  return await new Promise<Blob>((resolve, reject) => {
    canvas.toBlob((blob) => {
      if (blob) resolve(blob);
      else reject(new Error("PNG 파일을 생성하지 못했습니다."));
    }, "image/png");
  });
}

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

function getTradeSideSortIndex(side: TradeSide) {
  return side === "have" ? 0 : 1;
}

function compareTradeCards(a: TradeCard, b: TradeCard) {
  const aCard = a as QuantityTradeCard;
  const bCard = b as QuantityTradeCard;
  const sideDiff =
    getTradeSideSortIndex(a.side) - getTradeSideSortIndex(b.side);

  if (sideDiff !== 0) {
    return sideDiff;
  }

  const categoryDiff =
    getCategorySortIndex(a.category) - getCategorySortIndex(b.category);

  if (categoryDiff !== 0) {
    return categoryDiff;
  }

  const sortOrderDiff =
    (aCard.registeredSortOrder ?? Number.MAX_SAFE_INTEGER) -
    (bCard.registeredSortOrder ?? Number.MAX_SAFE_INTEGER);

  // 관리자에서 등록한 특전 순서를 작품명이나 선택 순서보다 우선합니다.
  if (sortOrderDiff !== 0) {
    return sortOrderDiff;
  }

  if (a.category === "benefit" && b.category === "benefit") {
    const subcategoryDiff = getBenefitSubcategoryLabel(
      a.benefitSubcategory,
    ).localeCompare(getBenefitSubcategoryLabel(b.benefitSubcategory), "ko-KR", {
      numeric: true,
      sensitivity: "base",
    });

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

  return a.id.localeCompare(b.id);
}

function sortTradeCards(cards: TradeCard[]) {
  return [...cards].sort(compareTradeCards);
}

export function UiLabBuilder({
  collection,
  registeredItems,
  referenceImages,
}: UiLabBuilderProps) {
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
  const [exportPreviewUrl, setExportPreviewUrl] = useState<string | null>(null);
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
    if (board.cards.length === 0) return;

    const preload = () => {
      void Promise.allSettled(
        board.cards.map((card) => loadCanvasImage(card.imageUrl)),
      );
    };

    const timer = window.setTimeout(preload, 120);
    return () => window.clearTimeout(timer);
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
          cards: sortTradeCards(
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
                    quantity: safeQuantity,
                    registeredItemId: item.id,
                    registeredSortOrder: item.sortOrder,
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
        quantity: safeQuantity,
        registeredItemId: item.id,
        registeredSortOrder: item.sortOrder,
      };

      return {
        ...prev,
        cards: sortTradeCards([...prev.cards, newCard]),
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
          metadata.category === "benefit" ? metadata.benefitSubcategory : null,
        quantity: 1,
        registeredSortOrder: Number.MAX_SAFE_INTEGER,
      }));

    if (newCards.length === 0) return;

    setBoard((prev) => ({
      ...prev,
      cards: sortTradeCards([...prev.cards, ...newCards]),
    }));
  }

  function updateCard(cardId: string, patch: Partial<QuantityTradeCard>) {
    setBoard((prev) => ({
      ...prev,
      cards: sortTradeCards(
        prev.cards.map((card) =>
          card.id === cardId ? { ...card, ...patch } : card,
        ),
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
    if (!canDownload) return;

    try {
      setIsExporting(true);
      const previewNode = previewRef.current;
      if (!previewNode) throw new Error("미리보기 영역을 찾지 못했습니다.");
      const blob = await renderPreviewNodeToPngBlob(previewNode);

      await savePngBlob(
        blob,
        `${collection.slug}-trade-board.png`,
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
    setSelectedConditions([]);
    setBoard(createInitialBoard());
  }

  const formatEventDate = (value?: string | null) => {
    if (!value) return "";
    const [year, month, day] = value.split("-");
    return year && month && day ? `${year}.${month}.${day}` : value;
  };
  return (
    <section
      data-ui-lab-version="2026-07-11-b"
      className="w-full bg-white"
      style={{ fontFamily: TRADE_LAB_FONT_FAMILY }}
    >
      <div className="w-full">
        <div className="w-full bg-white px-5 pb-5 pt-3">
          <div className="space-y-3">
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
              교환 이미지 추가
            </h2>

            <div className="mt-4 grid grid-cols-2 gap-3">
              <AddSideButton
                koreanTitle="있어요"
                englishTitle="Have"
                iconSrc="/trade-icons/have.png"
                count={haveCardCount}
                onClick={() => openAddModal("have")}
              />

              <AddSideButton
                koreanTitle="구해요"
                englishTitle="Want"
                iconSrc="/trade-icons/want.png"
                count={wantCardCount}
                onClick={() => openAddModal("want")}
              />
            </div>
          </div>

          <div className="mt-6 border-t border-neutral-100 pt-5">
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
              특전 구분
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
              구분 없이
            </button>
          </div>

          <div className="w-full min-w-0 max-w-full overflow-hidden bg-white">
            <UiLabPreview
              ref={previewRef}
              responsive
              board={board}
              collectionTitle={collection.title}
              eventStartDate={collection.eventStartDate}
              eventEndDate={collection.eventEndDate}
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

type AddSideButtonProps = {
  koreanTitle: string;
  englishTitle: string;
  iconSrc: string;
  count: number;
  onClick: () => void;
};

type ExportPreviewModalProps = {
  imageUrl: string;
  onClose: () => void;
};

function ExportPreviewModal({ imageUrl, onClose }: ExportPreviewModalProps) {
  return (
    <div className="fixed inset-0 z-50 bg-neutral-950/70 px-4 py-5">
      <div className="mx-auto flex h-full w-full max-w-md flex-col overflow-hidden rounded-3xl bg-white shadow-xl sm:max-w-lg">
        <header className="shrink-0 border-b border-neutral-100 p-5">
          <div className="flex items-start justify-between gap-4">
            <div>
              <p className="text-xs font-black uppercase tracking-[0.2em] text-neutral-400">
                Save Image
              </p>
              <h2 className="mt-1 text-xl font-black text-neutral-950">
                교환판 이미지 저장
              </h2>
              <p className="mt-2 text-xs leading-5 text-neutral-500">
                아래 이미지를 길게 눌러 사진 앱에 저장하거나 공유해 주세요.
              </p>
            </div>

            <button
              type="button"
              onClick={onClose}
              className="flex h-10 w-10 shrink-0 items-center justify-center rounded-full bg-neutral-100 text-xl font-black text-neutral-500"
              aria-label="닫기"
            >
              ×
            </button>
          </div>
        </header>

        <div className="min-h-0 flex-1 overflow-y-auto p-5">
          <img
            src={imageUrl}
            alt="저장할 교환판 이미지"
            className="w-full rounded-2xl border border-neutral-200 bg-white"
          />
        </div>
      </div>
    </div>
  );
}

function AddSideButton({
  koreanTitle,
  englishTitle,
  iconSrc,
  count,
  onClick,
}: AddSideButtonProps) {
  return (
    <button
      type="button"
      onClick={onClick}
      aria-label={`${koreanTitle} (${englishTitle}) 이미지 추가${count > 0 ? `, 현재 ${count}개 선택됨` : ""}`}
      className="rounded-2xl border border-neutral-200 bg-neutral-50 px-3 py-3 text-left transition hover:border-neutral-950 hover:bg-white"
    >
      <div className="flex items-center gap-2">
        <img
          src={iconSrc}
          alt=""
          aria-hidden="true"
          className="h-6 w-6 shrink-0 object-contain"
        />
        <span className="text-[10px] font-black uppercase tracking-[0.16em] text-neutral-400">
          {englishTitle}
        </span>
      </div>

      <div className="mt-2 flex items-center justify-between gap-2">
        <span className="whitespace-nowrap text-sm font-black text-neutral-950">
          {koreanTitle}
        </span>
        <span className="shrink-0 rounded-full bg-neutral-950 px-2.5 py-1 text-[10px] font-black text-white">
          + 추가
        </span>
      </div>
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
}: AddItemModalProps) {
  const sideKoreanLabel = side === "have" ? "있어요" : "구해요";
  const sideEnglishLabel = side === "have" ? "Have" : "Want";
  const sideLabel = `${sideKoreanLabel} (${sideEnglishLabel})`;
  const canUseBenefitSubcategoryFilter =
    (selectedCategory === ALL_CATEGORIES_VALUE ||
      selectedCategory === "benefit") &&
    (benefitSubcategoryOptions.length > 0 || hasBenefitItemsWithoutSubcategory);
  const initialUploadWorkTitle =
    selectedWorkTitle !== ALL_WORKS_VALUE
      ? selectedWorkTitle
      : (workTitleOptions[0] ?? "");
  const initialUploadCategory: TradeCategory =
    selectedCategory !== ALL_CATEGORIES_VALUE ? selectedCategory : "benefit";
  const [uploadWorkTitle, setUploadWorkTitle] = useState(
    initialUploadWorkTitle,
  );
  const [uploadCategory, setUploadCategory] = useState<TradeCategory>(
    initialUploadCategory,
  );
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
                Add {sideEnglishLabel} Item
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
            </p>

            <div className="mt-4 grid grid-cols-2 gap-2">
              <label className="block min-w-0">
                <span className="text-[11px] font-black text-neutral-500">
                  작품명
                </span>
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
                <span className="text-[11px] font-black text-neutral-500">
                  굿즈 종류
                </span>
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

type GoodsWorkReferenceProps = {
  referenceImages: TradeReferenceImage[];
};

function GoodsWorkReference({ referenceImages }: GoodsWorkReferenceProps) {
  const [isOpen, setIsOpen] = useState(false);

  return (
    <section className="mb-4 border-b border-neutral-100 pb-4 pt-1">
      <button
        type="button"
        onClick={() => setIsOpen((prev) => !prev)}
        className="flex w-full items-center justify-between gap-3 rounded-2xl bg-neutral-50 px-3 py-2.5 text-left ring-1 ring-neutral-200"
        aria-expanded={isOpen}
      >
        <span className="flex min-w-0 items-center gap-1.5">
          <span aria-hidden="true" className="shrink-0 text-xs leading-none">
            🔍
          </span>
          <span className="text-xs font-black leading-4 text-neutral-950">
            내가 뽑은 굿즈가 어떤 작품인지 모르겠다면?
          </span>
        </span>

        <span className="shrink-0 rounded-full bg-white px-2.5 py-1 text-[10px] font-black text-neutral-500 ring-1 ring-neutral-200">
          {isOpen ? "접기" : "보기"}
        </span>
      </button>

      {isOpen ? (
        referenceImages.length > 0 ? (
          <div className="mt-3 max-h-80 space-y-3 overflow-y-auto pr-1">
            {referenceImages.map((image) => (
              <img
                key={image.id}
                src={image.imageUrl}
                alt="굿즈 작품 확인용 공지 이미지"
                loading="eager"
                decoding="async"
                className="block h-auto w-full rounded-2xl bg-white object-contain ring-1 ring-neutral-200"
              />
            ))}
          </div>
        ) : (
          <p className="mt-3 rounded-xl bg-neutral-50 px-4 py-5 text-center text-xs leading-5 text-neutral-400 ring-1 ring-neutral-200">
            등록된 공지 이미지를 불러오지 못했습니다.
          </p>
        )
      ) : null}
    </section>
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
        <div className="relative border-b border-neutral-200 bg-neutral-50 p-2 leading-none">
          <img
            src={item.imageUrl}
            alt={item.itemName}
            loading="lazy"
            decoding="async"
            className={`${getImageRatioClass(imageRatio)} block w-full rounded-xl bg-white object-contain align-top`}
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
              aria-label="있어요 (Have) 또는 구해요 (Want)"
            >
              <option value="have">있어요 (Have)</option>
              <option value="want">구해요 (Want)</option>
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
