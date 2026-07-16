'use client';

import { FormEvent, useState } from 'react';
import { useRouter } from 'next/navigation';
import { supabase } from '@/lib/supabase';

const ADMIN_LOGIN_ID = 'admin';
const ADMIN_AUTH_EMAIL = 'admin@goods-trade.local';

function getAuthEmailFromLoginId(loginId: string) {
  const normalizedLoginId = loginId.trim().toLowerCase();

  if (normalizedLoginId === ADMIN_LOGIN_ID) {
    return ADMIN_AUTH_EMAIL;
  }

  return normalizedLoginId;
}

export default function AdminLoginPage() {
  const router = useRouter();

  const [loginId, setLoginId] = useState('');
  const [password, setPassword] = useState('');
  const [message, setMessage] = useState('');
  const [isSubmitting, setIsSubmitting] = useState(false);

  async function handleSubmit(event: FormEvent<HTMLFormElement>) {
    event.preventDefault();

    const normalizedLoginId = loginId.trim().toLowerCase();

    if (!normalizedLoginId || !password) {
      setMessage('ID와 비밀번호를 입력해 주세요.');
      return;
    }

    if (normalizedLoginId !== ADMIN_LOGIN_ID) {
      setMessage('로그인 정보가 올바르지 않습니다.');
      return;
    }

    try {
      setIsSubmitting(true);
      setMessage('');

      const authEmail = getAuthEmailFromLoginId(normalizedLoginId);

      const { data: loginData, error: loginError } =
        await supabase.auth.signInWithPassword({
          email: authEmail,
          password,
        });

      if (loginError || !loginData.user) {
        setMessage('로그인 정보가 올바르지 않습니다.');
        return;
      }

      const { data: adminUser, error: adminError } = await supabase
        .from('admin_users')
        .select('user_id')
        .eq('user_id', loginData.user.id)
        .maybeSingle();

      if (adminError) {
        console.error(adminError);
        await supabase.auth.signOut();
        setMessage('관리자 권한을 확인할 수 없습니다. RLS 정책을 확인해 주세요.');
        return;
      }

      if (!adminUser) {
        await supabase.auth.signOut();
        setMessage('관리자 권한이 없는 계정입니다.');
        return;
      }

      router.push('/admin');
      router.refresh();
    } catch (error) {
      console.error(error);
      setMessage('로그인 중 오류가 발생했습니다.');
    } finally {
      setIsSubmitting(false);
    }
  }

  return (
    <main className="min-h-full bg-[#fafafa]">
      <header className="border-b border-neutral-100 bg-white p-5 pt-6">
        <p className="text-[11px] font-black uppercase tracking-[0.18em] text-[#7C5CFC]">
          BL GOODS TRADE
        </p>
        <h1 className="mt-1 text-[25px] font-black leading-tight tracking-[-0.03em] text-neutral-950">
          관리자 로그인
        </h1>
        <p className="mt-2 text-sm leading-6 text-neutral-500">
          행사와 굿즈 이미지를 관리하려면 관리자 계정으로 로그인해 주세요.
        </p>
      </header>

      <form onSubmit={handleSubmit} className="space-y-4 p-5">
        <label className="block">
          <span className="text-sm font-bold text-neutral-800">ID</span>
          <input
            type="text"
            value={loginId}
            onChange={(event) => setLoginId(event.target.value)}
            className="mt-1 w-full rounded-2xl border border-neutral-200 bg-white px-4 py-3 text-sm outline-none focus:border-[#7C5CFC]"
            placeholder="ID"
            autoComplete="username"
          />
        </label>

        <label className="block">
          <span className="text-sm font-bold text-neutral-800">비밀번호</span>
          <input
            type="password"
            value={password}
            onChange={(event) => setPassword(event.target.value)}
            className="mt-1 w-full rounded-2xl border border-neutral-200 bg-white px-4 py-3 text-sm outline-none focus:border-[#7C5CFC]"
            placeholder="비밀번호"
            autoComplete="current-password"
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
      </form>
    </main>
  );
}
