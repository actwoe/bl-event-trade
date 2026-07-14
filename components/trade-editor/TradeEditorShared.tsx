"use client";

import { useState } from "react";
import { TradeReferenceImage } from "@/lib/trade-types";

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

export function ExportPreviewModal({ imageUrl, onClose }: ExportPreviewModalProps) {
  return (
    <div className="fixed inset-0 z-50 bg-neutral-950/70 px-4 py-5">
      <div className="mx-auto flex h-full w-full max-w-md flex-col overflow-hidden rounded-3xl bg-white shadow-xl sm:max-w-lg">
        <header className="shrink-0 border-b border-neutral-100 p-5">
          <div className="flex items-start justify-between gap-4">
            <div>
              <p className="text-xs font-black uppercase tracking-[0.2em] text-neutral-400">Save Image</p>
              <h2 className="mt-1 text-xl font-black text-neutral-950">교환판 이미지 저장</h2>
              <p className="mt-2 text-xs leading-5 text-neutral-500">아래 이미지를 길게 눌러 사진 앱에 저장하거나 공유해 주세요.</p>
            </div>
            <button type="button" onClick={onClose} className="flex h-10 w-10 shrink-0 items-center justify-center rounded-full bg-neutral-100 text-xl font-black text-neutral-500" aria-label="닫기">×</button>
          </div>
        </header>
        <div className="min-h-0 flex-1 overflow-y-auto p-5">
          <img src={imageUrl} alt="저장할 교환판 이미지" className="w-full rounded-2xl border border-neutral-200 bg-white" />
        </div>
      </div>
    </div>
  );
}

export function AddSideButton({ koreanTitle, englishTitle, iconSrc, count, onClick }: AddSideButtonProps) {
  return (
    <button
      type="button"
      onClick={onClick}
      aria-label={`${koreanTitle} (${englishTitle}) 이미지 추가${count > 0 ? `, 현재 ${count}개 선택됨` : ""}`}
      className="rounded-2xl border border-neutral-200 bg-neutral-50 px-3 py-3 text-left transition hover:border-neutral-950 hover:bg-white"
    >
      <div className="flex items-center gap-2">
        <img src={iconSrc} alt="" aria-hidden="true" className="h-6 w-6 shrink-0 object-contain" />
        <span className="text-[10px] font-black uppercase tracking-[0.16em] text-neutral-400">{englishTitle}</span>
      </div>
      <div className="mt-2 flex items-center justify-between gap-2">
        <span className="whitespace-nowrap text-sm font-black text-neutral-950">{koreanTitle}</span>
        <span className="shrink-0 rounded-full bg-neutral-950 px-2.5 py-1 text-[10px] font-black text-white">+ 추가</span>
      </div>
    </button>
  );
}

type GoodsWorkReferenceProps = { referenceImages: TradeReferenceImage[] };

export function GoodsWorkReference({ referenceImages }: GoodsWorkReferenceProps) {
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
          <span aria-hidden="true" className="shrink-0 text-xs leading-none">🔍</span>
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
