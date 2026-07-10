import sharp from "sharp";
import { NextRequest } from "next/server";

export const runtime = "nodejs";
export const dynamic = "force-dynamic";

const CATEGORY_LABELS: Record<string, string> = {
  acrylic: "아크릴",
  photocard: "포토카드",
  paper: "지류",
  benefit: "특전",
  etc: "기타",
};

type Card = {
  id: string;
  side: "have" | "want";
  category: string;
  imageUrl: string;
  workTitle: string;
  memo?: string;
  imageRatio?: "square" | "photocard";
  benefitSubcategory?: string | null;
  quantity?: number;
};

type Board = {
  nickname?: string;
  contact?: string;
  memo?: string;
  cards: Card[];
  categoryDisplayMode?: "simple" | "grouped";
};

function escapeXml(value: string) {
  return value
    .replaceAll("&", "&amp;")
    .replaceAll("<", "&lt;")
    .replaceAll(">", "&gt;")
    .replaceAll('"', "&quot;")
    .replaceAll("'", "&apos;");
}

function groupKey(card: Card) {
  if (card.category === "benefit") {
    const sub = card.benefitSubcategory?.trim();
    return sub ? `benefit:${sub}` : "benefit";
  }
  return card.category;
}

function groupLabel(card: Card) {
  if (card.category === "benefit") {
    return card.benefitSubcategory?.trim() || "특전";
  }
  return CATEGORY_LABELS[card.category] || card.category;
}

function metaLabel(card: Card) {
  if (card.category === "benefit" && card.benefitSubcategory?.trim()) {
    return card.benefitSubcategory.trim();
  }
  return card.memo || CATEGORY_LABELS[card.category] || card.category;
}

async function imageToDataUrl(url: string) {
  if (url.startsWith("data:")) return url;
  if (url.startsWith("blob:")) {
    throw new Error("업로드한 로컬 이미지는 서버 저장 전에 데이터로 변환되어야 합니다.");
  }

  const response = await fetch(url, {
    cache: "no-store",
    redirect: "follow",
    headers: {
      Accept: "image/avif,image/webp,image/apng,image/svg+xml,image/*,*/*;q=0.8",
      "User-Agent": "Mozilla/5.0 goods-trade-board-image-renderer",
    },
  });

  if (!response.ok) {
    throw new Error(`썸네일 요청 실패 (${response.status})`);
  }

  const contentType = response.headers.get("content-type") || "image/jpeg";
  if (!contentType.startsWith("image/")) {
    throw new Error(`이미지 형식이 아닙니다 (${contentType})`);
  }

  const sourceBuffer = Buffer.from(await response.arrayBuffer());
  const pngBuffer = await sharp(sourceBuffer, { animated: false })
    .rotate()
    .png()
    .toBuffer();

  return `data:image/png;base64,${pngBuffer.toString("base64")}`;
}

function text(value: string, x: number, y: number, size: number, weight = 700, fill = "#171717", anchor: "start" | "middle" = "start") {
  return `<text x="${x}" y="${y}" font-size="${size}" font-weight="${weight}" fill="${fill}" text-anchor="${anchor}" font-family="Arial, 'Apple SD Gothic Neo', 'Noto Sans KR', sans-serif">${escapeXml(value)}</text>`;
}

function renderCard(card: Card, x: number, y: number, showMeta: boolean) {
  const width = 112;
  const imageHeight = card.imageRatio === "photocard" ? 170 : 112;
  const quantity = Math.max(1, Math.floor(card.quantity ?? 1));
  const titleY = y + imageHeight + 18;
  const metaY = titleY + 15;

  return `
    <g>
      <rect x="${x}" y="${y}" width="${width}" height="${imageHeight}" rx="12" fill="#f5f5f5"/>
      <image href="${card.imageUrl}" x="${x}" y="${y}" width="${width}" height="${imageHeight}" preserveAspectRatio="xMidYMid meet"/>
      ${quantity > 1 ? `<circle cx="${x + width - 12}" cy="${y + 15}" r="9" fill="#171717"/>${text(`×${quantity}`, x + width - 12, y + 18, 8, 900, "#ffffff", "middle")}` : ""}
      ${text(card.workTitle || "작품명", x + width / 2, titleY, 11, 800, "#171717", "middle")}
      ${showMeta ? text(metaLabel(card), x + width / 2, metaY, 9, 500, "#737373", "middle") : ""}
    </g>
  `;
}

