"use client";

import type { ImgHTMLAttributes } from "react";

const WATERMARK_TEXT = "BL EVENT TRADE";

type ProtectedGoodsImageProps = Omit<ImgHTMLAttributes<HTMLImageElement>, "alt"> & {
  alt: string;
  watermarkClassName?: string;
};

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
        draggable={false}
        onContextMenu={(event) => {
          event.preventDefault();
          onContextMenu?.(event);
        }}
        onDragStart={(event) => {
          event.preventDefault();
          onDragStart?.(event);
        }}
        className={`select-none ${className ?? ""}`}
        style={{
          WebkitTouchCallout: "none",
          userSelect: "none",
          ...style,
        }}
      />
      <span
        aria-hidden="true"
        data-goods-watermark="true"
        className={`pointer-events-none absolute z-[1] whitespace-nowrap rounded bg-black/45 px-1 py-0.5 font-black leading-none tracking-[0.08em] text-white/90 shadow-sm ${watermarkClassName}`}
      >
        {WATERMARK_TEXT}
      </span>
    </>
  );
}
