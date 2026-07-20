"use client";

import { toCanvas } from "html-to-image";
import {
  GOODS_WATERMARK_ANGLE_DEG,
  GOODS_WATERMARK_FILL,
  GOODS_WATERMARK_TEXT,
} from "@/lib/goods-watermark";

const TRADE_PREVIEW_WIDTH = 840;
const TRADE_EXPORT_WIDTH = 2000;
const TRADE_EXPORT_SCALE = TRADE_EXPORT_WIDTH / TRADE_PREVIEW_WIDTH;
const TRADE_FONT_FAMILY = "'Pretendard', Arial, sans-serif";
const IMAGE_READY_TIMEOUT_MS = 10_000;
const EXPORT_RETRY_DELAY_MS = 250;

type ExportBadgeSnapshot = {
  rect: DOMRect;
  text: string;
  backgroundColor: string;
  color: string;
  borderColor: string;
  borderWidth: number;
  fontFamily: string;
  fontSize: string;
  fontWeight: string;
};

type ExportImageSnapshot = {
  element: HTMLImageElement;
  drawable: HTMLImageElement;
  objectUrl: string;
  rect: DOMRect;
  borderRadius: number;
  quantityBadge: ExportBadgeSnapshot | null;
  statusBadge: ExportBadgeSnapshot | null;
  previousVisibility: string;
};

function prefersTouchSaveFlow() {
  const userAgent = navigator.userAgent;
  const isPhoneOrTabletUa = /iPhone|iPad|iPod|Android/i.test(userAgent);
  const isIpadDesktopUa =
    navigator.maxTouchPoints > 1 && /Macintosh/i.test(userAgent);

  return isPhoneOrTabletUa || isIpadDesktopUa;
}

function waitForNextPaint() {
  return new Promise<void>((resolve) => {
    requestAnimationFrame(() => {
      requestAnimationFrame(() => resolve());
    });
  });
}

function waitForImageReady(image: HTMLImageElement) {
  if (image.complete && image.naturalWidth > 0) {
    return image.decode?.().catch(() => undefined) ?? Promise.resolve();
  }

  return new Promise<void>((resolve) => {
    const finish = () => {
      image.removeEventListener("load", finish);
      image.removeEventListener("error", finish);
      resolve();
    };

    image.addEventListener("load", finish, { once: true });
    image.addEventListener("error", finish, { once: true });
  }).then(async () => {
    if (image.complete && image.naturalWidth > 0 && image.decode) {
      await image.decode().catch(() => undefined);
    }
  });
}

async function ensurePreviewImagesReady(node: HTMLElement) {
  const images = Array.from(node.querySelectorAll("img"));
  if (images.length === 0) return;

  let timeoutId: ReturnType<typeof setTimeout> | undefined;
  const timeout = new Promise<void>((resolve) => {
    timeoutId = setTimeout(resolve, IMAGE_READY_TIMEOUT_MS);
  });

  await Promise.race([
    Promise.all(images.map((image) => waitForImageReady(image))).then(
      () => undefined,
    ),
    timeout,
  ]);

  if (timeoutId) clearTimeout(timeoutId);
}

function isHttpImageSource(source: string) {
  return source.startsWith("http://") || source.startsWith("https://");
}

async function fetchImageBlob(source: string) {
  const fetchSource = async (url: string) => {
    const response = await fetch(url, {
      cache: "force-cache",
      credentials: "omit",
    });

    if (!response.ok) {
      throw new Error(`굿즈 이미지 요청에 실패했습니다. (${response.status})`);
    }

    const blob = await response.blob();
    if (!blob.type.startsWith("image/")) {
      throw new Error("굿즈 이미지 형식을 확인할 수 없습니다.");
    }

    return blob;
  };

  try {
    return await fetchSource(source);
  } catch (directError) {
    if (!isHttpImageSource(source)) throw directError;

    return fetchSource(`/api/image-proxy?url=${encodeURIComponent(source)}`);
  }
}

function loadDrawableImage(blob: Blob) {
  const objectUrl = URL.createObjectURL(blob);
  const image = new Image();
  image.decoding = "async";

  return new Promise<{ image: HTMLImageElement; objectUrl: string }>(
    (resolve, reject) => {
      image.onload = async () => {
        await image.decode?.().catch(() => undefined);
        resolve({ image, objectUrl });
      };
      image.onerror = () => {
        URL.revokeObjectURL(objectUrl);
        reject(new Error("굿즈 이미지를 PNG 저장용으로 불러오지 못했습니다."));
      };
      image.src = objectUrl;
    },
  );
}

