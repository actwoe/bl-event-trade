"use client";

import { nanoid } from "nanoid";
import { useEffect, useState } from "react";
import { useTradeEditorState } from "@/hooks/useTradeEditorState";
import { sortTradeCardsBySideAndGroup } from "@/lib/trade-card-order";
import {
  getCardQuantity,
  QuantityTradeCard,
} from "@/lib/trade-editor-core";
import {
  MAX_TRADE_GROUPS,
  parseSavedTradeGroupBoard,
  SavedTradeGroupBoard,
} from "@/lib/trade-groups";
import {
  RegisteredTradeItem,
  TradeBoard,
  TradeCollectionSummary,
} from "@/lib/trade-types";
import { supabase } from "@/lib/supabase";

type UserAuthState = "checking" | "signed-in" | "signed-out";

type SavedGroupChangeHandler = (group: { id: string; name: string }) => void;

type UseSavedTradeGroupsOptions = {
  collection: TradeCollectionSummary;
  registeredItems: RegisteredTradeItem[];
  initialGroupId?: string;
  editorState: ReturnType<typeof useTradeEditorState>;
  onSavedGroupChange?: SavedGroupChangeHandler;
};

function createSavedTradeGroupBoard(
  board: TradeBoard,
  selectedConditions: string[],
) {
  let skippedUploadCount = 0;

  const cards: SavedTradeGroupBoard["cards"] = board.cards.flatMap((card) => {
    const quantityCard = card as QuantityTradeCard;

    if (!quantityCard.registeredItemId) {
      skippedUploadCount += 1;
      return [];
    }

    return [
      {
        itemId: quantityCard.registeredItemId,
        side: card.side,
        quantity: getCardQuantity(card),
        category: card.category,
        workTitle: card.workTitle,
        memo: card.memo,
        imageRatio: card.imageRatio === "photocard" ? "photocard" : "square",
        benefitSubcategory: card.benefitSubcategory ?? null,
      },
    ];
  });

  const boardData: SavedTradeGroupBoard = {
    version: 1,
    nickname: board.nickname,
    contact: board.contact,
    selectedConditions,
    categoryDisplayMode:
      board.categoryDisplayMode === "simple" ? "simple" : "grouped",
    cards,
  };

  return { boardData, skippedUploadCount };
}

function restoreSavedTradeGroupBoard(
  boardData: SavedTradeGroupBoard,
  registeredItems: RegisteredTradeItem[],
) {
  const itemMap = new Map(registeredItems.map((item) => [item.id, item]));

  const cards: QuantityTradeCard[] = boardData.cards.flatMap((savedCard) => {
    const item = itemMap.get(savedCard.itemId);

    if (!item) {
      return [];
    }

    return [
      {
        id: nanoid(),
        side: savedCard.side,
        category: savedCard.category,
        imageUrl: item.imageUrl,
        workTitle: savedCard.workTitle || item.workTitle,
        memo: savedCard.memo || item.itemName,
        imageRatio: savedCard.imageRatio,
        benefitSubcategory:
          savedCard.benefitSubcategory ?? item.benefitSubcategory ?? null,
        quantity: savedCard.quantity,
        registeredItemId: item.id,
      },
    ];
  });

  return {
    board: {
      nickname: boardData.nickname,
      contact: boardData.contact,
      memo: boardData.selectedConditions.join(" · "),
      cards,
      categoryDisplayMode: boardData.categoryDisplayMode,
    } satisfies TradeBoard,
    selectedConditions: boardData.selectedConditions,
    missingCardCount: boardData.cards.length - cards.length,
  };
}

