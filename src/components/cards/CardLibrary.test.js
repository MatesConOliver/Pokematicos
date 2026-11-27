import React from "react";
import { renderToStaticMarkup } from "react-dom/server";
import { DEFAULT_LIBRARY_TAB, getVisibleLibraryTabs } from "./CardLibrary";
import LibraryCardRow from "./LibraryCardRow";
import CardPreviewModal from "./CardPreviewModal";

describe("CardLibrary visible tabs", () => {
  test("defaults to notices (News) tab for all modes", () => {
    expect(DEFAULT_LIBRARY_TAB).toBe("notices");
    expect(getVisibleLibraryTabs("admin")).toContain(DEFAULT_LIBRARY_TAB);
    expect(getVisibleLibraryTabs("guest")).toContain(DEFAULT_LIBRARY_TAB);
  });

  test("includes extra tab for admin between experience and study", () => {
    expect(getVisibleLibraryTabs("admin")).toEqual([
      "points",
      "rewards",
      "experience",
      "extra",
      "study",
      "notices",
    ]);
  });

  test("hides extra tab for non-admin users", () => {
    expect(getVisibleLibraryTabs("guest")).toEqual([
      "points",
      "rewards",
      "experience",
      "study",
      "notices",
    ]);
    expect(getVisibleLibraryTabs(undefined)).not.toContain("extra");
  });
});

describe("Combo display in Points Library & CardPreviewModal", () => {
  const cardA = { id: "card_a", title: "Secret Card Alpha", category: "points", points: 2 };
  const cardB = { id: "card_b", title: "Secret Card Beta", category: "points", points: 3 };
  const comboCard = {
    id: "combo_1",
    title: "Weekly Trio",
    category: "points",
    points: 10,
    combo: {
      isCombo: true,
      period: "week",
      repeatMode: "per_period",
      requirements: [
        { cardId: "card_a", count: 1 },
        { cardId: "card_b", count: 3 },
      ],
    },
  };
  const cardsById = new Map([
    [cardA.id, cardA],
    [cardB.id, cardB],
    [comboCard.id, comboCard],
  ]);

  test("LibraryCardRow renders 'X cards combo' without listing required card names", () => {
    const html = renderToStaticMarkup(
      <LibraryCardRow
        c={comboCard}
        mode="guest"
        cardsById={cardsById}
        activeStudent={null}
      />
    );

    expect(html).toContain("4 cards combo");
    expect(html).not.toContain("Secret Card Alpha");
    expect(html).not.toContain("Secret Card Beta");
  });

  test("CardPreviewModal shows currentCount/requiredCount (e.g. 0/1, 3/3) instead of 'x required'", () => {
    const guestHtml = renderToStaticMarkup(
      <CardPreviewModal
        cardPreview={{ ...comboCard, isLibraryCard: true }}
        mode="guest"
        cardsById={cardsById}
        activeStudent={null}
      />
    );

    expect(guestHtml).toContain("Secret Card Alpha");
    expect(guestHtml).toContain("0/1");
    expect(guestHtml).toContain("0/3");
    expect(guestHtml).not.toContain("1 required");
    expect(guestHtml).not.toContain("3 required");

    const nowIso = new Date().toISOString();
    const studentHtml = renderToStaticMarkup(
      <CardPreviewModal
        cardPreview={{ ...comboCard, isLibraryCard: true }}
        mode="guest"
        cardsById={cardsById}
        activeStudent={{
          id: "stu_1",
          name: "Ana",
          cards: [
            { id: "o1", cardId: "card_b", grantedAt: nowIso },
            { id: "o2", cardId: "card_b", grantedAt: nowIso },
            { id: "o3", cardId: "card_b", grantedAt: nowIso },
          ],
        }}
      />
    );

    expect(studentHtml).toContain("0/1");
    expect(studentHtml).toContain("3/3");
  });
});
