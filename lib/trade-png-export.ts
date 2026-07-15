"use client";

import { toBlob } from "html-to-image";

const TRADE_PREVIEW_WIDTH = 840;
const TRADE_EXPORT_WIDTH = 2000;
const TRADE_FONT_FAMILY = "'Pretendard', Arial, sans-serif";
const IMAGE_READY_TIMEOUT_MS = 10_000;
const EXPORT_RETRY_DELAY_MS = 250;

type RestorableImageSource = {
  image: HTMLImageElement;
  source: string;
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

function blobToDataUrl(blob: Blob) {
  return new Promise<string>((resolve, reject) => {
    const reader = new FileReader();
    reader.onload = () => {
      if (typeof reader.result === "string") {
        resolve(reader.result);
        return;
      }

      reject(new Error("굿즈 이미지를 PNG 저장용으로 변환하지 못했습니다."));
    };
    reader.onerror = () => {
      reject(new Error("굿즈 이미지를 PNG 저장용으로 읽지 못했습니다."));
    };
    reader.readAsDataURL(blob);
  });
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

async function prepareExportImageSources(node: HTMLElement) {
  const images = Array.from(node.querySelectorAll("img"));
  const restorableImages: RestorableImageSource[] = [];
  const dataUrlBySource = new Map<string, Promise<string>>();
  const restore = () => {
    for (const { image, source } of restorableImages) {
      image.src = source;
    }
  };

  const imageSources = images.flatMap((image) => {
    const source = image.currentSrc || image.src;
    if (!source || source.startsWith("data:")) return [];

    return [
      {
        image,
        source,
        originalSource: image.getAttribute("src") ?? source,
      },
    ];
  });

  try {
    const preparedImages = await Promise.all(
      imageSources.map(async ({ image, source, originalSource }) => {
        let dataUrlPromise = dataUrlBySource.get(source);

        if (!dataUrlPromise) {
          dataUrlPromise = fetchImageBlob(source).then(blobToDataUrl);
          dataUrlBySource.set(source, dataUrlPromise);
        }

        return {
          image,
          originalSource,
          dataUrl: await dataUrlPromise,
        };
      }),
    );

    for (const { image, originalSource, dataUrl } of preparedImages) {
      restorableImages.push({ image, source: originalSource });
      image.src = dataUrl;
    }

    await Promise.all(
      preparedImages.map(async ({ image }) => {
        await waitForImageReady(image);

        if (image.naturalWidth <= 0) {
          throw new Error("굿즈 이미지를 PNG 저장용으로 준비하지 못했습니다.");
        }
      }),
    );
  } catch (error) {
    restore();
    throw error;
  }

  return restore;
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
  let restoreImageSources: (() => void) | undefined;

  try {
    node.style.transform = "none";
    node.style.transformOrigin = "top left";

    await Promise.all([ensureTradeFontReady(), ensurePreviewImagesReady(node)]);
    restoreImageSources = await prepareExportImageSources(node);
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
    restoreImageSources?.();
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
