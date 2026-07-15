"use client";

import { toBlob } from "html-to-image";

const TRADE_PREVIEW_WIDTH = 840;
const TRADE_EXPORT_WIDTH = 2000;
const TRADE_FONT_FAMILY = "'Pretendard', Arial, sans-serif";
const IMAGE_READY_TIMEOUT_MS = 10_000;
const EXPORT_RETRY_DELAY_MS = 250;

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

async function ensureTradeFontReady() {
  if (typeof document === "undefined" || !("fonts" in document)) return;

  await document.fonts.load(`900 22px ${TRADE_FONT_FAMILY}`);
  await document.fonts.ready;
}

function getExportErrorMessage(error: unknown) {
  if (error instanceof Error && error.message.trim()) return error.message;
  if (error instanceof DOMException && error.message.trim()) return error.message;
  if (typeof error === "string" && error.trim()) return error;

  return "미리보기 이미지 또는 글꼴 로딩이 완료되지 않았습니다.";
}

async function createTradePngBlob(node: HTMLDivElement) {
  const height = Math.max(
    node.scrollHeight,
    Math.ceil(node.getBoundingClientRect().height),
  );

  if (height <= 0) {
    throw new Error("미리보기 높이를 계산하지 못했습니다.");
  }

  return toBlob(node, {
    cacheBust: false,
    pixelRatio: TRADE_EXPORT_WIDTH / TRADE_PREVIEW_WIDTH,
    width: TRADE_PREVIEW_WIDTH,
    height,
    backgroundColor: "transparent",
    style: {
      transform: "none",
      transformOrigin: "top left",
    },
  });
}

export async function renderTradePreviewToPngBlob(node: HTMLDivElement) {
  const previousTransform = node.style.transform;
  const previousTransformOrigin = node.style.transformOrigin;

  try {
    node.style.transform = "none";
    node.style.transformOrigin = "top left";

    await Promise.all([ensureTradeFontReady(), ensurePreviewImagesReady(node)]);
    await waitForNextPaint();

    let lastError: unknown;

    for (let attempt = 0; attempt < 2; attempt += 1) {
      try {
        const blob = await createTradePngBlob(node);
        if (blob) return blob;
        lastError = new Error("PNG 파일을 생성하지 못했습니다.");
      } catch (error) {
        lastError = error;
      }

      await new Promise((resolve) =>
        window.setTimeout(resolve, EXPORT_RETRY_DELAY_MS),
      );
      await ensurePreviewImagesReady(node);
      await waitForNextPaint();
    }

    throw new Error(getExportErrorMessage(lastError));
  } finally {
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