function getQuantityBadge(image: HTMLImageElement) {
  const parent = image.parentElement;
  if (!parent) return null;

  return (
    Array.from(parent.children).find((child) => {
      const text = child.textContent?.trim() ?? "";
      return child instanceof HTMLElement && text.startsWith("×");
    }) ?? null
  ) as HTMLElement | null;
}

function getStatusBadge(image: HTMLImageElement) {
  const parent = image.parentElement;
  if (!parent) return null;

  return (
    Array.from(parent.children).find(
      (child) =>
        child instanceof HTMLElement &&
        child.dataset.tradeStatusBadge === "true",
    ) ?? null
  ) as HTMLElement | null;
}

function createBadgeSnapshot(element: HTMLElement | null) {
  if (!element) return null;

  const style = window.getComputedStyle(element);

  return {
    rect: element.getBoundingClientRect(),
    text: element.textContent?.trim() ?? "",
    backgroundColor: style.backgroundColor,
    color: style.color,
    borderColor: style.borderColor,
    borderWidth: Number.parseFloat(style.borderTopWidth) || 0,
    fontFamily: style.fontFamily,
    fontSize: style.fontSize,
    fontWeight: style.fontWeight,
  } satisfies ExportBadgeSnapshot;
}

async function prepareExportImages(node: HTMLElement) {
  const images = Array.from(node.querySelectorAll("img"));
  const snapshots: ExportImageSnapshot[] = [];
  const drawableBySource = new Map<
    string,
    Promise<{ image: HTMLImageElement; objectUrl: string }>
  >();

  try {
    for (const element of images) {
      const source = element.currentSrc || element.src;
      if (!source) continue;

      let drawablePromise = drawableBySource.get(source);
      if (!drawablePromise) {
        drawablePromise = fetchImageBlob(source).then(loadDrawableImage);
        drawableBySource.set(source, drawablePromise);
      }

      const { image: drawable, objectUrl } = await drawablePromise;
      const style = window.getComputedStyle(element);
      const quantityBadgeElement = getQuantityBadge(element);
      const statusBadgeElement = getStatusBadge(element);

      snapshots.push({
        element,
        drawable,
        objectUrl,
        rect: element.getBoundingClientRect(),
        borderRadius: Number.parseFloat(style.borderTopLeftRadius) || 0,
        quantityBadge: createBadgeSnapshot(quantityBadgeElement),
        statusBadge: createBadgeSnapshot(statusBadgeElement),
        previousVisibility: element.style.visibility,
      });
    }
  } catch (error) {
    for (const snapshot of snapshots) {
      URL.revokeObjectURL(snapshot.objectUrl);
    }
    throw error;
  }

  for (const snapshot of snapshots) {
    snapshot.element.style.visibility = "hidden";
  }

  return {
    snapshots,
    restore() {
      for (const snapshot of snapshots) {
        snapshot.element.style.visibility = snapshot.previousVisibility;
        URL.revokeObjectURL(snapshot.objectUrl);
      }
    },
  };
}

async function ensureTradeFontReady() {
  if (typeof document === "undefined" || !("fonts" in document)) return;

  await document.fonts.load(`900 22px ${TRADE_FONT_FAMILY}`);
  await document.fonts.ready;
}

function getExportErrorMessage(error: unknown) {
  if (error instanceof Error && error.message.trim()) return error.message;
  if (error instanceof DOMException && error.message.trim())
    return error.message;
  if (typeof error === "string" && error.trim()) return error;

  return "미리보기 이미지 또는 글꼴 로딩이 완료되지 않았습니다.";
}

function createRoundedRectPath(
  context: CanvasRenderingContext2D,
  x: number,
  y: number,
  width: number,
  height: number,
  radius: number,
) {
  const safeRadius = Math.max(0, Math.min(radius, width / 2, height / 2));

  context.beginPath();
  context.moveTo(x + safeRadius, y);
  context.lineTo(x + width - safeRadius, y);
  context.quadraticCurveTo(x + width, y, x + width, y + safeRadius);
  context.lineTo(x + width, y + height - safeRadius);
  context.quadraticCurveTo(
    x + width,
    y + height,
    x + width - safeRadius,
    y + height,
  );
  context.lineTo(x + safeRadius, y + height);
  context.quadraticCurveTo(x, y + height, x, y + height - safeRadius);
  context.lineTo(x, y + safeRadius);
  context.quadraticCurveTo(x, y, x + safeRadius, y);
  context.closePath();
}

