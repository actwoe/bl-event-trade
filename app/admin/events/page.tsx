'use client';

import Link from 'next/link';
import { ChangeEvent, FormEvent, useEffect, useMemo, useState } from 'react';
import { useRouter } from 'next/navigation';
import { getTradeAssetUrl, supabase } from '@/lib/supabase';

type AdminState = 'checking' | 'admin' | 'not-admin' | 'signed-out';

type TradeCollectionRow = {
  id: string;
  slug: string;
  title: string;
  description: string | null;
  thumbnail_path: string | null;
  status_label: string | null;
  is_public: boolean;
  sort_order: number | null;
  created_at?: string | null;
};

function normalizeSlug(value: string) {
  return value
    .trim()
    .toLowerCase()
    .replace(/[^a-z0-9-]/g, '-')
    .replace(/-+/g, '-')
    .replace(/^-|-$/g, '');
}

function getFileExtension(file: File) {
  const extension = file.name.split('.').pop()?.toLowerCase();

  if (!extension) {
    return 'jpg';
  }

  if (extension === 'jpeg') {
    return 'jpg';
  }

  return extension;
}

function sortEvents(rows: TradeCollectionRow[]) {
  return [...rows].sort((a, b) => {
    const sortDiff = (a.sort_order ?? 0) - (b.sort_order ?? 0);

    if (sortDiff !== 0) {
      return sortDiff;
    }

    return a.title.localeCompare(b.title, 'ko-KR', {
      numeric: true,
      sensitivity: 'base',
    });
  });
}

