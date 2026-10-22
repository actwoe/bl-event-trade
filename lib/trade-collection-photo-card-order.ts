export type CollectionPhotoCardVariant = "A" | "B" | "C" | "D";

export const COLLECTION_PHOTO_CARD_VARIANTS: CollectionPhotoCardVariant[] = [
  "A",
  "B",
  "C",
  "D",
];

export function getCollectionPhotoCardSortOrder(
  variant: CollectionPhotoCardVariant,
) {
  const index = COLLECTION_PHOTO_CARD_VARIANTS.indexOf(variant);
  return index >= 0 ? index : 0;
}

export function getCollectionPhotoCardVariant(
  sortOrder?: number | null,
): CollectionPhotoCardVariant {
  if (sortOrder === 1) return "B";
  if (sortOrder === 2) return "C";
  if (sortOrder === 3) return "D";
  return "A";
}

export function normalizeCollectionPhotoCardSortOrder(
  sortOrder?: number | null,
) {
  return getCollectionPhotoCardSortOrder(
    getCollectionPhotoCardVariant(sortOrder),
  );
}
