import {
  getNaturalPeriodKey,
  normalizeComboConfig,
  isComboCard,
  evaluateComboProgress,
  applyComboCardGrants,
} from "./cardComboService";

describe("cardComboService", () => {
  describe("getNaturalPeriodKey", () => {
    test("computes local day and month keys", () => {
      const wed = new Date(2026, 10, 25, 14, 30, 0); // Wed Nov 25 2026
      expect(getNaturalPeriodKey("day", wed)).toBe("2026-11-25");
      expect(getNaturalPeriodKey("month", wed)).toBe("2026-11");
    });

    test("computes natural Monday-Sunday week keys consistently across month/year boundaries", () => {
      const mon = new Date(2026, 10, 23, 9, 0, 0); // Mon Nov 23 2026
      const sun = new Date(2026, 10, 29, 23, 59, 0); // Sun Nov 29 2026
      const nextMon = new Date(2026, 10, 30, 0, 5, 0); // Mon Nov 30 2026

      expect(getNaturalPeriodKey("week", mon)).toBe("W:2026-11-23");
      expect(getNaturalPeriodKey("week", sun)).toBe("W:2026-11-23");
      expect(getNaturalPeriodKey("week", nextMon)).toBe("W:2026-11-30");

      // Year boundary: Mon Dec 29 2025 -> Sun Jan 4 2026
      const dec30 = new Date(2025, 11, 30, 12, 0, 0);
      const jan4 = new Date(2026, 0, 4, 18, 0, 0);
      expect(getNaturalPeriodKey("week", dec30)).toBe("W:2025-12-29");
      expect(getNaturalPeriodKey("week", jan4)).toBe("W:2025-12-29");
    });
  });

  describe("normalizeComboConfig", () => {
    test("returns null for non-points categories, disabled combos, or empty requirements", () => {
      expect(
        normalizeComboConfig({ isCombo: true, period: "day", requirements: [{ cardId: "a", count: 1 }] }, { category: "rewards" })
      ).toBeNull();
      expect(
        normalizeComboConfig({ isCombo: false, period: "day", requirements: [{ cardId: "a", count: 1 }] })
      ).toBeNull();
      expect(
        normalizeComboConfig({ isCombo: true, period: "day", requirements: [] })
      ).toBeNull();
    });

    test("merges duplicate cardIds and excludes self cardId", () => {
      const cfg = normalizeComboConfig(
        {
          isCombo: true,
          period: "month",
          repeatMode: "once",
          requirements: [
            { cardId: "c1", count: 2 },
            { cardId: "c1", count: 1 },
            { cardId: "self", count: 1 },
            { cardId: "c2", count: 0 },
          ],
        },
        { category: "points", excludeCardId: "self" }
      );

      expect(cfg).toEqual({
        isCombo: true,
        period: "month",
        repeatMode: "once",
        requirements: [
          { cardId: "c1", count: 3 },
          { cardId: "c2", count: 1 },
        ],
      });
    });
  });

  describe("evaluateComboProgress & applyComboCardGrants", () => {
    const cardA = { id: "card_a", title: "Card A", category: "points", points: 2 };
    const cardB = { id: "card_b", title: "Card B", category: "points", points: 3 };
    const comboWeekly = {
      id: "combo_weekly",
      title: "Weekly Collector",
      category: "points",
      points: 10,
      imageURL: "https://example.com/combo.png",
      combo: {
        isCombo: true,
        period: "week",
        repeatMode: "per_period",
        requirements: [
          { cardId: "card_a", count: 2 },
          { cardId: "card_b", count: 1 },
        ],
      },
    };
    const comboOnce = {
      id: "combo_once",
      title: "One-Time Master",
      category: "points",
      points: 20,
      combo: {
        isCombo: true,
        period: "month",
        repeatMode: "once",
        requirements: [{ cardId: "combo_weekly", count: 1 }],
      },
    };

    const allCards = [cardA, cardB, comboWeekly, comboOnce];

    test("isComboCard recognizes valid points combo cards only", () => {
      expect(isComboCard(cardA)).toBe(false);
      expect(isComboCard(comboWeekly)).toBe(true);
      expect(isComboCard({ ...comboWeekly, category: "rewards" })).toBe(false);
    });

    test("grants combo card with student's multiplier applied once requirements are met in the same week", () => {
      const wed = new Date(2026, 10, 25, 12, 0, 0);
      const mon = new Date(2026, 10, 23, 10, 0, 0).toISOString();
      const lastWeekSun = new Date(2026, 10, 22, 18, 0, 0).toISOString();

      const cardsArr = [
        { id: "o1", cardId: "card_a", grantedAt: lastWeekSun }, // previous week -> ignored
        { id: "o2", cardId: "card_a", grantedAt: mon },
        { id: "o3", cardId: "card_a", grantedAt: wed.toISOString() },
        { id: "o4", cardId: "card_b", grantedAt: wed.toISOString() },
      ];

      const res = applyComboCardGrants({
        cardsArr,
        currentPoints: 5,
        multiplier: 1.5,
        allCards,
        now: wed,
      });

      // Chained: comboWeekly unlocks (+10 * 1.5 = +15) AND triggers comboOnce (+20 * 1.5 = +30)
      expect(res.grantedComboCards.map((g) => g.cardId)).toEqual(["combo_weekly", "combo_once"]);
      expect(res.currentPoints).toBe(50);
      expect(cardsArr).toHaveLength(6);
      expect(cardsArr[4].pointsGranted).toBe(15);
      expect(cardsArr[4].autoFrom).toEqual({
        type: "combo",
        comboCardId: "combo_weekly",
        period: "week",
        periodKey: "W:2026-11-23",
      });

      // Running again in the same week must NOT re-grant
      const resRepeat = applyComboCardGrants({
        cardsArr,
        currentPoints: res.currentPoints,
        multiplier: 1.5,
        allCards,
        now: wed,
      });
      expect(resRepeat.grantedComboCards).toEqual([]);
      expect(resRepeat.currentPoints).toBe(50);
    });

    test("per_period combo can be re-earned in the next natural period, while once combo cannot", () => {
      const week1 = new Date(2026, 10, 25, 12, 0, 0);
      const week2SameMonth = new Date(2026, 10, 30, 12, 0, 0); // Mon Nov 30 (new week, same month)

      const cardsArr = [
        { id: "o1", cardId: "card_a", grantedAt: week1.toISOString() },
        { id: "o2", cardId: "card_a", grantedAt: week1.toISOString() },
        { id: "o3", cardId: "card_b", grantedAt: week1.toISOString() },
      ];

      const first = applyComboCardGrants({
        cardsArr,
        currentPoints: 0,
        multiplier: 1,
        allCards,
        now: week1,
      });
      expect(first.grantedComboCards.map((g) => g.cardId)).toEqual(["combo_weekly", "combo_once"]);

      // Now in week 2, earn 2x A and 1x B again
      cardsArr.push(
        { id: "o4", cardId: "card_a", grantedAt: week2SameMonth.toISOString() },
        { id: "o5", cardId: "card_a", grantedAt: week2SameMonth.toISOString() },
        { id: "o6", cardId: "card_b", grantedAt: week2SameMonth.toISOString() }
      );

      const second = applyComboCardGrants({
        cardsArr,
        currentPoints: first.currentPoints,
        multiplier: 2,
        allCards,
        now: week2SameMonth,
      });
      expect(second.grantedComboCards.map((g) => g.cardId)).toEqual(["combo_weekly"]);
      expect(second.currentPoints).toBe(30 + 20); // 10 * 2 added

      // Check once-only remains claimed in next month too
      const nextMonth = new Date(2026, 11, 5, 12, 0, 0);
      const onceProgress = evaluateComboProgress({
        student: { cards: cardsArr },
        comboCard: comboOnce,
        allCards,
        now: nextMonth,
      });
      expect(onceProgress.isAlreadyClaimed).toBe(true);
      expect(onceProgress.canTriggerNow).toBe(false);
    });

    test("recomputes progress dynamically if admin deletes a required card", () => {
      const today = new Date(2026, 10, 27, 15, 0, 0);
      const studentBeforeDelete = {
        cards: [
          { id: "o1", cardId: "card_a", grantedAt: today.toISOString() },
          { id: "o2", cardId: "card_a", grantedAt: today.toISOString() },
        ],
      };
      const p1 = evaluateComboProgress({
        student: studentBeforeDelete,
        comboCard: comboWeekly,
        allCards,
        now: today,
      });
      expect(p1.requirementsProgress[0].currentCount).toBe(2);
      expect(p1.requirementsProgress[0].met).toBe(true);

      const studentAfterDelete = {
        cards: [{ id: "o1", cardId: "card_a", grantedAt: today.toISOString() }],
      };
      const p2 = evaluateComboProgress({
        student: studentAfterDelete,
        comboCard: comboWeekly,
        allCards,
        now: today,
      });
      expect(p2.requirementsProgress[0].currentCount).toBe(1);
      expect(p2.requirementsProgress[0].met).toBe(false);
    });

    test("blocks combo+evolution card until evolution is unlocked, then grants once unlocked", () => {
      const today = new Date(2026, 10, 27, 15, 0, 0);
      const evoCombo = {
        id: "evo_combo",
        title: "Mega Combo",
        category: "points",
        points: 15,
        evolution: {
          isEvolution: true,
          baseCardId: "card_a",
          requiredCopies: 2,
        },
        combo: {
          isCombo: true,
          period: "day",
          repeatMode: "once",
          requirements: [
            { cardId: "card_a", count: 2 },
            { cardId: "card_b", count: 1 },
          ],
        },
      };

      const cardsArr = [
        { id: "o1", cardId: "card_a", grantedAt: today.toISOString() },
        { id: "o2", cardId: "card_a", grantedAt: today.toISOString() },
        { id: "o3", cardId: "card_b", grantedAt: today.toISOString() },
      ];

      // Before evolution is unlocked: progress tracks requirements, but evolutionLocked = true prevents trigger
      const lockedProg = evaluateComboProgress({
        student: { cards: cardsArr, unlockedEvolutionIds: [] },
        comboCard: evoCombo,
        allCards: [cardA, cardB, evoCombo],
        now: today,
      });
      expect(lockedProg.isCompleteNow).toBe(true);
      expect(lockedProg.evolutionLocked).toBe(true);
      expect(lockedProg.canTriggerNow).toBe(false);

      const blockedGrant = applyComboCardGrants({
        cardsArr,
        currentPoints: 0,
        multiplier: 2,
        allCards: [cardA, cardB, evoCombo],
        now: today,
        student: { unlockedEvolutionIds: [] },
      });
      expect(blockedGrant.grantedComboCards).toEqual([]);
      expect(cardsArr).toHaveLength(3);

      // After evolution is unlocked: triggers immediately with multiplier applied
      const unlockedGrant = applyComboCardGrants({
        cardsArr,
        currentPoints: 0,
        multiplier: 2,
        allCards: [cardA, cardB, evoCombo],
        now: today,
        student: { unlockedEvolutionIds: ["evo_combo"] },
      });
      expect(unlockedGrant.grantedComboCards.map((g) => g.cardId)).toEqual(["evo_combo"]);
      expect(unlockedGrant.currentPoints).toBe(30);
      expect(cardsArr).toHaveLength(4);
    });
  });
});
