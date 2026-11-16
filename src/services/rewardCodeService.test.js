import { reconcileAndEnrichStudentHistory } from "./rewardCodeService";
import { collection, doc, getDocs, updateDoc } from "firebase/firestore";

jest.mock("firebase/firestore", () => ({
  collection: jest.fn(),
  doc: jest.fn(),
  getDoc: jest.fn(),
  getDocs: jest.fn(),
  setDoc: jest.fn(),
  updateDoc: jest.fn(),
  deleteDoc: jest.fn(),
  writeBatch: jest.fn(),
  serverTimestamp: jest.fn(() => "SERVER_TS"),
}));

function makeSnapshot(items) {
  return {
    docs: items.map((item, idx) => ({
      id: item.id || `doc_${idx}`,
      data: () => item,
    })),
  };
}

describe("reconcileAndEnrichStudentHistory", () => {
  beforeEach(() => {
    jest.clearAllMocks();
    collection.mockImplementation((_db, path) => ({ path }));
    doc.mockImplementation((_db, path) => ({ path }));
    updateDoc.mockResolvedValue(undefined);
  });

  test("resolves cardId from activityCatalogue when legacy achievement doc has no cardId", async () => {
    getDocs.mockImplementation((ref) => {
      if (ref.path.endsWith("/achievements")) {
        return Promise.resolve(
          makeSnapshot([
            {
              id: "math_quiz1",
              sourceId: "math",
              activityId: "quiz1",
              activityName: "Fraction Quiz",
              effectivePointsAwarded: 15,
            },
          ])
        );
      }
      if (ref.path.endsWith("/activityCatalogue")) {
        return Promise.resolve(
          makeSnapshot([
            {
              id: "math_quiz1",
              sourceId: "math",
              activityId: "quiz1",
              name: "Fraction Quiz",
              rewardType: "both",
              linkedCardId: "card_fraction_fox",
              pointsAwarded: 15,
            },
          ])
        );
      }
      return Promise.resolve(makeSnapshot([]));
    });

    const student = {
      id: "student_1",
      cards: [
        {
          id: "owned_1",
          cardId: "card_fraction_fox",
          title: "Fraction Fox",
          obtainedFrom: "activity_math_quiz1",
        },
      ],
      rewardsHistory: [
        {
          id: "hist_1",
          type: "achievement",
          sourceId: "math",
          activityId: "quiz1",
          activityName: "Fraction Quiz",
          pointsAwarded: 15,
          date: "2026-01-10T10:00:00.000Z",
        },
      ],
    };

    const result = await reconcileAndEnrichStudentHistory({
      db: {},
      classId: "class_1",
      student,
    });

    expect(result).toHaveLength(1);
    expect(result[0].cardId).toBe("card_fraction_fox");
    expect(result[0].cardTitle).toBe("Fraction Fox");
    expect(result[0].type).toBe("achievement_card");
    expect(result[0].isCodeRedemption).toBe(true);
    expect(updateDoc).toHaveBeenCalledTimes(1);
  });

  test("does not attach a card to points-only activities even if catalogue has stale cardId", async () => {
    getDocs.mockImplementation((ref) => {
      if (ref.path.endsWith("/achievements")) {
        return Promise.resolve(makeSnapshot([]));
      }
      if (ref.path.endsWith("/activityCatalogue")) {
        return Promise.resolve(
          makeSnapshot([
            {
              id: "app_pts",
              sourceId: "app",
              activityId: "pts",
              name: "Daily Practice",
              rewardType: "points",
              cardId: "stale_card",
              pointsAwarded: 10,
            },
          ])
        );
      }
      return Promise.resolve(makeSnapshot([]));
    });

    const student = {
      id: "student_2",
      cards: [],
      rewardsHistory: [
        {
          id: "hist_pts",
          isCodeRedemption: true,
          type: "achievement",
          source: "app",
          sourceId: "app",
          activityId: "pts",
          activityName: "Daily Practice",
          pointsAwarded: 10,
          cardId: null,
          date: "2026-01-11T10:00:00.000Z",
        },
      ],
    };

    const result = await reconcileAndEnrichStudentHistory({
      db: {},
      classId: "class_1",
      student,
    });

    expect(result).toHaveLength(1);
    expect(result[0].cardId).toBeNull();
    expect(result[0].type).toBe("achievement");
    expect(updateDoc).not.toHaveBeenCalled();
  });

  test("recovers missing achievement from subcollection and resolves card via obtainedFrom", async () => {
    getDocs.mockImplementation((ref) => {
      if (ref.path.endsWith("/achievements")) {
        return Promise.resolve(
          makeSnapshot([
            {
              id: "geo_puzzle2",
              sourceId: "geo",
              activityId: "puzzle2",
              activityName: "Triangle Quest",
              pointsAwarded: 20,
              redeemedAt: "2026-01-12T12:00:00.000Z",
            },
          ])
        );
      }
      if (ref.path.endsWith("/activityCatalogue")) {
        return Promise.resolve(makeSnapshot([]));
      }
      return Promise.resolve(makeSnapshot([]));
    });

    const student = {
      id: "student_3",
      cards: [
        {
          id: "owned_2",
          cardId: "card_triangle",
          title: "Triangle Titan",
          obtainedFrom: "activity_geo_puzzle2",
        },
      ],
      rewardsHistory: [],
    };

    const result = await reconcileAndEnrichStudentHistory({
      db: {},
      classId: "class_1",
      student,
    });

    expect(result).toHaveLength(1);
    expect(result[0].cardId).toBe("card_triangle");
    expect(result[0].cardTitle).toBe("Triangle Titan");
    expect(result[0].type).toBe("achievement_card");
    expect(updateDoc).toHaveBeenCalledTimes(1);
  });
});
