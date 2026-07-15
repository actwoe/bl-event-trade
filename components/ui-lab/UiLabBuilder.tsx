"use client";

import { TradeEditor } from "@/components/trade-editor/TradeEditor";
import type { TradeEditorProps } from "@/components/trade-editor/TradeEditor";

export function UiLabBuilder(props: TradeEditorProps) {
  return <TradeEditor {...props} />;
}
