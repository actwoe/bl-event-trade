'use client';

import Link from 'next/link';
import { useEffect, useState } from 'react';
import { useRouter } from 'next/navigation';
import { supabase } from '@/lib/supabase';

type AdminState =
  | 'checking'
  | 'authenticated-admin'
  | 'authenticated-not-admin'
  | 'signed-out';

export default function AdminPage() {
  const router = useRouter();

  const [adminState, setAdminState] = useState<AdminState>('checking');
  const [email, setEmail] = useState('');
  const [pendingCount, setPendingCount] = useState(0);

  useEffect(() => {
    async function checkAdmin() {
      const { data: sessionData } = await supabase.auth.getSession();
      const user = sessionData.session?.user;

      if (!user) {
        setAdminState('signed-out');
        return;
      }

      setEmail(user.email ?? '');

      const { data: adminUser, error } = await supabase
        .from('admin_users')
        .select('user_id')
        .eq('user_id', user.id)
        .maybeSingle();

      if (error || !adminUser) {
        setAdminState('authenticated-not-admin');
        return;
      }

      setAdminState('authenticated-admin');

      const { count, error: countError } = await supabase
        .from('card_submissions')
        .select('id', {
          count: 'exact',
          head: true,
        })
        .eq('status', 'pending');

      if (!countError) {
        setPendingCount(count ?? 0);
      }
    }

    checkAdmin();
  }, []);

  async function handleLogout() {
    await supabase.auth.signOut();
    router.push('/admin/login');
    router.refresh();
  }

  if (adminState === 'checking') {
    return (
      <main className="min-h-screen bg-neutral-100 px-4 py-10">
        <div className="mx-auto max-w-md rounded-3xl bg-white p-6 text-sm text-neutral-500 shadow-sm">
          관리자 권한을 확인하는 중입니다.
        </div>
      </main>
    );
  }

  if (adminState === 'signed-out') {
    return (
      <main className="min-h-screen bg-neutral-100 px-4 py-10">
        <section className="mx-auto max-w-md rounded-3xl bg-white p-6 shadow-sm">
          <h1 className="text-2xl font-black text-neutral-950">
            로그인이 필요합니다
          </h1>

          <p className="mt-2 text-sm leading-6 text-neutral-500">
            관리자 페이지에 접근하려면 먼저 로그인해 주세요.
          </p>

          <Link
            href="/admin/login"
            className="mt-6 inline-flex rounded-2xl bg-neutral-950 px-5 py-3 text-sm font-black text-white"
          >
            관리자 로그인
          </Link>
        </section>
      </main>
    );
  }

  if (adminState === 'authenticated-not-admin') {
    return (
      <main className="min-h-screen bg-neutral-100 px-4 py-10">
        <section className="mx-auto max-w-md rounded-3xl bg-white p-6 shadow-sm">
          <h1 className="text-2xl font-black text-neutral-950">
            관리자 권한이 없습니다
          </h1>

          <p className="mt-2 text-sm leading-6 text-neutral-500">
            현재 로그인한 계정은 관리자 목록에 등록되어 있지 않습니다.
          </p>

          <button
            type="button"
            onClick={handleLogout}
            className="mt-6 rounded-2xl bg-neutral-950 px-5 py-3 text-sm font-black text-white"
          >
            로그아웃
          </button>
        </section>
      </main>
    );
  }

  return (
    <main className="min-h-screen bg-neutral-100 px-4 py-5">
      <section className="mx-auto w-full max-w-md sm:max-w-lg">
        <header className="rounded-3xl bg-white p-5 shadow-sm">
          <div className="flex items-start justify-between gap-4">
            <div>
              <p className="text-xs font-black uppercase tracking-[0.2em] text-neutral-500">
                Admin
              </p>

              <h1 className="mt-1 text-2xl font-black text-neutral-950">
                관리자 홈
              </h1>

              <p className="mt-2 text-sm text-neutral-500">
                로그인 계정: {email}
              </p>
            </div>

            <button
              type="button"
              onClick={handleLogout}
              className="shrink-0 rounded-full border border-neutral-300 bg-white px-4 py-2 text-xs font-bold text-neutral-700"
            >
              로그아웃
            </button>
          </div>
        </header>

        <div className="mt-5 grid gap-3">
          <Link
            href="/admin/events/new"
            className="rounded-3xl bg-white p-5 shadow-sm transition hover:-translate-y-1 hover:shadow-md"
          >
            <h2 className="text-lg font-black text-neutral-950">
              새 행사 등록
            </h2>
            <p className="mt-2 text-sm leading-6 text-neutral-500">
              교환판 첫 페이지에 표시될 행사를 만들고 썸네일을 업로드합니다.
            </p>
          </Link>

          <Link
            href="/admin/events"
            className="rounded-3xl bg-white p-5 shadow-sm transition hover:-translate-y-1 hover:shadow-md"
          >
            <h2 className="text-lg font-black text-neutral-950">
              행사 목록 / 굿즈 관리
            </h2>
            <p className="mt-2 text-sm leading-6 text-neutral-500">
              등록된 행사와 각 행사의 굿즈 이미지를 관리합니다.
            </p>
          </Link>

          <Link
            href="/admin/submissions"
            className="rounded-3xl bg-white p-5 shadow-sm transition hover:-translate-y-1 hover:shadow-md"
          >
            <div className="flex items-start justify-between gap-3">
              <div>
                <h2 className="text-lg font-black text-neutral-950">
                  이미지 제보 관리
                </h2>
                <p className="mt-2 text-sm leading-6 text-neutral-500">
                  유저가 제보한 이미지를 확인하고 승인/반려합니다.
                </p>
              </div>

              {pendingCount > 0 ? (
                <span className="shrink-0 rounded-full bg-neutral-950 px-3 py-1 text-xs font-black text-white">
                  {pendingCount}
                </span>
              ) : null}
            </div>
          </Link>

          <Link
            href="/"
            className="rounded-3xl bg-white p-5 shadow-sm transition hover:-translate-y-1 hover:shadow-md"
          >
            <h2 className="text-lg font-black text-neutral-950">
              사이트로 이동
            </h2>
            <p className="mt-2 text-sm leading-6 text-neutral-500">
              일반 사용자에게 보이는 메인 화면을 확인합니다.
            </p>
          </Link>
        </div>
      </section>
    </main>
  );
}