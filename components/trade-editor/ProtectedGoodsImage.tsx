"use client";

import type { ImgHTMLAttributes, SyntheticEvent } from "react";
import { getGoodsWatermarkOverlayStyle } from "@/lib/goods-watermark";

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
} as const;

type ProtectedGoodsImageProps = Omit<
  ImgHTMLAttributes<HTMLImageElement>,
  "alt"
> & {
  alt: string;
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

      <div
        aria-hidden="true"
        data-goods-image-protection-layer="true"
        draggable={false}
        onContextMenu={blockNativeImageAction}
        onDragStart={blockNativeImageAction}
        className="absolute inset-0 z-[3]"
        style={{
          ...protectionLayerStyle,
          ...getGoodsWatermarkOverlayStyle(),
          borderRadius: "inherit",
        }}
      />
    </>
  );
}
