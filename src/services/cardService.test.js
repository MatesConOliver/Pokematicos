import { addDoc, collection, deleteField, doc, getDoc, getDocs, runTransaction, updateDoc } from "firebase/firestore";
import { getDownloadURL, ref, uploadBytes } from "firebase/storage";
import { createCard, giveCardToStudent, updateCard } from "./cardService";

jest.mock("firebase/firestore", () => ({
  addDoc: jest.fn(),
  collection: jest.fn(),
  deleteDoc: jest.fn(),
  deleteField: jest.fn(),
  doc: jest.fn(),
  getDoc: jest.fn(),
  getDocs: jest.fn(),
  runTransaction: jest.fn(),
  updateDoc: jest.fn(),
  writeBatch: jest.fn(),
}));

jest.mock("firebase/storage", () => ({
  getDownloadURL: jest.fn(),
  ref: jest.fn(),
  uploadBytes: jest.fn(),
}));

describe("cardService locked image handling", () => {
  beforeEach(() => {
    jest.clearAllMocks();
    collection.mockImplementation((_db, path) => ({ path }));
    deleteField.mockImplementation(() => ({ __type: "deleteField" }));
    doc.mockImplementation((_db, path) => ({ path }));
    ref.mockImplementation((_storage, path) => ({ path }));
    addDoc.mockResolvedValue({ id: "card-1" });
    updateDoc.mockResolvedValue(undefined);
    uploadBytes.mockImplementation(async (refObj) => ({ ref: refObj }));
    getDownloadURL.mockImplementation(async (refObj) => `https://cdn.example/${refObj.path}`);
  });

  it("omits lockedImageURL and lockedImageURL_B and skips locked uploads when creating an extra card", async () => {
    const lockedFile = { name: "locked.png" };
    const unlockedFile = { name: "unlocked.png" };
    const lockedFile_B = { name: "lockedB.png" };
    const unlockedFile_B = { name: "unlockedB.png" };

    await createCard({
      db: {},
      storage: {},
      classId: "class-1",
      title: "Bonus Card",
      description: "Extra info",
      points: 25,
      category: "extra",
      lockedFile,
      unlockedFile,
      lockedFile_B,
      unlockedFile_B,
      alertFn: jest.fn(),
    });

    expect(uploadBytes).toHaveBeenCalledTimes(2);
    expect(uploadBytes.mock.calls.map(([refObj]) => refObj.path)).toEqual([
      expect.stringContaining("_unlocked_unlocked.png"),
      expect.stringContaining("_unlockedB_unlockedB.png"),
    ]);

    expect(addDoc).toHaveBeenCalledTimes(1);
    const payload = addDoc.mock.calls[0][1];
    expect(payload.category).toBe("extra");
    expect(payload.points).toBe(0);
    expect(payload.imageURL).toContain("_unlocked_unlocked.png");
    expect(payload.imageURL_B).toContain("_unlockedB_unlockedB.png");
    expect("lockedImageURL" in payload).toBe(false);
    expect("lockedImageURL_B" in payload).toBe(false);
  });

  it("still uploads and stores lockedImageURL and lockedImageURL_B for non-extra cards", async () => {
    await createCard({
      db: {},
      storage: {},
      classId: "class-1",
      title: "Points Card",
      description: "Normal card",
      points: 10,
      category: "points",
      lockedFile: { name: "locked.png" },
      unlockedFile: { name: "unlocked.png" },
      alertFn: jest.fn(),
    });

    expect(uploadBytes).toHaveBeenCalledTimes(2);
    const payload = addDoc.mock.calls[0][1];
    expect(payload.category).toBe("points");
    expect(payload.points).toBe(10);
    expect(payload.lockedImageURL).toContain("_locked_locked.png");
    expect(payload.imageURL).toContain("_unlocked_unlocked.png");
    expect("lockedImageURL_B" in payload).toBe(true);
  });

  it("deletes lockedImageURL and lockedImageURL_B via deleteField() and skips locked uploads when updating an extra card", async () => {
    getDoc.mockResolvedValue({
      exists: () => true,
      data: () => ({
        title: "Old Card",
        category: "points",
        imageURL: "",
        lockedImageURL: "https://cdn.example/old-locked.png",
        imageURL_B: "https://cdn.example/old-unlocked-b.png",
        lockedImageURL_B: "https://cdn.example/old-locked-b.png",
      }),
    });

    await updateCard({
      db: {},
      storage: {},
      classId: "class-1",
      cardId: "card-1",
      updates: {
        title: "Converted Extra",
        description: "Updated",
        points: 50,
        category: "extra",
        lockedFile: { name: "ignored-locked.png" },
        unlockedFile: null,
        lockedFile_B: { name: "ignored-lockedB.png" },
        unlockedFile_B: { name: "new-unlockedB.png" },
      },
      alertFn: jest.fn(),
    });

    expect(uploadBytes).toHaveBeenCalledTimes(1);
    expect(uploadBytes.mock.calls[0][0].path).toContain("_unlockedB_new-unlockedB.png");

    expect(updateDoc).toHaveBeenCalledTimes(1);
    const updatePayload = updateDoc.mock.calls[0][1];
    expect(updatePayload.category).toBe("extra");
    expect(updatePayload.points).toBe(0);
    expect(updatePayload.imageURL).toBe("https://cdn.example/old-locked.png");
    expect(updatePayload.imageURL_B).toContain("_unlockedB_new-unlockedB.png");
    expect(updatePayload.lockedImageURL).toEqual({ __type: "deleteField" });
    expect(updatePayload.lockedImageURL_B).toEqual({ __type: "deleteField" });
  });

  it("saves normalized combo config on createCard and triggers combo card with multiplier on giveCardToStudent", async () => {
    await createCard({
      db: {},
      storage: {},
      classId: "class-1",
      title: "Weekly Combo",
      points: 10,
      category: "points",
      combo: {
        isCombo: true,
        period: "week",
        repeatMode: "per_period",
        requirements: [{ cardId: "base_a", count: 2 }],
      },
      alertFn: jest.fn(),
    });

    const createdPayload = addDoc.mock.calls[0][1];
    expect(createdPayload.combo).toEqual({
      isCombo: true,
      period: "week",
      repeatMode: "per_period",
      requirements: [{ cardId: "base_a", count: 2 }],
    });

    const baseCard = { id: "base_a", title: "Base A", category: "points", points: 2, linkedStreakIds: [] };
    const comboCard = {
      id: "combo_1",
      title: "Weekly Combo",
      category: "points",
      points: 10,
      combo: {
        isCombo: true,
        period: "week",
        repeatMode: "per_period",
        requirements: [{ cardId: "base_a", count: 2 }],
      },
    };
    const nowIso = new Date().toISOString();
    const studentData = {
      name: "Leo",
      currentPoints: 4,
      multiplier: 2,
      cards: [{ id: "o1", cardId: "base_a", grantedAt: nowIso }],
    };

    getDoc.mockImplementation((refObj) => {
      if (refObj.path === "classes/class-1/cards/base_a") {
        return Promise.resolve({ exists: () => true, data: () => baseCard });
      }
      if (refObj.path === "classes/class-1/students/stu-1") {
        return Promise.resolve({ exists: () => true, data: () => studentData });
      }
      return Promise.resolve({ exists: () => false });
    });

    getDocs.mockResolvedValue({
      docs: [
        { id: "base_a", data: () => baseCard },
        { id: "combo_1", data: () => comboCard },
      ],
    });

    let updatedPayload = null;
    runTransaction.mockImplementation(async (_db, fn) => {
      const tx = {
        get: () => Promise.resolve({ exists: () => true, data: () => studentData }),
        update: (_ref, payload) => {
          updatedPayload = payload;
        },
      };
      await fn(tx);
    });

    await giveCardToStudent({
      db: {},
      classId: "class-1",
      studentId: "stu-1",
      cardId: "base_a",
      activeClass: { streakConfigs: [] },
      allCards: [baseCard, comboCard],
    });

    expect(updatedPayload).toBeTruthy();
    // 4 initial + (2 * 2) base_a + (10 * 2) combo_1 = 28
    expect(updatedPayload.currentPoints).toBe(28);
    expect(updatedPayload.cards.map((c) => c.cardId)).toEqual(["base_a", "base_a", "combo_1"]);
    expect(updatedPayload.cards[2].pointsGranted).toBe(20);
    expect(updatedPayload.cards[2].autoFrom?.type).toBe("combo");
  });
});
