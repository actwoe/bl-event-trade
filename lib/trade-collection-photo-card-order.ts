export type CollectionPhotoCardVariant = "A" | "B";

export const COLLECTION_PHOTO_CARD_VARIANTS: CollectionPhotoCardVariant[] = [
  "A",
  "B",
];

export function getCollectionPhotoCardSortOrder(
  variant: CollectionPhotoCardVariant,
) {
  return variant === "B" ? 1 : 0;
}

export function getCollectionPhotoCardVariant(
  sortOrder?: number | null,
): CollectionPhotoCardVariant {
  return sortOrder === 1 ? "B" : "A";
}

export function normalizeCollectionPhotoCardSortOrder(
  sortOrder?: number | null,
) {
  return getCollectionPhotoCardSortOrder(
    getCollectionPhotoCardVariant(sortOrder),
  );
}
