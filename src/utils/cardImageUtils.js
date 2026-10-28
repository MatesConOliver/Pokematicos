export function getCardDisplayImage(card, flagValue = "A", isLocked = false) {
  if (!card) return "";

  if (isLocked) {
    return flagValue === "B"
      ? card.lockedImageURL_B || card.lockedImageURL || card.imageURL || ""
      : card.lockedImageURL || card.imageURL || "";
  }

  return flagValue === "B"
    ? card.imageURL_B || card.imageURL || ""
    : card.imageURL || "";
}
