"use client";

import Link from "next/link";

export type AdminBottomNavItem = "home" | "events" | "submissions" | "lab";

type AdminBottomNavProps = {
  active: AdminBottomNavItem;
};

const ITEMS = [
  { id: "home" as const, label: "관리 홈", href: "/admin" },
  { id: "events" as const, label: "행사 관리", href: "/admin/events" },
  { id: "submissions" as const, label: "제보 관리", href: "/admin/submissions" },
  { id: "lab" as const, label: "테스트", href: "/admin/trade-lab" },
];

function NavIcon({ id }: { id: AdminBottomNavItem }) {
  const common = "h-5 w-5 fill-none stroke-current";

  if (id === "home") {
    return (
      <svg viewBox="0 0 24 24" aria-hidden="true" className={common} strokeWidth="1.8">
        <path d="M3.5 10.5 12 3l8.5 7.5" />
        <path d="M5.5 9.5V21h13V9.5M9.5 21v-6h5v6" />
      </svg>
    );
  }

  if (id === "events") {
    return (
      <svg viewBox="0 0 24 24" aria-hidden="true" className={common} strokeWidth="1.8">
        <rect x="4" y="5" width="16" height="15" rx="2.5" />
        <path d="M8 3v4M16 3v4M4 9h16M8 13h3M13 13h3M8 16h3" />
      </svg>
    );
  }

  if (id === "submissions") {
    return (
      <svg viewBox="0 0 24 24" aria-hidden="true" className={common} strokeWidth="1.8">
        <rect x="3" y="6" width="18" height="14" rx="3" />
        <path d="M8 6l1.5-2h5L16 6" />
        <circle cx="12" cy="13" r="3.5" />
      </svg>
    );
  }

  return (
    <svg viewBox="0 0 24 24" aria-hidden="true" className={common} strokeWidth="1.8">
      <path d="M5 4h14v16H5z" />
      <path d="M8 8h8M8 12h5M8 16h7" />
    </svg>
  );
}

export function AdminBottomNav({ active }: AdminBottomNavProps) {
  return (
    <nav className="app-bottom-nav relative z-20 grid shrink-0 grid-cols-4 border-t border-neutral-200 bg-white px-2">
      {ITEMS.map((item) => {
        const isActive = item.id === active;

        return (
          <Link
            key={item.id}
            href={item.href}
            className={
              isActive
                ? "flex flex-col items-center gap-1 py-1 text-[#7C5CFC]"
                : "flex flex-col items-center gap-1 py-1 text-neutral-500"
            }
          >
            <NavIcon id={item.id} />
            <span className={isActive ? "text-[10px] font-black" : "text-[10px] font-bold"}>
              {item.label}
            </span>
          </Link>
        );
      })}
    </nav>
  );
}
