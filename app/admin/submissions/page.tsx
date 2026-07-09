"use client";

import Link from "next/link";
import { useEffect, useMemo, useState } from "react";
import { useRouter } from "next/navigation";
import { supabase } from "@/lib/supabase";
import { TRADE_CATEGORIES, TradeCategory } from "@/lib/trade-types";

type AdminState = "checking" | "admin" | "not-admin" | "signed-out";

type SubmissionStatus = "pending" | "approved" | "rejected";

type CardSubmissionRow = {
  id: string;
  collection_id: string | null;
  collection_slug: string;
  collection_title: string;
  category: TradeCategory;
  work_title: string;
  item_name: string | null;
  benefit_subcategory: string | null;
  image_path: string;
  submitter_contact: string | null;
  note: string | null;
  status: SubmissionStatus;
  admin_note: string | null;
  approved_item_id: string | null;
  created_at: string;
  reviewed_at: string | null;
  reviewed_by: string | null;
};

type StatusFilter = "pending" | "approved" | "rejected" | "all";

function normalizePathPart(value: string) {
  const normalized = value
    .trim()
    .toLowerCase()
    .normalize("NFKD")
    .replace(/[\u0300-\u036f]/g, "")
    .replace(/[^a-z0-9-]/g, "-")
    .replace(/-+/g, "-")
    .replace(/^-|-$/g, "");

  return normalized || "item";
}

function getFileExtensionFromPath(path: string) {
  const extension = path.split(".").pop()?.toLowerCase();

  if (!extension) {
    return "jpg";
  }

  if (extension === "jpeg") {
    return "jpg";
  }

  return extension;
}

function getContentTypeFromExtension(extension: string) {
  if (extension === "png") {
    return "image/png";
  }

  if (extension === "webp") {
    return "image/webp";
  }

  if (extension === "gif") {
    return "image/gif";
  }

  return "image/jpeg";
}

function getCategoryLabel(category: TradeCategory) {
  return (
    TRADE_CATEGORIES.find((option) => option.id === category)?.label ?? category
  );
}