function drawContainedImage(
  context: CanvasRenderingContext2D,
  image: HTMLImageElement,
  x: number,
  y: number,
  width: number,
  height: number,
  borderRadius: number,
) {
  const sourceWidth = image.naturalWidth;
  const sourceHeight = image.naturalHeight;

  if (sourceWidth <= 0 || sourceHeight <= 0 || width <= 0 || height <= 0) {
    throw new Error("굿즈 이미지 크기를 확인하지 못했습니다.");
  }

  const scale = Math.min(width / sourceWidth, height / sourceHeight);
  const drawWidth = sourceWidth * scale;
  const drawHeight = sourceHeight * scale;
  const drawX = x + (width - drawWidth) / 2;
  const drawY = y + (height - drawHeight) / 2;

  context.save();
  createRoundedRectPath(context, x, y, width, height, borderRadius);
  context.clip();
  context.fillStyle = "#ffffff";
  context.fillRect(x, y, width, height);
  context.drawImage(image, drawX, drawY, drawWidth, drawHeight);
  context.restore();
}

function drawExportBadge(
  context: CanvasRenderingContext2D,
  badge: ExportBadgeSnapshot,
  nodeRect: DOMRect,
) {
  const x = badge.rect.left - nodeRect.left;
  const y = badge.rect.top - nodeRect.top;
  const width = badge.rect.width;
  const height = badge.rect.height;

  context.save();
  context.shadowColor = "rgba(15, 23, 42, 0.14)";
  context.shadowBlur = 2;
  context.shadowOffsetY = 1;
  createRoundedRectPath(context, x, y, width, height, height / 2);
  context.fillStyle = badge.backgroundColor || "rgb(10, 10, 10)";
  context.fill();
  if (badge.borderWidth > 0) {
    context.lineWidth = badge.borderWidth;
    context.strokeStyle = badge.borderColor || "transparent";
    context.stroke();
  }
  context.shadowColor = "transparent";
  context.fillStyle = badge.color || "#ffffff";
  context.font = `${badge.fontWeight || "900"} ${badge.fontSize || "9px"} ${badge.fontFamily || TRADE_FONT_FAMILY}`;
  context.textAlign = "center";
  context.textBaseline = "middle";
  context.fillText(badge.text, x + width / 2, y + height / 2 + 0.25);
  context.restore();
}

function drawRepeatedGoodsWatermark(
  context: CanvasRenderingContext2D,
  x: number,
  y: number,
  width: number,
  height: number,
  borderRadius: number,
) {
  if (width <= 1 || height <= 1) return;

  const angle = (GOODS_WATERMARK_ANGLE_DEG * Math.PI) / 180;
  const absoluteCosine = Math.abs(Math.cos(angle));
  const absoluteSine = Math.abs(Math.sin(angle));
  const fontSize = 8;

  context.save();
  createRoundedRectPath(context, x, y, width, height, borderRadius);
  context.clip();
  context.fillStyle = GOODS_WATERMARK_FILL;
  context.font = `700 ${fontSize}px Arial, sans-serif`;
  context.textAlign = "center";
  context.textBaseline = "middle";

  const textWidth = Math.max(
    1,
    context.measureText(GOODS_WATERMARK_TEXT).width,
  );
  const textHeight = fontSize * 1.25;
  const horizontalStep = textWidth + Math.max(10, fontSize * 1.5);
  const verticalStep = textHeight + Math.max(8, fontSize * 1.25);

  // Rotate one shared grid instead of rotating each phrase independently.
  // Every image therefore uses the same font size and spacing. The grid is
  // extended beyond the image bounds so even small thumbnails receive
  // multiple watermark fragments, while the step sizes keep phrases apart.
  const rotatedSpanWidth =
    width * absoluteCosine + height * absoluteSine;
  const rotatedSpanHeight =
    width * absoluteSine + height * absoluteCosine;
  const halfSpanX = rotatedSpanWidth / 2 + horizontalStep;
  const halfSpanY = rotatedSpanHeight / 2 + verticalStep;
  const firstRow = Math.floor(-halfSpanY / verticalStep);
  const lastRow = Math.ceil(halfSpanY / verticalStep);

  context.translate(x + width / 2, y + height / 2);
  context.rotate(angle);

  for (let row = firstRow; row <= lastRow; row += 1) {
    const rowY = row * verticalStep;
    const staggerOffset = Math.abs(row) % 2 === 1 ? horizontalStep / 2 : 0;
    const firstColumn = Math.floor(
      (-halfSpanX - staggerOffset) / horizontalStep,
    );
    const lastColumn = Math.ceil(
      (halfSpanX - staggerOffset) / horizontalStep,
    );

    for (let column = firstColumn; column <= lastColumn; column += 1) {
      context.fillText(
        GOODS_WATERMARK_TEXT,
        column * horizontalStep + staggerOffset,
        rowY,
      );
    }
  }

  context.restore();
}

