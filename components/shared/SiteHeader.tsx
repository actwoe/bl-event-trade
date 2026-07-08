import Link from 'next/link';

export function SiteHeader() {
  return (
    <header className="sticky top-0 z-50 border-b border-neutral-200 bg-white/90 px-4 py-3 backdrop-blur">
      <div className="mx-auto flex w-full max-w-5xl items-center justify-between gap-3">
        <Link href="/" className="min-w-0 truncate text-sm font-black text-neutral-950">
          팝업 & 콜카 굿즈 교환판
        </Link>

        <nav className="flex shrink-0 items-center gap-2">
          <Link
            href="/cardform"
            className="rounded-full border border-neutral-200 bg-white px-4 py-2 text-xs font-black text-neutral-700 shadow-sm transition hover:border-neutral-950 hover:text-neutral-950"
          >
            이미지 제보
          </Link>
        </nav>
      </div>
    </header>
  );
}
