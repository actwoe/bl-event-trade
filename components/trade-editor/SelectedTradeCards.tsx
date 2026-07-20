"use client";

import {
  TRADE_CATEGORIES,
  TradeBoardMode,
  TradeCard,
  TradeCategory,
  TradeSide,
} from "@/lib/trade-types";
import {
  getCardQuantity,
  QuantityTradeCard,
} from "@/lib/trade-editor-core";
import { getCardMetaLabel } from "@/lib/trade-editor-display";
import { ProtectedGoodsImage } from "@/components/trade-editor/ProtectedGoodsImage";

type SideLabelMode = "bilingual" | "korean";

type SelectedTradeCardsProps = {
  title: string;
  cards: TradeCard[];
  boardMode?: TradeBoardMode;
  onUpdate: (cardId: string, patch: Partial<QuantityTradeCard>) => void;
  onRemove: (cardId: string) => void;
  sideLabelMode?: SideLabelMode;
};

export function SelectedTradeCards({
  title,
  cards,
  boardMode = "trade",
  onUpdate,
  onRemove,
  sideLabelMode = "korean",
}: SelectedTradeCardsProps) {
  return (
    <section>
      <div className="mb-3 flex items-center gap-2">
        <h3 className="shrink-0 text-xs font-black text-neutral-700">{title}</h3>
        <span className="h-px flex-1 bg-neutral-200" />
      </div>

      <div className="space-y-3">
        {cards.map((card) => (
          <SelectedTradeCardEditor
            key={card.id}
            card={card}
            boardMode={boardMode}
            onUpdate={(patch) => onUpdate(card.id, patch)}
            onRemove={() => onRemove(card.id)}
            sideLabelMode={sideLabelMode}
          />
        ))}
      </div>
    </section>
  );
}

type SelectedTradeCardEditorProps = {
  card: TradeCard;
  boardMode: TradeBoardMode;
  onUpdate: (patch: Partial<QuantityTradeCard>) => void;
  onRemove: () => void;
  sideLabelMode: SideLabelMode;
};

