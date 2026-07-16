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
  const [eventLocation, setEventLocation] = useState("");
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
          event_location: eventLocation.trim() || null,
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
      <main className="w-full bg-white px-5 py-4">
        <section className="rounded-2xl border border-neutral-200 bg-neutral-50 p-4 text-sm text-neutral-500">
          관리자 권한을 확인하는 중입니다.
        </section>
      </main>
    );
  }

  if (adminState === "signed-out") {
    return (
      <main className="w-full bg-white px-5 py-4">
        <section className="rounded-2xl border border-neutral-200 bg-neutral-50 p-4">
          <h1 className="text-lg font-black text-neutral-950">로그인이 필요합니다</h1>
          <p className="mt-2 text-sm leading-6 text-neutral-500">
            행사 등록은 관리자 로그인 후 이용할 수 있습니다.
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

  if (adminState === "not-admin") {
    return (
      <main className="w-full bg-white px-5 py-4">
        <section className="rounded-2xl border border-neutral-200 bg-neutral-50 p-4">
          <h1 className="text-lg font-black text-neutral-950">관리자 권한이 없습니다</h1>
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
    <main className="w-full bg-white">
      <section className="border-b border-neutral-100 bg-white px-5 py-4">
        <p className="text-[12px] font-black tracking-[0.04em] text-[#7C5CFC]">
          NEW EVENT
        </p>
        <h1 className="mt-1 break-keep text-[24px] font-black leading-tight tracking-[-0.03em] text-neutral-950">
          새 행사 등록
        </h1>
        <p className="mt-2 text-[13px] font-medium leading-5 text-neutral-500">
          메인 화면과 굿즈 교환판에 노출할 행사를 등록합니다.
        </p>
      </section>

      <div className="space-y-3 bg-white px-5 pb-5 pt-3">
        {message ? (
          <p className="rounded-xl bg-neutral-50 px-3 py-3 text-sm leading-6 text-neutral-600">
            {message}
          </p>
        ) : null}

        <form
          onSubmit={handleCreateEvent}
          className="rounded-2xl border border-neutral-200 bg-neutral-50 p-4"
        >
          <div className="space-y-4">
            <label className="block">
              <span className="text-xs font-black text-neutral-500">행사 제목</span>
              <input
                value={title}
                onChange={(event) => setTitle(event.target.value)}
                className="mt-1 w-full rounded-2xl border border-neutral-200 bg-white px-4 py-3 text-sm outline-none focus:border-[#7C5CFC]"
                placeholder="예: 2026 여름 팝업 & 콜카 굿즈 교환판"
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
                실제 주소는 /trade/{normalizedSlug || "slug"} 형태입니다.
              </p>
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
              <span className="text-xs font-black text-neutral-500">행사 기간 메모</span>
              <input
                value={periodNote}
                onChange={(event) => setPeriodNote(event.target.value)}
                className="mt-1 w-full rounded-2xl border border-neutral-200 bg-white px-4 py-3 text-sm outline-none focus:border-[#7C5CFC]"
                placeholder="선택 입력"
              />
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
                <span className="block text-sm font-black text-neutral-950">공개 여부</span>
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
              <span className="text-xs font-black text-neutral-500">행사 썸네일</span>
              <label className="mt-1 flex cursor-pointer flex-col items-center justify-center rounded-2xl border border-dashed border-neutral-300 bg-white px-4 py-7 text-center transition hover:border-[#7C5CFC]">
                {thumbnailPreviewUrl ? (
                  <img
                    src={thumbnailPreviewUrl}
                    alt="썸네일 미리보기"
                    className="aspect-[32/45] w-40 rounded-xl object-cover"
                  />
                ) : (
                  <>
                    <span className="text-sm font-black text-neutral-700">썸네일 이미지 선택</span>
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
              className="w-full rounded-xl bg-neutral-950 px-5 py-4 text-sm font-black text-white disabled:cursor-not-allowed disabled:bg-neutral-300"
            >
              {isSubmittingEvent ? "등록 중..." : "행사 등록"}
            </button>
          </div>
        </form>
      </div>
    </main>
  );
}
