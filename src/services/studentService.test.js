import { editStudent } from "./studentService";
import { doc, getDoc, updateDoc } from "firebase/firestore";

jest.mock("firebase/firestore", () => ({
  collection: jest.fn(),
  doc: jest.fn(),
  addDoc: jest.fn(),
  getDoc: jest.fn(),
  updateDoc: jest.fn(),
  deleteDoc: jest.fn(),
}));

describe("editStudent manual XP handling", () => {
  const allCards = [
    { id: "xp_20", title: "Level 1", category: "experience", points: 20, multiplierBonus: 0.1 },
    { id: "xp_50", title: "Level 2", category: "experience", points: 50, multiplierBonus: 0.25 },
    { id: "xp_100", title: "Level 3", category: "experience", points: 100, multiplierBonus: 0.5 },
  ];

  beforeEach(() => {
    jest.clearAllMocks();
    doc.mockImplementation((_db, path) => ({ path }));
    updateDoc.mockResolvedValue(undefined);
  });

  test("grants newly reached XP cards when XP is increased manually", async () => {
    getDoc.mockResolvedValue({
      exists: () => true,
      data: () => ({
        xp: 25,
        cards: [{ id: "owned_1", cardId: "xp_20", title: "Level 1" }],
      }),
    });

    const alertFn = jest.fn();

    await editStudent(
      {},
      "class_1",
      "stu_1",
      { name: "Ana", currentPoints: 10, xp: 100, multiplier: 1 },
      alertFn,
      allCards
    );

    expect(updateDoc).toHaveBeenCalledTimes(1);
    const [, payload] = updateDoc.mock.calls[0];
    expect(payload.xp).toBe(100);
    expect(payload.cards.map((c) => c.cardId)).toEqual(["xp_20", "xp_50", "xp_100"]);
    expect(alertFn).toHaveBeenCalledWith(
      expect.objectContaining({
        message: "Unlocked 2 new Experience Card(s)!",
        cards: expect.arrayContaining([
          expect.objectContaining({ id: "xp_50" }),
          expect.objectContaining({ id: "xp_100" }),
        ]),
      })
    );
  });

  test("does NOT remove previously owned XP cards when XP is lowered manually", async () => {
    getDoc.mockResolvedValue({
      exists: () => true,
      data: () => ({
        xp: 120,
        cards: [
          { id: "owned_1", cardId: "xp_20", title: "Level 1" },
          { id: "owned_2", cardId: "xp_50", title: "Level 2" },
          { id: "owned_3", cardId: "xp_100", title: "Level 3" },
        ],
      }),
    });

    const alertFn = jest.fn();

    await editStudent(
      {},
      "class_1",
      "stu_1",
      { name: "Ana", currentPoints: 10, xp: 10, multiplier: 1 },
      alertFn,
      allCards
    );

    expect(updateDoc).toHaveBeenCalledTimes(1);
    const [, payload] = updateDoc.mock.calls[0];
    expect(payload.xp).toBe(10);
    expect(payload.cards).toBeUndefined();
    expect(alertFn).not.toHaveBeenCalled();
  });
});
