import { ImageResponse } from 'next/og';
import { NextRequest } from 'next/server';

export const runtime = 'nodejs';
export const dynamic = 'force-dynamic';

type Card = {
  id: string;
  side: 'have' | 'want';
  category: string;
  imageUrl: string;
  workTitle: string;
  memo?: string;
  imageRatio?: 'square' | 'photocard';
  benefitSubcategory?: string | null;
  quantity?: number;
};

type Board = {
  nickname?: string;
  contact?: string;
  memo?: string;
  cards: Card[];
  categoryDisplayMode?: 'simple' | 'grouped';
};

const CATEGORY_LABELS: Record<string, string> = {
  acrylic: '아크릴',
  photocard: '포토카드',
  paper: '지류',
  benefit: '특전',
  etc: '기타',
};

async function toDataUrl(url: string) {
  if (url.startsWith('data:')) return url;
  const response = await fetch(url, { cache: 'force-cache' });
  if (!response.ok) throw new Error(`image fetch failed: ${response.status}`);
  const type = response.headers.get('content-type') || 'image/jpeg';
  const bytes = Buffer.from(await response.arrayBuffer());
  return `data:${type};base64,${bytes.toString('base64')}`;
}

function metaLabel(card: Card) {
  if (card.category === 'benefit' && card.benefitSubcategory?.trim()) {
    return card.benefitSubcategory.trim();
  }
  return CATEGORY_LABELS[card.category] || card.memo || card.category;
}

function groupKey(card: Card) {
  if (card.category === 'benefit') {
    const sub = card.benefitSubcategory?.trim();
    return sub ? `benefit:${sub}` : 'benefit';
  }
  return card.category;
}

function groupLabel(card: Card) {
  if (card.category === 'benefit') return card.benefitSubcategory?.trim() || '특전';
  return CATEGORY_LABELS[card.category] || card.category;
}