export async function POST(request: NextRequest) {
  try {
    const body = (await request.json()) as { board?: Board; collectionTitle?: string };
    const board = body.board;
    const collectionTitle = body.collectionTitle?.trim() || "교환판";

    if (!board?.cards?.length) {
      return Response.json({ error: "저장할 굿즈가 없습니다." }, { status: 400 });
    }

    const cards = await Promise.all(
      board.cards.map(async (card) => ({
        ...card,
        imageUrl: await imageToDataUrl(card.imageUrl),
      })),
    );

    const have = cards.filter((card) => card.side === "have");
    const want = cards.filter((card) => card.side === "want");
    const grouped = board.categoryDisplayMode !== "simple";

    const groups: Array<{ key: string; label: string }> = [];
    if (grouped) {
      for (const card of cards) {
        const key = groupKey(card);
        if (!groups.some((group) => group.key === key)) {
          groups.push({ key, label: groupLabel(card) });
        }
      }
    }

    const sideX = { have: 28, want: 300 };
    const cardGapX = 12;
    const rowGap = 24;
    let contentY = 160;
    const pieces: string[] = [];

    pieces.push(`<rect width="560" height="100%" fill="#ffffff"/>`);
    pieces.push(`<rect x="20" y="20" width="520" height="110" rx="26" fill="#0a0a0a"/>`);
    pieces.push(text("TRADE BOARD", 40, 52, 10, 900, "#a3a3a3"));
    pieces.push(text(collectionTitle, 40, 84, 24, 900, "#ffffff"));

    const profile = [board.nickname, board.contact].filter(Boolean).join(" · ");
    if (profile) pieces.push(text(profile, 40, 108, 12, 600, "#d4d4d4"));

    pieces.push(`<rect x="28" y="140" width="244" height="28" rx="10" fill="#e5e5e5"/>`);
    pieces.push(`<rect x="288" y="140" width="244" height="28" rx="10" fill="#e5e5e5"/>`);
    pieces.push(text("있어요", 150, 159, 12, 900, "#404040", "middle"));
    pieces.push(text("구해요", 410, 159, 12, 900, "#404040", "middle"));
    contentY = 188;

    const renderSideGrid = (items: Card[], side: "have" | "want", startY: number, showMeta: boolean) => {
      items.forEach((card, index) => {
        const col = index % 2;
        const row = Math.floor(index / 2);
        const y = startY + row * (card.imageRatio === "photocard" ? 210 : 152);
        const x = sideX[side] + col * (112 + cardGapX);
        pieces.push(renderCard(card, x, y, showMeta));
      });

      const maxImageHeight = items.some((card) => card.imageRatio === "photocard") ? 210 : 152;
      return Math.max(1, Math.ceil(items.length / 2)) * maxImageHeight;
    };

    if (grouped) {
      for (const group of groups) {
        pieces.push(text(group.label, 28, contentY + 12, 10, 900));
        pieces.push(`<line x1="80" y1="${contentY + 8}" x2="532" y2="${contentY + 8}" stroke="#d4d4d4" stroke-width="1"/>`);
        const gridY = contentY + 24;
        const h = have.filter((card) => groupKey(card) === group.key);
        const w = want.filter((card) => groupKey(card) === group.key);
        const hHeight = renderSideGrid(h, "have", gridY, false);
        const wHeight = renderSideGrid(w, "want", gridY, false);
        const groupHeight = Math.max(hHeight, wHeight, 152);
        pieces.push(`<line x1="280" y1="${gridY}" x2="280" y2="${gridY + groupHeight - 8}" stroke="#e5e5e5" stroke-width="1"/>`);
        contentY = gridY + groupHeight + rowGap;
      }
    } else {
      const hHeight = renderSideGrid(have, "have", contentY, true);
      const wHeight = renderSideGrid(want, "want", contentY, true);
      const height = Math.max(hHeight, wHeight, 152);
      pieces.push(`<line x1="280" y1="${contentY}" x2="280" y2="${contentY + height - 8}" stroke="#e5e5e5" stroke-width="1"/>`);
      contentY += height + 20;
    }

    if (board.memo?.trim()) {
      pieces.push(`<rect x="28" y="${contentY}" width="504" height="42" rx="12" fill="#f5f5f5"/>`);
      pieces.push(text(board.memo.trim(), 40, contentY + 25, 11, 700, "#525252"));
      contentY += 58;
    }

    const height = Math.max(320, Math.min(4096, contentY + 24));
    const svg = `<svg xmlns="http://www.w3.org/2000/svg" width="560" height="${height}" viewBox="0 0 560 ${height}">${pieces.join("")}</svg>`;
    const png = await sharp(Buffer.from(svg)).png().toBuffer();

    return new Response(new Uint8Array(png), {
      status: 200,
      headers: {
        "Content-Type": "image/png",
        "Content-Length": String(png.byteLength),
        "Cache-Control": "no-store",
      },
    });
  } catch (error) {
    console.error("trade-board-image API failed", error);
    const message = error instanceof Error ? error.message : "알 수 없는 오류";
    return Response.json({ error: message }, { status: 500 });
  }
}
