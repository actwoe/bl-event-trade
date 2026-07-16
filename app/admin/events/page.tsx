'use client';

import Link from 'next/link';
import { ChangeEvent, FormEvent, useEffect, useMemo, useState } from 'react';
import { useRouter } from 'next/navigation';
import { getTradeAssetUrl, supabase } from '@/lib/supabase';
import {
  compareEventsByStatus,
  getEventPeriodLabel,
  getEventStatus,
  getEventStatusLabel,
  getKoreaTodayDateString,
} from '@/lib/event-status';

type AdminState = 'checking' | 'admin' | 'not-admin' | 'signed-out';

type TradeCollectionRow = {
  id: string;
  slug: string;
  title: string;
  description: string | null;
  event_start_date: string | null;
  event_end_date: string | null;
  event_location: string | null;
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
  const today = getKoreaTodayDateString();

  return [...rows].sort((a, b) =>
    compareEventsByStatus(
      {
        title: a.title,
        eventStartDate: a.event_start_date,
        eventEndDate: a.event_end_date,
        sortOrder: a.sort_order ?? 0,
      },
      {
        title: b.title,
        eventStartDate: b.event_start_date,
        eventEndDate: b.event_end_date,
        sortOrder: b.sort_order ?? 0,
      },
      today,
    ),
  );
}

