'use client';

import Link from 'next/link';
import { useEffect, useState } from 'react';
import { useRouter } from 'next/navigation';
import { supabase } from '@/lib/supabase';

type AuthState = 'checking' | 'signed-in' | 'signed-out';

type UserAuthLinksProps = {
  className?: string;
};

export function UserAuthLinks({ className = '' }: UserAuthLinksProps) {
  const router = useRouter();
  const [authState, setAuthState] = useState<AuthState>('checking');

  useEffect(() => {
    let isMounted = true;

    async function loadSession() {
      const { data } = await supabase.auth.getSession();

      if (!isMounted) return;
      setAuthState(data.session?.user ? 'signed-in' : 'signed-out');
    }

    void loadSession();

    const { data: listener } = supabase.auth.onAuthStateChange((_event, session) => {
      if (!isMounted) return;
      setAuthState(session?.user ? 'signed-in' : 'signed-out');
    });

    return () => {
      isMounted = false;
      listener.subscription.unsubscribe();
    };
  }, []);

  async function handleLogout() {
    await supabase.auth.signOut();
    router.push('/');
    router.refresh();
  }

  if (authState === 'checking') {
    return (
      <div className={`flex items-center gap-2 ${className}`}>
        <span className="rounded-full border border-white/70 bg-white/75 px-3 py-2 text-[11px] font-bold text-neutral-400">
          계정 확인 중
        </span>
      </div>
    );
  }

  if (authState === 'signed-in') {
    return (
      <div className={`flex flex-wrap items-center gap-2 ${className}`}>
        <Link
          href="/my-trades"
          className="rounded-full border border-white/70 bg-white/75 px-3 py-2 text-[11px] font-bold text-neutral-600 transition hover:bg-white hover:text-neutral-950"
        >
          내 교환판
        </Link>
        <button
          type="button"
          onClick={handleLogout}
          className="rounded-full border border-white/70 bg-white/75 px-3 py-2 text-[11px] font-bold text-neutral-600 transition hover:bg-white hover:text-neutral-950"
        >
          로그아웃
        </button>
      </div>
    );
  }

  return (
    <div className={`flex flex-wrap items-center gap-2 ${className}`}>
      <Link
        href="/login"
        className="rounded-full border border-white/70 bg-white/75 px-3 py-2 text-[11px] font-bold text-neutral-600 transition hover:bg-white hover:text-neutral-950"
      >
        로그인
      </Link>
      <Link
        href="/signup"
        className="rounded-full border border-white/70 bg-white/75 px-3 py-2 text-[11px] font-bold text-neutral-600 transition hover:bg-white hover:text-neutral-950"
      >
        회원가입
      </Link>
    </div>
  );
}
