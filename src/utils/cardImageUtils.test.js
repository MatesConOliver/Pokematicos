import { getCardDisplayImage } from "./cardImageUtils";

describe("getCardDisplayImage", () => {
  const card = {
    imageURL: "unlocked-a",
    lockedImageURL: "locked-a",
    imageURL_B: "unlocked-b",
    lockedImageURL_B: "locked-b",
  };

  it("uses the selected variant and locked or unlocked artwork", () => {
    expect(getCardDisplayImage(card, "A", false)).toBe("unlocked-a");
    expect(getCardDisplayImage(card, "A", true)).toBe("locked-a");
    expect(getCardDisplayImage(card, "B", false)).toBe("unlocked-b");
    expect(getCardDisplayImage(card, "B", true)).toBe("locked-b");
  });

  it("falls back to Option A when Option B artwork is missing", () => {
    const partialCard = { imageURL: "unlocked-a", lockedImageURL: "locked-a" };

    expect(getCardDisplayImage(partialCard, "B", false)).toBe("unlocked-a");
    expect(getCardDisplayImage(partialCard, "B", true)).toBe("locked-a");
    expect(
      getCardDisplayImage({ imageURL: "unlocked-a" }, "B", true)
    ).toBe("unlocked-a");
  });

  it("returns an empty URL when the card is missing", () => {
    expect(getCardDisplayImage(null, "B", false)).toBe("");
  });
});
