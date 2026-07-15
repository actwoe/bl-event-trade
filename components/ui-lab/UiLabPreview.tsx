"use client";

import { forwardRef, useEffect, useRef, useState } from "react";
import { TRADE_CATEGORIES, TradeBoard, TradeCard } from "@/lib/trade-types";
import { QuantityBadge } from "@/components/trade/QuantityBadge";
import { ProtectedGoodsImage } from "@/components/trade-editor/ProtectedGoodsImage";
import { sortTradeCardsBySideAndGroup } from "@/lib/trade-card-order";
import {
  getPreviewColumnsPerSide,
  getSharedPreviewGroupOrder,
} from "@/lib/trade-preview-layout";

type UiLabPreviewProps = {
  board: TradeBoard;
  collectionTitle: string;
  eventStartDate?: string | null;
  eventEndDate?: string | null;
  responsive?: boolean;
};

type QuantityTradeCard = TradeCard & { quantity?: number };

type CardGroup = {
  key: string;
  label: string;
  cards: TradeCard[];
};

function formatEventPeriod(start?: string | null, end?: string | null) {
  const format = (value?: string | null) => {
    if (!value) return "";
    const [year, month, day] = value.split("-");
    if (!year || !month || !day) return value;
    return `${year}.${month}.${day}`;
  };

  const startLabel = format(start);
  const endLabel = format(end);
  if (startLabel && endLabel) return `${startLabel} ~ ${endLabel}`;
  return startLabel || endLabel;
}

function getMemoChips(memo: string) {
  return memo
    .split(" · ")
    .map((text) => text.trim())
    .filter(Boolean);
}

function getCardQuantity(card: TradeCard) {
  const quantity = (card as QuantityTradeCard).quantity ?? 1;
  return Number.isFinite(quantity) ? Math.max(1, Math.floor(quantity)) : 1;
}

function getCardMetaLabel(card: TradeCard) {
  const categoryLabel =
    TRADE_CATEGORIES.find((category) => category.id === card.category)?.label ??
    card.category;
  const subcategory =
    typeof card.benefitSubcategory === "string"
      ? card.benefitSubcategory.trim()
      : "";
  return card.category === "benefit" && subcategory
    ? subcategory
    : categoryLabel;
}

function getCardGroups(cards: TradeCard[]): CardGroup[] {
  const groups: CardGroup[] = [];

  for (const card of sortTradeCardsBySideAndGroup(cards)) {
    const label = getCardMetaLabel(card);
    const key =
      card.category === "benefit" ? `benefit:${label}` : card.category;
    const existing = groups.find((group) => group.key === key);

    if (existing) {
      existing.cards.push(card);
    } else {
      groups.push({ key, label, cards: [card] });
    }
  }

  return groups;
}

