"use client";

import Link from 'next/link';

export function SiteHeader() {
  return (
    <header className="bg-neutral-100 px-4 pt-4">
      <div className="mx-auto flex w-full max-w-md items-center justify-between gap-3 sm:max-w-lg">
        <Link
          href="/"
          className="inline-flex rounded-full border border-neutral-200/80 bg-white px-4 py-2 text-xs font-black text-neutral-600 shadow-[0_8px_22px_rgba(15,23,42,0.04)] transition hover:border-neutral-950 hover:text-neutral-950"
        >
          ← 메인으로
        </Link>

        <Link
          href="/cardform"
          className="inline-flex rounded-full border border-neutral-200/80 bg-white px-4 py-2 text-xs font-black text-neutral-600 shadow-[0_8px_22px_rgba(15,23,42,0.04)] transition hover:border-neutral-950 hover:text-neutral-950"
        >
          이미지 제보하기
        </Link>
      </div>
    </header>
  );
}
