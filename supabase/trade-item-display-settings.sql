-- 굿즈명 표시 및 공지용 이미지 안내 영역의 행사별 설정

alter table public.trade_items
  add column if not exists show_item_name boolean not null default false;

-- 이미지가 아직 없는 기존 텍스트 굿즈는 굿즈명이 보이도록 보정합니다.
update public.trade_items
set show_item_name = true
where coalesce(image_path, '') = ''
  and coalesce(item_name, '') <> '';

alter table public.trade_collections
  add column if not exists reference_section_enabled boolean not null default false;

alter table public.trade_collections
  add column if not exists reference_section_title text not null
  default '내가 뽑은 굿즈가 어떤 작품인지 모르겠다면?';

notify pgrst, 'reload schema';
