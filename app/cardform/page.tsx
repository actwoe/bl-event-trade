'use client';

import { ChangeEvent, FormEvent, useEffect, useMemo, useState } from 'react';
import { nanoid } from 'nanoid';
import { supabase } from '@/lib/supabase';
import { TRADE_CATEGORIES, TradeCategory } from '@/lib/trade-types';

type TradeCollectionRow = {
  id: string;
  slug: string;
  title: string;
  description: string | null;
};

type TradeWorkRow = {
  title: string;
};

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

function normalizePathPart(value: string) {
  const normalized = value
    .trim()
    .toLowerCase()
    .normalize('NFKD')
    .replace(/[\u0300-\u036f]/g, '')
    .replace(/[^a-z0-9-]/g, '-')
    .replace(/-+/g, '-')
    .replace(/^-|-$/g, '');

  return normalized || 'submission';
}

function sortKoreanTitles(titles: string[]) {
  return [...titles].sort((a, b) =>
    a.localeCompare(b, 'ko-KR', {
      numeric: true,
      sensitivity: 'base',
    }),
  );
}

export default function CardFormPage() {
  const [collections, setCollections] = useState<TradeCollectionRow[]>([]);
  const [collectionId, setCollectionId] = useState('');
  const [workTitles, setWorkTitles] = useState<string[]>([]);
  const [workTitle, setWorkTitle] = useState('');
  const [category, setCategory] = useState<TradeCategory>('benefit');

  const [imageFile, setImageFile] = useState<File | null>(null);
  const [imagePreviewUrl, setImagePreviewUrl] = useState('');

  const [message, setMessage] = useState('');
  const [isSubmitting, setIsSubmitting] = useState(false);
  const [isSubmitted, setIsSubmitted] = useState(false);

  const selectedCollection = useMemo(() => {
    return collections.find((collection) => collection.id === collectionId);
  }, [collections, collectionId]);

  useEffect(() => {
    async function loadCollections() {
      const { data, error } = await supabase
        .from('trade_collections')
        .select('id, slug, title, description')
        .eq('is_public', true)
        .order('published_at', { ascending: false })
        .order('sort_order', { ascending: true });

      if (error) {
        console.error(error);
        setMessage('행사 목록을 불러오지 못했습니다.');
        return;
      }

      const nextCollections = (data ?? []) as TradeCollectionRow[];

      setCollections(nextCollections);

      if (nextCollections[0]) {
        setCollectionId(nextCollections[0].id);
      }
    }

    loadCollections();
  }, []);

  useEffect(() => {
    async function loadWorkTitles() {
      if (!collectionId) {
        setWorkTitles([]);
        setWorkTitle('');
        return;
      }

      const { data, error } = await supabase
        .from('trade_collection_works')
        .select('title')
        .eq('collection_id', collectionId)
        .eq('is_visible', true)
        .order('title', { ascending: true });

      if (error) {
        console.error(error);
        setMessage('작품 목록을 불러오지 못했습니다.');
        setWorkTitles([]);
        setWorkTitle('');
        return;
      }

      const rows = (data ?? []) as TradeWorkRow[];

      const uniqueWorkTitles = sortKoreanTitles(
        Array.from(
          new Set(
            rows
              .map((row) => row.title)
              .filter((title) => title.trim().length > 0),
          ),
        ),
      );

      setWorkTitles(uniqueWorkTitles);
      setWorkTitle(uniqueWorkTitles[0] ?? '');
    }

    loadWorkTitles();
  }, [collectionId]);

  useEffect(() => {
    return () => {
      if (imagePreviewUrl) {
        URL.revokeObjectURL(imagePreviewUrl);
      }
    };
  }, [imagePreviewUrl]);

  function handleImageChange(event: ChangeEvent<HTMLInputElement>) {
    const file = event.target.files?.[0];

    if (!file) {
      return;
    }

    if (!file.type.startsWith('image/')) {
      setMessage('이미지 파일만 업로드할 수 있습니다.');
      return;
    }

    if (imagePreviewUrl) {
      URL.revokeObjectURL(imagePreviewUrl);
    }

    setImageFile(file);
    setImagePreviewUrl(URL.createObjectURL(file));
    setMessage('');
  }

  async function handleSubmit(event: FormEvent<HTMLFormElement>) {
    event.preventDefault();

    if (!selectedCollection) {
      setMessage('행사를 선택해 주세요.');
      return;
    }

    if (!workTitle) {
      setMessage('작품을 선택해 주세요.');
      return;
    }

    if (!imageFile) {
      setMessage('제보할 이미지를 업로드해 주세요.');
      return;
    }

    try {
      setIsSubmitting(true);
      setMessage('');

      const fileExtension = getFileExtension(imageFile);
      const safeWorkTitle = normalizePathPart(workTitle);
      const fileName = `${safeWorkTitle}-${Date.now()}-${nanoid(
        8,
      )}.${fileExtension}`;
      const imagePath = `${selectedCollection.slug}/${fileName}`;

      const { error: uploadError } = await supabase.storage
        .from('trade-submissions')
        .upload(imagePath, imageFile, {
          cacheControl: '3600',
          upsert: false,
          contentType: imageFile.type,
        });

      if (uploadError) {
        console.error(uploadError);
        setMessage(
          '이미지 업로드에 실패했습니다. 잠시 후 다시 시도해 주세요.',
        );
        return;
      }

      const { error: insertError } = await supabase
        .from('card_submissions')
        .insert({
          collection_id: selectedCollection.id,
          collection_slug: selectedCollection.slug,
          collection_title: selectedCollection.title,
          category,
          work_title: workTitle,
          item_name: null,
          image_path: imagePath,
          submitter_contact: null,
          note: null,
          status: 'pending',
        });

      if (insertError) {
        console.error(insertError);
        setMessage('제보 등록에 실패했습니다. 잠시 후 다시 시도해 주세요.');
        return;
      }

      setIsSubmitted(true);
      setImageFile(null);
      setImagePreviewUrl('');
    } catch (error) {
      console.error(error);
      setMessage('제보 중 오류가 발생했습니다.');
    } finally {
      setIsSubmitting(false);
    }
  }

  return (
    <main className="min-h-screen bg-neutral-100 px-4 py-5">
      <section className="mx-auto w-full max-w-md sm:max-w-lg">
        <header className="rounded-3xl bg-white p-5 shadow-sm">
          <div>
            <p className="text-xs font-black uppercase tracking-[0.2em] text-neutral-500">
              Image Submission
            </p>

            <h1 className="mt-1 text-2xl font-black text-neutral-950">
              이미지 제보
            </h1>

            <p className="mt-2 text-sm leading-6 text-neutral-500">
              교환판에 없는 굿즈 이미지를 제보해 주세요. 제보된 이미지는
              관리자가 확인한 뒤 반영됩니다.
            </p>
          </div>

          <div className="mt-5 rounded-2xl bg-neutral-100 p-4 text-xs leading-6 text-neutral-600">
            <p>제보 이미지는 즉시 공개되지 않습니다.</p>
            <p>반영 시 워터마크가 추가될 수 있습니다.</p>
          </div>
        </header>

        {isSubmitted ? (
          <section className="mt-5 rounded-3xl bg-white p-5 text-center shadow-sm">
            <h2 className="text-xl font-black text-neutral-950">
              제보가 접수되었습니다
            </h2>

            <p className="mt-2 text-sm leading-6 text-neutral-500">
              관리자가 확인한 뒤 교환판에 반영됩니다.
            </p>

            <button
              type="button"
              onClick={() => setIsSubmitted(false)}
              className="mt-6 w-full rounded-2xl bg-neutral-950 px-5 py-4 text-sm font-black text-white"
            >
              다른 이미지 제보하기
            </button>
          </section>
        ) : (
          <form
            onSubmit={handleSubmit}
            className="mt-5 rounded-3xl bg-white p-5 shadow-sm"
          >
            <div className="space-y-5">
              <label className="block">
                <span className="text-sm font-bold text-neutral-800">
                  행사 선택
                </span>

                <select
                  value={collectionId}
                  onChange={(event) => setCollectionId(event.target.value)}
                  className="mt-1 w-full rounded-2xl border border-neutral-200 bg-white px-4 py-3 text-sm outline-none focus:border-neutral-950"
                >
                  {collections.length > 0 ? (
                    collections.map((collection) => (
                      <option key={collection.id} value={collection.id}>
                        {collection.title}
                      </option>
                    ))
                  ) : (
                    <option value="">등록된 행사가 없습니다</option>
                  )}
                </select>
              </label>

              <label className="block">
                <span className="text-sm font-bold text-neutral-800">
                  작품 선택
                </span>

                <select
                  value={workTitle}
                  onChange={(event) => setWorkTitle(event.target.value)}
                  disabled={workTitles.length === 0}
                  className="mt-1 w-full rounded-2xl border border-neutral-200 bg-white px-4 py-3 text-sm outline-none focus:border-neutral-950 disabled:bg-neutral-100 disabled:text-neutral-400"
                >
                  {workTitles.length > 0 ? (
                    workTitles.map((title) => (
                      <option key={title} value={title}>
                        {title}
                      </option>
                    ))
                  ) : (
                    <option value="">등록된 작품이 없습니다</option>
                  )}
                </select>

                <p className="mt-2 text-xs leading-5 text-neutral-400">
                  작품 목록은 관리자가 해당 행사에 등록한 작품 기준으로
                  표시됩니다.
                </p>
              </label>

              <label className="block">
                <span className="text-sm font-bold text-neutral-800">
                  굿즈 종류
                </span>

                <select
                  value={category}
                  onChange={(event) =>
                    setCategory(event.target.value as TradeCategory)
                  }
                  className="mt-1 w-full rounded-2xl border border-neutral-200 bg-white px-4 py-3 text-sm outline-none focus:border-neutral-950"
                >
                  {TRADE_CATEGORIES.map((option) => (
                    <option key={option.id} value={option.id}>
                      {option.label}
                    </option>
                  ))}
                </select>
              </label>

              <div>
                <span className="text-sm font-bold text-neutral-800">
                  이미지
                </span>

                <label className="mt-1 flex cursor-pointer flex-col items-center justify-center rounded-2xl border border-dashed border-neutral-300 bg-neutral-50 px-4 py-8 text-center hover:border-neutral-950">
                  {imagePreviewUrl ? (
                    <img
                      src={imagePreviewUrl}
                      alt="제보 이미지 미리보기"
                      className="aspect-[3/4] w-32 rounded-2xl bg-white object-contain p-1 shadow-sm"
                    />
                  ) : (
                    <>
                      <span className="text-sm font-black text-neutral-700">
                        이미지 선택
                      </span>
                      <span className="mt-2 text-xs leading-5 text-neutral-400">
                        제보할 굿즈 이미지를 업로드해 주세요.
                      </span>
                    </>
                  )}

                  <input
                    type="file"
                    accept="image/*"
                    onChange={handleImageChange}
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
                disabled={
                  isSubmitting ||
                  collections.length === 0 ||
                  workTitles.length === 0
                }
                className="w-full rounded-2xl bg-neutral-950 px-5 py-4 text-sm font-black text-white disabled:cursor-not-allowed disabled:bg-neutral-300"
              >
                {isSubmitting ? '제보 중...' : '이미지 제보하기'}
              </button>
            </div>
          </form>
        )}
      </section>
    </main>
  );
}
