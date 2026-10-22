-- 공개 교환판에서 직접 만든 굿즈 종류명이 "기타 굿즈"로 표시되는 문제 수정
-- 원인: anon SELECT 정책이 admin_users를 함께 참조하여 공개 페이지의
-- trade_item_categories 조회가 실패할 수 있음.

-- 기존 단일 SELECT 정책 제거
drop policy if exists "trade item categories visible select"
on public.trade_item_categories;

-- 재실행 가능하도록 새 정책도 먼저 정리
drop policy if exists "trade item categories public visible select"
on public.trade_item_categories;

drop policy if exists "trade item categories admin select"
on public.trade_item_categories;

-- 공개/로그인 사용자: 공개된 굿즈 종류는 admin_users 조회 없이 읽기 허용
create policy "trade item categories public visible select"
on public.trade_item_categories
for select
to anon, authenticated
using (is_visible);

-- 관리자: 숨김 상태의 굿즈 종류도 관리 화면에서 읽을 수 있도록 별도 허용
create policy "trade item categories admin select"
on public.trade_item_categories
for select
to authenticated
using (
  exists (
    select 1
    from public.admin_users
    where admin_users.user_id = auth.uid()
  )
);

-- Data API 권한을 명시적으로 유지
grant select
on table public.trade_item_categories
to anon;

grant select, insert, update, delete
on table public.trade_item_categories
to authenticated;

grant select, insert, update, delete
on table public.trade_item_categories
to service_role;

notify pgrst, 'reload schema';
