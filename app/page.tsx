import Image from 'next/image';
import Link from 'next/link';
import { SiteFooter } from '@/components/shared/SiteFooter';
import { getTradeAssetUrl, supabase } from '@/lib/supabase';

type TradeCollectionRow = {
  id: string;
  slug: string;
  title: string;
  description: string | null;
  thumbnail_path: string;
  status_label: string | null;
  published_at: string;
  sort_order: number;
};

export default async function HomePage() {
  const { data: collections, error } = await supabase
    .from('trade_collections')
    .select(
      'id, slug, title, description, thumbnail_path, status_label, published_at, sort_order',
    )
    .eq('is_public', true)
    .order('published_at', { ascending: false })
    .order('sort_order', { ascending: true });

  const tradeCollections = (collections ?? []) as TradeCollectionRow[];

  return (
    <main className="min-h-screen bg-neutral-50">
      <section className="mx-auto max-w-md px-4 py-8 sm:max-w-lg">
        <div className="text-center">
          <p className="mb-3 inline-flex rounded-full bg-neutral-950 px-4 py-1 text-[11px] font-black uppercase tracking-[0.16em] text-white">
            Goods Trade Board Maker
          </p>

          <h1 className="text-3xl font-black tracking-tight text-neutral-950">
            굿즈 교환판 생성기
          </h1>

          <p className="mx-auto mt-4 max-w-sm text-sm leading-7 text-neutral-600">
            원하는 행사를 선택한 뒤, 있어요 / 구해요 굿즈를 정리해서 SNS에
            올릴 수 있는 교환판 이미지를 만들어보세요.
          </p>
        </div>

        <section className="mt-10">
          <div className="flex items-center justify-between gap-3">
            <div>
              <h2 className="text-lg font-black text-neutral-950">
                교환판 선택
              </h2>
              <p className="mt-1 text-xs leading-5 text-neutral-500">
                최근 등록된 행사가 먼저 보여요.
              </p>
            </div>

            <Link
              href="/cardform"
              className="shrink-0 rounded-full border border-neutral-300 bg-white px-4 py-2 text-xs font-black text-neutral-800 shadow-sm transition hover:border-neutral-950"
            >
              이미지 제보
            </Link>
          </div>

          {error ? (
            <div className="mt-5 rounded-2xl border border-red-200 bg-red-50 px-4 py-5 text-sm leading-6 text-red-700">
              교환판 목록을 불러오지 못했습니다. Supabase 테이블, RLS 정책,
              환경변수를 확인해 주세요.
            </div>
          ) : null}

          {tradeCollections.length > 0 ? (
            <div className="mt-5 grid grid-cols-2 gap-3 sm:gap-4">
              {tradeCollections.map((collection) => (
                <Link
                  key={collection.id}
                  href={`/trade/${collection.slug}`}
                  className="group overflow-hidden rounded-2xl border border-neutral-200 bg-white shadow-sm transition hover:-translate-y-1 hover:border-neutral-950 hover:shadow-md"
                >
                  <div className="relative aspect-[32/45] overflow-hidden bg-neutral-100">
                    <Image
                      src={getTradeAssetUrl(collection.thumbnail_path)}
                      alt={collection.title}
                      fill
                      className="object-cover object-center transition duration-300 group-hover:scale-105"
                      sizes="(max-width: 768px) 50vw, 240px"
                      priority
                    />

                    {collection.status_label ? (
                      <span className="absolute left-2 top-2 rounded-full bg-neutral-950 px-2 py-1 text-[10px] font-black text-white">
                        {collection.status_label}
                      </span>
                    ) : null}
                  </div>

                  <div className="p-3">
                    <h3 className="line-clamp-2 text-sm font-black leading-5 text-neutral-950">
                      {collection.title}
                    </h3>

                    <p className="mt-1 line-clamp-2 text-[11px] leading-5 text-neutral-500">
                      {collection.description || '행사 기간 미입력'}
                    </p>

                    <div className="mt-3 flex items-center justify-between border-t border-neutral-100 pt-3">
                      <span className="text-[10px] font-bold text-neutral-400">
                        교환판 생성
                      </span>

                      <span className="text-[10px] font-black text-neutral-950 transition group-hover:translate-x-1">
                        만들기 →
                      </span>
                    </div>
                  </div>
                </Link>
              ))}
            </div>
          ) : (
            <div className="mt-5 rounded-2xl border border-dashed border-neutral-300 bg-white px-4 py-10 text-center">
              <p className="text-sm font-bold text-neutral-500">
                아직 공개된 교환판이 없습니다.
              </p>
              <p className="mt-2 text-xs text-neutral-400">
                관리자 페이지에서 행사를 등록해 주세요.
              </p>
            </div>
          )}
        </section>
      </section>

      <SiteFooter />
    </main>
  );
}