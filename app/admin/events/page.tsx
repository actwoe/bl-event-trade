'use client';

import Link from 'next/link';
import { useEffect, useState } from 'react';
import { useRouter } from 'next/navigation';
import { getTradeAssetUrl, supabase } from '@/lib/supabase';

type AdminState = 'checking' | 'admin' | 'not-admin' | 'signed-out';

type TradeCollectionRow = {
  id: string;
  slug: string;
  title: string;
  description: string | null;
  thumbnail_path: string;
  status_label: string | null;
  is_public: boolean;
  sort_order: number;
  published_at: string;
  created_at: string;
};

export default function AdminEventsPage() {
  const router = useRouter();

  const [adminState, setAdminState] = useState<AdminState>('checking');
  const [events, setEvents] = useState<TradeCollectionRow[]>([]);
  const [message, setMessage] = useState('');

  useEffect(() => {
    async function loadEvents() {
      const { data: sessionData } = await supabase.auth.getSession();
      const user = sessionData.session?.user;

      if (!user) {
        setAdminState('signed-out');
        return;
      }

      const { data: adminUser, error: adminError } = await supabase
        .from('admin_users')
        .select('user_id')
        .eq('user_id', user.id)
        .maybeSingle();

      if (adminError || !adminUser) {
        setAdminState('not-admin');
        return;
      }

      setAdminState('admin');

      const { data, error } = await supabase
        .from('trade_collections')
        .select(
          'id, slug, title, description, thumbnail_path, status_label, is_public, sort_order, published_at, created_at',
        )
        .order('published_at', { ascending: false })
        .order('sort_order', { ascending: true });

      if (error) {
        console.error(error);
        setMessage('행사 목록을 불러오지 못했습니다.');
        return;
      }

      setEvents((data ?? []) as TradeCollectionRow[]);
    }

    loadEvents();
  }, []);

  async function handleLogout() {
    await supabase.auth.signOut();
    router.push('/admin/login');
    router.refresh();
  }

  if (adminState === 'checking') {
    return (
      <main className="min-h-screen bg-neutral-100 px-4 py-10">
        <section className="mx-auto max-w-md rounded-3xl bg-white p-6 text-sm text-neutral-500 shadow-sm">
          관리자 권한을 확인하는 중입니다.
        </section>
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
            행사 관리는 관리자 로그인 후 이용할 수 있습니다.
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

  if (adminState === 'not-admin') {
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
          <div className="flex items-center justify-between gap-3">
            <Link
              href="/admin"
              className="rounded-full border border-neutral-200 px-4 py-2 text-xs font-bold text-neutral-600"
            >
              ← 관리자 홈
            </Link>

            <Link
              href="/"
              className="rounded-full border border-neutral-200 px-4 py-2 text-xs font-bold text-neutral-600"
            >
              사이트 보기
            </Link>
          </div>

          <div className="mt-6">
            <p className="text-xs font-black uppercase tracking-[0.2em] text-neutral-500">
              Admin Events
            </p>

            <h1 className="mt-1 text-2xl font-black text-neutral-950">
              행사 목록
            </h1>

            <p className="mt-2 text-sm leading-6 text-neutral-500">
              행사를 수정하고 각 행사에 굿즈 이미지를 등록합니다.
            </p>
          </div>

          <Link
            href="/admin/events/new"
            className="mt-5 flex w-full items-center justify-center rounded-2xl bg-neutral-950 px-5 py-4 text-sm font-black text-white"
          >
            새 행사 등록
          </Link>
        </header>

        {message ? (
          <p className="mt-4 rounded-2xl bg-red-50 px-4 py-3 text-sm leading-6 text-red-700">
            {message}
          </p>
        ) : null}

        <div className="mt-5">
          {events.length > 0 ? (
            <div className="grid grid-cols-2 gap-3 sm:gap-4">
              {events.map((event) => (
                <article
                  key={event.id}
                  className="overflow-hidden rounded-2xl bg-white shadow-sm"
                >
                  <div className="relative aspect-[32/45] bg-neutral-100">
                    <img
                      src={getTradeAssetUrl(event.thumbnail_path)}
                      alt={event.title}
                      className="h-full w-full object-cover"
                    />

                    {event.status_label ? (
                      <span className="absolute left-2 top-2 rounded-full bg-neutral-950 px-2 py-1 text-[10px] font-black text-white">
                        {event.status_label}
                      </span>
                    ) : null}

                    <span
                      className={
                        event.is_public
                          ? 'absolute right-2 top-2 rounded-full bg-white px-2 py-1 text-[10px] font-black text-neutral-950'
                          : 'absolute right-2 top-2 rounded-full bg-red-50 px-2 py-1 text-[10px] font-black text-red-600'
                      }
                    >
                      {event.is_public ? '공개' : '비공개'}
                    </span>
                  </div>

                  <div className="p-3">
                    <h2 className="line-clamp-2 text-sm font-black leading-5 text-neutral-950">
                      {event.title}
                    </h2>

                    <p className="mt-1 line-clamp-2 text-[11px] leading-5 text-neutral-500">
                      {event.description || '행사 기간 미입력'}
                    </p>

                    <p className="mt-2 truncate text-[10px] font-bold text-neutral-400">
                      /trade/{event.slug}
                    </p>

                    <div className="mt-3 grid grid-cols-1 gap-2">
                      <Link
                        href={`/admin/events/${event.id}`}
                        className="rounded-xl bg-neutral-950 px-3 py-2.5 text-center text-[11px] font-black text-white"
                      >
                        관리
                      </Link>

                      <Link
                        href={`/trade/${event.slug}`}
                        className="rounded-xl border border-neutral-300 bg-white px-3 py-2.5 text-center text-[11px] font-black text-neutral-700"
                      >
                        교환판 보기
                      </Link>
                    </div>
                  </div>
                </article>
              ))}
            </div>
          ) : (
            <div className="rounded-3xl bg-white px-5 py-10 text-center shadow-sm">
              <p className="text-sm font-bold text-neutral-500">
                아직 등록된 행사가 없습니다.
              </p>

              <Link
                href="/admin/events/new"
                className="mt-5 inline-flex rounded-2xl bg-neutral-950 px-5 py-3 text-sm font-black text-white"
              >
                첫 행사 등록하기
              </Link>
            </div>
          )}
        </div>
      </section>
    </main>
  );
}