import Link from "next/link";

export type AppBottomNavItem = "home" | "submit" | "trades" | "login";

type AppBottomNavProps = {
  active: AppBottomNavItem;
  homeHref?: string;
};

const ITEMS = [
  { id: "home" as const, label: "홈", href: "/" },
  { id: "submit" as const, label: "이미지 제보", href: "/cardform" },
  { id: "trades" as const, label: "내 교환판", href: "/my-trades" },
  { id: "login" as const, label: "로그인", href: "/login" },
];

function NavIcon({ id }: { id: AppBottomNavItem }) {
  const common = "h-5 w-5 fill-none stroke-current";

  if (id === "home") {
    return (
      <svg viewBox="0 0 24 24" aria-hidden="true" className={common} strokeWidth="1.8">
        <path d="M3.5 10.5 12 3l8.5 7.5" />
        <path d="M5.5 9.5V21h13V9.5M9.5 21v-6h5v6" />
      </svg>
    );
  }

  if (id === "submit") {
    return (
      <svg viewBox="0 0 24 24" aria-hidden="true" className={common} strokeWidth="1.8">
        <rect x="3" y="6" width="18" height="14" rx="3" />
        <path d="M8 6l1.5-2h5L16 6" />
        <circle cx="12" cy="13" r="3.5" />
      </svg>
    );
  }

  if (id === "trades") {
    return (
      <svg viewBox="0 0 24 24" aria-hidden="true" className={common} strokeWidth="1.8">
        <rect x="5" y="3" width="14" height="18" rx="2.5" />
        <path d="M8.5 8h7M8.5 12h7M8.5 16h4" />
      </svg>
    );
  }

  return (
    <svg viewBox="0 0 24 24" aria-hidden="true" className={common} strokeWidth="1.8">
      <circle cx="12" cy="8" r="3.5" />
      <path d="M5.5 20c.6-4 2.9-6 6.5-6s5.9 2 6.5 6" />
    </svg>
  );
}

export function AppBottomNav({ active, homeHref = "/" }: AppBottomNavProps) {
  return (
    <nav className="app-bottom-nav relative z-20 grid shrink-0 grid-cols-4 border-t border-neutral-200 bg-white px-2">
      {ITEMS.map((item) => {
        const href = item.id === "home" ? homeHref : item.href;
        const isActive = item.id === active;

        return (
          <Link
            key={item.id}
            href={href}
            className={
              isActive
                ? "app-bottom-nav-item flex flex-col items-center gap-1 py-1 text-[#7C5CFC]"
                : "app-bottom-nav-item flex flex-col items-center gap-1 py-1 text-neutral-500"
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
