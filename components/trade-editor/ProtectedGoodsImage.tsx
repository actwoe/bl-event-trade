"use client";

import type { ImgHTMLAttributes, SyntheticEvent } from "react";

const WATERMARK_TEXT = "BL EVENT TRADE";

const protectedImageStyle = {
  WebkitTouchCallout: "none",
  WebkitUserDrag: "none",
  userSelect: "none",
  pointerEvents: "none",
} as const;

const protectionLayerStyle = {
  WebkitTouchCallout: "none",
  WebkitUserDrag: "none",
  userSelect: "none",
  touchAction: "manipulation",
} as const;

type ProtectedGoodsImageProps = Omit<ImgHTMLAttributes<HTMLImageElement>, "alt"> & {
  alt: string;
  watermarkClassName?: string;
};

function blockNativeImageAction(event: SyntheticEvent<HTMLElement>) {
  event.preventDefault();
}

export function ProtectedGoodsImage({
  alt,
  className,
  style,
  onContextMenu,
  onDragStart,
  watermarkClassName = "bottom-1 right-1 text-[7px]",
  ...props
}: ProtectedGoodsImageProps) {
  return (
    <>
      <img
        {...props}
        alt={alt}
        data-protected-goods-image="true"
        draggable={false}
        onContextMenu={(event) => {
          event.preventDefault();
          onContextMenu?.(event);
        }}
        onDragStart={(event) => {
          event.preventDefault();
          onDragStart?.(event);
        }}
        className={`pointer-events-none select-none ${className ?? ""}`}
        style={{
          ...protectedImageStyle,
          ...style,
        }}
      />

      <span
        aria-hidden="true"
        data-goods-image-protection-layer="true"
        draggable={false}
        onContextMenu={blockNativeImageAction}
        onDragStart={blockNativeImageAction}
        className="absolute inset-0 z-[2] select-none [-webkit-touch-callout:none] [-webkit-user-drag:none]"
        style={protectionLayerStyle}
      />

      <span
        aria-hidden="true"
        data-goods-watermark="true"
        className={`pointer-events-none absolute z-[3] whitespace-nowrap rounded bg-black/45 px-1 py-0.5 font-black leading-none tracking-[0.08em] text-white/90 shadow-sm ${watermarkClassName}`}
      >
        {WATERMARK_TEXT}
      </span>
    </>
  );
}
