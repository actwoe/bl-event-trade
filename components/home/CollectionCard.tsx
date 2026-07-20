'use client';

import Link from 'next/link';
import { useRouter } from 'next/navigation';
import { useEffect } from 'react';
import { getEventStatusLabel, type EventStatus } from '@/lib/event-status';

type CollectionCardProps = {
  href: string;
  title: string;
  periodLabel: string;
  location: string | null;
  thumbnailUrl: string;
  status: EventStatus;
};

export function CollectionCard({
  href,
  title,
  periodLabel,
  location,
  thumbnailUrl,
  status,
}: CollectionCardProps) {
  const router = useRouter();
  const ended = status === 'ended';

  useEffect(() => {
    router.prefetch(href);
  }, [href, router]);

  return (
    <Link
      href={href}
      prefetch
      onPointerEnter={() => router.prefetch(href)}
      onPointerDown={() => router.prefetch(href)}
      onFocus={() => router.prefetch(href)}
      className="group block w-full touch-manipulation overflow-hidden rounded-[18px] border border-neutral-200 bg-white text-left transition active:scale-[0.985] hover:border-neutral-300"
      aria-label={`${title} 교환/양도판 만들기`}
    >
      <div className="relative aspect-[32/45] bg-neutral-100">
        {thumbnailUrl ? (
          <img
            src={thumbnailUrl}
            alt=""
            loading="eager"
            decoding="async"
            fetchPriority="high"
            className={`block h-full w-full object-cover transition group-hover:scale-[1.02] ${
              ended ? 'grayscale opacity-70' : ''
            }`}
          />
        ) : (
          <div className="flex h-full items-center justify-center px-3 text-center text-xs font-bold text-neutral-400">
            썸네일 없음
          </div>
        )}

        <span
          className={
            status === 'ongoing'
              ? 'absolute right-2 top-2 rounded-full bg-[#F3F0FF] px-2 py-1 text-[9px] font-black text-[#7C5CFC]'
              : 'absolute right-2 top-2 rounded-full bg-white/90 px-2 py-1 text-[9px] font-black text-neutral-500'
          }
        >
          {getEventStatusLabel(status)}
        </span>
      </div>

      <div className="p-3">
        <h2 className="line-clamp-2 break-keep text-[13px] font-black leading-5 text-neutral-950">
          {title}
        </h2>
        <p className="mt-1.5 text-[10px] font-semibold text-neutral-500">
          {periodLabel}
        </p>
        {location ? (
          <p className="mt-1 line-clamp-1 text-[10px] text-neutral-400">
            {location}
          </p>
        ) : null}
      </div>
    </Link>
  );
}