function SelectedTradeCardEditor({
  card,
  boardMode,
  onUpdate,
  onRemove,
  sideLabelMode,
}: SelectedTradeCardEditorProps) {
  const quantity = getCardQuantity(card);
  const metaLabel = getCardMetaLabel(card);
  const bilingual = sideLabelMode === "bilingual";

  function decreaseQuantity() {
    if (quantity <= 1) {
      onRemove();
      return;
    }

    onUpdate({ quantity: quantity - 1 });
  }

  function increaseQuantity() {
    onUpdate({ quantity: quantity + 1 });
  }

  return (
    <div className="grid grid-cols-[64px_1fr] gap-3 rounded-xl bg-neutral-50 p-3">
      <div className="relative h-16 w-16 overflow-hidden rounded-lg bg-white">
        <ProtectedGoodsImage
          src={card.imageUrl}
          alt={card.memo || card.workTitle || "굿즈 이미지"}
          className="h-full w-full object-contain p-1"
        />

        <TradeCardStatusToggle
          card={card}
          boardMode={boardMode}
          onUpdate={onUpdate}
        />
      </div>

      <div className="min-w-0 space-y-2">
        <div className="flex items-start gap-2">
          <div
            className={`grid min-w-0 flex-1 gap-2 ${
              boardMode === "trade" ? "grid-cols-2" : "grid-cols-1"
            }`}
          >
            {boardMode === "trade" ? (
              <select
                value={card.side}
                onChange={(event) =>
                  onUpdate({
                    side: event.target.value as TradeSide,
                  })
                }
                className="min-w-0 rounded-lg border border-neutral-200 bg-white px-2 py-1.5 text-xs outline-none"
                aria-label={bilingual ? "있어요 (Have) 또는 구해요 (Want)" : "있어요 또는 구해요"}
              >
                <option value="have">{bilingual ? "있어요 (Have)" : "있어요"}</option>
                <option value="want">{bilingual ? "구해요 (Want)" : "구해요"}</option>
              </select>
            ) : null}

            <select
              value={card.category}
              onChange={(event) =>
                onUpdate({
                  category: event.target.value as TradeCategory,
                })
              }
              className="min-w-0 rounded-lg border border-neutral-200 bg-white px-2 py-1.5 text-xs outline-none"
              aria-label="굿즈 종류"
            >
              {TRADE_CATEGORIES.map((category) => (
                <option key={category.id} value={category.id}>
                  {category.label}
                </option>
              ))}
            </select>
          </div>

          <button
            type="button"
            onClick={onRemove}
            aria-label="선택한 이미지 삭제"
            className="flex h-8 w-8 shrink-0 items-center justify-center rounded-full bg-white text-sm font-black text-neutral-400 shadow-sm ring-1 ring-neutral-200 hover:bg-red-50 hover:text-red-500 hover:ring-red-200"
          >
            ×
          </button>
        </div>

        <div className="flex min-w-0 items-start gap-2">
          <div className="min-w-0 flex-1 space-y-0.5 text-xs leading-5">
            <p className="truncate font-black text-neutral-950">
              {card.workTitle || "작품명 없음"}
            </p>
            <p className="truncate text-neutral-500">{metaLabel}</p>
          </div>

          <div className="flex h-8 shrink-0 items-center overflow-hidden rounded-full border border-neutral-200 bg-white">
            <button
              type="button"
              onClick={decreaseQuantity}
              className="flex h-8 w-7 items-center justify-center text-sm font-black text-neutral-500"
              aria-label="수량 줄이기"
            >
              −
            </button>
            <span className="min-w-6 px-0.5 text-center text-xs font-black text-neutral-950">
              {quantity}
            </span>
            <button
              type="button"
              onClick={increaseQuantity}
              className="flex h-8 w-7 items-center justify-center text-sm font-black text-neutral-500"
              aria-label="수량 늘리기"
            >
              +
            </button>
          </div>
        </div>
      </div>
    </div>
  );
}

function TradeCardStatusToggle({
  card,
  boardMode,
  onUpdate,
}: {
  card: TradeCard;
  boardMode: TradeBoardMode;
  onUpdate: (patch: Partial<QuantityTradeCard>) => void;
}) {
  if (boardMode === "sell") return null;

  if (card.side === "want") {
    const active = card.isPriority === true;

    return (
      <button
        type="button"
        onClick={() => onUpdate({ isPriority: !active })}
        aria-label={active ? "우선 구함 표시 해제" : "우선 구함으로 표시"}
        aria-pressed={active}
        className={
          active
            ? "absolute left-1 top-1 z-[4] flex h-6 w-6 items-center justify-center rounded-full border border-red-500 bg-red-500 text-[14px] font-black leading-none text-white shadow-sm"
            : "absolute left-1 top-1 z-[4] flex h-6 w-6 items-center justify-center rounded-full border border-neutral-200 bg-white/90 text-[14px] font-black leading-none text-neutral-300 shadow-sm"
        }
      >
        {active ? "♥" : "♡"}
      </button>
    );
  }

  const active = card.isForSale === true;

  return (
    <button
      type="button"
      onClick={() => onUpdate({ isForSale: !active })}
      aria-label={active ? "SELL 표시 해제" : "SELL로 표시"}
      aria-pressed={active}
      className={
        active
          ? "absolute left-1 top-1 z-[4] flex h-6 min-w-9 items-center justify-center rounded-full bg-[#7C5CFC] px-1.5 text-[8px] font-black leading-none tracking-[0.04em] text-white shadow-sm"
          : "absolute left-1 top-1 z-[4] flex h-6 min-w-9 items-center justify-center rounded-full border border-neutral-200 bg-white/90 px-1.5 text-[8px] font-black leading-none tracking-[0.04em] text-neutral-400 shadow-sm"
      }
    >
      SELL
    </button>
  );
}
