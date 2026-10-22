-- 행사별 굿즈 종류 관리
-- 기존 행사는 실제 사용 중인 분류만 행사별로 백필하고,
-- 이 SQL 적용 후 생성되는 새 행사는 관리자가 필요한 종류만 직접 추가합니다.

create table if not exists public.trade_item_categories (
  id uuid primary key default gen_random_uuid(),
  collection_id uuid not null references public.trade_collections(id) on delete cascade,
  category_key text not null,
  label text not null,
  category_kind text not null default 'standard'
    check (category_kind in ('standard', 'benefit', 'collection_photo_card')),
  is_visible boolean not null default true,
  sort_order integer not null default 0,
  created_at timestamptz not null default now(),
  unique (collection_id, category_key),
  unique (collection_id, label)
);

create index if not exists trade_item_categories_collection_sort_idx
  on public.trade_item_categories (collection_id, sort_order, created_at);

-- 기존 고정 카테고리 제약이 있다면 동적 카테고리를 저장할 수 있도록 제거합니다.
-- category 컬럼을 실제로 참조하는 CHECK 제약만 대상으로 합니다.
do $$
declare
  constraint_row record;
begin
  for constraint_row in
    select
      c.conname,
      format('%I.%I', n.nspname, cls.relname) as qualified_table
    from pg_constraint c
    join pg_class cls on cls.oid = c.conrelid
    join pg_namespace n on n.oid = cls.relnamespace
    join pg_attribute a
      on a.attrelid = c.conrelid
     and a.attname = 'category'
     and a.attnum = any (c.conkey)
    where c.contype = 'c'
      and n.nspname = 'public'
      and cls.relname in ('trade_items', 'card_submissions')
  loop
    execute format(
      'alter table %s drop constraint %I',
      constraint_row.qualified_table,
      constraint_row.conname
    );
  end loop;
end
$$;

-- 기존 행사는 실제로 사용 중인 종류만 백필합니다.
-- 따라서 행사마다 이미 사용하던 종류 구성이 그대로 분리되고,
-- 굿즈가 아직 없는 행사는 빈 상태에서 필요한 종류만 새로 추가할 수 있습니다.
with used_categories as (
  select distinct collection_id, category
  from public.trade_items
  where collection_id is not null
    and category is not null
    and btrim(category) <> ''

  union

  select distinct collection_id, category
  from public.card_submissions
  where collection_id is not null
    and category is not null
    and btrim(category) <> ''
)
insert into public.trade_item_categories
  (collection_id, category_key, label, category_kind, is_visible, sort_order)
select
  collection_id,
  category,
  case category
    when 'benefit' then '특전'
    when 'deco_photo_pack' then '데코 포토팩'
    when 'sweets_acrylic_magnet' then '스위츠 아크릴 마그넷'
    when 'heart_can_badge' then '하트 캔뱃지'
    when 'collection_photo_card' then '컬렉션 포토카드'
    else category
  end as label,
  case category
    when 'benefit' then 'benefit'
    when 'collection_photo_card' then 'collection_photo_card'
    else 'standard'
  end as category_kind,
  true,
  case category
    when 'benefit' then 0
    when 'deco_photo_pack' then 1
    when 'sweets_acrylic_magnet' then 2
    when 'heart_can_badge' then 3
    when 'collection_photo_card' then 4
    else 100
  end as sort_order
from used_categories
on conflict (collection_id, category_key) do nothing;

alter table public.trade_item_categories enable row level security;

-- 공개 교환판(anon)은 공개된 종류만 읽습니다.
-- 관리자 여부 확인을 같은 anon 정책 안에서 수행하면 admin_users 권한 때문에
-- 공개 페이지의 전체 종류 조회가 실패할 수 있으므로 정책을 분리합니다.
drop policy if exists "trade item categories visible select" on public.trade_item_categories;
drop policy if exists "trade item categories public visible select" on public.trade_item_categories;
drop policy if exists "trade item categories admin select" on public.trade_item_categories;

create policy "trade item categories public visible select"
on public.trade_item_categories
for select
to anon, authenticated
using (is_visible);

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

drop policy if exists "trade item categories admin insert" on public.trade_item_categories;
create policy "trade item categories admin insert"
on public.trade_item_categories
for insert
to authenticated
with check (
  exists (
    select 1
    from public.admin_users
    where admin_users.user_id = auth.uid()
  )
);

drop policy if exists "trade item categories admin update" on public.trade_item_categories;
create policy "trade item categories admin update"
on public.trade_item_categories
for update
to authenticated
using (
  exists (
    select 1
    from public.admin_users
    where admin_users.user_id = auth.uid()
  )
)
with check (
  exists (
    select 1
    from public.admin_users
    where admin_users.user_id = auth.uid()
  )
);

drop policy if exists "trade item categories admin delete" on public.trade_item_categories;
create policy "trade item categories admin delete"
on public.trade_item_categories
for delete
to authenticated
using (
  exists (
    select 1
    from public.admin_users
    where admin_users.user_id = auth.uid()
  )
);


-- Data API(PostgREST)에서 새 테이블을 사용할 수 있도록 역할 권한을 부여합니다.
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
