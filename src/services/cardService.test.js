import { addDoc, collection, deleteField, doc, getDoc, updateDoc } from "firebase/firestore";
import { getDownloadURL, ref, uploadBytes } from "firebase/storage";
import { createCard, updateCard } from "./cardService";

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
});
