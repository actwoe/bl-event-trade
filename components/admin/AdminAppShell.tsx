"use client";

import type { ReactNode } from "react";
import { useEffect, useState } from "react";
import Link from "next/link";
import { usePathname } from "next/navigation";
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
  const [access, setAccess] = useState<"checking" | "allowed" | "denied">("checking");
  useEffect(() => {
    let active = true;
    async function verify() {
      if (pathname === "/admin/login") return;
      setAccess("checking");
      const { data, error } = await supabase.auth.getUser();
      if (!active) return;
      if (error || !data.user) { setAccess("denied"); return; }
      const { data: admin, error: adminError } = await supabase.from("admin_users")
        .select("user_id").eq("user_id", data.user.id).maybeSingle();
      if (active) setAccess(!adminError && admin ? "allowed" : "denied");
    }
    void verify();
    const { data: listener } = supabase.auth.onAuthStateChange((event) => {
      if (event === "SIGNED_OUT") setAccess("denied");
    });
    return () => { active = false; listener.subscription.unsubscribe(); };
  }, [pathname]);

  if (pathname !== "/admin/login" && access !== "allowed") {
    return <div className="flex min-h-screen flex-col items-center justify-center gap-4 p-6 text-center">
      <p>{access === "checking" ? "관리자 권한을 확인하는 중입니다." : "관리자 로그인이 필요하거나 접근 권한이 없습니다."}</p>
      {access === "denied" && <Link href="/admin/login" className="rounded-lg bg-black px-5 py-3 text-white">관리자 로그인</Link>}
    </div>;
  }

  if (pathname.startsWith("/admin/ui-lab")) {
    return children;
  }

  const route = getAdminRouteMeta(pathname);
  const isLoginPage = pathname === "/admin/login";
  const usesProductionPageDesign =
    pathname === "/admin/events" ||
    pathname === "/admin/events/new" ||
    pathname.startsWith("/admin/trade-lab");

  return (
    <AppFrame>
      <AppTopBar
        title={route.title}
        backHref={route.backHref}
        showAccount={!isLoginPage}
        loginHref="/my-trades"
        accountLabel="관리자 홈"
      />

      {!isLoginPage && (
        <div className="flex shrink-0 items-center justify-between border-b border-neutral-100 bg-white px-4 py-2 text-xs font-bold">
          <Link href="/" className="rounded-lg px-2 py-2 text-neutral-800 hover:bg-neutral-100">← 사이트 홈</Link>
          <Link href="/my-trades" className="rounded-lg px-2 py-2 text-neutral-600 hover:bg-neutral-100">내 교환/양도판</Link>
        </div>
      )}

      <div
        className={`min-h-0 flex-1 overflow-y-auto overscroll-contain ${
          usesProductionPageDesign ? "bg-white" : "bg-[#fafafa]"
        }`}
      >
        <div
          className={
            usesProductionPageDesign
              ? "min-h-full bg-white"
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
