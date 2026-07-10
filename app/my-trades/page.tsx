'use client';

import Link from 'next/link';
import { useEffect, useMemo, useState } from 'react';
import { useRouter } from 'next/navigation';
import { supabase } from '@/lib/supabase';
import { MAX_TRADE_GROUPS, TradeGroupRow } from '@/lib/trade-groups';

type AuthState = 'checking' | 'signed-in' | 'signed-out';

type CollectionInfo = {
  id: string;
  slug: string;
  title: string;
};

function formatUpdatedAt(value: string) {
  return new Intl.DateTimeFormat('ko-KR', {
    timeZone: 'Asia/Seoul',
    year: 'numeric',
    month: '2-digit',
    day: '2-digit',
    hour: '2-digit',
    minute: '2-digit',
  }).format(new Date(value));
}

function getGroupCardCounts(group: TradeGroupRow) {
  const cards = Array.isArray(group.board_data?.cards)
    ? group.board_data.cards
    : [];

  return cards.reduce(
    (counts, card) => {
      const quantity =
        Number.isFinite(card.quantity) && card.quantity > 0
          ? Math.floor(card.quantity)
          : 1;

      if (card.side === 'have') {
        counts.have += quantity;
      } else if (card.side === 'want') {
        counts.want += quantity;
      }

      return counts;
    },
    { have: 0, want: 0 },
  );
}

