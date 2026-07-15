'use client';

import Link from 'next/link';
import { useEffect, useState } from 'react';
import { useRouter } from 'next/navigation';
import { supabase } from '@/lib/supabase';

type AuthState = 'checking' | 'signed-in' | 'signed-out';

type UserAuthLinksProps = {
  className?: string;
  variant?: 'buttons' | 'icon';
};

function AccountIcon() {
  return (
    <svg
      viewBox="0 0 24 24"
      aria-hidden="true"
      className="h-5 w-5 fill-none stroke-current"
      strokeWidth="1.8"
    >
      <circle cx="12" cy="8" r="3.5" />
      <path d="M5.5 20c.6-4 2.9-6 6.5-6s5.9 2 6.5 6" />
    </svg>
  );
}

export function UserAuthLinks({
  className = '',
  variant = 'buttons',
}: UserAuthLinksProps) {
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

  if (variant === 'icon') {
    const accountClassName = `flex h-11 w-11 shrink-0 items-center justify-center rounded-full border border-neutral-200 bg-white text-neutral-900 shadow-sm transition hover:border-neutral-300 hover:bg-neutral-50 ${className}`;

    if (authState === 'checking') {
      return (
        <span
          aria-label="계정 확인 중"
          className={`${accountClassName} text-neutral-300`}
        >
          <AccountIcon />
        </span>
      );
    }

    return (
      <Link
        href={authState === 'signed-in' ? '/my-trades' : '/login'}
        aria-label={authState === 'signed-in' ? '내 교환판' : '로그인'}
        className={accountClassName}
      >
        <AccountIcon />
      </Link>
    );
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
