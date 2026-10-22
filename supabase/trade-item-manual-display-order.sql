-- Run in Supabase SQL Editor on the test database first. Preserve sort_order (A/B/C/D).
alter table public.trade_items
  add column if not exists display_order integer;

-- Existing rows remain NULL; created_at order is used until an admin rearranges them.
-- Existing RLS policies for trade_items apply to display_order updates.
