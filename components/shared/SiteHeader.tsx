'use client';

import Link from 'next/link';
import { usePathname } from 'next/navigation';

function getLinkClassName(isActive: boolean) {
  return isActive
    ? 'rounded-full bg-neutral-950 px-3 py-2 text-[11px] font-black text-white'
    : 'rounded-full border border-neutral-200 bg-white px-3 py-2 text-[11px] font-bold text-neutral-600';
}

export function SiteHeader() {
  const pathname = usePathname();

  const isCardForm = pathname.startsWith('/cardform');
  const isAdmin = pathname.startsWith('/admin');

  return (
    <header className="sticky top-0 z-40 border-b border-neutral-200 bg-white/90 backdrop-blur">
      <div className="mx-auto flex w-full max-w-md items-center justify-between gap-3 px-4 py-3 sm:max-w-lg">
        <Link href="/" className="min-w-0">
          <p className="truncate text-sm font-black text-neutral-950">
            굿즈 교환판
          </p>
          <p className="truncate text-[10px] font-bold uppercase tracking-[0.16em] text-neutral-400">
            Trade Board
          </p>
        </Link>

        <nav className="flex shrink-0 items-center gap-1.5">
          <Link href="/cardform" className={getLinkClassName(isCardForm)}>
            이미지 제보
          </Link>

          <Link href="/admin/login" className={getLinkClassName(isAdmin)}>
            관리자
          </Link>
        </nav>
      </div>
    </header>
  );
}