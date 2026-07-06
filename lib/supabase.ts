import { createClient } from '@supabase/supabase-js';

const supabaseUrl = process.env.NEXT_PUBLIC_SUPABASE_URL;
const supabasePublishableKey =
  process.env.NEXT_PUBLIC_SUPABASE_PUBLISHABLE_KEY;

if (!supabaseUrl) {
  throw new Error('Missing NEXT_PUBLIC_SUPABASE_URL');
}

if (!supabasePublishableKey) {
  throw new Error('Missing NEXT_PUBLIC_SUPABASE_PUBLISHABLE_KEY');
}

export const supabase = createClient(supabaseUrl, supabasePublishableKey);

export const TRADE_ASSETS_BUCKET = 'trade-assets';

export function getTradeAssetUrl(path: string) {
  const { data } = supabase.storage
    .from(TRADE_ASSETS_BUCKET)
    .getPublicUrl(path);

  return data.publicUrl;
}