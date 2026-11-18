import { redeemIndividual, redeemGroup } from "./studentRewardService";
import { doc, updateDoc, writeBatch, increment } from "firebase/firestore";

jest.mock("firebase/firestore", () => ({
  collection: jest.fn(),
  doc: jest.fn(),
  getDoc: jest.fn(),
  getDocs: jest.fn(),
  updateDoc: jest.fn(),
  writeBatch: jest.fn(),
  increment: jest.fn((val) => ({ __increment: val })),
}));

describe("studentRewardService negative balance support", () => {
  const rewards = [{ id: "rew_1", title: "Extra Time", cost: 20, cardId: null }];
  const cards = [];

  beforeEach(() => {
    jest.clearAllMocks();
    doc.mockImplementation((_db, path) => ({ path }));
    updateDoc.mockResolvedValue(undefined);
  });

  test("redeemIndividual allows student balance to go negative without blocking or clamping", async () => {
    const students = [{ id: "stu_1", name: "Ana", currentPoints: 5, xp: 10, cards: [], rewardsHistory: [] }];
    const confirmFn = jest.fn().mockResolvedValue(true);
    const alertFn = jest.fn();

    const ok = await redeemIndividual({
      db: {},
      classId: "class_1",
      studentId: "stu_1",
      rewardId: "rew_1",
      rewards,
      students,
      cards,
      alertFn,
      confirmFn,
    });

    expect(ok).toBe(true);
    expect(confirmFn).toHaveBeenCalledWith(
      'Redeem "Extra Time" for 20 points? Balance will become -15 pts.'
    );
    expect(updateDoc).toHaveBeenCalledTimes(1);
    const [, payload] = updateDoc.mock.calls[0];
    expect(payload.currentPoints).toBe(-15);
    expect(payload.xp).toBe(30);
    expect(alertFn).not.toHaveBeenCalledWith("Not enough points!");
  });

  test("redeemIndividual supports redeeming further into negative balance", async () => {
    const students = [{ id: "stu_1", name: "Ana", currentPoints: -3.5, xp: 30, cards: [], rewardsHistory: [] }];
    const confirmFn = jest.fn().mockResolvedValue(true);

    const ok = await redeemIndividual({
      db: {},
      classId: "class_1",
      studentId: "stu_1",
      rewardId: "rew_1",
      rewards,
      students,
      cards,
      alertFn: jest.fn(),
      confirmFn,
    });

    expect(ok).toBe(true);
    const [, payload] = updateDoc.mock.calls[0];
    expect(payload.currentPoints).toBe(-23.5);
  });

  test("redeemGroup allows participant balances to go negative without clamping", async () => {
    const batchUpdate = jest.fn();
    const batchCommit = jest.fn().mockResolvedValue(undefined);
    writeBatch.mockReturnValue({ update: batchUpdate, commit: batchCommit });

    const students = [
      { id: "stu_1", name: "Ana", currentPoints: 12, xp: 0, cards: [], rewardsHistory: [] },
      { id: "stu_2", name: "Luis", currentPoints: 4, xp: 5, cards: [], rewardsHistory: [] },
    ];
    const confirmFn = jest.fn().mockResolvedValue(true);

    const ok = await redeemGroup({
      db: {},
      classId: "class_1",
      rewardId: "rew_1",
      participants: [
        ["stu_1", 10],
        ["stu_2", 10],
      ],
      rewards,
      students,
      cards,
      alertFn: jest.fn(),
      confirmFn,
    });

    expect(ok).toBe(true);
    expect(confirmFn).toHaveBeenCalledWith(
      'Redeem "Extra Time" for group? Negative balance after redeem: Luis (-6 pts).'
    );
    expect(batchUpdate).toHaveBeenCalledTimes(2);
    expect(batchUpdate.mock.calls[0][1].currentPoints).toBe(2);
    expect(batchUpdate.mock.calls[1][1].currentPoints).toBe(-6);
    expect(increment).toHaveBeenCalledWith(10);
    expect(batchCommit).toHaveBeenCalledTimes(1);
  });
});
