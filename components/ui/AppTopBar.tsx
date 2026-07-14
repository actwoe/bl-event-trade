"use client";

import Link from "next/link";

export type AppTopBarProps = {
  title: string;
  backHref: string;
  loginHref?: string;
  onAccountClick?: () => void;
  accountLabel?: string;
};

function BackIcon() {
  return (
    <svg
      viewBox="0 0 24 24"
      aria-hidden="true"
      className="h-5 w-5 fill-none stroke-current"
      strokeWidth="1.9"
    >
      <path d="m14.5 5-7 7 7 7" />
    </svg>
  );
}

function AccountIcon() {
  return (
    <svg
      viewBox="0 0 24 24"
      aria-hidden="true"
      className="h-5 w-5 fill-none stroke-current"
      strokeWidth="1.8"
    >
      <circle cx="12" cy="8" r="3.5" />
      <path d="M5.5 20c.6-4 2.9-6 6.5-6s5.9 2 6.5 6" />
    </svg>
  );
}

export function AppTopBar({
  title,
  backHref,
  loginHref = "/login",
  onAccountClick,
  accountLabel = "로그인",
}: AppTopBarProps) {
  const accountClassName =
    "flex h-10 w-10 items-center justify-center rounded-full text-neutral-900 transition hover:bg-neutral-100";

  return (
    <header className="grid h-16 shrink-0 grid-cols-[48px_1fr_48px] items-center border-b border-neutral-100 bg-white px-3">
      <Link
        href={backHref}
        aria-label="뒤로가기"
        className="flex h-10 w-10 items-center justify-center rounded-full text-neutral-900 transition hover:bg-neutral-100"
      >
        <BackIcon />
      </Link>

      <h1 className="truncate px-2 text-center text-[16px] font-black tracking-[-0.02em] text-neutral-950">
        {title}
      </h1>

      {onAccountClick ? (
        <button
          type="button"
          onClick={onAccountClick}
          aria-label={accountLabel}
          className={accountClassName}
        >
          <AccountIcon />
        </button>
      ) : (
        <Link
          href={loginHref}
          aria-label={accountLabel}
          className={accountClassName}
        >
          <AccountIcon />
        </Link>
      )}
    </header>
  );
}
