"use client";

import Link from "next/link";
import { useEffect, useState } from "react";
import { supabase } from "@/lib/supabase";

type AdminState = "checking" | "admin" | "not-admin" | "signed-out";

const cardClassName =
  "block rounded-2xl border border-neutral-200 bg-white p-4 transition hover:border-neutral-300";

function AdminStateCard({
  title,
  description,
  action,
}: {
  title: string;
  description: string;
  action?: React.ReactNode;
}) {
  return (
    <div className="p-4">
      <section className="rounded-2xl border border-neutral-200 bg-white p-5">
        <h1 className="text-[20px] font-black tracking-[-0.02em] text-neutral-950">
          {title}
        </h1>
        <p className="mt-2 text-sm leading-6 text-neutral-500">{description}</p>
        {action}
      </section>
    </div>
  );
}

export default function AdminHomePage() {
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

  if (adminState === "checking") {
    return (
      <main className="min-h-full bg-[#fafafa]">
        <AdminStateCard
          title="관리자 권한 확인 중"
          description="관리자 계정과 권한 정보를 확인하고 있습니다."
        />
      </main>
    );
  }

  if (adminState === "signed-out") {
    return (
      <main className="min-h-full bg-[#fafafa]">
        <AdminStateCard
          title="로그인이 필요합니다"
          description="관리자 홈은 관리자 로그인 후 이용할 수 있습니다."
          action={
            <Link
              href="/admin/login"
              className="mt-5 inline-flex rounded-2xl bg-neutral-950 px-5 py-3 text-sm font-black text-white"
            >
              관리자 로그인
            </Link>
          }
        />
      </main>
    );
  }

  if (adminState === "not-admin") {
    return (
      <main className="min-h-full bg-[#fafafa]">
        <AdminStateCard
          title="관리자 권한이 없습니다"
          description="현재 로그인한 계정은 관리자 목록에 등록되어 있지 않습니다."
        />
      </main>
    );
  }

  return (
    <main className="min-h-full bg-[#fafafa]">
      <header className="border-b border-neutral-100 bg-white p-5 pt-6">
        <p className="text-[11px] font-black uppercase tracking-[0.18em] text-[#7C5CFC]">
          BL GOODS TRADE
        </p>
        <h1 className="mt-1 text-[25px] font-black leading-tight tracking-[-0.03em] text-neutral-950">
          관리자 홈
        </h1>
        <p className="mt-2 text-sm leading-6 text-neutral-500">
          행사와 굿즈 이미지, 이용자 제보를 관리합니다.
        </p>
      </header>

      <div className="grid gap-3 p-4">
        <Link href="/admin/events" className={cardClassName}>
          <p className="text-base font-black text-neutral-950">행사 관리</p>
          <p className="mt-1 text-sm leading-6 text-neutral-500">
            등록된 행사를 확인하고 작품·특전·굿즈 이미지를 관리합니다.
          </p>
        </Link>

        <Link href="/admin/events/new" className={cardClassName}>
          <p className="text-base font-black text-neutral-950">새 행사 등록</p>
          <p className="mt-1 text-sm leading-6 text-neutral-500">
            메인에 노출할 팝업 및 콜라보 카페 행사를 추가합니다.
          </p>
        </Link>

        <Link href="/admin/submissions" className={cardClassName}>
          <p className="text-base font-black text-neutral-950">이미지 제보 관리</p>
          <p className="mt-1 text-sm leading-6 text-neutral-500">
            이용자가 제보한 이미지를 검수하고 교환판에 반영합니다.
          </p>
        </Link>

        <Link href="/admin/trade-lab" className={cardClassName}>
          <p className="text-base font-black text-neutral-950">교환판 테스트</p>
          <p className="mt-1 text-sm leading-6 text-neutral-500">
            실제 서비스와 분리된 화면에서 저장 및 미리보기를 검증합니다.
          </p>
        </Link>
      </div>
    </main>
  );
}