export default function AdminEventsPage() {
  const router = useRouter();

  const [adminState, setAdminState] = useState<AdminState>('checking');
  const [events, setEvents] = useState<TradeCollectionRow[]>([]);
  const [message, setMessage] = useState('');

  const [title, setTitle] = useState('');
  const [slug, setSlug] = useState('');
  const [period, setPeriod] = useState('');
  const [statusLabel, setStatusLabel] = useState('OPEN');
  const [sortOrder, setSortOrder] = useState('0');
  const [isPublic, setIsPublic] = useState(true);
  const [thumbnailFile, setThumbnailFile] = useState<File | null>(null);
  const [thumbnailPreviewUrl, setThumbnailPreviewUrl] = useState('');

  const [isLoadingEvents, setIsLoadingEvents] = useState(false);
  const [isSubmittingEvent, setIsSubmittingEvent] = useState(false);
  const [isDeletingEventId, setIsDeletingEventId] = useState('');

  const normalizedSlug = useMemo(() => normalizeSlug(slug), [slug]);

  useEffect(() => {
    async function checkAdminAndLoad() {
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
      await loadEvents();
    }

    checkAdminAndLoad();
  }, []);

  useEffect(() => {
    return () => {
      if (thumbnailPreviewUrl.startsWith('blob:')) {
        URL.revokeObjectURL(thumbnailPreviewUrl);
      }
    };
  }, [thumbnailPreviewUrl]);

  async function loadEvents() {
    setIsLoadingEvents(true);
    setMessage('');

    try {
      const { data, error } = await supabase
        .from('trade_collections')
        .select(
          'id, slug, title, description, thumbnail_path, status_label, is_public, sort_order, created_at',
        )
        .order('sort_order', { ascending: true })
        .order('created_at', { ascending: false });

      if (error) {
        console.error(error);
        setMessage('행사 목록을 불러오지 못했습니다. DB 정책을 확인해 주세요.');
        return;
      }

      setEvents(sortEvents((data ?? []) as TradeCollectionRow[]));
    } catch (error) {
      console.error(error);
      setMessage('행사 목록을 불러오는 중 오류가 발생했습니다.');
    } finally {
      setIsLoadingEvents(false);
    }
  }

  function handleThumbnailChange(event: ChangeEvent<HTMLInputElement>) {
    const file = event.target.files?.[0];

    if (!file) {
      return;
    }

    if (!file.type.startsWith('image/')) {
      setMessage('이미지 파일만 업로드할 수 있습니다.');
      return;
    }

    if (thumbnailPreviewUrl.startsWith('blob:')) {
      URL.revokeObjectURL(thumbnailPreviewUrl);
    }

    setThumbnailFile(file);
    setThumbnailPreviewUrl(URL.createObjectURL(file));
  }

  async function handleCreateEvent(event: FormEvent<HTMLFormElement>) {
    event.preventDefault();

    if (!title.trim()) {
      setMessage('행사 제목을 입력해 주세요.');
      return;
    }

    if (!normalizedSlug) {
      setMessage('slug를 입력해 주세요. 영문, 숫자, 하이픈만 사용할 수 있습니다.');
      return;
    }

    try {
      setIsSubmittingEvent(true);
      setMessage('');

      let thumbnailPath = '';

      if (thumbnailFile) {
        const fileExtension = getFileExtension(thumbnailFile);
        thumbnailPath = `${normalizedSlug}/thumbnail.${fileExtension}`;

        const { error: uploadError } = await supabase.storage
          .from('trade-assets')
          .upload(thumbnailPath, thumbnailFile, {
            cacheControl: '3600',
            upsert: true,
            contentType: thumbnailFile.type,
          });

        if (uploadError) {
          console.error(uploadError);
          setMessage(
            '썸네일 업로드에 실패했습니다. Storage 정책을 확인해 주세요.',
          );
          return;
        }
      }

      const parsedSortOrder = Number.parseInt(sortOrder, 10);

      const { error: insertError } = await supabase
        .from('trade_collections')
        .insert({
          title: title.trim(),
          slug: normalizedSlug,
          description: period.trim() || null,
          thumbnail_path: thumbnailPath,
          status_label: statusLabel.trim() || null,
          is_public: isPublic,
          sort_order: Number.isNaN(parsedSortOrder) ? 0 : parsedSortOrder,
        });

      if (insertError) {
        console.error(insertError);
        setMessage('행사 등록에 실패했습니다. slug 중복 또는 DB 정책을 확인해 주세요.');
        return;
      }

      setTitle('');
      setSlug('');
      setPeriod('');
      setStatusLabel('OPEN');
      setSortOrder('0');
      setIsPublic(true);
      setThumbnailFile(null);
      setThumbnailPreviewUrl('');

      await loadEvents();
      setMessage('행사가 등록되었습니다.');
      router.refresh();
    } catch (error) {
      console.error(error);
      setMessage('행사 등록 중 오류가 발생했습니다.');
    } finally {
      setIsSubmittingEvent(false);
    }
  }

  async function handleDeleteEvent(row: TradeCollectionRow) {
    const ok = window.confirm(
      '이 행사를 삭제할까요? 연결된 작품명과 굿즈 이미지는 별도 테이블에 남아 있을 수 있습니다.',
    );

    if (!ok) {
      return;
    }

    try {
      setIsDeletingEventId(row.id);
      setMessage('');

      const { error } = await supabase
        .from('trade_collections')
        .delete()
        .eq('id', row.id);

      if (error) {
        console.error(error);
        setMessage('행사 삭제에 실패했습니다. DB 정책을 확인해 주세요.');
        return;
      }

      await loadEvents();
      setMessage('행사가 삭제되었습니다.');
      router.refresh();
    } catch (error) {
      console.error(error);
      setMessage('행사 삭제 중 오류가 발생했습니다.');
    } finally {
      setIsDeletingEventId('');
    }
  }

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

            <button
              type="button"
              onClick={handleLogout}
              className="rounded-full border border-neutral-200 px-4 py-2 text-xs font-bold text-neutral-600"
            >
              로그아웃
            </button>
          </div>

          <div className="mt-6">
            <p className="text-xs font-black uppercase tracking-[0.2em] text-neutral-500">
              Popup & Callabo Cafe Trade Board
            </p>

            <h1 className="mt-1 text-2xl font-black text-neutral-950">
              행사 관리
            </h1>

            <p className="mt-2 text-sm leading-6 text-neutral-500">
              팝업 & 콜카 굿즈 교환판 행사를 등록하고, 각 행사별 작품·특전·굿즈를 관리합니다.
            </p>
          </div>
        </header>

        {message ? (
          <p className="mt-4 rounded-2xl bg-white px-4 py-3 text-sm leading-6 text-neutral-700 shadow-sm">
            {message}
          </p>
        ) : null}

        <form
          onSubmit={handleCreateEvent}
          className="mt-5 rounded-3xl bg-white p-5 shadow-sm"
        >
          <h2 className="text-lg font-black text-neutral-950">행사 등록</h2>

          <div className="mt-5 space-y-5">
            <label className="block">
              <span className="text-sm font-bold text-neutral-800">행사 제목</span>

              <input
                value={title}
                onChange={(event) => setTitle(event.target.value)}
                className="mt-1 w-full rounded-2xl border border-neutral-200 px-4 py-3 text-sm outline-none focus:border-neutral-950"
                placeholder="예: 2026 여름 팝업 & 콜카 굿즈 교환판"
              />
            </label>

            <label className="block">
              <span className="text-sm font-bold text-neutral-800">행사 기간</span>

              <input
                value={period}
                onChange={(event) => setPeriod(event.target.value)}
                className="mt-1 w-full rounded-2xl border border-neutral-200 px-4 py-3 text-sm outline-none focus:border-neutral-950"
                placeholder="예: 2026.07.01 - 2026.07.31"
              />
            </label>

            <label className="block">
              <span className="text-sm font-bold text-neutral-800">Slug</span>

              <input
                value={slug}
                onChange={(event) => setSlug(event.target.value)}
                className="mt-1 w-full rounded-2xl border border-neutral-200 px-4 py-3 text-sm outline-none focus:border-neutral-950"
                placeholder="예: summer-event-2026"
              />

              <p className="mt-2 text-xs leading-5 text-neutral-400">
                실제 주소는 /trade/{normalizedSlug || 'slug'} 형태입니다.
              </p>
            </label>

            <div className="grid grid-cols-2 gap-3">
              <label className="block">
                <span className="text-sm font-bold text-neutral-800">
                  상태 라벨
                </span>

                <input
                  value={statusLabel}
                  onChange={(event) => setStatusLabel(event.target.value)}
                  className="mt-1 w-full rounded-2xl border border-neutral-200 px-4 py-3 text-sm outline-none focus:border-neutral-950"
                  placeholder="OPEN"
                />
              </label>

              <label className="block">
                <span className="text-sm font-bold text-neutral-800">
                  정렬 순서
                </span>

                <input
                  type="number"
                  value={sortOrder}
                  onChange={(event) => setSortOrder(event.target.value)}
                  className="mt-1 w-full rounded-2xl border border-neutral-200 px-4 py-3 text-sm outline-none focus:border-neutral-950"
                  placeholder="0"
                />
              </label>
            </div>

            <label className="flex items-center justify-between gap-3 rounded-2xl bg-neutral-100 px-4 py-3">
              <span>
                <span className="block text-sm font-bold text-neutral-800">
                  공개 여부
                </span>
                <span className="mt-1 block text-xs text-neutral-500">
                  공개 상태여야 메인 페이지와 팝업 & 콜카 굿즈 교환판 목록에 노출됩니다.
                </span>
              </span>

              <input
                type="checkbox"
                checked={isPublic}
                onChange={(event) => setIsPublic(event.target.checked)}
                className="h-5 w-5"
              />
            </label>

            <div>
              <span className="text-sm font-bold text-neutral-800">
                행사 썸네일
              </span>

              <label className="mt-1 flex cursor-pointer flex-col items-center justify-center rounded-2xl border border-dashed border-neutral-300 bg-neutral-50 px-4 py-8 text-center hover:border-neutral-950">
                {thumbnailPreviewUrl ? (
                  <img
                    src={thumbnailPreviewUrl}
                    alt="썸네일 미리보기"
                    className="aspect-[32/45] w-44 rounded-2xl object-cover shadow-sm"
                  />
                ) : (
                  <>
                    <span className="text-sm font-black text-neutral-700">
                      썸네일 이미지 선택
                    </span>
                    <span className="mt-2 text-xs leading-5 text-neutral-400">
                      포스터형 이미지는 32:45 비율을 추천합니다.
                    </span>
                  </>
                )}

                <input
                  type="file"
                  accept="image/*"
                  onChange={handleThumbnailChange}
                  className="hidden"
                />
              </label>
            </div>

            <button
              type="submit"
              disabled={isSubmittingEvent}
              className="w-full rounded-2xl bg-neutral-950 px-5 py-4 text-sm font-black text-white disabled:cursor-not-allowed disabled:bg-neutral-300"
            >
              {isSubmittingEvent ? '등록 중...' : '행사 등록'}
            </button>
          </div>
        </form>

        <section className="mt-5 rounded-3xl bg-white p-5 shadow-sm">
          <div className="flex items-center justify-between gap-3">
            <div>
              <h2 className="text-lg font-black text-neutral-950">행사 목록</h2>
              <p className="mt-1 text-xs text-neutral-400">
                총 {events.length}개
              </p>
            </div>

            <button
              type="button"
              onClick={loadEvents}
              disabled={isLoadingEvents}
              className="rounded-full border border-neutral-200 px-4 py-2 text-xs font-black text-neutral-600 disabled:cursor-not-allowed disabled:opacity-50"
            >
              {isLoadingEvents ? '불러오는 중' : '새로고침'}
            </button>
          </div>

          {events.length > 0 ? (
            <div className="mt-5 grid grid-cols-2 gap-3">
              {events.map((row) => {
                const thumbnailUrl = getTradeAssetUrl(row.thumbnail_path ?? '');
                const isDeleting = isDeletingEventId === row.id;

                return (
                  <article
                    key={row.id}
                    className="overflow-hidden rounded-2xl border border-neutral-200 bg-neutral-50"
                  >
                    <Link href={`/admin/events/${row.id}`} className="block bg-white">
                      <div className="aspect-[32/45] w-full overflow-hidden bg-white">
                        {thumbnailUrl ? (
                          <img
                            src={thumbnailUrl}
                            alt="행사 썸네일"
                            className="h-full w-full object-cover"
                          />
                        ) : (
                          <div className="flex h-full w-full items-center justify-center text-[10px] font-bold text-neutral-300">
                            NO IMG
                          </div>
                        )}
                      </div>
                    </Link>

                    <div className="p-3">
                      <div className="flex items-start justify-between gap-2">
                        <div className="min-w-0">
                          <p className="line-clamp-2 text-sm font-black leading-5 text-neutral-950">
                            {row.title}
                          </p>
                          <p className="mt-1 truncate text-[10px] text-neutral-500">
                            /trade/{row.slug}
                          </p>
                        </div>

                        <span
                          className={`shrink-0 rounded-full px-2 py-1 text-[10px] font-black ${
                            row.is_public
                              ? 'bg-green-50 text-green-700'
                              : 'bg-neutral-200 text-neutral-500'
                          }`}
                        >
                          {row.is_public ? '공개' : '숨김'}
                        </span>
                      </div>

                      <p className="mt-2 line-clamp-2 min-h-10 text-xs leading-5 text-neutral-500">
                        {row.description || '행사 기간/설명이 없습니다.'}
                      </p>

                      <p className="mt-1 text-[10px] font-bold text-neutral-400">
                        {row.status_label || '라벨 없음'} · 정렬 {row.sort_order ?? 0}
                      </p>

                      <div className="mt-3 grid grid-cols-3 gap-1.5">
                        <Link
                          href={`/admin/events/${row.id}`}
                          className="rounded-xl bg-neutral-950 px-2 py-2 text-center text-[11px] font-black text-white"
                        >
                          관리
                        </Link>

                        <Link
                          href={`/trade/${row.slug}`}
                          className="rounded-xl border border-neutral-200 bg-white px-2 py-2 text-center text-[11px] font-black text-neutral-600"
                        >
                          보기
                        </Link>

                        <button
                          type="button"
                          onClick={() => handleDeleteEvent(row)}
                          disabled={isDeleting}
                          className="rounded-xl border border-red-200 bg-red-50 px-2 py-2 text-[11px] font-black text-red-600 disabled:cursor-not-allowed disabled:opacity-50"
                        >
                          {isDeleting ? '삭제 중' : '삭제'}
                        </button>
                      </div>
                    </div>
                  </article>
                );
              })}
            </div>
          ) : (
            <p className="mt-5 rounded-2xl bg-neutral-50 px-4 py-8 text-center text-sm text-neutral-400">
              아직 등록된 행사가 없습니다.
            </p>
          )}
        </section>
      </section>
    </main>
  );
}
