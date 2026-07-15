"use client";

import Link from "next/link";
import { useTradeEditorState } from "@/hooks/useTradeEditorState";
import { useSavedTradeGroups } from "@/hooks/useSavedTradeGroups";
import { TradeEditorView } from "@/components/trade-editor/TradeEditor";
import { SavedTradeGroupSection } from "@/components/trade-editor/SavedTradeGroupSection";
import {
  RegisteredTradeItem,
  TradeCollectionSummary,
  TradeReferenceImage,
} from "@/lib/trade-types";

type TradeBuilderProps = {
  collection: TradeCollectionSummary;
  registeredItems: RegisteredTradeItem[];
  referenceImages: TradeReferenceImage[];
  initialGroupId?: string;
  embedded?: boolean;
  onSavedGroupChange?: (group: { id: string; name: string }) => void;
};

export function TradeBuilder({
  collection,
  registeredItems,
  referenceImages,
  initialGroupId,
  embedded = false,
  onSavedGroupChange,
}: TradeBuilderProps) {
  const editorState = useTradeEditorState(registeredItems);
  const savedGroups = useSavedTradeGroups({
    collection,
    registeredItems,
    initialGroupId,
    editorState,
    onSavedGroupChange,
  });

  function resetBoard() {
    editorState.resetEditor();
    savedGroups.setResetMessage();
  }

  const productionHeader = !embedded ? (
    <div className="-mx-5 -mt-5 border-b border-neutral-200/70 bg-[linear-gradient(135deg,#efe7ff_0%,#d8efff_48%,#ffe1f2_100%)] px-5 pb-5 pt-5">
      <div className="mb-6 flex items-center justify-between gap-3">
        <Link
          href="/"
          className="rounded-full border border-white/70 bg-white/75 px-4 py-2 text-xs font-bold text-neutral-600 shadow-[0_4px_12px_rgba(15,23,42,0.025)] transition hover:border-white hover:bg-white hover:text-neutral-950"
        >
          ← 메인으로
        </Link>

        <Link
          href="/cardform"
          className="rounded-full border border-white/70 bg-white/75 px-4 py-2 text-xs font-bold text-neutral-600 shadow-[0_4px_12px_rgba(15,23,42,0.025)] transition hover:border-white hover:bg-white hover:text-neutral-950"
        >
          이미지 제보하기
        </Link>
      </div>

      <h1 className="text-2xl font-black text-neutral-950">
        {collection.title}
      </h1>

      {collection.description ? (
        <p className="mt-2 text-sm leading-6 text-neutral-500">
          {collection.description}
        </p>
      ) : (
        <p className="mt-2 text-sm leading-6 text-neutral-500">
          등록된 굿즈 이미지를 선택해 있어요 / 구해요 팝업 & 콜카 굿즈
          교환판을 만들 수 있습니다.
        </p>
      )}
    </div>
  ) : null;

  const saveSection = (
    <SavedTradeGroupSection
      collection={collection}
      userAuthState={savedGroups.userAuthState}
      savedGroupCount={savedGroups.savedGroupCount}
      activeGroupId={savedGroups.activeGroupId}
      groupName={savedGroups.groupName}
      groupSaveMessage={savedGroups.groupSaveMessage}
      isSavingGroup={savedGroups.isSavingGroup}
      isLoadingGroup={savedGroups.isLoadingGroup}
      directUploadCardCount={editorState.directUploadCardCount}
      onGroupNameChange={savedGroups.setGroupName}
      onSave={savedGroups.saveTradeGroup}
      onStartNew={savedGroups.startNewTradeGroup}
    />
  );

  return (
    <TradeEditorView
      collection={collection}
      registeredItems={registeredItems}
      referenceImages={referenceImages}
      editorState={editorState}
      variant="production"
      embedded={embedded}
      header={productionHeader}
      saveSection={saveSection}
      onReset={resetBoard}
    />
  );
}
