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
const IOS_EXPORT_WIDTHS = [2000, 1600, 1200] as const;
const IOS_MAX_CANVAS_PIXELS = 12_000_000;
const IMAGE_FETCH_CONCURRENCY = 4;
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

function isIosWebKit() {
  const ua = navigator.userAgent;
  return /iPhone|iPad|iPod/i.test(ua) ||
    (/Macintosh/i.test(ua) && navigator.maxTouchPoints > 1);
}

function timeoutAfter(ms: number) {
  return new Promise<void>((resolve) => window.setTimeout(resolve, ms));
}

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

const GOODS_WATERMARK_STYLE_MARKERS = [
  "data:image/svg+xml",
  "BL EVENT TRADE",
  "BL%20EVENT%20TRADE",
] as const;

type ExportStyleOverrideRecord = {
  element: HTMLElement;
  styleValue: string;
  stylePriority: string;
  backgroundValue: string;
  backgroundPriority: string;
  backgroundImageValue: string;
  backgroundImagePriority: string;
  opacityValue: string;
  opacityPriority: string;
  displayValue: string;
  displayPriority: string;
};

function isGoodsProtectionElement(element: HTMLElement) {
  if (element.dataset.goodsImageProtectionLayer === "true") {
    return true;
  }

  const inlineStyle = element.getAttribute("style") ?? "";
  return GOODS_WATERMARK_STYLE_MARKERS.some((marker) =>
    inlineStyle.includes(marker),
  );
}