export async function POST(request: NextRequest) {
  const { board, collectionTitle } = (await request.json()) as {
    board: Board;
    collectionTitle: string;
  };

  if (!board?.cards?.length) return new Response('No cards', { status: 400 });

  const cards = await Promise.all(
    board.cards.map(async (card) => ({ ...card, imageUrl: await toDataUrl(card.imageUrl) })),
  );
  const have = cards.filter((card) => card.side === 'have');
  const want = cards.filter((card) => card.side === 'want');
  const grouped = board.categoryDisplayMode !== 'simple';

  const groupOrder: { key: string; label: string }[] = [];
  if (grouped) {
    for (const card of cards) {
      const key = groupKey(card);
      if (!groupOrder.some((group) => group.key === key)) {
        groupOrder.push({ key, label: groupLabel(card) });
      }
    }
  }

  const rows = grouped ? groupOrder.length : 1;
  const maxSideCount = grouped
    ? groupOrder.reduce((sum, group) => {
        const hc = have.filter((card) => groupKey(card) === group.key).length;
        const wc = want.filter((card) => groupKey(card) === group.key).length;
        return sum + Math.max(Math.ceil(hc / 2), Math.ceil(wc / 2), 1);
      }, 0)
    : Math.max(Math.ceil(have.length / 2), Math.ceil(want.length / 2), 1);
  const height = Math.min(4096, 250 + rows * 42 + maxSideCount * 180);

  const cardNode = (card: Card, showMeta: boolean) => (
    <div key={card.id} style={{ width: 118, display: 'flex', flexDirection: 'column', alignItems: 'center' }}>
      <div style={{ width: 118, height: card.imageRatio === 'photocard' ? 182 : 118, position: 'relative', display: 'flex', borderRadius: 14, overflow: 'hidden', background: '#f5f5f5' }}>
        <img src={card.imageUrl} width="118" height={card.imageRatio === 'photocard' ? '182' : '118'} style={{ width: '100%', height: '100%', objectFit: 'contain' }} />
        {(card.quantity ?? 1) > 1 ? (
          <div style={{ position: 'absolute', right: 8, top: 12, width: 18, height: 18, borderRadius: 999, background: '#171717', color: '#fff', fontSize: 8, fontWeight: 900, display: 'flex', alignItems: 'center', justifyContent: 'center' }}>×{card.quantity}</div>
        ) : null}
      </div>
      <div style={{ width: 118, marginTop: 5, textAlign: 'center', fontSize: 11, fontWeight: 800, lineHeight: 1.2, overflow: 'hidden', whiteSpace: 'nowrap', textOverflow: 'ellipsis' }}>{card.workTitle || '작품명'}</div>
      {showMeta ? <div style={{ width: 118, marginTop: 2, textAlign: 'center', fontSize: 9, color: '#737373', overflow: 'hidden', whiteSpace: 'nowrap', textOverflow: 'ellipsis' }}>{metaLabel(card)}</div> : null}
    </div>
  );

  const gridNode = (items: Card[], showMeta: boolean) => (
    <div style={{ display: 'flex', flexWrap: 'wrap', gap: '12px 10px', justifyContent: items.length === 1 ? 'center' : 'flex-start' }}>
      {items.map((card) => cardNode(card, showMeta))}
    </div>
  );

  return new ImageResponse(
    <div style={{ width: 560, minHeight: height, background: '#fff', padding: 24, display: 'flex', fontFamily: 'sans-serif', color: '#171717' }}>
      <div style={{ width: '100%', borderRadius: 30, overflow: 'hidden', background: '#fff', boxShadow: '0 10px 30px rgba(15,23,42,.12)', display: 'flex', flexDirection: 'column' }}>
        <div style={{ background: '#0a0a0a', color: '#fff', padding: '18px 20px', display: 'flex', justifyContent: 'space-between' }}>
          <div style={{ display: 'flex', flexDirection: 'column' }}>
            <div style={{ fontSize: 10, color: 'rgba(255,255,255,.55)', letterSpacing: 2.4, fontWeight: 900 }}>TRADE BOARD</div>
            <div style={{ marginTop: 5, fontSize: 24, fontWeight: 900 }}>{collectionTitle}</div>
            {[board.nickname, board.contact].filter(Boolean).length ? <div style={{ marginTop: 8, fontSize: 12, color: 'rgba(255,255,255,.7)' }}>{[board.nickname, board.contact].filter(Boolean).join(' · ')}</div> : null}
          </div>
        </div>
        <div style={{ padding: 16, display: 'flex', flexDirection: 'column' }}>
          <div style={{ display: 'flex', gap: 12 }}>
            {['🙋🏻‍♀️ 있어요', '❤️ 구해요'].map((label) => <div key={label} style={{ width: 250, height: 30, borderRadius: 12, background: '#e5e5e5', color: '#404040', display: 'flex', alignItems: 'center', justifyContent: 'center', fontSize: 12, fontWeight: 900 }}>{label}</div>)}
          </div>
          {grouped ? (
            <div style={{ marginTop: 16, display: 'flex', flexDirection: 'column', gap: 18 }}>
              {groupOrder.map((group) => {
                const h = have.filter((card) => groupKey(card) === group.key);
                const w = want.filter((card) => groupKey(card) === group.key);
                return <div key={group.key} style={{ display: 'flex', flexDirection: 'column' }}>
                  <div style={{ display: 'flex', alignItems: 'center', gap: 8, marginBottom: 8 }}><div style={{ fontSize: 10, fontWeight: 900 }}>{group.label}</div><div style={{ height: 1, flex: 1, background: '#d4d4d4' }} /></div>
                  <div style={{ display: 'flex' }}><div style={{ width: 250, paddingRight: 12 }}>{gridNode(h, false)}</div><div style={{ width: 250, paddingLeft: 12, borderLeft: '1px solid #e5e5e5' }}>{gridNode(w, false)}</div></div>
                </div>;
              })}
            </div>
          ) : (
            <div style={{ marginTop: 12, display: 'flex' }}><div style={{ width: 250, paddingRight: 12 }}>{gridNode(have, true)}</div><div style={{ width: 250, paddingLeft: 12, borderLeft: '1px solid #e5e5e5' }}>{gridNode(want, true)}</div></div>
          )}
        </div>
      </div>
    </div>,
    { width: 560, height },
  );
}
