"use client";

import Link from "next/link";
import { useEffect, useState } from "react";
import { useRouter } from "next/navigation";
import { supabase } from "@/lib/supabase";

type AdminState = "checking" | "admin" | "not-admin" | "signed-out";

const cardClassName =
  "rounded-3xl border border-neutral-200/70 bg-neutral-50/80 p-4 transition hover:border-neutral-300 hover:bg-white";

export default function AdminHomePage() {
  const router = useRouter();
  const [adminState, setAdminState] = useState<AdminState>("checking");

  useEffect(() => {
    async function checkAdmin() {
      const { data: sessionData } = await supabase.auth.getSession();
      const user = sessionData.session?.user;

      if (!user) {
        setAdminState("signed-out");
        return;
      }

      const { data: adminUser, error } = await supabase
        .from("admin_users")
        .select("user_id")
        .eq("user_id", user.id)
        .maybeSingle();

      if (error || !adminUser) {
        setAdminState("not-admin");
        return;
      }

      setAdminState("admin");
    }

    checkAdmin();
  }, []);


  async function handleLogout() {
    await supabase.auth.signOut();
    router.push("/admin/login");
    router.refresh();
  }

  if (adminState === "checking") {
    return (
      <main className="w-full bg-neutral-100 px-4 py-5 sm:py-6">
        <section className="mx-auto max-w-md rounded-[28px] border border-neutral-200/70 bg-white p-5 text-sm text-neutral-500 shadow-[0_8px_26px_rgba(15,23,42,0.032)] sm:max-w-lg">
          관리자 권한을 확인하는 중입니다.
        </section>
      </main>
    );
  }

  if (adminState === "signed-out") {
    return (
      <main className="w-full bg-neutral-100 px-4 py-5 sm:py-6">
        <section className="mx-auto max-w-md rounded-[28px] border border-neutral-200/70 bg-white p-5 shadow-[0_8px_26px_rgba(15,23,42,0.032)] sm:max-w-lg">
          <h1 className="text-2xl font-bold text-neutral-950">
            로그인이 필요합니다
          </h1>
          <p className="mt-2 text-sm leading-6 text-neutral-500">
            관리자 홈은 관리자 로그인 후 이용할 수 있습니다.
          </p>
          <Link
            href="/admin/login"
            className="mt-6 inline-flex rounded-2xl bg-neutral-950 px-5 py-3 text-sm font-bold text-white"
          >
            관리자 로그인
          </Link>
        </section>
      </main>
    );
  }

  if (adminState === "not-admin") {
    return (
      <main className="w-full bg-neutral-100 px-4 py-5 sm:py-6">
        <section className="mx-auto max-w-md rounded-[28px] border border-neutral-200/70 bg-white p-5 shadow-[0_8px_26px_rgba(15,23,42,0.032)] sm:max-w-lg">
          <h1 className="text-2xl font-bold text-neutral-950">
            관리자 권한이 없습니다
          </h1>
          <p className="mt-2 text-sm leading-6 text-neutral-500">
            현재 로그인한 계정은 관리자 목록에 등록되어 있지 않습니다.
          </p>
        </section>
      </main>
    );
  }

  return (
    <main className="w-full bg-neutral-100 px-4 py-5 sm:py-6">
      <section className="mx-auto w-full max-w-md sm:max-w-lg">
        <div className="overflow-hidden rounded-[28px] border border-neutral-200/70 bg-white shadow-[0_8px_26px_rgba(15,23,42,0.032)]">
          <header className="border-b border-neutral-200/70 bg-[linear-gradient(135deg,#efe7ff_0%,#d8efff_48%,#ffe1f2_100%)] p-5">
            <div className="mb-6 flex items-center justify-between gap-3">
              <Link
                href="/"
                className="rounded-full border border-white/70 bg-white/75 px-4 py-2 text-xs font-bold text-neutral-600 shadow-[0_4px_12px_rgba(15,23,42,0.025)] transition hover:border-white hover:bg-white hover:text-neutral-950"
              >
                ← 메인으로
              </Link>

              <button
                type="button"
                onClick={handleLogout}
                className="rounded-full border border-white/70 bg-white/75 px-4 py-2 text-xs font-bold text-neutral-600 shadow-[0_4px_12px_rgba(15,23,42,0.025)] transition hover:border-white hover:bg-white hover:text-neutral-950"
              >
                로그아웃
              </button>
            </div>

            <p className="mt-6 text-xs font-bold uppercase tracking-[0.2em] text-neutral-500">
              Admin Home
            </p>
            <h1 className="mt-1 text-2xl font-bold text-neutral-950">
              관리자 홈
            </h1>
            <p className="mt-2 text-sm leading-6 text-neutral-500">
              행사와 굿즈 이미지, 유저 제보를 관리합니다.
            </p>
          </header>

          <div className="grid gap-3 p-5">
            <Link href="/admin/events" className={cardClassName}>
              <p className="text-base font-bold text-neutral-950">행사 목록</p>
              <p className="mt-1 text-sm leading-6 text-neutral-500">
                등록된 행사를 확인하고 작품·특전·굿즈 이미지를 관리합니다.
              </p>
            </Link>

            <Link href="/admin/events/new" className={cardClassName}>
              <p className="text-base font-bold text-neutral-950">새 행사 등록</p>
              <p className="mt-1 text-sm leading-6 text-neutral-500">
                메인에 노출할 팝업 & 콜라보 카페 행사를 추가합니다.
              </p>
            </Link>

            <Link href="/admin/submissions" className={cardClassName}>
              <p className="text-base font-bold text-neutral-950">이미지 제보 관리</p>
              <p className="mt-1 text-sm leading-6 text-neutral-500">
                유저가 제보한 이미지를 검수하고 교환판에 반영합니다.
              </p>
            </Link>

            <Link href="/admin/trade-lab" className={cardClassName}>
              <p className="text-base font-bold text-neutral-950">교환판 테스트</p>
              <p className="mt-1 text-sm leading-6 text-neutral-500">
                실서비스와 분리된 화면에서 PNG와 모바일 저장 변경을 검증합니다.
              </p>
            </Link>
          </div>
        </div>
      </section>
    </main>
  );
}
