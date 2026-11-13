import {
  isEvolutionCard,
  checkEvolutionEligibility,
  isCardUnlockedForStudent,
  executeEvolution,
} from "./cardEvolutionService";
import { doc, runTransaction } from "firebase/firestore";

jest.mock("firebase/firestore", () => ({
  doc: jest.fn(),
  runTransaction: jest.fn(),
}));

describe("cardEvolutionService", () => {
  describe("isEvolutionCard", () => {
    test("identifies cards with evolution configuration", () => {
      expect(isEvolutionCard(null)).toBe(false);
      expect(isEvolutionCard({})).toBe(false);
      expect(isEvolutionCard({ evolution: { isEvolution: true } })).toBe(true);
      expect(isEvolutionCard({ evolution: { baseCardId: "card_1" } })).toBe(true);
      expect(isEvolutionCard({ evolution: {} })).toBe(false);
    });
  });

  describe("checkEvolutionEligibility", () => {
    const baseEvolutionCard = {
      id: "card_raichu",
      title: "Raichu",
      evolution: {
        isEvolution: true,
        baseCardId: "card_pikachu",
        requiredCopies: 3,
        catalystCardId: "item_thunder_stone",
      },
    };

    test("returns canEvolve: false if student has no cards", () => {
      const student = { cards: [] };
      const res = checkEvolutionEligibility({
        student,
        evolutionCard: baseEvolutionCard,
      });

      expect(res.canEvolve).toBe(false);
      expect(res.currentCopies).toBe(0);
      expect(res.requiredCopies).toBe(3);
      expect(res.hasCopies).toBe(false);
      expect(res.hasCatalyst).toBe(false);
      expect(res.isAlreadyUnlocked).toBe(false);
    });

    test("returns canEvolve: false if student has 2/3 base cards and has catalyst", () => {
      const student = {
        cards: [
          { cardId: "card_pikachu" },
          { cardId: "card_pikachu" },
          { cardId: "item_thunder_stone" },
        ],
      };
      const res = checkEvolutionEligibility({
        student,
        evolutionCard: baseEvolutionCard,
      });

      expect(res.canEvolve).toBe(false);
      expect(res.currentCopies).toBe(2);
      expect(res.hasCopies).toBe(false);
      expect(res.hasCatalyst).toBe(true);
    });

    test("returns canEvolve: false if student has 3/3 base cards but NO catalyst", () => {
      const student = {
        cards: [
          { cardId: "card_pikachu" },
          { cardId: "card_pikachu" },
          { cardId: "card_pikachu" },
        ],
      };
      const res = checkEvolutionEligibility({
        student,
        evolutionCard: baseEvolutionCard,
      });

      expect(res.canEvolve).toBe(false);
      expect(res.currentCopies).toBe(3);
      expect(res.hasCopies).toBe(true);
      expect(res.hasCatalyst).toBe(false);
    });

    test("returns canEvolve: true if student has 3/3 base cards and has catalyst", () => {
      const student = {
        cards: [
          { cardId: "card_pikachu" },
          { cardId: "card_pikachu" },
          { cardId: "card_pikachu" },
          { cardId: "item_thunder_stone" },
        ],
      };
      const res = checkEvolutionEligibility({
        student,
        evolutionCard: baseEvolutionCard,
      });

      expect(res.canEvolve).toBe(true);
      expect(res.currentCopies).toBe(3);
      expect(res.hasCopies).toBe(true);
      expect(res.hasCatalyst).toBe(true);
      expect(res.isAlreadyUnlocked).toBe(false);
    });

    test("returns canEvolve: false if student already unlocked this evolution", () => {
      const student = {
        cards: [
          { cardId: "card_pikachu" },
          { cardId: "card_pikachu" },
          { cardId: "card_pikachu" },
          { cardId: "item_thunder_stone" },
        ],
        unlockedEvolutionIds: ["card_raichu"],
      };
      const res = checkEvolutionEligibility({
        student,
        evolutionCard: baseEvolutionCard,
      });

      expect(res.canEvolve).toBe(false);
      expect(res.isAlreadyUnlocked).toBe(true);
    });

    test("uses class catalyst fallback when card has no specific catalystCardId", () => {
      const genericEvoCard = {
        id: "card_charizard",
        title: "Charizard",
        evolution: {
          isEvolution: true,
          baseCardId: "card_charmeleon",
          requiredCopies: 2,
        },
      };

      const student = {
        cards: [
          { cardId: "card_charmeleon" },
          { cardId: "card_charmeleon" },
          { cardId: "class_default_stone" },
        ],
      };

      const res = checkEvolutionEligibility({
        student,
        evolutionCard: genericEvoCard,
        catalystCardId: "class_default_stone",
      });

      expect(res.canEvolve).toBe(true);
      expect(res.hasCatalyst).toBe(true);
      expect(res.catalystCount).toBe(1);
    });

    test("returns canEvolve: false and missingCatalystConfig: true when no catalyst is configured anywhere", () => {
      const genericEvoCard = {
        id: "card_charizard",
        title: "Charizard",
        evolution: {
          isEvolution: true,
          baseCardId: "card_charmeleon",
          requiredCopies: 2,
        },
      };

      const student = {
        cards: [
          { cardId: "card_charmeleon" },
          { cardId: "card_charmeleon" },
        ],
      };

      const res = checkEvolutionEligibility({
        student,
        evolutionCard: genericEvoCard,
      });

      expect(res.canEvolve).toBe(false);
      expect(res.hasCatalyst).toBe(false);
      expect(res.missingCatalystConfig).toBe(true);
    });
  });

  describe("isCardUnlockedForStudent", () => {
    const normalCard = { id: "card_1", title: "Normal" };
    const evoCard = {
      id: "card_evo",
      title: "Evolved",
      evolution: { isEvolution: true, baseCardId: "card_1", requiredCopies: 3 },
    };

    test("returns true for normal cards", () => {
      expect(isCardUnlockedForStudent({ unlockedEvolutionIds: [] }, normalCard)).toBe(true);
      expect(isCardUnlockedForStudent(null, normalCard)).toBe(true);
    });

    test("returns false for locked evolution cards and true once unlocked", () => {
      expect(isCardUnlockedForStudent(null, evoCard)).toBe(false);
      expect(isCardUnlockedForStudent({ unlockedEvolutionIds: [] }, evoCard)).toBe(false);
      expect(isCardUnlockedForStudent({ unlockedEvolutionIds: ["card_evo"] }, evoCard)).toBe(true);
    });
  });

  describe("executeEvolution", () => {
    test("unlocks evolution and consumes 1 catalyst without granting evolved card automatically", async () => {
      const studentData = {
        cards: [
          { id: "o1", cardId: "card_pikachu" },
          { id: "o2", cardId: "card_pikachu" },
          { id: "o3", cardId: "card_pikachu" },
          { id: "c1", cardId: "item_stone" },
        ],
        unlockedEvolutionIds: [],
        rewardsHistory: [],
      };
      const evoCardData = {
        title: "Raichu",
        evolution: {
          isEvolution: true,
          baseCardId: "card_pikachu",
          requiredCopies: 3,
          catalystCardId: "item_stone",
        },
      };

      doc.mockImplementation((_db, path) => ({ path }));
      const txUpdate = jest.fn();
      runTransaction.mockImplementation(async (_db, fn) =>
        fn({
          get: jest.fn(async (ref) => {
            if (ref.path.includes("/students/")) {
              return { exists: () => true, id: "stu_1", data: () => studentData };
            }
            return { exists: () => true, id: "card_raichu", data: () => evoCardData };
          }),
          update: txUpdate,
        })
      );

      await executeEvolution({
        db: {},
        classId: "class_1",
        studentId: "stu_1",
        evolutionCardId: "card_raichu",
      });

      expect(txUpdate).toHaveBeenCalledTimes(1);
      const updatePayload = txUpdate.mock.calls[0][1];
      expect(updatePayload.unlockedEvolutionIds).toEqual(["card_raichu"]);
      // Preserves all 3 base cards, consumes the 1 catalyst, and does NOT add card_raichu
      expect(updatePayload.cards).toHaveLength(3);
      expect(updatePayload.cards.every((c) => c.cardId === "card_pikachu")).toBe(true);
    });
  });
});
