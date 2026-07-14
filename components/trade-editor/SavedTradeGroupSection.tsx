"use client";

import Link from "next/link";
import { MAX_TRADE_GROUPS } from "@/lib/trade-groups";
import { TradeCollectionSummary } from "@/lib/trade-types";

type SavedTradeGroupSectionProps = {
  collection: TradeCollectionSummary;
  userAuthState: "checking" | "signed-in" | "signed-out";
  savedGroupCount: number;
  activeGroupId: string;
  groupName: string;
  groupSaveMessage: string;
  isSavingGroup: boolean;
  isLoadingGroup: boolean;
  directUploadCardCount: number;
  onGroupNameChange: (value: string) => void;
  onSave: () => void;
  onStartNew: () => void;
};

export function SavedTradeGroupSection({
  collection,
  userAuthState,
  savedGroupCount,
  activeGroupId,
  groupName,
  groupSaveMessage,
  isSavingGroup,
  isLoadingGroup,
  directUploadCardCount,
  onGroupNameChange,
  onSave,
  onStartNew,
}: SavedTradeGroupSectionProps) {
  return (
    <section className="mt-8 rounded-2xl border border-neutral-200 bg-neutral-50 p-4">
      <div className="flex items-start justify-between gap-3">
        <div>
          <p className="text-sm font-black text-neutral-950">내 교환판 저장</p>
          <p className="mt-1 text-xs leading-5 text-neutral-400">
            로그인하면 그룹을 최대 {MAX_TRADE_GROUPS}개까지 저장하고 다시 수정할 수 있습니다.
          </p>
        </div>

        {userAuthState === "signed-in" ? (
          <Link
            href="/my-trades"
            className="shrink-0 rounded-full bg-white px-3 py-1.5 text-[11px] font-black text-neutral-500 ring-1 ring-neutral-200"
          >
            {savedGroupCount}/{MAX_TRADE_GROUPS}
          </Link>
        ) : null}
      </div>

      {userAuthState === "checking" || isLoadingGroup ? (
        <p className="mt-4 rounded-xl bg-white px-3 py-3 text-xs text-neutral-500 ring-1 ring-neutral-200">
          계정과 저장 교환판을 확인하는 중입니다.
        </p>
      ) : userAuthState === "signed-out" ? (
        <div className="mt-4 grid grid-cols-2 gap-2">
          <Link
            href={`/login?next=${encodeURIComponent(`/trade/${collection.slug}`)}`}
            className="rounded-xl bg-neutral-950 px-3 py-3 text-center text-xs font-black text-white"
          >
            로그인
          </Link>
          <Link
            href="/signup"
            className="rounded-xl border border-neutral-300 bg-white px-3 py-3 text-center text-xs font-black text-neutral-600"
          >
            회원가입
          </Link>
        </div>
      ) : (
        <div className="mt-4">
          <label className="block">
            <span className="text-[11px] font-black text-neutral-500">
              {activeGroupId ? "현재 그룹 이름" : "새 교환판 이름"}
            </span>
            <input
              value={groupName}
              onChange={(event) => onGroupNameChange(event.target.value)}
              maxLength={40}
              className="mt-1 w-full rounded-xl border border-neutral-200 bg-white px-3 py-3 text-sm outline-none focus:border-neutral-950"
              placeholder="예: 토요일 현장 교환"
            />
          </label>

          <button
            type="button"
            onClick={onSave}
            disabled={
              isSavingGroup ||
              (!activeGroupId && savedGroupCount >= MAX_TRADE_GROUPS)
            }
            className="mt-3 w-full rounded-xl bg-neutral-950 px-4 py-3 text-xs font-black text-white disabled:cursor-not-allowed disabled:bg-neutral-300"
          >
            {isSavingGroup
              ? "저장 중..."
              : activeGroupId
                ? "현재 그룹에 저장"
                : "새 그룹으로 저장"}
          </button>

          {activeGroupId ? (
            <button
              type="button"
              onClick={onStartNew}
              disabled={savedGroupCount >= MAX_TRADE_GROUPS}
              className="mt-2 w-full rounded-xl border border-neutral-300 bg-white px-4 py-3 text-xs font-black text-neutral-600 disabled:cursor-not-allowed disabled:border-neutral-200 disabled:bg-neutral-100 disabled:text-neutral-300"
            >
              {savedGroupCount >= MAX_TRADE_GROUPS
                ? `최대 ${MAX_TRADE_GROUPS}개 저장됨`
                : "현재 내용으로 새 그룹 만들기"}
            </button>
          ) : null}

          {directUploadCardCount > 0 ? (
            <p className="mt-2 text-[11px] leading-5 text-amber-700">
              직접 추가한 이미지 {directUploadCardCount}개는 현재 그룹 저장에서 제외됩니다. PNG 저장에는 그대로 포함됩니다.
            </p>
          ) : null}
        </div>
      )}

      {groupSaveMessage ? (
        <p className="mt-3 rounded-xl bg-white px-3 py-3 text-xs leading-5 text-neutral-600 ring-1 ring-neutral-200">
          {groupSaveMessage}
        </p>
      ) : null}
    </section>
  );
}