export function useSavedTradeGroups({
  collection,
  registeredItems,
  initialGroupId,
  editorState,
  onSavedGroupChange,
}: UseSavedTradeGroupsOptions) {
  const { board, setBoard, selectedConditions, setSelectedConditions } =
    editorState;
  const [userAuthState, setUserAuthState] =
    useState<UserAuthState>("checking");
  const [currentUserId, setCurrentUserId] = useState("");
  const [savedGroupCount, setSavedGroupCount] = useState(0);
  const [activeGroupId, setActiveGroupId] = useState("");
  const [groupName, setGroupName] = useState("");
  const [groupSaveMessage, setGroupSaveMessage] = useState("");
  const [isSavingGroup, setIsSavingGroup] = useState(false);
  const [isLoadingGroup, setIsLoadingGroup] = useState(false);

  useEffect(() => {
    let isMounted = true;

    async function loadUserAndSavedGroup() {
      const { data: sessionData } = await supabase.auth.getSession();
      const user = sessionData.session?.user;

      if (!isMounted) return;

      if (!user) {
        setUserAuthState("signed-out");
        setCurrentUserId("");
        return;
      }

      setUserAuthState("signed-in");
      setCurrentUserId(user.id);

      const { count, error: countError } = await supabase
        .from("trade_groups")
        .select("id", { count: "exact", head: true })
        .eq("user_id", user.id);

      if (!isMounted) return;

      if (countError) {
        console.error(countError);
        setGroupSaveMessage(
          "저장 기능을 확인할 수 없습니다. Supabase SQL 적용 여부를 확인해 주세요.",
        );
      } else {
        setSavedGroupCount(count ?? 0);
      }

      const groupId =
        initialGroupId ??
        new URLSearchParams(window.location.search).get("group");
      if (!groupId) return;

      setIsLoadingGroup(true);

      const { data: groupData, error: groupError } = await supabase
        .from("trade_groups")
        .select("id, collection_id, name, board_data")
        .eq("id", groupId)
        .eq("user_id", user.id)
        .maybeSingle();

      if (!isMounted) return;

      setIsLoadingGroup(false);

      if (groupError || !groupData) {
        if (groupError) console.error(groupError);
        setGroupSaveMessage("저장한 교환판을 불러오지 못했습니다.");
        return;
      }

      if (groupData.collection_id !== collection.id) {
        setGroupSaveMessage(
          "이 저장 그룹은 다른 행사 교환판입니다. 내 교환판에서 다시 열어 주세요.",
        );
        return;
      }

      const parsedBoard = parseSavedTradeGroupBoard(groupData.board_data);

      if (!parsedBoard) {
        setGroupSaveMessage("저장된 교환판 데이터 형식을 확인할 수 없습니다.");
        return;
      }

      const restored = restoreSavedTradeGroupBoard(
        parsedBoard,
        registeredItems,
      );

      setActiveGroupId(groupData.id);
      setGroupName(groupData.name);
      setSelectedConditions(restored.selectedConditions);
      setBoard({
        ...restored.board,
        cards: sortTradeCardsBySideAndGroup(restored.board.cards),
      });

      if (restored.missingCardCount > 0) {
        setGroupSaveMessage(
          `현재 행사에서 삭제된 굿즈 ${restored.missingCardCount}개는 제외하고 불러왔습니다.`,
        );
      } else {
        setGroupSaveMessage("저장한 교환판을 불러왔습니다.");
      }
    }

    void loadUserAndSavedGroup();

    return () => {
      isMounted = false;
    };
  }, [
    collection.id,
    initialGroupId,
    registeredItems,
    setBoard,
    setSelectedConditions,
  ]);

  async function saveTradeGroup() {
    if (userAuthState !== "signed-in" || !currentUserId) {
      setGroupSaveMessage("로그인 후 교환판을 저장할 수 있습니다.");
      return;
    }

    const normalizedName = groupName.trim();

    if (!normalizedName) {
      setGroupSaveMessage("저장할 교환판 이름을 입력해 주세요.");
      return;
    }

    if (normalizedName.length > 40) {
      setGroupSaveMessage("교환판 이름은 40자 이하로 입력해 주세요.");
      return;
    }

    if (!activeGroupId && savedGroupCount >= MAX_TRADE_GROUPS) {
      setGroupSaveMessage(
        `교환판 그룹은 최대 ${MAX_TRADE_GROUPS}개까지 저장할 수 있습니다.`,
      );
      return;
    }

    const { boardData, skippedUploadCount } = createSavedTradeGroupBoard(
      board,
      selectedConditions,
    );

    try {
      setIsSavingGroup(true);
      setGroupSaveMessage("");

      if (activeGroupId) {
        const { error } = await supabase
          .from("trade_groups")
          .update({
            name: normalizedName,
            board_data: boardData,
          })
          .eq("id", activeGroupId)
          .eq("user_id", currentUserId);

        if (error) throw error;

        setGroupSaveMessage(
          skippedUploadCount > 0
            ? `교환판을 저장했습니다. 직접 추가 이미지 ${skippedUploadCount}개는 저장에서 제외되었습니다.`
            : "교환판을 저장했습니다.",
        );
        onSavedGroupChange?.({ id: activeGroupId, name: normalizedName });
        return;
      }

      const { data, error } = await supabase
        .from("trade_groups")
        .insert({
          user_id: currentUserId,
          collection_id: collection.id,
          name: normalizedName,
          board_data: boardData,
        })
        .select("id")
        .single();

      if (error) throw error;

      setActiveGroupId(data.id);
      setSavedGroupCount((current) => current + 1);
      onSavedGroupChange?.({ id: data.id, name: normalizedName });

      const nextUrl = new URL(window.location.href);
      nextUrl.searchParams.set("group", data.id);
      window.history.replaceState({}, "", nextUrl);

      setGroupSaveMessage(
        skippedUploadCount > 0
          ? `새 교환판을 저장했습니다. 직접 추가 이미지 ${skippedUploadCount}개는 저장에서 제외되었습니다.`
          : "새 교환판을 저장했습니다.",
      );
    } catch (error) {
      console.error(error);
      setGroupSaveMessage(
        "교환판을 저장하지 못했습니다. 저장 그룹이 3개인지, Supabase SQL이 적용됐는지 확인해 주세요.",
      );
    } finally {
      setIsSavingGroup(false);
    }
  }

  function startNewTradeGroup() {
    if (!activeGroupId) return;

    if (savedGroupCount >= MAX_TRADE_GROUPS) {
      setGroupSaveMessage(
        `교환판 그룹은 최대 ${MAX_TRADE_GROUPS}개까지 저장할 수 있습니다.`,
      );
      return;
    }

    setActiveGroupId("");
    setGroupName("");

    const nextUrl = new URL(window.location.href);
    nextUrl.searchParams.delete("group");
    window.history.replaceState({}, "", nextUrl);

    setGroupSaveMessage(
      "현재 교환판 내용은 유지됩니다. 새 이름을 입력한 뒤 새 그룹으로 저장해 주세요.",
    );
  }

  function setResetMessage() {
    setGroupSaveMessage(
      activeGroupId
        ? "화면을 초기화했습니다. 저장 버튼을 누르면 현재 그룹에 반영됩니다."
        : "",
    );
  }

  return {
    userAuthState,
    savedGroupCount,
    activeGroupId,
    groupName,
    setGroupName,
    groupSaveMessage,
    isSavingGroup,
    isLoadingGroup,
    saveTradeGroup,
    startNewTradeGroup,
    setResetMessage,
  };
}