export const UiLabPreview = forwardRef<HTMLDivElement, UiLabPreviewProps>(
  function UiLabPreview(
    { board, collectionTitle, eventStartDate, eventEndDate, responsive = false },
    ref,
  ) {
    const hasCards = board.cards.length > 0;
    const nickname = board.nickname.trim();
    const account = board.contact.trim();
    const hasProfile = Boolean(nickname || account);
    const memoChips = getMemoChips(board.memo);
    const grouped = board.categoryDisplayMode !== "simple";
    const containerRef = useRef<HTMLDivElement>(null);
    const previewRef = useRef<HTMLDivElement>(null);
    const [previewScale, setPreviewScale] = useState(1);
    const [previewHeight, setPreviewHeight] = useState<number | undefined>();

    useEffect(() => {
      if (!responsive) return;
      const container = containerRef.current;
      const preview = previewRef.current;
      if (!container || !preview) return;

      const updateSize = () => {
        const availableWidth = container.clientWidth;
        const nextScale = Math.min(1, availableWidth / 840);
        setPreviewScale(nextScale);
        setPreviewHeight(preview.scrollHeight * nextScale);
      };

      updateSize();
      const resizeObserver = new ResizeObserver(updateSize);
      resizeObserver.observe(container);
      resizeObserver.observe(preview);
      return () => resizeObserver.disconnect();
    }, [responsive, board, collectionTitle]);

    const assignPreviewRef = (node: HTMLDivElement | null) => {
      previewRef.current = node;
      if (typeof ref === "function") ref(node);
      else if (ref) ref.current = node;
    };

    const previewNode = (
      <div
        ref={assignPreviewRef}
        data-ui-lab-preview-version="2026-07-13-dom-export"
        className="box-border w-[840px] bg-transparent p-5 text-neutral-950"
        style={{
          fontFamily: "'Pretendard', Arial, sans-serif",
          transform: responsive ? `scale(${previewScale})` : undefined,
          transformOrigin: responsive ? "top left" : undefined,
        }}
      >
        <div className="overflow-hidden rounded-[24px] border border-neutral-200 bg-white shadow-[0_10px_30px_rgba(15,23,42,0.10)]">
          <header className="bg-neutral-950 px-6 py-4 text-white">
            <div className="flex min-h-[50px] min-w-0 items-center justify-between gap-6">
              <div className="min-w-0 text-left">
                <p className="mb-1 text-[9px] font-bold tracking-[0.18em] text-white/55">
                  BL GOODS TRADE BOARD
                </p>
                <h1 className="break-keep text-[22px] font-black leading-tight tracking-tight">
                  {collectionTitle}
                </h1>
              </div>

              {hasProfile ? (
                <div className="max-w-[34%] shrink-0 text-right">
                  {nickname ? (
                    <p className="truncate text-[11px] font-black leading-tight text-white/85">
                      {nickname}
                    </p>
                  ) : null}
                  {account ? (
                    <p className="mt-0.5 truncate text-[9px] font-bold leading-tight text-white/55">
                      {account}
                    </p>
                  ) : null}
                </div>
              ) : null}
            </div>
          </header>

          <section className="px-3 pb-6 pt-4">
            {memoChips.length > 0 ? (
              <div className="mb-5 border-b border-neutral-200 pb-5">
                <div className="flex flex-nowrap items-center justify-center gap-1.5 overflow-hidden px-1">
                  {memoChips.slice(0, 6).map((chip) => (
                    <span
                      key={chip}
                      className="inline-flex min-h-[28px] w-fit shrink-0 items-center justify-center whitespace-nowrap rounded-full bg-neutral-950 px-3 py-1.5 text-center text-[10px] font-black leading-none text-white"
                    >
                      {chip}
                    </span>
                  ))}
                </div>
              </div>
            ) : null}

            {hasCards ? (
              grouped ? (
                <GroupedTradeRows cards={sortTradeCardsBySideAndGroup(board.cards)} />
              ) : (
                <SimpleTradeRows cards={sortTradeCardsBySideAndGroup(board.cards)} />
              )
            ) : (
              <div className="border-2 border-dashed border-neutral-200 px-6 py-16 text-center">
                <p className="text-lg font-black text-neutral-300">
                  선택된 이미지가 없습니다
                </p>
              </div>
            )}
          </section>

          <footer className="border-t border-neutral-200 bg-[#F7F7FA] px-4 py-4 text-center">
            <p className="text-[8px] font-medium leading-4 text-neutral-400">
              업로드된 모든 이미지의 저작권은 각 플랫폼과 작가님께 있습니다.
            </p>
            <p className="text-[8px] font-bold leading-4 text-neutral-500">
              제작 NP @ru1ned1over
            </p>
          </footer>
        </div>
      </div>
    );

    if (!responsive) return previewNode;

    return (
      <div
        ref={containerRef}
        className="w-full min-w-0 overflow-hidden"
        style={{ height: previewHeight }}
      >
        {previewNode}
      </div>
    );
  },
);

function SideTitle({ title, count }: { title: string; count: number }) {
  return (
    <div>
      <div className="flex items-end justify-between gap-3">
        <span className="text-[17px] font-black leading-none text-[#7C5CFC]">
          {title}
        </span>
        <span className="text-[11px] font-bold leading-none text-neutral-400">
          {count}
        </span>
      </div>
      <div className="relative mt-3 h-px bg-neutral-200">
        <span className="absolute left-0 top-0 h-px w-10 bg-[#7C5CFC]" />
      </div>
    </div>
  );
}

function GroupedTradeRows({ cards }: { cards: TradeCard[] }) {
  const sortedCards = sortTradeCardsBySideAndGroup(cards);
  const haveCards = sortedCards.filter((card) => card.side === "have");
  const wantCards = sortedCards.filter((card) => card.side === "want");
  const haveGroups = getCardGroups(haveCards);
  const wantGroups = getCardGroups(wantCards);
  const order = getSharedPreviewGroupOrder(haveGroups, wantGroups);

  return (
    <div>
      <div className="grid grid-cols-2 gap-6">
        <SideTitle title="있어요 (Have)" count={haveCards.length} />
        <SideTitle title="구해요 (Want)" count={wantCards.length} />
      </div>

      <div className="mt-5 space-y-6">
        {order.map((group) => {
          const have =
            haveGroups.find((item) => item.key === group.key)?.cards ?? [];
          const want =
            wantGroups.find((item) => item.key === group.key)?.cards ?? [];
          const isSingleContentRow =
            order.length === 1 && Math.max(have.length, want.length) <= 3;
          const columnsPerSide = getPreviewColumnsPerSide(
            [have.length, want.length],
            isSingleContentRow ? 2 : 3,
          );

          return (
            <section key={group.key}>
              <div className="mb-3 flex items-center gap-3">
                <span className="h-4 w-1 rounded-full bg-[#7C5CFC]" />
                <h2 className="text-[12px] font-black text-neutral-800">
                  {group.label}
                </h2>
                <span className="h-px flex-1 bg-neutral-200" />
              </div>

              <div className="grid grid-cols-2">
                <div className="min-w-0 pr-2">
                  <CardGrid
                    cards={have}
                    columns={columnsPerSide}
                    showMeta={false}
                    centerIncompleteRow={have.length < want.length}
                  />
                </div>
                <div className="min-w-0 border-l border-neutral-200 pl-2">
                  <CardGrid
                    cards={want}
                    columns={columnsPerSide}
                    showMeta={false}
                    centerIncompleteRow={want.length < have.length}
                  />
                </div>
              </div>
            </section>
          );
        })}
      </div>
    </div>
  );
}

