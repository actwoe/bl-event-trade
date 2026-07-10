'use client';

import Link from 'next/link';
import { useRouter } from 'next/navigation';
import { useEffect } from 'react';

type CollectionCardProps = {
  href: string;
  title: string;
  periodLabel: string;
  thumbnailUrl: string;
  ended: boolean;
};

export function CollectionCard({
  href,
  title,
  periodLabel,
  thumbnailUrl,
  ended,
}: CollectionCardProps) {
  const router = useRouter();

  useEffect(() => {
    router.prefetch(href);
  }, [href, router]);

  return (
    <Link
      href={href}
      prefetch
      className="group block w-full touch-manipulation overflow-hidden rounded-2xl border border-neutral-200/70 bg-white transition active:scale-[0.98] active:border-neutral-300 hover:-translate-y-0.5 hover:border-neutral-300 hover:shadow-[0_10px_24px_rgba(15,23,42,0.05)]"
      aria-label={`${title} 교환판 만들기`}
    >
      <div className="relative aspect-[32/45] bg-neutral-50">
        {thumbnailUrl ? (
          <img
            src={thumbnailUrl}
            alt=""
            className={`h-full w-full object-cover transition group-hover:scale-[1.02] ${
              ended ? 'grayscale opacity-60' : ''
            }`}
          />
        ) : (
          <div className="flex h-full w-full items-center justify-center px-3 text-center text-xs font-bold leading-5 text-neutral-400">
            썸네일 없음
          </div>
        )}

        {ended ? (
          <span className="absolute left-2 top-2 rounded-full bg-neutral-950 px-2.5 py-1 text-[10px] font-bold text-white">
            종료
          </span>
        ) : null}
      </div>

      <div className="p-3">
        <h3 className="line-clamp-2 break-keep text-sm font-bold leading-5 text-neutral-900">
          {title}
        </h3>

        {periodLabel ? (
          <p className="mt-1 line-clamp-2 text-[11px] font-medium leading-5 text-neutral-400">
            {periodLabel}
          </p>
        ) : null}
      </div>
    </Link>
  );
}
