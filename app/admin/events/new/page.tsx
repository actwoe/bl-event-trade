'use client';

import Link from 'next/link';
import { ChangeEvent, FormEvent, useEffect, useMemo, useState } from 'react';
import { useRouter } from 'next/navigation';
import { supabase } from '@/lib/supabase';

type AdminState = 'checking' | 'admin' | 'not-admin' | 'signed-out';

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

export default function AdminNewEventPage() {
  const router = useRouter();

  const [adminState, setAdminState] = useState<AdminState>('checking');

  const [title, setTitle] = useState('');
  const [slug, setSlug] = useState('');
  const [period, setPeriod] = useState('');
  const [statusLabel, setStatusLabel] = useState('OPEN');
  const [isPublic, setIsPublic] = useState(true);
  const [sortOrder, setSortOrder] = useState('0');
  const [thumbnailFile, setThumbnailFile] = useState<File | null>(null);
  const [thumbnailPreviewUrl, setThumbnailPreviewUrl] = useState('');

  const [message, setMessage] = useState('');
  const [isSubmitting, setIsSubmitting] = useState(false);

  const normalizedSlug = useMemo(() => {
    return normalizeSlug(slug);
  }, [slug]);

  useEffect(() => {
    async function checkAdmin() {
      const { data: sessionData } = await supabase.auth.getSession();
      const user = sessionData.session?.user;

      if (!user) {
        setAdminState('signed-out');
        return;
      }

      const { data: adminUser, error } = await supabase
        .from('admin_users')
        .select('user_id')
        .eq('user_id', user.id)
        .maybeSingle();

      if (error || !adminUser) {
        setAdminState('not-admin');
        return;
      }

      setAdminState('admin');
    }

    checkAdmin();
  }, []);

  useEffect(() => {
    return () => {
      if (thumbnailPreviewUrl) {
        URL.revokeObjectURL(thumbnailPreviewUrl);
      }
    };
  }, [thumbnailPreviewUrl]);

  function handleTitleChange(value: string) {
    setTitle(value);

    if (!slug) {
      setSlug(normalizeSlug(value));
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

    if (thumbnailPreviewUrl) {
      URL.revokeObjectURL(thumbnailPreviewUrl);
    }

    setThumbnailFile(file);
    setThumbnailPreviewUrl(URL.createObjectURL(file));
  }

  async function handleSubmit(event: FormEvent<HTMLFormElement>) {
    event.preventDefault();

    if (!title.trim()) {
      setMessage('행사 제목을 입력해 주세요.');
      return;
    }

    if (!normalizedSlug) {
      setMessage(
        'slug를 입력해 주세요. 영문 소문자, 숫자, 하이픈만 사용할 수 있습니다.',
      );
      return;
    }

    if (!thumbnailFile) {
      setMessage('행사 썸네일 이미지를 업로드해 주세요.');
      return;
    }

    try {
      setIsSubmitting(true);
      setMessage('');

      const fileExtension = getFileExtension(thumbnailFile);
      const thumbnailPath = `${normalizedSlug}/thumbnail.${fileExtension}`;

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
          '썸네일 업로드에 실패했습니다. Storage 정책과 trade-assets 버킷을 확인해 주세요.',
        );
        return;
      }

      const parsedSortOrder = Number.parseInt(sortOrder, 10);

      const { data: insertedEvent, error: insertError } = await supabase
        .from('trade_collections')
        .insert({
          slug: normalizedSlug,
          title: title.trim(),
          description: period.trim() || null,
          thumbnail_path: thumbnailPath,
          status_label: statusLabel.trim() || null,
          is_public: isPublic,
          sort_order: Number.isNaN(parsedSortOrder) ? 0 : parsedSortOrder,
          published_at: new Date().toISOString(),
        })
        .select('id')
        .single();

      if (insertError || !insertedEvent) {
        console.error(insertError);
        setMessage(
          '행사 등록에 실패했습니다. slug가 중복되었거나 DB 정책이 막혔을 수 있습니다.',
        );
        return;
      }

      router.push('/admin/events');
      router.refresh();
    } catch (error) {
      console.error(error);
      setMessage('행사 등록 중 오류가 발생했습니다.');
    } finally {
      setIsSubmitting(false);
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
            새 행사는 관리자 로그인 후 등록할 수 있습니다.
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
              href="/admin/events"
              className="rounded-full border border-neutral-200 px-4 py-2 text-xs font-bold text-neutral-600"
            >
              ← 행사 목록
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
              New Event
            </p>

            <h1 className="mt-1 text-2xl font-black text-neutral-950">
              새 행사 등록
            </h1>

            <p className="mt-2 text-sm leading-6 text-neutral-500">
              메인 페이지에 표시될 교환판 행사를 만들고 썸네일을 업로드합니다.
            </p>
          </div>
        </header>

        <form
          onSubmit={handleSubmit}
          className="mt-5 rounded-3xl bg-white p-5 shadow-sm"
        >
          <div className="space-y-5">
            <label className="block">
              <span className="text-sm font-bold text-neutral-800">
                행사 제목
              </span>

              <input
                value={title}
                onChange={(event) => handleTitleChange(event.target.value)}
                className="mt-1 w-full rounded-2xl border border-neutral-200 px-4 py-3 text-sm outline-none focus:border-neutral-950"
                placeholder="예: 2026 여름 특전 교환판"
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
                실제 주소는 /trade/{normalizedSlug || 'slug'} 형태로 생성됩니다.
                영문 소문자, 숫자, 하이픈만 사용하는 걸 추천합니다.
              </p>
            </label>

            <label className="block">
              <span className="text-sm font-bold text-neutral-800">
                행사 기간
              </span>

              <input
                value={period}
                onChange={(event) => setPeriod(event.target.value)}
                className="mt-1 w-full rounded-2xl border border-neutral-200 px-4 py-3 text-sm outline-none focus:border-neutral-950"
                placeholder="예: 2026.07.01 - 2026.07.31"
              />

              <p className="mt-2 text-xs leading-5 text-neutral-400">
                메인 카드와 교환판 설명 영역에 표시됩니다.
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
                  공개 상태여야 메인 페이지에 노출됩니다.
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

            {message ? (
              <p className="rounded-2xl bg-neutral-100 px-4 py-3 text-sm leading-6 text-neutral-700">
                {message}
              </p>
            ) : null}

            <button
              type="submit"
              disabled={isSubmitting}
              className="w-full rounded-2xl bg-neutral-950 px-5 py-4 text-sm font-black text-white disabled:cursor-not-allowed disabled:bg-neutral-300"
            >
              {isSubmitting ? '등록 중...' : '행사 등록'}
            </button>
          </div>
        </form>
      </section>
    </main>
  );
}