export default function MyTradesPage() {
  const router = useRouter();
  const [authState, setAuthState] = useState<AuthState>('checking');
  const [groups, setGroups] = useState<TradeGroupRow[]>([]);
  const [collections, setCollections] = useState<Record<string, CollectionInfo>>({});
  const [message, setMessage] = useState('');
  const [isLoading, setIsLoading] = useState(true);
  const [deletingId, setDeletingId] = useState('');
  const [currentUserId, setCurrentUserId] = useState('');

  useEffect(() => {
    let isMounted = true;

    async function loadGroups() {
      const { data: sessionData } = await supabase.auth.getSession();
      const user = sessionData.session?.user;

      if (!isMounted) return;

      if (!user) {
        setAuthState('signed-out');
        setIsLoading(false);
        return;
      }

      setAuthState('signed-in');
      setCurrentUserId(user.id);

      const { data, error } = await supabase
        .from('trade_groups')
        .select('id, user_id, collection_id, name, board_data, created_at, updated_at')
        .eq('user_id', user.id)
        .order('updated_at', { ascending: false });

      if (!isMounted) return;

      if (error) {
        console.error(error);
        setMessage('저장한 교환판을 불러오지 못했습니다. Supabase SQL과 RLS를 확인해 주세요.');
        setIsLoading(false);
        return;
      }

      const nextGroups = (data ?? []) as TradeGroupRow[];
      setGroups(nextGroups);

      const collectionIds = Array.from(
        new Set(nextGroups.map((group) => group.collection_id)),
      );

      if (collectionIds.length > 0) {
        const { data: collectionData, error: collectionError } = await supabase
          .from('trade_collections')
          .select('id, slug, title')
          .in('id', collectionIds);

        if (!isMounted) return;

        if (collectionError) {
          console.error(collectionError);
        } else {
          const map = Object.fromEntries(
            ((collectionData ?? []) as CollectionInfo[]).map((collection) => [
              collection.id,
              collection,
            ]),
          );
          setCollections(map);
        }
      }

      setIsLoading(false);
    }

    void loadGroups();

    return () => {
      isMounted = false;
    };
  }, []);

  const canCreateGroup = groups.length < MAX_TRADE_GROUPS;

  const sortedGroups = useMemo(
    () => [...groups].sort((a, b) => b.updated_at.localeCompare(a.updated_at)),
    [groups],
  );

  async function handleDelete(groupId: string) {
    const target = groups.find((group) => group.id === groupId);
    if (!target || !currentUserId) return;

    const confirmed = window.confirm(`“${target.name}” 교환판을 삭제할까요?`);
    if (!confirmed) return;

    try {
      setDeletingId(groupId);
      setMessage('');

      const { data, error } = await supabase
        .from('trade_groups')
        .delete()
        .eq('id', groupId)
        .eq('user_id', currentUserId)
        .select('id')
        .maybeSingle();

      if (error || !data) {
        if (error) console.error(error);
        setMessage('교환판을 삭제하지 못했습니다.');
        return;
      }

      setGroups((current) => current.filter((group) => group.id !== groupId));
      setMessage('교환판을 삭제했습니다.');
    } finally {
      setDeletingId('');
    }
  }

  async function handleLogout() {
    await supabase.auth.signOut();
    router.push('/');
    router.refresh();
  }

  if (authState === 'checking' || isLoading) {
    return (
      <main className="w-full bg-neutral-100 px-4 py-5 sm:py-6">
        <section className="mx-auto max-w-md rounded-[28px] border border-neutral-200/70 bg-white p-5 text-sm text-neutral-500 sm:max-w-lg">
          저장한 교환판을 불러오는 중입니다.
        </section>
      </main>
    );
  }

  if (authState === 'signed-out') {
    return (
      <main className="w-full bg-neutral-100 px-4 py-5 sm:py-6">
        <section className="mx-auto max-w-md rounded-[28px] border border-neutral-200/70 bg-white p-5 sm:max-w-lg">
          <h1 className="text-2xl font-black text-neutral-950">로그인이 필요합니다</h1>
          <p className="mt-2 text-sm leading-6 text-neutral-500">
            교환판 그룹은 로그인한 사용자만 저장하고 불러올 수 있습니다.
          </p>
          <Link
            href="/login?next=/my-trades"
            className="mt-6 inline-flex rounded-2xl bg-neutral-950 px-5 py-3 text-sm font-black text-white"
          >
            로그인
          </Link>
        </section>
      </main>
    );
  }

  return (
    <main className="w-full bg-neutral-100 px-4 py-5 sm:py-6">
      <section className="mx-auto max-w-md overflow-hidden rounded-[28px] border border-neutral-200/70 bg-white shadow-[0_8px_26px_rgba(15,23,42,0.032)] sm:max-w-lg">
        <header className="border-b border-neutral-200/70 bg-[linear-gradient(135deg,#efe7ff_0%,#d8efff_48%,#ffe1f2_100%)] p-5">
          <div className="flex items-center justify-between gap-3">
            <Link
              href="/"
              className="rounded-full border border-white/70 bg-white/75 px-4 py-2 text-xs font-bold text-neutral-600"
            >
              ← 메인으로
            </Link>
            <button
              type="button"
              onClick={handleLogout}
              className="rounded-full border border-white/70 bg-white/75 px-4 py-2 text-xs font-bold text-neutral-600"
            >
              로그아웃
            </button>
          </div>

          <h1 className="mt-6 text-2xl font-black text-neutral-950">내 교환판</h1>
          <p className="mt-2 text-sm leading-6 text-neutral-600">
            저장한 교환판을 다시 열어 교환 완료 굿즈만 삭제하고 계속 수정할 수 있습니다.
          </p>
        </header>

        <div className="p-5">
          <div className="flex items-center justify-between gap-3">
            <p className="text-sm font-black text-neutral-950">
              저장 그룹 {groups.length}/{MAX_TRADE_GROUPS}
            </p>
            <Link
              href="/"
              aria-disabled={!canCreateGroup}
              className={
                canCreateGroup
                  ? 'rounded-xl bg-neutral-950 px-4 py-2.5 text-xs font-black text-white'
                  : 'pointer-events-none rounded-xl bg-neutral-200 px-4 py-2.5 text-xs font-black text-neutral-400'
              }
            >
              새 교환판 만들기
            </Link>
          </div>

          {message ? (
            <p className="mt-4 rounded-2xl bg-neutral-100 px-4 py-3 text-sm leading-6 text-neutral-700">
              {message}
            </p>
          ) : null}

          {sortedGroups.length > 0 ? (
            <div className="mt-4 space-y-3">
              {sortedGroups.map((group) => {
                const collection = collections[group.collection_id];
                const editHref = collection
                  ? `/trade/${collection.slug}?group=${group.id}`
                  : '';
                const cardCounts = getGroupCardCounts(group);

                return (
                  <article
                    key={group.id}
                    className="rounded-2xl border border-neutral-200 bg-neutral-50 p-4"
                  >
                    <p className="text-base font-black text-neutral-950">{group.name}</p>
                    <p className="mt-1 text-xs font-bold text-neutral-500">
                      {collection?.title ?? '행사 정보를 찾을 수 없음'}
                    </p>
                    <p className="mt-1 text-[11px] font-bold text-neutral-500">
                      있어요 {cardCounts.have}개 · 구해요 {cardCounts.want}개
                    </p>
                    <p className="mt-1 text-[11px] text-neutral-400">
                      최근 저장 {formatUpdatedAt(group.updated_at)}
                    </p>

                    <div className="mt-4 grid grid-cols-2 gap-2">
                      {editHref ? (
                        <Link
                          href={editHref}
                          className="rounded-xl bg-neutral-950 px-3 py-3 text-center text-xs font-black text-white"
                        >
                          열어서 수정
                        </Link>
                      ) : (
                        <span className="rounded-xl bg-neutral-200 px-3 py-3 text-center text-xs font-black text-neutral-400">
                          행사 없음
                        </span>
                      )}
                      <button
                        type="button"
                        onClick={() => handleDelete(group.id)}
                        disabled={deletingId === group.id}
                        className="rounded-xl border border-neutral-300 bg-white px-3 py-3 text-xs font-black text-neutral-600 disabled:text-neutral-300"
                      >
                        {deletingId === group.id ? '삭제 중...' : '삭제'}
                      </button>
                    </div>
                  </article>
                );
              })}
            </div>
          ) : (
            <div className="mt-4 rounded-2xl border border-dashed border-neutral-200 bg-neutral-50 px-4 py-10 text-center">
              <p className="text-sm font-bold text-neutral-400">
                아직 저장한 교환판이 없습니다.
              </p>
            </div>
          )}
        </div>
      </section>
    </main>
  );
}
