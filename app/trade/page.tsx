import { redirect } from 'next/navigation';
import { supabase } from '@/lib/supabase';

type TradeCollectionRow = {
  slug: string;
};

export default async function TradePage() {
  const { data } = await supabase
    .from('trade_collections')
    .select('slug')
    .eq('is_public', true)
    .order('published_at', { ascending: false })
    .order('sort_order', { ascending: true })
    .limit(1)
    .maybeSingle();

  const collection = data as TradeCollectionRow | null;

  if (collection?.slug) {
    redirect(`/trade/${collection.slug}`);
  }

  redirect('/');
}