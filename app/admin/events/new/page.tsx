"use client";

import Link from "next/link";
import { ChangeEvent, FormEvent, useEffect, useMemo, useState } from "react";
import { useRouter } from "next/navigation";
import { supabase } from "@/lib/supabase";

type AdminState = "checking" | "admin" | "not-admin" | "signed-out";

function normalizeSlug(value: string) {
  return value
    .trim()
    .toLowerCase()
    .replace(/[^a-z0-9-]/g, "-")
    .replace(/-+/g, "-")
    .replace(/^-|-$/g, "");
}

function getFileExtension(file: File) {
  const extension = file.name.split(".").pop()?.toLowerCase();

  if (!extension) {
    return "jpg";
  }

  if (extension === "jpeg") {
    return "jpg";
  }

  return extension;
}

export default function AdminEventNewPage() {
  const router = useRouter();

  const [adminState, setAdminState] = useState<AdminState>("checking");
  const [message, setMessage] = useState("");

  const [title, setTitle] = useState("");
  const [slug, setSlug] = useState("");
  const [periodNote, setPeriodNote] = useState("");
  const [eventStartDate, setEventStartDate] = useState("");
  const [eventEndDate, setEventEndDate] = useState("");
  const [sortOrder, setSortOrder] = useState("0");
  const [isPublic, setIsPublic] = useState(true);
  const [thumbnailFile, setThumbnailFile] = useState<File | null>(null);
  const [thumbnailPreviewUrl, setThumbnailPreviewUrl] = useState("");
  const [isSubmittingEvent, setIsSubmittingEvent] = useState(false);

  const normalizedSlug = useMemo(() => normalizeSlug(slug), [slug]);

  useEffect(() => {
    async function checkAdmin() {
      const { data: sessionData } = await supabase.auth.getSession();
      const user = sessionData.session?.user;

      if (!user) {
        setAdminState("signed-out");
        return;
      }

      const { data: adminUser, error: adminError } = await supabase
        .from("admin_users")
        .select("user_id")
        .eq("user_id", user.id)
        .maybeSingle();

      if (adminError || !adminUser) {
        setAdminState("not-admin");
        return;
      }

      setAdminState("admin");
    }

    checkAdmin();
  }, []);

  useEffect(() => {
    return () => {
      if (thumbnailPreviewUrl.startsWith("blob:")) {
        URL.revokeObjectURL(thumbnailPreviewUrl);
      }
    };
  }, [thumbnailPreviewUrl]);

  function handleThumbnailChange(event: ChangeEvent<HTMLInputElement>) {
    const file = event.target.files?.[0];

    if (!file) {
      return;
    }

    if (!file.type.startsWith("image/")) {
      setMessage("이미지 파일만 업로드할 수 있습니다.");
      return;
    }

    if (thumbnailPreviewUrl.startsWith("blob:")) {
      URL.revokeObjectURL(thumbnailPreviewUrl);
    }

    setThumbnailFile(file);
    setThumbnailPreviewUrl(URL.createObjectURL(file));
  }

  async function handleCreateEvent(event: FormEvent<HTMLFormElement>) {
    event.preventDefault();

    if (!title.trim()) {
      setMessage("행사 제목을 입력해 주세요.");
      return;
    }

    if (!normalizedSlug) {
      setMessage("slug를 입력해 주세요. 영문, 숫자, 하이픈만 사용할 수 있습니다.");
      return;
    }

    if (eventStartDate && eventEndDate && eventStartDate > eventEndDate) {
      setMessage("행사 종료일은 시작일보다 빠를 수 없습니다.");
      return;
    }

    try {
      setIsSubmittingEvent(true);
      setMessage("");

      let thumbnailPath: string | null = null;

      if (thumbnailFile) {
        const fileExtension = getFileExtension(thumbnailFile);
        thumbnailPath = `${normalizedSlug}/thumbnail.${fileExtension}`;

        const { error: uploadError } = await supabase.storage
          .from("trade-assets")
          .upload(thumbnailPath, thumbnailFile, {
            cacheControl: "3600",
            upsert: true,
            contentType: thumbnailFile.type,
          });

        if (uploadError) {
          console.error(uploadError);
          setMessage("썸네일 업로드에 실패했습니다. Storage 정책을 확인해 주세요.");
          return;
        }
      }

      const parsedSortOrder = Number.parseInt(sortOrder, 10);

      const { data, error: insertError } = await supabase
        .from("trade_collections")
        .insert({
          title: title.trim(),
          slug: normalizedSlug,
          description: periodNote.trim() || null,
          event_start_date: eventStartDate || null,
          event_end_date: eventEndDate || null,
          thumbnail_path: thumbnailPath,
          status_label: null,
          is_public: isPublic,
          sort_order: Number.isNaN(parsedSortOrder) ? 0 : parsedSortOrder,
        })
        .select("id")
        .single();

      if (insertError) {
        console.error(insertError);
        setMessage("행사 등록에 실패했습니다. slug 중복 또는 DB 정책을 확인해 주세요.");
        return;
      }

      setMessage("행사가 등록되었습니다.");
      router.push(data?.id ? `/admin/events/${data.id}` : "/admin/events");
      router.refresh();
    } catch (error) {
      console.error(error);
      setMessage("행사 등록 중 오류가 발생했습니다.");
    } finally {
      setIsSubmittingEvent(false);
    }
  }

  async function handleLogout() {
    await supabase.auth.signOut();
    router.push("/admin/login");
    router.refresh();
  }

  if (adminState === "checking") {
    return (
      <main className="w-full bg-neutral-100 px-4 py-10">
        <section className="mx-auto max-w-md rounded-[28px] border border-neutral-200/70 bg-white p-6 text-sm text-neutral-500 shadow-[0_8px_26px_rgba(15,23,42,0.032)]">
          관리자 권한을 확인하는 중입니다.
        </section>
      </main>
    );
  }

  if (adminState === "signed-out") {
    return (
      <main className="w-full bg-neutral-100 px-4 py-10">
        <section className="mx-auto max-w-md rounded-[28px] border border-neutral-200/70 bg-white p-6 shadow-[0_8px_26px_rgba(15,23,42,0.032)]">
          <h1 className="text-2xl font-bold text-neutral-950">로그인이 필요합니다</h1>
          <p className="mt-2 text-sm leading-6 text-neutral-500">
            행사 등록은 관리자 로그인 후 이용할 수 있습니다.
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
      <main className="w-full bg-neutral-100 px-4 py-10">
        <section className="mx-auto max-w-md rounded-[28px] border border-neutral-200/70 bg-white p-6 shadow-[0_8px_26px_rgba(15,23,42,0.032)]">
          <h1 className="text-2xl font-bold text-neutral-950">관리자 권한이 없습니다</h1>
          <p className="mt-2 text-sm leading-6 text-neutral-500">
            현재 로그인한 계정은 관리자 목록에 등록되어 있지 않습니다.
          </p>
          <button
            type="button"
            onClick={handleLogout}
            className="mt-6 rounded-2xl bg-neutral-950 px-5 py-3 text-sm font-bold text-white"
          >
            로그아웃
          </button>
        </section>
      </main>
    );
  }

  return (
    <main className="w-full bg-neutral-100 px-4 pb-4 pt-5 sm:pb-5 sm:pt-6">
      <section className="mx-auto w-full max-w-md sm:max-w-lg">
        <div className="overflow-hidden rounded-[28px] border border-neutral-200/70 bg-white shadow-[0_8px_26px_rgba(15,23,42,0.032)]">
          <header className="border-b border-neutral-200/70 bg-[linear-gradient(135deg,#efe7ff_0%,#d8efff_48%,#ffe1f2_100%)] p-5">
            <div className="mb-6 flex items-center justify-between gap-3">
              <Link
                href="/admin/events"
                className="rounded-full border border-white/70 bg-white/75 px-4 py-2 text-xs font-bold text-neutral-600 shadow-[0_4px_12px_rgba(15,23,42,0.025)] transition hover:border-white hover:bg-white hover:text-neutral-950"
              >
                ← 행사 목록
              </Link>

              <button
                type="button"
                onClick={handleLogout}
                className="rounded-full border border-white/70 bg-white/75 px-4 py-2 text-xs font-bold text-neutral-600 shadow-[0_4px_12px_rgba(15,23,42,0.025)] transition hover:border-white hover:bg-white hover:text-neutral-950"
              >
                로그아웃
              </button>
            </div>

            <div className="mt-6">
              <p className="text-xs font-bold uppercase tracking-[0.2em] text-neutral-500">
                Popup & Callabo Cafe Trade Board
              </p>
              <h1 className="mt-1 text-2xl font-bold text-neutral-950">행사 등록</h1>
              <p className="mt-2 text-sm leading-6 text-neutral-500">
                팝업 & 콜라보 카페 굿즈 교환판에 노출할 새 행사를 등록합니다.
              </p>
            </div>
          </header>

          {message ? (
            <p className="mx-5 mt-5 rounded-2xl border border-neutral-200/70 bg-neutral-50/80 px-4 py-3 text-sm leading-6 text-neutral-700">
              {message}
            </p>
          ) : null}

          <form onSubmit={handleCreateEvent} className="p-5">
            <div className="space-y-5">
              <label className="block">
                <span className="text-sm font-semibold text-neutral-800">행사 제목</span>
                <input
                  value={title}
                  onChange={(event) => setTitle(event.target.value)}
                  className="mt-1 w-full rounded-2xl border border-neutral-200 bg-white px-4 py-3 text-sm outline-none transition focus:border-neutral-950"
                  placeholder="예: 2026 여름 팝업 & 콜카 굿즈 교환판"
                />
              </label>

              <label className="block">
                <span className="text-sm font-semibold text-neutral-800">Slug</span>
                <input
                  value={slug}
                  onChange={(event) => setSlug(event.target.value)}
                  className="mt-1 w-full rounded-2xl border border-neutral-200 bg-white px-4 py-3 text-sm outline-none transition focus:border-neutral-950"
                  placeholder="예: summer-event-2026"
                />
                <p className="mt-2 text-xs leading-5 text-neutral-400">
                  실제 주소는 /trade/{normalizedSlug || "slug"} 형태입니다.
                </p>
              </label>

              <div className="grid grid-cols-2 gap-3">
                <label className="block">
                  <span className="text-sm font-semibold text-neutral-800">시작일</span>
                  <input
                    type="date"
                    value={eventStartDate}
                    onChange={(event) => setEventStartDate(event.target.value)}
                    className="mt-1 w-full rounded-2xl border border-neutral-200 bg-white px-3 py-3 text-sm outline-none transition focus:border-neutral-950"
                  />
                </label>

                <label className="block">
                  <span className="text-sm font-semibold text-neutral-800">종료일</span>
                  <input
                    type="date"
                    value={eventEndDate}
                    onChange={(event) => setEventEndDate(event.target.value)}
                    className="mt-1 w-full rounded-2xl border border-neutral-200 bg-white px-3 py-3 text-sm outline-none transition focus:border-neutral-950"
                  />
                </label>
              </div>

              <label className="block">
                <span className="text-sm font-semibold text-neutral-800">행사 기간 메모</span>
                <input
                  value={periodNote}
                  onChange={(event) => setPeriodNote(event.target.value)}
                  className="mt-1 w-full rounded-2xl border border-neutral-200 bg-white px-4 py-3 text-sm outline-none transition focus:border-neutral-950"
                  placeholder="선택 입력"
                />
              </label>

              <label className="block">
                <span className="text-sm font-semibold text-neutral-800">정렬 순서</span>
                <input
                  type="number"
                  value={sortOrder}
                  onChange={(event) => setSortOrder(event.target.value)}
                  className="mt-1 w-full rounded-2xl border border-neutral-200 bg-white px-4 py-3 text-sm outline-none transition focus:border-neutral-950"
                  placeholder="0"
                />
              </label>

              <label className="flex items-center justify-between gap-3 rounded-2xl border border-neutral-200/70 bg-neutral-50/80 px-4 py-3">
                <span>
                  <span className="block text-sm font-semibold text-neutral-800">공개 여부</span>
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
                <span className="text-sm font-semibold text-neutral-800">행사 썸네일</span>
                <label className="mt-1 flex cursor-pointer flex-col items-center justify-center rounded-2xl border border-dashed border-neutral-300 bg-neutral-50/80 px-4 py-8 text-center transition hover:border-neutral-950 hover:bg-white">
                  {thumbnailPreviewUrl ? (
                    <img
                      src={thumbnailPreviewUrl}
                      alt="썸네일 미리보기"
                      className="aspect-[32/45] w-44 rounded-2xl object-cover shadow-[0_10px_30px_rgba(15,23,42,0.05)]"
                    />
                  ) : (
                    <>
                      <span className="text-sm font-bold text-neutral-700">썸네일 이미지 선택</span>
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
                className="w-full rounded-2xl bg-neutral-950 px-5 py-4 text-sm font-bold text-white transition hover:bg-neutral-800 disabled:cursor-not-allowed disabled:bg-neutral-300"
              >
                {isSubmittingEvent ? "등록 중..." : "행사 등록"}
              </button>
            </div>
          </form>
        </div>
      </section>
    </main>
  );
}
