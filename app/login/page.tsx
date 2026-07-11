'use client';

import Link from 'next/link';
import { FormEvent, useState } from 'react';
import { useRouter } from 'next/navigation';
import { supabase } from '@/lib/supabase';
import {
  ADMIN_LOGIN_ID,
  getAuthEmailFromLoginId,
  isValidLoginId,
  normalizeLoginId,
} from '@/lib/auth-identity';

function getNextPath() {
  if (typeof window === 'undefined') return '/my-trades';

  const next = new URLSearchParams(window.location.search).get('next');

  if (!next || !next.startsWith('/') || next.startsWith('//')) {
    return '/my-trades';
  }

  return next;
}

export default function LoginPage() {
  const router = useRouter();
  const [loginId, setLoginId] = useState('');
  const [password, setPassword] = useState('');
  const [message, setMessage] = useState('');
  const [isSubmitting, setIsSubmitting] = useState(false);

  async function handleSubmit(event: FormEvent<HTMLFormElement>) {
    event.preventDefault();

    const normalizedLoginId = normalizeLoginId(loginId);

    if (!normalizedLoginId || !password) {
      setMessage('아이디와 비밀번호를 입력해 주세요.');
      return;
    }

    if (!isValidLoginId(normalizedLoginId) && normalizedLoginId !== ADMIN_LOGIN_ID) {
      setMessage('아이디 또는 비밀번호가 올바르지 않습니다.');
      return;
    }

    try {
      setIsSubmitting(true);
      setMessage('');

      const { data: loginData, error: loginError } =
        await supabase.auth.signInWithPassword({
          email: getAuthEmailFromLoginId(normalizedLoginId),
          password,
        });

      if (loginError || !loginData.user) {
        setMessage('아이디 또는 비밀번호가 올바르지 않습니다.');
        return;
      }

      if (normalizedLoginId === ADMIN_LOGIN_ID) {
        const { data: adminUser, error: adminError } = await supabase
          .from('admin_users')
          .select('user_id')
          .eq('user_id', loginData.user.id)
          .maybeSingle();

        if (adminError || !adminUser) {
          if (adminError) console.error(adminError);
          await supabase.auth.signOut();
          setMessage('관리자 권한을 확인할 수 없습니다.');
          return;
        }

        router.push('/admin');
        router.refresh();
        return;
      }

      router.push(getNextPath());
      router.refresh();
    } catch (error) {
      console.error(error);
      setMessage('로그인 중 오류가 발생했습니다.');
    } finally {
      setIsSubmitting(false);
    }
  }

  return (
    <main className="w-full bg-neutral-100 px-4 py-5 sm:py-6">
      <section className="mx-auto max-w-md overflow-hidden rounded-[28px] border border-neutral-200/70 bg-white shadow-[0_8px_26px_rgba(15,23,42,0.032)] sm:max-w-lg">
        <header className="border-b border-neutral-200/70 bg-[linear-gradient(135deg,#efe7ff_0%,#d8efff_48%,#ffe1f2_100%)] p-5">
          <Link
            href="/"
            className="inline-flex rounded-full border border-white/70 bg-white/75 px-4 py-2 text-xs font-bold text-neutral-600"
          >
            ← 메인으로
          </Link>
          <h1 className="mt-6 text-2xl font-black text-neutral-950">로그인</h1>
          <p className="mt-2 text-sm leading-6 text-neutral-600">
            로그인 시 기존에 만든 교환판을 불러와 편리하게 수정할 수 있습니다.
          </p>
        </header>

        <form onSubmit={handleSubmit} className="space-y-4 p-5">
          <label className="block">
            <span className="text-sm font-bold text-neutral-800">아이디</span>
            <input
              type="text"
              value={loginId}
              onChange={(event) => setLoginId(event.target.value)}
              className="mt-1 w-full rounded-2xl border border-neutral-200 px-4 py-3 text-sm outline-none focus:border-neutral-950"
              autoComplete="username"
              autoCapitalize="none"
              spellCheck={false}
              placeholder="아이디"
            />
          </label>

          <label className="block">
            <span className="text-sm font-bold text-neutral-800">비밀번호</span>
            <input
              type="password"
              value={password}
              onChange={(event) => setPassword(event.target.value)}
              className="mt-1 w-full rounded-2xl border border-neutral-200 px-4 py-3 text-sm outline-none focus:border-neutral-950"
              autoComplete="current-password"
              placeholder="비밀번호"
            />
          </label>

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
            {isSubmitting ? '로그인 중...' : '로그인'}
          </button>

          <p className="text-center text-xs leading-5 text-neutral-500">
            아직 계정이 없다면{' '}
            <Link href="/signup" className="font-black text-neutral-950 underline">
              회원가입
            </Link>
          </p>
        </form>
      </section>
    </main>
  );
}
