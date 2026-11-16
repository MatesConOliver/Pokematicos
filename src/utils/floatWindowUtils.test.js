import { computeEffectiveMultiplier } from "./floatWindowUtils";

describe("computeEffectiveMultiplier", () => {
  const allCards = [
    { id: "xp_1", title: "Scholar I", category: "experience", points: 50, multiplierBonus: 0.25 },
    { id: "xp_2", title: "Scholar II", category: "experience", points: 100, multiplierBonus: 0.5 },
    { id: "pts_1", title: "Homework", category: "points", points: 5, multiplierBonus: 99 },
  ];

  test("combines base multiplier, active float windows, and unique owned XP card bonuses", () => {
    const student = {
      multiplier: 1.5,
      streaks: {
        s1: {
          floatWindows: [
            { start: "2026-11-10", end: "2026-11-20", multiplierBonus: 0.2 },
            { start: "2026-11-01", end: "2026-11-05", multiplierBonus: 5 },
          ],
        },
      },
      cards: [
        { id: "o1", cardId: "xp_1" },
        { id: "o2", cardId: "xp_1" }, // duplicate copy should NOT stack
        { id: "o3", cardId: "xp_2" },
        { id: "o4", cardId: "pts_1" }, // non-experience card should be ignored
      ],
    };

    expect(computeEffectiveMultiplier(student, "2026-11-15", allCards)).toBe(2.45);
  });

  test("falls back cleanly when allCards is omitted or student has no XP cards", () => {
    const student = {
      multiplier: 1,
      streaks: {
        s1: {
          floatWindows: [{ start: "2026-11-15", end: "2026-11-15", multiplierBonus: 0.5 }],
        },
      },
      cards: [{ id: "o1", cardId: "xp_1" }],
    };

    expect(computeEffectiveMultiplier(student, "2026-11-15")).toBe(1.5);
  });
});