export default function AdminSubmissionsPage() {
  const router = useRouter();

  const [adminState, setAdminState] = useState<AdminState>("checking");
  const [submissions, setSubmissions] = useState<CardSubmissionRow[]>([]);
  const [signedUrlById, setSignedUrlById] = useState<Record<string, string>>(
    {},
  );
  const [adminNoteById, setAdminNoteById] = useState<Record<string, string>>(
    {},
  );

  const [statusFilter, setStatusFilter] = useState<StatusFilter>("pending");
  const [message, setMessage] = useState("");
  const [processingId, setProcessingId] = useState("");

  const filteredSubmissions = useMemo(() => {
    if (statusFilter === "all") {
      return submissions;
    }

    return submissions.filter(
      (submission) => submission.status === statusFilter,
    );
  }, [submissions, statusFilter]);

  const pendingCount = useMemo(() => {
    return submissions.filter((submission) => submission.status === "pending")
      .length;
  }, [submissions]);

  useEffect(() => {
    async function loadPage() {
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

      await loadSubmissions();
    }

    loadPage();
  }, []);

  async function loadSubmissions() {
    const { data, error } = await supabase
      .from("card_submissions")
      .select(
        "id, collection_id, collection_slug, collection_title, category, work_title, item_name, benefit_subcategory, image_path, submitter_contact, note, status, admin_note, approved_item_id, created_at, reviewed_at, reviewed_by",
      )
      .order("created_at", { ascending: false });

    if (error) {
      console.error(error);
      setMessage("제보 목록을 불러오지 못했습니다.");
      return;
    }

    const nextSubmissions = (data ?? []) as CardSubmissionRow[];

    setSubmissions(nextSubmissions);

    const nextAdminNotes: Record<string, string> = {};

    nextSubmissions.forEach((submission) => {
      nextAdminNotes[submission.id] = submission.admin_note ?? "";
    });

    setAdminNoteById(nextAdminNotes);

    await loadSignedUrls(nextSubmissions);
  }

  async function loadSignedUrls(nextSubmissions: CardSubmissionRow[]) {
    const entries = await Promise.all(
      nextSubmissions.map(async (submission) => {
        const { data, error } = await supabase.storage
          .from("trade-submissions")
          .createSignedUrl(submission.image_path, 60 * 60);

        if (error || !data?.signedUrl) {
          console.error(error);
          return [submission.id, ""] as const;
        }

        return [submission.id, data.signedUrl] as const;
      }),
    );

    setSignedUrlById(Object.fromEntries(entries));
  }

  async function handleApprove(submission: CardSubmissionRow) {
    if (submission.status !== "pending") {
      setMessage("이미 처리된 제보입니다.");
      return;
    }

    if (!submission.collection_id) {
      setMessage("연결된 행사가 없어 승인할 수 없습니다.");
      return;
    }

    const ok = window.confirm("이 제보 이미지를 교환판에 반영할까요?");

    if (!ok) {
      return;
    }

    try {
      setProcessingId(submission.id);
      setMessage("");

      const { data: sessionData } = await supabase.auth.getSession();
      const user = sessionData.session?.user;

      if (!user) {
        setMessage("로그인이 필요합니다.");
        return;
      }

      const { data: downloadedFile, error: downloadError } =
        await supabase.storage
          .from("trade-submissions")
          .download(submission.image_path);

      if (downloadError || !downloadedFile) {
        console.error(downloadError);
        setMessage("제보 이미지를 불러오지 못했습니다.");
        return;
      }

      const fileExtension = getFileExtensionFromPath(submission.image_path);
      const safeWorkTitle = normalizePathPart(submission.work_title);
      const publicImagePath = `${submission.collection_slug}/approved-${submission.category}-${safeWorkTitle}-${Date.now()}.${fileExtension}`;

      const { error: uploadError } = await supabase.storage
        .from("trade-assets")
        .upload(publicImagePath, downloadedFile, {
          cacheControl: "3600",
          upsert: false,
          contentType: getContentTypeFromExtension(fileExtension),
        });

      if (uploadError) {
        console.error(uploadError);
        setMessage("공개 이미지 업로드에 실패했습니다.");
        return;
      }

      const { data: insertedItem, error: insertError } = await supabase
        .from("trade_items")
        .insert({
          collection_id: submission.collection_id,
          category: submission.category,
          work_title: submission.work_title,
          item_name: null,
          benefit_subcategory:
            submission.category === "benefit" && submission.benefit_subcategory
              ? submission.benefit_subcategory
              : null,
          image_path: publicImagePath,
          is_visible: true,
          sort_order: 0,
        })
        .select("id")
        .single();

      if (insertError || !insertedItem) {
        console.error(insertError);
        setMessage("교환판 굿즈 등록에 실패했습니다.");
        return;
      }

      const { error: updateError } = await supabase
        .from("card_submissions")
        .update({
          status: "approved",
          item_name: null,
          approved_item_id: insertedItem.id,
          admin_note: adminNoteById[submission.id]?.trim() || null,
          reviewed_at: new Date().toISOString(),
          reviewed_by: user.id,
        })
        .eq("id", submission.id);

      if (updateError) {
        console.error(updateError);
        setMessage("제보 승인 상태 업데이트에 실패했습니다.");
        return;
      }

      await loadSubmissions();
      setMessage("제보 이미지를 승인하고 교환판에 반영했습니다.");
    } catch (error) {
      console.error(error);
      setMessage("승인 처리 중 오류가 발생했습니다.");
    } finally {
      setProcessingId("");
    }
  }

  async function handleReject(submission: CardSubmissionRow) {
    if (submission.status !== "pending") {
      setMessage("이미 처리된 제보입니다.");
      return;
    }

    const ok = window.confirm("이 제보를 반려할까요?");

    if (!ok) {
      return;
    }

    try {
      setProcessingId(submission.id);
      setMessage("");

      const { data: sessionData } = await supabase.auth.getSession();
      const user = sessionData.session?.user;

      if (!user) {
        setMessage("로그인이 필요합니다.");
        return;
      }

      const { error } = await supabase
        .from("card_submissions")
        .update({
          status: "rejected",
          admin_note: adminNoteById[submission.id]?.trim() || null,
          reviewed_at: new Date().toISOString(),
          reviewed_by: user.id,
        })
        .eq("id", submission.id);

      if (error) {
        console.error(error);
        setMessage("제보 반려에 실패했습니다.");
        return;
      }

      await loadSubmissions();
      setMessage("제보를 반려했습니다.");
    } catch (error) {
      console.error(error);
      setMessage("반려 처리 중 오류가 발생했습니다.");
    } finally {
      setProcessingId("");
    }
  }

  async function handleDeleteSubmission(submission: CardSubmissionRow) {
    const ok = window.confirm(
      "이 제보 기록과 비공개 업로드 이미지를 삭제할까요?",
    );

    if (!ok) {
      return;
    }

    try {
      setProcessingId(submission.id);
      setMessage("");

      const { error: storageError } = await supabase.storage
        .from("trade-submissions")
        .remove([submission.image_path]);

      if (storageError) {
        console.error(storageError);
      }

      const { error: deleteError } = await supabase
        .from("card_submissions")
        .delete()
        .eq("id", submission.id);

      if (deleteError) {
        console.error(deleteError);
        setMessage("제보 삭제에 실패했습니다.");
        return;
      }

      await loadSubmissions();
      setMessage("제보 기록을 삭제했습니다.");
    } catch (error) {
      console.error(error);
      setMessage("삭제 처리 중 오류가 발생했습니다.");
    } finally {
      setProcessingId("");
    }
  }

  async function handleLogout() {
    await supabase.auth.signOut();
    router.push("/admin/login");
    router.refresh();
  }

  if (adminState === "checking") {
    return (
      <main className="min-h-screen bg-neutral-100 px-4 py-10">
        <section className="mx-auto max-w-md rounded-3xl bg-white p-6 text-sm text-neutral-500 shadow-sm">
          관리자 권한을 확인하는 중입니다.
        </section>
      </main>
    );
  }

  if (adminState === "signed-out") {
    return (
      <main className="min-h-screen bg-neutral-100 px-4 py-10">
        <section className="mx-auto max-w-md rounded-3xl bg-white p-6 shadow-sm">
          <h1 className="text-2xl font-black text-neutral-950">
            로그인이 필요합니다
          </h1>

          <p className="mt-2 text-sm leading-6 text-neutral-500">
            제보 관리는 관리자 로그인 후 이용할 수 있습니다.
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

  if (adminState === "not-admin") {
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
        <div className="overflow-hidden rounded-[28px] border border-neutral-200/70 bg-white shadow-[0_8px_26px_rgba(15,23,42,0.032)]">
          <header className="border-b border-neutral-200/70 bg-[linear-gradient(135deg,#f8fafc_0%,#eef2ff_52%,#fdf2f8_100%)] p-5">
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
            <p className="text-xs font-black uppercase tracking-[0.2em] text-neutral-500">
              Submissions
            </p>

            <h1 className="mt-1 text-2xl font-black text-neutral-950">
              이미지 제보 관리
            </h1>

            <p className="mt-2 text-sm leading-6 text-neutral-500">
              유저가 제보한 이미지를 확인하고 교환판 반영 여부를 결정합니다.
            </p>
          </div>

          <div className="mt-5 rounded-2xl border border-white/60 bg-white/65 p-4 text-xs leading-6 text-neutral-600 shadow-[0_8px_20px_rgba(15,23,42,0.025)]">
            <p>대기 중인 제보: {pendingCount}개</p>
            <p>승인하면 공개 교환판에 즉시 반영됩니다.</p>
          </div>
          </header>

          {message ? (
            <p className="mx-5 mt-5 rounded-2xl border border-neutral-200/70 bg-neutral-50/80 px-4 py-3 text-sm leading-6 text-neutral-700">
            {message}
          </p>
        ) : null}

          <div className="p-5">
            <div className="flex gap-2 overflow-x-auto pb-1">
          <StatusFilterButton
            label="대기"
            active={statusFilter === "pending"}
            onClick={() => setStatusFilter("pending")}
          />
          <StatusFilterButton
            label="승인"
            active={statusFilter === "approved"}
            onClick={() => setStatusFilter("approved")}
          />
          <StatusFilterButton
            label="반려"
            active={statusFilter === "rejected"}
            onClick={() => setStatusFilter("rejected")}
          />
          <StatusFilterButton
            label="전체"
            active={statusFilter === "all"}
            onClick={() => setStatusFilter("all")}
          />
        </div>

            <div className="mt-5 space-y-4">
          {filteredSubmissions.length > 0 ? (
            filteredSubmissions.map((submission) => {
              const signedUrl = signedUrlById[submission.id];
              const isProcessing = processingId === submission.id;
              const categoryLabel = getCategoryLabel(submission.category);

              return (
                <article
                  key={submission.id}
                  className="overflow-hidden rounded-3xl bg-white shadow-sm"
                >
                  <div className="relative aspect-[3/4] bg-neutral-100">
                    {signedUrl ? (
                      <img
                        src={signedUrl}
                        alt={submission.work_title}
                        className="h-full w-full bg-white object-contain p-1"
                      />
                    ) : (
                      <div className="flex h-full items-center justify-center px-4 text-center text-xs text-neutral-400">
                        이미지를 불러오지 못했습니다.
                      </div>
                    )}

                    <span
                      className={
                        submission.status === "approved"
                          ? "absolute right-3 top-3 rounded-full bg-green-50 px-3 py-1 text-xs font-black text-green-700"
                          : submission.status === "rejected"
                            ? "absolute right-3 top-3 rounded-full bg-red-50 px-3 py-1 text-xs font-black text-red-600"
                            : "absolute right-3 top-3 rounded-full bg-white px-3 py-1 text-xs font-black text-neutral-950"
                      }
                    >
                      {submission.status === "approved"
                        ? "승인"
                        : submission.status === "rejected"
                          ? "반려"
                          : "대기"}
                    </span>
                  </div>

                  <div className="p-5">
                    <p className="text-xs font-black text-neutral-400">
                      {submission.collection_title}
                    </p>

                    <h2 className="mt-1 text-lg font-black text-neutral-950">
                      {submission.work_title}
                    </h2>

                    <div className="mt-3 space-y-1 text-sm leading-6 text-neutral-600">
                      <p>굿즈 종류: {categoryLabel}</p>
                      {submission.category === "benefit" ? (
                        <p>
                          특전 하위 분류:{" "}
                          {submission.benefit_subcategory || "선택 안 함"}
                        </p>
                      ) : null}
                      <p>
                        제보일:{" "}
                        {new Date(submission.created_at).toLocaleString(
                          "ko-KR",
                        )}
                      </p>
                    </div>

                    <label className="mt-4 block">
                      <span className="text-sm font-bold text-neutral-800">
                        관리자 메모
                      </span>

                      <textarea
                        value={adminNoteById[submission.id] ?? ""}
                        onChange={(event) =>
                          setAdminNoteById((prev) => ({
                            ...prev,
                            [submission.id]: event.target.value,
                          }))
                        }
                        disabled={submission.status !== "pending"}
                        className="mt-1 min-h-20 w-full rounded-2xl border border-neutral-200 px-4 py-3 text-sm outline-none focus:border-neutral-950 disabled:bg-neutral-50 disabled:text-neutral-400"
                        placeholder="내부 메모 또는 반려 사유"
                      />
                    </label>

                    {submission.status === "pending" ? (
                      <div className="mt-4 grid grid-cols-2 gap-2">
                        <button
                          type="button"
                          onClick={() => handleReject(submission)}
                          disabled={isProcessing}
                          className="rounded-2xl border border-red-200 bg-red-50 px-4 py-3 text-sm font-black text-red-600 disabled:cursor-not-allowed disabled:opacity-50"
                        >
                          {isProcessing ? "처리 중..." : "반려"}
                        </button>

                        <button
                          type="button"
                          onClick={() => handleApprove(submission)}
                          disabled={isProcessing}
                          className="rounded-2xl bg-neutral-950 px-4 py-3 text-sm font-black text-white disabled:cursor-not-allowed disabled:bg-neutral-300"
                        >
                          {isProcessing ? "처리 중..." : "승인"}
                        </button>
                      </div>
                    ) : (
                      <div className="mt-4 grid grid-cols-2 gap-2">
                        {submission.status === "approved" ? (
                          <Link
                            href={`/trade/${submission.collection_slug}`}
                            className="rounded-2xl bg-neutral-950 px-4 py-3 text-center text-sm font-black text-white"
                          >
                            교환판 보기
                          </Link>
                        ) : (
                          <div />
                        )}

                        <button
                          type="button"
                          onClick={() => handleDeleteSubmission(submission)}
                          disabled={isProcessing}
                          className="rounded-2xl border border-red-200 bg-red-50 px-4 py-3 text-sm font-black text-red-600 disabled:cursor-not-allowed disabled:opacity-50"
                        >
                          {isProcessing ? "삭제 중..." : "기록 삭제"}
                        </button>
                      </div>
                    )}
                  </div>
                </article>
              );
            })
          ) : (
            <div className="rounded-3xl bg-white px-5 py-10 text-center shadow-sm">
              <p className="text-sm font-bold text-neutral-500">
                표시할 제보가 없습니다.
              </p>
            </div>
          )}
            </div>
          </div>
        </div>
      </section>
    </main>
  );
}

type StatusFilterButtonProps = {
  label: string;
  active: boolean;
  onClick: () => void;
};

function StatusFilterButton({
  label,
  active,
  onClick,
}: StatusFilterButtonProps) {
  return (
    <button
      type="button"
      onClick={onClick}
      className={
        active
          ? "shrink-0 rounded-full bg-neutral-950 px-4 py-2 text-xs font-black text-white"
          : "shrink-0 rounded-full border border-neutral-200 bg-white px-4 py-2 text-xs font-bold text-neutral-600"
      }
    >
      {label}
    </button>
  );
}