function compositeExportImages(
  canvas: HTMLCanvasElement,
  node: HTMLElement,
  snapshots: ExportImageSnapshot[],
  exportWidth: number,
  exportHeight: number,
) {
  const context = canvas.getContext("2d");
  if (!context) {
    throw new Error("PNG 합성용 캔버스를 준비하지 못했습니다.");
  }

  const nodeRect = node.getBoundingClientRect();
  const scaleX = canvas.width / Math.max(1, exportWidth);
  const scaleY = canvas.height / Math.max(1, exportHeight);

  context.save();
  context.scale(scaleX, scaleY);
  context.imageSmoothingEnabled = true;
  context.imageSmoothingQuality = "high";

  for (const snapshot of snapshots) {
    drawContainedImage(
      context,
      snapshot.drawable,
      snapshot.rect.left - nodeRect.left,
      snapshot.rect.top - nodeRect.top,
      snapshot.rect.width,
      snapshot.rect.height,
      snapshot.borderRadius,
    );

    drawRepeatedGoodsWatermark(
      context,
      snapshot.rect.left - nodeRect.left,
      snapshot.rect.top - nodeRect.top,
      snapshot.rect.width,
      snapshot.rect.height,
      snapshot.borderRadius,
    );
  }

  for (const snapshot of snapshots) {
    if (snapshot.statusBadge) {
      drawExportBadge(context, snapshot.statusBadge, nodeRect);
    }

    if (snapshot.quantityBadge) {
      drawExportBadge(context, snapshot.quantityBadge, nodeRect);
    }
  }

  context.restore();
}

function canvasToBlob(canvas: HTMLCanvasElement) {
  return new Promise<Blob>((resolve, reject) => {
    canvas.toBlob((blob) => {
      if (blob) {
        resolve(blob);
        return;
      }

      reject(new Error("PNG 파일을 생성하지 못했습니다."));
    }, "image/png");
  });
}

async function createTradePngBlob(
  node: HTMLDivElement,
  snapshots: ExportImageSnapshot[],
) {
  const nodeRect = node.getBoundingClientRect();
  const width = Math.max(node.offsetWidth, Math.ceil(nodeRect.width));
  const height = Math.max(node.scrollHeight, Math.ceil(nodeRect.height));

  if (width <= 0 || height <= 0) {
    throw new Error("미리보기 크기를 계산하지 못했습니다.");
  }

  const canvas = await toCanvas(node, {
    cacheBust: false,
    pixelRatio: TRADE_EXPORT_SCALE,
    width,
    height,
    backgroundColor: "transparent",
    style: {
      transform: "none",
      transformOrigin: "top left",
    },
  });

  compositeExportImages(canvas, node, snapshots, width, height);
  return canvasToBlob(canvas);
}

export async function renderTradePreviewToPngBlob(node: HTMLDivElement) {
  const previousTransform = node.style.transform;
  const previousTransformOrigin = node.style.transformOrigin;
  let restoreImages: (() => void) | undefined;

  try {
    node.style.transform = "none";
    node.style.transformOrigin = "top left";

    await Promise.all([ensureTradeFontReady(), ensurePreviewImagesReady(node)]);
    const preparedImages = await prepareExportImages(node);
    restoreImages = preparedImages.restore;
    await waitForNextPaint();

    let lastError: unknown;

    for (let attempt = 0; attempt < 2; attempt += 1) {
      try {
        return await createTradePngBlob(node, preparedImages.snapshots);
      } catch (error) {
        lastError = error;
      }

      await new Promise((resolve) =>
        window.setTimeout(resolve, EXPORT_RETRY_DELAY_MS),
      );
      await waitForNextPaint();
    }

    throw new Error(getExportErrorMessage(lastError));
  } finally {
    restoreImages?.();
    node.style.transform = previousTransform;
    node.style.transformOrigin = previousTransformOrigin;
  }
}

export async function saveTradePngBlob(
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
