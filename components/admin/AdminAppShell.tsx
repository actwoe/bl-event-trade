"use client";

import type { ReactNode } from "react";
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

  return (
    <AppFrame>
      <AppTopBar
        title={route.title}
        backHref={route.backHref}
        showAccount={!isLoginPage}
        onAccountClick={isLoginPage ? undefined : handleLogout}
        accountLabel="로그아웃"
      />

      <div className="min-h-0 flex-1 overflow-y-auto overscroll-contain bg-[#fafafa]">
        <div
          className={
            usesProductionPageDesign
              ? "min-h-full bg-[#fafafa]"
              : "admin-app-content min-h-full"
          }
        >
          {children}
        </div>
      </div>

      <AdminBottomNav active={route.active} />
    </AppFrame>
  );
}
