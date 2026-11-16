import { collectBatchFloatingMaxHits, prepareBatchFloatSchedules } from "./requestService";
import { doc, getDoc } from "firebase/firestore";

jest.mock("firebase/firestore", () => ({
  addDoc: jest.fn(),
  collection: jest.fn(),
  deleteDoc: jest.fn(),
  doc: jest.fn(),
  getDoc: jest.fn(),
  getDocs: jest.fn(),
  query: jest.fn(),
  where: jest.fn(),
}));

describe("batch request floating streak scheduling", () => {
  beforeEach(() => {
    jest.clearAllMocks();
    doc.mockImplementation((_db, path) => ({ path }));
  });

  test("collectBatchFloatingMaxHits groups all students hitting max for each floating streak", () => {
    const classById = new Map([
      [
        "c1",
        {
          id: "c1",
          streakConfigs: [
            { id: "fire", emoji: "🔥", max: 3, float: true },
            { id: "star", emoji: "⭐", max: 2, float: false },
          ],
        },
      ],
    ]);

    const cardByKey = new Map([
      ["c1:card_a", { id: "card_a", category: "points", linkedStreakIds: ["fire", "star"] }],
    ]);

    const studentByKey = new Map([
      ["c1:s1", { id: "s1", name: "Ana", streaks: { fire: { value: 2, lastUpdated: "2026-11-14" } } }],
      ["c1:s2", { id: "s2", name: "Leo", streaks: { fire: { value: 2, lastUpdated: "2026-11-14" } } }],
      ["c1:s3", { id: "s3", name: "Mia", streaks: { fire: { value: 1, lastUpdated: "2026-11-14" } } }], // not max yet
      ["c1:s4", { id: "s4", name: "Zoe", streaks: { fire: { value: 2, lastUpdated: "2026-11-15" } } }], // already updated today
    ]);

    const requests = [
      { id: "r1", classId: "c1", studentId: "s1", cardId: "card_a", type: "card" },
      { id: "r2", classId: "c1", studentId: "s1", cardId: "card_a", type: "card" }, // duplicate student in batch
      { id: "r3", classId: "c1", studentId: "s2", cardId: "card_a", type: "card" },
      { id: "r4", classId: "c1", studentId: "s3", cardId: "card_a", type: "card" },
      { id: "r5", classId: "c1", studentId: "s4", cardId: "card_a", type: "card" },
    ];

    const hits = collectBatchFloatingMaxHits({
      requests,
      classById,
      cardByKey,
      studentByKey,
      today: "2026-11-15",
    });

    expect(hits.size).toBe(1);
    const fireGroup = hits.get("c1:fire");
    expect(fireGroup.students.map((s) => s.studentName)).toEqual(["Ana", "Leo"]);
  });

  test("prepareBatchFloatSchedules prompts once and reuses the schedule for all affected students", async () => {
    const classData = {
      id: "c1",
      streakConfigs: [{ id: "fire", emoji: "🔥", max: 3, float: true }],
    };
    const cardData = { id: "card_a", category: "points", linkedStreakIds: ["fire"] };
    const studentsData = {
      s1: { id: "s1", name: "Ana", streaks: { fire: { value: 2, lastUpdated: "2026-11-14" } } },
      s2: { id: "s2", name: "Leo", streaks: { fire: { value: 2, lastUpdated: "2026-11-14" } } },
    };

    getDoc.mockImplementation((ref) => {
      if (ref.path === "classes/c1") return Promise.resolve({ exists: () => true, data: () => classData });
      if (ref.path === "classes/c1/cards/card_a") return Promise.resolve({ exists: () => true, data: () => cardData });
      if (ref.path === "classes/c1/students/s1") return Promise.resolve({ exists: () => true, data: () => studentsData.s1 });
      if (ref.path === "classes/c1/students/s2") return Promise.resolve({ exists: () => true, data: () => studentsData.s2 });
      return Promise.resolve({ exists: () => false });
    });

    const chosenSchedule = { delayDays: 3, durationDays: 5, multiplierBonus: 0.5 };
    const scheduleFn = jest.fn().mockResolvedValue(chosenSchedule);

    const requests = [
      { id: "r1", classId: "c1", studentId: "s1", cardId: "card_a", type: "card" },
      { id: "r2", classId: "c1", studentId: "s2", cardId: "card_a", type: "card" },
    ];

    const { batchScheduleFn } = await prepareBatchFloatSchedules({
      db: {},
      requests,
      scheduleFn,
    });

    expect(scheduleFn).toHaveBeenCalledTimes(1);
    expect(scheduleFn.mock.calls[0][0].message).toContain("2 students: Ana, Leo");

    const res1 = await batchScheduleFn({ classId: "c1", streakId: "fire" });
    const res2 = await batchScheduleFn({ classId: "c1", streakId: "fire" });
    expect(res1).toEqual(chosenSchedule);
    expect(res2).toEqual(chosenSchedule);
    expect(scheduleFn).toHaveBeenCalledTimes(1);
  });
});