export default function AdminEventsPage() {
  const router = useRouter();

  const [adminState, setAdminState] = useState<AdminState>('checking');
  const [events, setEvents] = useState<TradeCollectionRow[]>([]);
  const [message, setMessage] = useState('');

  const [title, setTitle] = useState('');
  const [slug, setSlug] = useState('');
  const [eventStartDate, setEventStartDate] = useState('');
  const [eventEndDate, setEventEndDate] = useState('');
  const [eventLocation, setEventLocation] = useState('');
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
          'id, slug, title, description, event_start_date, event_end_date, event_location, thumbnail_path, status_label, is_public, sort_order, created_at',
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

    if (eventStartDate && eventEndDate && eventEndDate < eventStartDate) {
      setMessage('종료일은 시작일보다 빠를 수 없습니다.');
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
          event_start_date: eventStartDate || null,
          event_end_date: eventEndDate || null,
          event_location: eventLocation.trim() || null,
          thumbnail_path: thumbnailPath,
          status_label: null,
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
      setEventStartDate('');
      setEventEndDate('');
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
      <main className="w-full bg-[#fafafa] px-5 py-4">
        <section className="rounded-2xl border border-neutral-200 bg-neutral-50 p-4 text-sm text-neutral-500">
          관리자 권한을 확인하는 중입니다.
        </section>
      </main>
    );
  }

  if (adminState === 'signed-out') {
    return (
      <main className="w-full bg-[#fafafa] px-5 py-4">
        <section className="rounded-2xl border border-neutral-200 bg-neutral-50 p-4">
          <h1 className="text-lg font-black text-neutral-950">
            로그인이 필요합니다
          </h1>
          <p className="mt-2 text-sm leading-6 text-neutral-500">
            행사 관리는 관리자 로그인 후 이용할 수 있습니다.
          </p>
          <Link
            href="/admin/login"
            className="mt-5 inline-flex rounded-2xl bg-neutral-950 px-5 py-3 text-sm font-black text-white"
          >
            관리자 로그인
          </Link>
        </section>
      </main>
    );
  }

  if (adminState === 'not-admin') {
    return (
      <main className="w-full bg-[#fafafa] px-5 py-4">
        <section className="rounded-2xl border border-neutral-200 bg-neutral-50 p-4">
          <h1 className="text-lg font-black text-neutral-950">
            관리자 권한이 없습니다
          </h1>
          <p className="mt-2 text-sm leading-6 text-neutral-500">
            현재 로그인한 계정은 관리자 목록에 등록되어 있지 않습니다.
          </p>
          <button
            type="button"
            onClick={handleLogout}
            className="mt-5 rounded-2xl bg-neutral-950 px-5 py-3 text-sm font-black text-white"
          >
            로그아웃
          </button>
        </section>
      </main>
    );
  }

  return (
    <main className="w-full bg-[#fafafa]">
      <section className="border-b border-neutral-100 bg-white px-5 py-4">
        <p className="text-[12px] font-black tracking-[0.04em] text-[#7C5CFC]">
          EVENT MANAGEMENT
        </p>
        <h1 className="mt-1 break-keep text-[24px] font-black leading-tight tracking-[-0.03em] text-neutral-950">
          행사 관리
        </h1>
        <p className="mt-2 text-[13px] font-medium leading-5 text-neutral-500">
          교환판 행사를 등록하고 행사별 작품과 굿즈를 관리합니다.
        </p>
      </section>

      <div className="space-y-4 px-5 py-4">
        {message ? (
          <p className="rounded-2xl border border-neutral-200 bg-white px-4 py-3 text-sm leading-6 text-neutral-600">
            {message}
          </p>
        ) : null}

        <form
          onSubmit={handleCreateEvent}
          className="rounded-2xl border border-neutral-200 bg-neutral-50 p-4"
        >
          <div className="flex items-start justify-between gap-3">
            <div>
              <h2 className="text-sm font-black text-neutral-950">
                새 행사 등록
              </h2>
              <p className="mt-1 text-xs leading-5 text-neutral-400">
                메인 화면과 교환판에 노출할 행사를 등록합니다.
              </p>
            </div>
            <Link
              href="/admin/events/new"
              className="shrink-0 rounded-full bg-white px-3 py-1.5 text-[11px] font-black text-neutral-500 ring-1 ring-neutral-200"
            >
              전체 화면
            </Link>
          </div>

          <div className="mt-4 space-y-4">
            <label className="block">
              <span className="text-xs font-black text-neutral-500">행사 제목</span>
              <input
                value={title}
                onChange={(event) => setTitle(event.target.value)}
                className="mt-1 w-full rounded-2xl border border-neutral-200 bg-white px-4 py-3 text-sm outline-none focus:border-[#7C5CFC]"
                placeholder="예: 2026 여름 팝업 & 콜카 굿즈 교환판"
              />
            </label>

            <div className="grid grid-cols-2 gap-3">
              <label className="block min-w-0">
                <span className="text-xs font-black text-neutral-500">시작일</span>
                <input
                  type="date"
                  value={eventStartDate}
                  onChange={(event) => setEventStartDate(event.target.value)}
                  className="mt-1 w-full min-w-0 rounded-2xl border border-neutral-200 bg-white px-3 py-3 text-sm outline-none focus:border-[#7C5CFC]"
                />
              </label>

              <label className="block min-w-0">
                <span className="text-xs font-black text-neutral-500">종료일</span>
                <input
                  type="date"
                  value={eventEndDate}
                  onChange={(event) => setEventEndDate(event.target.value)}
                  className="mt-1 w-full min-w-0 rounded-2xl border border-neutral-200 bg-white px-3 py-3 text-sm outline-none focus:border-[#7C5CFC]"
                />
              </label>
            </div>

            <label className="block">
              <span className="text-xs font-black text-neutral-500">행사 장소</span>
              <input
                value={eventLocation}
                onChange={(event) => setEventLocation(event.target.value)}
                className="mt-1 w-full rounded-2xl border border-neutral-200 bg-white px-4 py-3 text-sm outline-none focus:border-[#7C5CFC]"
                placeholder="예: 서울 · 더현대 서울 5F / 온라인"
              />
            </label>

            <label className="block">
              <span className="text-xs font-black text-neutral-500">Slug</span>
              <input
                value={slug}
                onChange={(event) => setSlug(event.target.value)}
                className="mt-1 w-full rounded-2xl border border-neutral-200 bg-white px-4 py-3 text-sm outline-none focus:border-[#7C5CFC]"
                placeholder="예: summer-event-2026"
              />
              <p className="mt-2 text-xs leading-5 text-neutral-400">
                실제 주소는 /trade/{normalizedSlug || 'slug'} 형태입니다.
              </p>
            </label>

            <label className="block">
              <span className="text-xs font-black text-neutral-500">정렬 순서</span>
              <input
                type="number"
                value={sortOrder}
                onChange={(event) => setSortOrder(event.target.value)}
                className="mt-1 w-full rounded-2xl border border-neutral-200 bg-white px-4 py-3 text-sm outline-none focus:border-[#7C5CFC]"
                placeholder="0"
              />
            </label>

            <label className="flex items-center justify-between gap-3 rounded-2xl border border-neutral-200 bg-white px-4 py-3">
              <span>
                <span className="block text-sm font-black text-neutral-950">
                  공개 여부
                </span>
                <span className="mt-1 block text-xs leading-5 text-neutral-400">
                  공개 상태여야 메인 페이지에 노출됩니다.
                </span>
              </span>
              <input
                type="checkbox"
                checked={isPublic}
                onChange={(event) => setIsPublic(event.target.checked)}
                className="h-5 w-5 accent-[#7C5CFC]"
              />
            </label>

            <div>
              <span className="text-xs font-black text-neutral-500">
                행사 썸네일
              </span>
              <label className="mt-1 flex cursor-pointer flex-col items-center justify-center rounded-2xl border border-dashed border-neutral-300 bg-white px-4 py-7 text-center transition hover:border-[#7C5CFC]">
                {thumbnailPreviewUrl ? (
                  <img
                    src={thumbnailPreviewUrl}
                    alt="썸네일 미리보기"
                    className="aspect-[32/45] w-40 rounded-xl object-cover"
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

        <section className="rounded-2xl border border-neutral-200 bg-neutral-50 p-4">
          <div className="flex items-center justify-between gap-3">
            <div>
              <h2 className="text-sm font-black text-neutral-950">행사 목록</h2>
              <p className="mt-1 text-xs text-neutral-400">총 {events.length}개</p>
            </div>
            <button
              type="button"
              onClick={loadEvents}
              disabled={isLoadingEvents}
              className="rounded-full bg-white px-3 py-1.5 text-[11px] font-black text-neutral-500 ring-1 ring-neutral-200 disabled:cursor-not-allowed disabled:opacity-50"
            >
              {isLoadingEvents ? '불러오는 중' : '새로고침'}
            </button>
          </div>

          {events.length > 0 ? (
            <div className="mt-4 grid grid-cols-2 gap-3">
              {events.map((row) => {
                const thumbnailUrl = getTradeAssetUrl(row.thumbnail_path ?? '');
                const isDeleting = isDeletingEventId === row.id;
                const status = getEventStatus(
                  row.event_start_date,
                  row.event_end_date,
                  getKoreaTodayDateString(),
                );
                const ended = status === 'ended';
                const statusLabel = getEventStatusLabel(status);

                return (
                  <article
                    key={row.id}
                    className="min-w-0 overflow-hidden rounded-2xl border border-neutral-200 bg-white"
                  >
                    <Link href={`/admin/events/${row.id}`} className="block">
                      <div className="relative aspect-[32/45] w-full overflow-hidden bg-white">
                        {thumbnailUrl ? (
                          <img
                            src={thumbnailUrl}
                            alt="행사 썸네일"
                            className={`h-full w-full object-cover ${ended ? 'grayscale opacity-60' : ''}`}
                          />
                        ) : (
                          <div className="flex h-full w-full items-center justify-center text-[10px] font-bold text-neutral-300">
                            NO IMG
                          </div>
                        )}
                        <span
                          className={`absolute left-2 top-2 rounded-full px-2.5 py-1 text-[10px] font-black ${
                            status === 'ended'
                              ? 'bg-neutral-950 text-white'
                              : status === 'scheduled'
                                ? 'bg-[#F1EDFF] text-[#7C5CFC]'
                                : 'bg-emerald-100 text-emerald-700'
                          }`}
                        >
                          {statusLabel}
                        </span>
                      </div>
                    </Link>

                    <div className="p-3">
                      <div className="flex items-start justify-between gap-2">
                        <div className="min-w-0">
                          <p className="line-clamp-2 text-sm font-black leading-5 text-neutral-950">
                            {row.title}
                          </p>
                          <p className="mt-1.5 line-clamp-2 text-xs font-bold leading-5 text-neutral-500">
                            {getEventPeriodLabel(row.event_start_date, row.event_end_date)}
                          </p>
                          {row.event_location ? (
                            <p className="mt-1 truncate text-[10px] font-semibold text-neutral-400">
                              {row.event_location}
                            </p>
                          ) : null}
                        </div>
                        <span
                          className={`shrink-0 rounded-full px-2 py-1 text-[10px] font-black ${
                            row.is_public
                              ? 'bg-emerald-50 text-emerald-700'
                              : 'bg-neutral-100 text-neutral-500'
                          }`}
                        >
                          {row.is_public ? '공개' : '숨김'}
                        </span>
                      </div>

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
            <p className="mt-4 rounded-2xl border border-neutral-200 bg-white px-4 py-8 text-center text-sm text-neutral-400">
              아직 등록된 행사가 없습니다.
            </p>
          )}
        </section>
      </div>
    </main>
  );
}