function suppressGoodsProtectionLayers(root: ParentNode) {
  const records: ExportStyleOverrideRecord[] = [];
  root.querySelectorAll<HTMLElement>("*").forEach((element) => {
    if (!isGoodsProtectionElement(element)) return;

    records.push({
      element,
      styleValue: element.getAttribute("style") ?? "",
      stylePriority: "",
      backgroundValue: element.style.getPropertyValue("background"),
      backgroundPriority: element.style.getPropertyPriority("background"),
      backgroundImageValue: element.style.getPropertyValue("background-image"),
      backgroundImagePriority: element.style.getPropertyPriority("background-image"),
      opacityValue: element.style.getPropertyValue("opacity"),
      opacityPriority: element.style.getPropertyPriority("opacity"),
      displayValue: element.style.getPropertyValue("display"),
      displayPriority: element.style.getPropertyPriority("display"),
    });

    element.style.setProperty("background", "transparent", "important");
    element.style.setProperty("background-image", "none", "important");
    element.style.setProperty("opacity", "0", "important");
    element.style.setProperty("display", "none", "important");
  });

  return () => {
    for (const record of records) {
      if (record.styleValue) {
        record.element.setAttribute("style", record.styleValue);
      } else {
        record.element.removeAttribute("style");
      }

      if (record.backgroundValue) {
        record.element.style.setProperty(
          "background",
          record.backgroundValue,
          record.backgroundPriority,
        );
      }
      if (record.backgroundImageValue) {
        record.element.style.setProperty(
          "background-image",
          record.backgroundImageValue,
          record.backgroundImagePriority,
        );
      }
      if (record.opacityValue) {
        record.element.style.setProperty(
          "opacity",
          record.opacityValue,
          record.opacityPriority,
        );
      }
      if (record.displayValue) {
        record.element.style.setProperty(
          "display",
          record.displayValue,
          record.displayPriority,
        );
      }
    }
  };
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

async function prepareExportImages(
  node: HTMLElement,
  hideOriginalElements: boolean,
) {
  const images = Array.from(node.querySelectorAll("img"));
  const snapshots: ExportImageSnapshot[] = [];
  const drawableBySource = new Map<
    string,
    Promise<{ image: HTMLImageElement; objectUrl: string }>
  >();
  const objectUrls = new Set<string>();
  let index = 0;

  // A large board previously awaited every image in sequence. Limit parallel
  // downloads/decodes to avoid long iOS exports without overloading Safari.
  const worker = async () => {
    while (index < images.length) {
      const element = images[index++];
      const source = element.currentSrc || element.src;
      if (!source) continue;

      let drawablePromise = drawableBySource.get(source);
      if (!drawablePromise) {
        drawablePromise = fetchImageBlob(source).then(loadDrawableImage);
        drawableBySource.set(source, drawablePromise);
      }

      const { image: drawable, objectUrl } = await drawablePromise;
      objectUrls.add(objectUrl);
      const style = window.getComputedStyle(element);
      snapshots.push({
        element,
        drawable,
        objectUrl,
        rect: element.getBoundingClientRect(),
        borderRadius: Number.parseFloat(style.borderTopLeftRadius) || 0,
        quantityBadge: createBadgeSnapshot(getQuantityBadge(element)),
        statusBadge: createBadgeSnapshot(getStatusBadge(element)),
        previousVisibility: element.style.visibility,
      });
    }
  };

  try {
    await Promise.all(
      Array.from({ length: Math.min(IMAGE_FETCH_CONCURRENCY, images.length) },
        () => worker()),
    );
  } catch (error) {
    // Pending workers may still resolve: revoke their object URLs as well.
    await Promise.allSettled(Array.from(drawableBySource.values()));
    for (const result of drawableBySource.values()) {
      const resolved = await result.catch(() => null);
      if (resolved) objectUrls.add(resolved.objectUrl);
    }
    for (const url of objectUrls) URL.revokeObjectURL(url);
    throw error;
  }

  // Promise completion order is not necessarily DOM order. Use the original
  // image order for repeatable compositing and overlapping badges.
  snapshots.sort(
    (a, b) => images.indexOf(a.element) - images.indexOf(b.element),
  );
  if (hideOriginalElements) {
    for (const snapshot of snapshots) {
      snapshot.element.style.visibility = "hidden";
    }
  }

  return {
    snapshots,
    restore() {
      if (hideOriginalElements) {
        for (const snapshot of snapshots) {
          snapshot.element.style.visibility = snapshot.previousVisibility;
        }
      }
      for (const url of objectUrls) URL.revokeObjectURL(url);
    },
  };
}

async function ensureTradeFontReady() {
  if (typeof document === "undefined" || !("fonts" in document)) return;

  // Safari can leave a web-font promise pending. Do not block image export forever.
  await Promise.race([
    (async () => {
      await document.fonts.load(`900 22px ${TRADE_FONT_FAMILY}`);
      await document.fonts.ready;
    })().catch(() => undefined),
    timeoutAfter(IMAGE_READY_TIMEOUT_MS),
  ]);
}

function getExportErrorMessage(error: unknown) {
  if (error instanceof Error && error.message.trim()) return error.message;
  if (error instanceof DOMException && error.message.trim())
    return error.message;
  if (typeof error === "string" && error.trim()) return error;

  return "미리보기 이미지 또는 글꼴 로딩이 완료되지 않았습니다.";
}

function formatExportFailure(stage: string, error: unknown) {
  const detail = getExportErrorMessage(error);
  const errorName = error instanceof Error ? error.name : "UnknownError";
  return new Error(`[PNG ${stage}] ${errorName}: ${detail}`);
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

type CompositeExportOptions = {
  drawImages: boolean;
  drawBadges: boolean;
  drawWatermarks: boolean;
};

function compositeExportImages(
  canvas: HTMLCanvasElement,
  node: HTMLElement,
  snapshots: ExportImageSnapshot[],
  exportWidth: number,
  exportHeight: number,
  options: CompositeExportOptions,
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
    if (options.drawImages) {
      drawContainedImage(
        context,
        snapshot.drawable,
        snapshot.rect.left - nodeRect.left,
        snapshot.rect.top - nodeRect.top,
        snapshot.rect.width,
        snapshot.rect.height,
        snapshot.borderRadius,
      );
    }

    if (options.drawWatermarks) {
      drawRepeatedGoodsWatermark(
        context,
        snapshot.rect.left - nodeRect.left,
        snapshot.rect.top - nodeRect.top,
        snapshot.rect.width,
        snapshot.rect.height,
        snapshot.borderRadius,
      );
    }
  }

  if (options.drawBadges) {
    for (const snapshot of snapshots) {
      if (snapshot.statusBadge) {
        drawExportBadge(context, snapshot.statusBadge, nodeRect);
      }

      if (snapshot.quantityBadge) {
        drawExportBadge(context, snapshot.quantityBadge, nodeRect);
      }
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

// Safari can reject the very large SVG data: URL created internally by
// html-to-image. A blob: URL avoids that URL decoding path while preserving
// the exact same HTML snapshot, fonts and CSS.
async function renderViaHtml2Canvas(
  node: HTMLDivElement,
  width: number,
  height: number,
  pixelRatio: number,
): Promise<HTMLCanvasElement> {
  // Loaded only on iOS: keep the existing PC export renderer unchanged.
  const { default: html2canvas } = await import("html2canvas-pro");
  return html2canvas(node, {
    backgroundColor: null,
    scale: pixelRatio,
    useCORS: true,
    allowTaint: false,
    logging: false,
    imageTimeout: IMAGE_READY_TIMEOUT_MS,
    width,
    height,
    windowWidth: Math.max(document.documentElement.clientWidth, width),
    windowHeight: Math.max(document.documentElement.clientHeight, height),
    scrollX: 0,
    scrollY: -window.scrollY,
    onclone: (clonedDocument) => {
      const clonedNode = clonedDocument.querySelector(
        '[data-trade-png-export-root="true"]',
      ) as HTMLElement | null;
      if (!clonedNode) return;

      clonedNode.style.transform = "none";
      clonedNode.style.transformOrigin = "top left";

      suppressGoodsProtectionLayers(clonedNode);
      clonedNode
        .querySelectorAll<HTMLElement>('[data-goods-image-protection-layer="true"]')
        .forEach((layer) => layer.remove());
    },
  });
}

async function createTradePngBlob(
  node: HTMLDivElement,
  snapshots: ExportImageSnapshot[],
  targetWidth: number = TRADE_EXPORT_WIDTH,
) {
  const nodeRect = node.getBoundingClientRect();
  const width = Math.max(node.offsetWidth, Math.ceil(nodeRect.width));
  const height = Math.max(node.scrollHeight, Math.ceil(nodeRect.height));

  if (width <= 0 || height <= 0) {
    throw new Error("미리보기 크기를 계산하지 못했습니다.");
  }

  const constrainedWidth = isIosWebKit()
    ? Math.min(targetWidth, Math.floor(Math.sqrt(IOS_MAX_CANVAS_PIXELS * width / height)))
    : targetWidth;
  const pixelRatio = isIosWebKit()
    ? constrainedWidth / width
    : TRADE_EXPORT_SCALE;

  let canvas: HTMLCanvasElement;
  if (isIosWebKit()) {
    try {
      // Avoid html-to-image's SVG foreignObject renderer on iOS.
      canvas = await renderViaHtml2Canvas(node, width, height, pixelRatio);
    } catch (error) {
      throw formatExportFailure("iOS HTML2Canvas 변환", error);
    }
  } else {
    try {
      canvas = await toCanvas(node, {
        cacheBust: false,
        pixelRatio,
        skipFonts: false,
        width,
        height,
        backgroundColor: "transparent",
        style: { transform: "none", transformOrigin: "top left" },
      });
    } catch (error) {
      throw formatExportFailure("PC HTML 변환", error);
    }
  }

  try {
    compositeExportImages(canvas, node, snapshots, width, height, {
      drawImages: !isIosWebKit(),
      drawBadges: !isIosWebKit(),
      drawWatermarks: true,
    });
  } catch (error) {
    throw formatExportFailure("굿즈 이미지·워터마크 합성", error);
  }

  try {
    return await canvasToBlob(canvas);
  } catch (error) {
    throw formatExportFailure("PNG 파일 인코딩", error);
  }
}

export async function renderTradePreviewToPngBlob(node: HTMLDivElement) {
  const previousTransform = node.style.transform;
  const previousTransformOrigin = node.style.transformOrigin;
  const previousExportMarker = node.dataset.tradePngExportRoot;
  node.dataset.tradePngExportRoot = "true";
  let restoreImages: (() => void) | undefined;
  let restoreProtectionLayers: (() => void) | undefined;

  try {
    node.style.transform = "none";
    node.style.transformOrigin = "top left";

    try {
      await Promise.all([ensureTradeFontReady(), ensurePreviewImagesReady(node)]);
    } catch (error) {
      throw formatExportFailure("글꼴·미리보기 준비", error);
    }

    const ios = isIosWebKit();

    let preparedImages: Awaited<ReturnType<typeof prepareExportImages>>;
    try {
      preparedImages = await prepareExportImages(node, !ios);
    } catch (error) {
      throw formatExportFailure("굿즈 원본 이미지 다운로드·디코딩", error);
    }
    restoreImages = preparedImages.restore;

    if (ios) {
      restoreProtectionLayers = suppressGoodsProtectionLayers(node);
    }

    await waitForNextPaint();

    const attemptErrors: string[] = [];

    const attempts = ios
      ? IOS_EXPORT_WIDTHS.map((targetWidth) => ({ targetWidth }))
      : [
          { targetWidth: TRADE_EXPORT_WIDTH, skipFontEmbedding: false },
          { targetWidth: TRADE_EXPORT_WIDTH, skipFontEmbedding: false },
        ];

    for (const attempt of attempts) {
      try {
        return await createTradePngBlob(
          node,
          preparedImages.snapshots,
          attempt.targetWidth,
        );
      } catch (error) {
        attemptErrors.push(getExportErrorMessage(error));
        console.warn("교환판 PNG 생성 재시도:", error);
      }

      await timeoutAfter(EXPORT_RETRY_DELAY_MS);
      await waitForNextPaint();
    }

    // Show the first failure stage and whether subsequent size retries changed it.
    // Avoid reporting a generic font/image error when Safari returns an empty exception.
    throw new Error(
      `${attemptErrors[0] || "PNG 변환 실패 (원인 메시지 없음)"} (총 ${attemptErrors.length}회 실패)` +
      (attemptErrors.length > 1 && attemptErrors.at(-1) !== attemptErrors[0]
        ? ` / 마지막: ${attemptErrors.at(-1)}`
        : ""),
    );
  } finally {
    restoreImages?.();
    restoreProtectionLayers?.();
    node.style.transform = previousTransform;
    node.style.transformOrigin = previousTransformOrigin;
    if (previousExportMarker === undefined) {
      delete node.dataset.tradePngExportRoot;
    } else {
      node.dataset.tradePngExportRoot = previousExportMarker;
    }
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