function SimpleTradeRows({ cards }: { cards: TradeCard[] }) {
  const sortedCards = sortTradeCardsBySideAndGroup(cards);
  const haveCards = sortedCards.filter((card) => card.side === "have");
  const wantCards = sortedCards.filter((card) => card.side === "want");
  const isSingleContentRow = Math.max(haveCards.length, wantCards.length) <= 3;
  const columnsPerSide = getPreviewColumnsPerSide(
    [haveCards.length, wantCards.length],
    isSingleContentRow ? 2 : 3,
  );

  return (
    <div>
      <div className="grid grid-cols-2 gap-6">
        <SideTitle title="있어요 (Have)" count={haveCards.length} />
        <SideTitle title="구해요 (Want)" count={wantCards.length} />
      </div>

      <div className="mt-5 grid grid-cols-2">
        <div className="min-w-0 pr-2">
          <CardGrid
            cards={haveCards}
            columns={columnsPerSide}
            showMeta
            centerIncompleteRow={haveCards.length < wantCards.length}
          />
        </div>
        <div className="min-w-0 border-l border-neutral-200 pl-2">
          <CardGrid
            cards={wantCards}
            columns={columnsPerSide}
            showMeta
            centerIncompleteRow={wantCards.length < haveCards.length}
          />
        </div>
      </div>
    </div>
  );
}

function CardGrid({
  cards,
  columns,
  showMeta,
  centerIncompleteRow = false,
}: {
  cards: TradeCard[];
  columns: 1 | 2 | 3 | 4 | 6 | 8;
  showMeta: boolean;
  centerIncompleteRow?: boolean;
}) {
  if (cards.length === 0) {
    return (
      <div className="flex min-h-20 items-center justify-center px-3 text-center text-[10px] font-bold text-neutral-300">
        선택된 굿즈가 없습니다
      </div>
    );
  }

  const rows: TradeCard[][] = [];
  for (let index = 0; index < cards.length; index += columns) {
    rows.push(cards.slice(index, index + columns));
  }

  const totalGapRem = (columns - 1) * 0.75;
  const cardWidth = `calc((100% - ${totalGapRem}rem) / ${columns})`;

  return (
    <div className="flex flex-col gap-y-2">
      {rows.map((row, rowIndex) => {
        const shouldCenter = centerIncompleteRow && row.length < columns;

        return (
          <div
            key={`${row[0]?.id ?? rowIndex}-${rowIndex}`}
            className={`flex gap-x-3 ${shouldCenter ? "justify-center" : "justify-start"}`}
          >
            {row.map((card) => (
              <div
                key={card.id}
                className="min-w-0 shrink-0"
                style={{ flexBasis: cardWidth, maxWidth: cardWidth }}
              >
                <PreviewCard card={card} showMeta={showMeta} />
              </div>
            ))}
          </div>
        );
      })}
    </div>
  );
}

function PreviewCard({
  card,
  showMeta,
}: {
  card: TradeCard;
  showMeta: boolean;
}) {
  const metaLabel = getCardMetaLabel(card);
  const quantity = getCardQuantity(card);

  return (
    <article className="min-w-0 bg-white">
      <div className="relative bg-white">
        <ProtectedGoodsImage
          src={card.imageUrl}
          alt={card.memo || card.workTitle || "굿즈 이미지"}
          loading="eager"
          decoding="async"
          className={`${card.imageRatio === "photocard" ? "aspect-[55/85]" : "aspect-square"} w-full rounded-xl bg-white object-contain`}
        />
        <QuantityBadge quantity={quantity} />
      </div>

      <div className="pt-1.5">
        <p className="line-clamp-1 text-center text-[9px] font-black leading-4 text-neutral-950">
          {card.workTitle || "작품명"}
        </p>
        {showMeta ? (
          <p className="line-clamp-1 text-center text-[8px] font-bold leading-3 text-neutral-500">
            {metaLabel}
          </p>
        ) : null}
        {card.memo ? (
          <p className="line-clamp-1 text-center text-[8px] font-bold leading-3 text-neutral-400">
            {card.memo}
          </p>
        ) : null}
      </div>
    </article>
  );
}
