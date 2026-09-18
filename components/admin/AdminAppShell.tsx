"use client";

import Link from "next/link";
import { useEffect, type ReactNode } from "react";
import { usePathname, useRouter } from "next/navigation";
import { AdminBottomNav, type AdminBottomNavItem } from "@/components/admin/AdminBottomNav";
import { AppFrame } from "@/components/ui/AppFrame";
import { AppTopBar } from "@/components/ui/AppTopBar";
import { supabase } from "@/lib/supabase";

type AdminAppShellProps = {
  children: ReactNode;
};

type AdminRouteMeta = {
  title: string;
  backHref: string;
  active: AdminBottomNavItem;
};

const ADMIN_LINKS: Array<{
  id: AdminBottomNavItem;
  label: string;
  description: string;
  href: string;
}> = [
  { id: "home", label: "관리자 홈", description: "관리 메뉴 모아보기", href: "/admin" },
  { id: "events", label: "행사 관리", description: "행사·굿즈·공지 관리", href: "/admin/events" },
  { id: "submissions", label: "제보 관리", description: "이용자 이미지 검수", href: "/admin/submissions" },
  { id: "lab", label: "교환판 테스트", description: "테스트 화면 확인", href: "/admin/trade-lab" },
];

const SERVICE_LINKS = [
  { label: "서비스 홈 / 행사 목록", href: "/" },
  { label: "내 교환/양도판", href: "/my-trades" },
  { label: "이미지 제보", href: "/cardform" },
];

function getAdminRouteMeta(pathname: string): AdminRouteMeta {
  if (pathname === "/admin/login") {
    return { title: "관리자 로그인", backHref: "/", active: "home" };
  }

  if (pathname === "/admin/events/new") {
    return { title: "새 행사 등록", backHref: "/admin/events", active: "events" };
  }

  if (pathname.startsWith("/admin/events/")) {
    return { title: "행사 관리", backHref: "/admin/events", active: "events" };
  }

  if (pathname === "/admin/events") {
    return { title: "행사 관리", backHref: "/admin", active: "events" };
  }

  if (pathname.startsWith("/admin/submissions")) {
    return { title: "이미지 제보 관리", backHref: "/admin", active: "submissions" };
  }

  if (pathname.startsWith("/admin/trade-lab")) {
    return { title: "교환판 테스트", backHref: "/admin", active: "lab" };
  }

  return { title: "관리자 홈", backHref: "/", active: "home" };
}

export function AdminAppShell({ children }: AdminAppShellProps) {
  const pathname = usePathname();
  const router = useRouter();

  useEffect(() => {
    if (pathname === "/admin/login" || pathname.startsWith("/admin/ui-lab")) return;

    const html = document.documentElement;
    const body = document.body;
    const previousHtmlOverflow = html.style.overflow;
    const previousBodyOverflow = body.style.overflow;
    html.style.overflow = "hidden";
    body.style.overflow = "hidden";

    return () => {
      html.style.overflow = previousHtmlOverflow;
      body.style.overflow = previousBodyOverflow;
    };
  }, [pathname]);

  if (pathname.startsWith("/admin/ui-lab")) {
    return children;
  }

  const route = getAdminRouteMeta(pathname);
  const isLoginPage = pathname === "/admin/login";
  const usesProductionPageDesign =
    pathname === "/admin/events" ||
    pathname === "/admin/events/new" ||
    pathname.startsWith("/admin/trade-lab");

  async function handleLogout() {
    await supabase.auth.signOut();
    router.push("/admin/login");
    router.refresh();
  }

  if (isLoginPage) {
    return (
      <AppFrame>
        <AppTopBar title={route.title} backHref={route.backHref} showAccount={false} />
        <div className="min-h-0 flex-1 overflow-y-auto bg-[#fafafa]">{children}</div>
      </AppFrame>
    );
  }

  return (
    <div className="fixed inset-0 flex h-[100dvh] w-full overflow-hidden bg-[#f5f5f7] text-neutral-950">
      <aside className="hidden w-[252px] shrink-0 flex-col border-r border-neutral-200 bg-white lg:flex">
        <div className="border-b border-neutral-100 px-5 py-5">
          <p className="text-[10px] font-black uppercase tracking-[0.18em] text-[#7C5CFC]">
            BL GOODS TRADE
          </p>
          <p className="mt-1 text-lg font-black tracking-[-0.03em]">관리자</p>
        </div>

        <nav className="flex-1 overflow-y-auto px-3 py-4">
          <p className="px-3 pb-2 text-[10px] font-black uppercase tracking-[0.12em] text-neutral-400">
            관리
          </p>
          <div className="space-y-1">
            {ADMIN_LINKS.map((item) => {
              const active = route.active === item.id;
              return (
                <Link
                  key={item.id}
                  href={item.href}
                  className={
                    active
                      ? "block rounded-2xl bg-[#F1EDFF] px-3 py-3 text-[#6D4EF5]"
                      : "block rounded-2xl px-3 py-3 text-neutral-600 transition hover:bg-neutral-50 hover:text-neutral-950"
                  }
                >
                  <span className="block text-sm font-black">{item.label}</span>
                  <span className="mt-0.5 block text-[11px] font-medium text-neutral-400">
                    {item.description}
                  </span>
                </Link>
              );
            })}
          </div>

          <div className="my-4 h-px bg-neutral-100" />

          <p className="px-3 pb-2 text-[10px] font-black uppercase tracking-[0.12em] text-neutral-400">
            서비스 바로가기
          </p>
          <div className="space-y-1">
            {SERVICE_LINKS.map((item) => (
              <Link
                key={item.href}
                href={item.href}
                className="flex items-center justify-between rounded-xl px-3 py-2.5 text-xs font-bold text-neutral-600 transition hover:bg-neutral-50 hover:text-neutral-950"
              >
                <span>{item.label}</span>
                <span aria-hidden="true" className="text-neutral-300">↗</span>
              </Link>
            ))}
          </div>
        </nav>

        <div className="border-t border-neutral-100 p-3">
          <button
            type="button"
            onClick={handleLogout}
            className="w-full rounded-xl border border-neutral-200 bg-white px-3 py-2.5 text-xs font-black text-neutral-500 hover:bg-neutral-50"
          >
            로그아웃
          </button>
        </div>
      </aside>

      <section className="flex min-w-0 flex-1 flex-col overflow-hidden">
        <div className="lg:hidden">
          <AppTopBar
            title={route.title}
            backHref={route.backHref}
            onAccountClick={handleLogout}
            accountLabel="로그아웃"
          />
          <nav className="flex gap-2 overflow-x-auto border-b border-neutral-100 bg-white px-3 py-2 [scrollbar-width:none] [&::-webkit-scrollbar]:hidden">
            {SERVICE_LINKS.slice(0, 2).map((item) => (
              <Link
                key={item.href}
                href={item.href}
                className="shrink-0 rounded-full bg-neutral-100 px-3 py-1.5 text-[11px] font-black text-neutral-600"
              >
                {item.label}
              </Link>
            ))}
          </nav>
        </div>

        <div
          className={`${usesProductionPageDesign ? "" : "admin-app-content"} min-h-0 flex-1 overflow-y-auto overscroll-contain bg-[#f7f7f9]`}
        >
          {children}
        </div>

        <div className="lg:hidden">
          <AdminBottomNav active={route.active} />
        </div>
      </section>
    </div>
  );
}
