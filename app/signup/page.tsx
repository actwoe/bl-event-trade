'use client';

import Link from 'next/link';
import { AppBottomNav } from '@/components/ui/AppBottomNav';
import { AppFrame } from '@/components/ui/AppFrame';
import { AppTopBar } from '@/components/ui/AppTopBar';
import { FormEvent, useState } from 'react';
import { useRouter } from 'next/navigation';
import { supabase } from '@/lib/supabase';
import {
  ADMIN_LOGIN_ID,
  getAuthEmailFromLoginId,
  isValidLoginId,
  normalizeLoginId,
} from '@/lib/auth-identity';

export default function SignupPage() {
  const router = useRouter();
  const [loginId, setLoginId] = useState('');
  const [password, setPassword] = useState('');
  const [passwordConfirm, setPasswordConfirm] = useState('');
  const [message, setMessage] = useState('');
  const [isSubmitting, setIsSubmitting] = useState(false);

  async function handleSubmit(event: FormEvent<HTMLFormElement>) {
    event.preventDefault();

    const normalizedLoginId = normalizeLoginId(loginId);

    if (!normalizedLoginId || !password || !passwordConfirm) {
      setMessage('모든 항목을 입력해 주세요.');
      return;
    }

    if (!isValidLoginId(normalizedLoginId)) {
      setMessage('아이디는 영문 소문자, 숫자, 밑줄을 사용해 4~20자로 입력해 주세요.');
      return;
    }

    if (normalizedLoginId === ADMIN_LOGIN_ID) {
      setMessage('사용할 수 없는 아이디입니다.');
      return;
    }

    if (password.length < 8) {
      setMessage('비밀번호는 8자 이상으로 입력해 주세요.');
      return;
    }

    if (password !== passwordConfirm) {
      setMessage('비밀번호가 서로 일치하지 않습니다.');
      return;
    }

    try {
      setIsSubmitting(true);
      setMessage('');

      const { data, error } = await supabase.auth.signUp({
        email: getAuthEmailFromLoginId(normalizedLoginId),
        password,
        options: {
          data: {
            login_id: normalizedLoginId,
          },
        },
      });

      if (error) {
        const isDuplicate =
          error.message.toLowerCase().includes('already registered') ||
          error.message.toLowerCase().includes('already exists');

        setMessage(
          isDuplicate
            ? '이미 사용 중인 아이디입니다.'
            : '회원가입을 완료하지 못했습니다. 입력 내용을 확인해 주세요.',
        );
        return;
      }

      if (data.session) {
        router.push('/');
        router.refresh();
        return;
      }

      setMessage('회원가입을 완료하지 못했습니다. 관리자에게 문의해 주세요.');
    } catch (error) {
      console.error(error);
      setMessage('회원가입 중 오류가 발생했습니다.');
    } finally {
      setIsSubmitting(false);
    }
  }

  return (
    <AppFrame>
      <AppTopBar title="회원가입" backHref="/" showAccount={false} />
      <div className="min-h-0 flex-1 overflow-y-auto overscroll-contain">
        <header className="border-b border-neutral-100 bg-white p-5 pt-6">
          <p className="text-[11px] font-black uppercase tracking-[0.18em] text-[#7C5CFC]">
            BL GOODS TRADE
          </p>
          <h1 className="mt-1 text-[25px] font-black leading-tight tracking-[-0.03em] text-neutral-950">
            회원가입
          </h1>
          <div className="mt-2 space-y-1 text-sm leading-6 text-neutral-500">
            <p>회원가입을 하지 않아도 교환판을 만들 수 있습니다.</p>
            <p>회원가입하면 교환판 그룹을 최대 3개까지 저장할 수 있습니다.</p>
          </div>
        </header>

        <form onSubmit={handleSubmit} className="space-y-4 p-5">
          <label className="block">
            <span className="text-sm font-bold text-neutral-800">아이디</span>
            <input
              type="text"
              value={loginId}
              onChange={(event) => setLoginId(event.target.value)}
              className="mt-1 w-full rounded-2xl border border-neutral-200 px-4 py-3 text-sm outline-none focus:border-[#7C5CFC]"
              autoComplete="username"
              autoCapitalize="none"
              spellCheck={false}
              placeholder="영문 소문자, 숫자, 밑줄 4~20자"
            />
          </label>

          <label className="block">
            <span className="text-sm font-bold text-neutral-800">비밀번호</span>
            <input
              type="password"
              value={password}
              onChange={(event) => setPassword(event.target.value)}
              className="mt-1 w-full rounded-2xl border border-neutral-200 px-4 py-3 text-sm outline-none focus:border-[#7C5CFC]"
              autoComplete="new-password"
              placeholder="8자 이상"
            />
          </label>

          <label className="block">
            <span className="text-sm font-bold text-neutral-800">비밀번호 확인</span>
            <input
              type="password"
              value={passwordConfirm}
              onChange={(event) => setPasswordConfirm(event.target.value)}
              className="mt-1 w-full rounded-2xl border border-neutral-200 px-4 py-3 text-sm outline-none focus:border-[#7C5CFC]"
              autoComplete="new-password"
              placeholder="비밀번호 다시 입력"
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
            {isSubmitting ? '가입 중...' : '회원가입'}
          </button>

          <p className="text-center text-xs leading-5 text-neutral-500">
            이미 계정이 있다면{' '}
            <Link href="/login" className="font-black text-neutral-950 underline">
              로그인
            </Link>
          </p>
        </form>
      </div>
      <AppBottomNav active="login" />
    </AppFrame>
  );
}
