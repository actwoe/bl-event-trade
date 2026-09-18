-- 내 교환/양도판을 특정 행사에 종속하지 않고 계정 단위 최대 3개로 사용하기 위한 마이그레이션입니다.
-- 기존 행사별 저장판은 그대로 유지되고, 앞으로 통합 교환판에서 저장하는 그룹은 collection_id = null 로 저장됩니다.

alter table public.trade_groups
  alter column collection_id drop not null;

comment on column public.trade_groups.collection_id is
  '기존 행사별 저장판은 행사 ID, 통합 교환판은 NULL. 보드 안 각 카드가 collectionId를 보유한다.';

notify pgrst, 'reload schema';
