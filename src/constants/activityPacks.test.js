import { PREDEFINED_ACTIVITY_PACKS } from "./activityPacks.js";
import { generateRewardCode, decodeRewardCode } from "../utils/rewardCodeUtils.js";

describe("PREDEFINED_ACTIVITY_PACKS", () => {
  test("Statistics pack has 12 activities totaling 36 points and valid IDs", () => {
    const estadi = PREDEFINED_ACTIVITY_PACKS.estadi;
    expect(estadi.activities).toHaveLength(12);

    const totalPoints = estadi.activities.reduce((sum, a) => sum + a.pointsAwarded, 0);
    expect(totalPoints).toBe(36);

    const seen = new Set();
    for (const act of estadi.activities) {
      expect(act.sourceId).toBe("Estadi");
      expect(act.activityId.length).toBeGreaterThan(0);
      expect(act.activityId.length).toBeLessThanOrEqual(6);
      expect(seen.has(act.activityId)).toBe(false);
      seen.add(act.activityId);

      const code = generateRewardCode("student123", act.sourceId, act.activityId);
      const decoded = decodeRewardCode(code);
      expect(decoded.success).toBe(true);
      expect(decoded.sourceId).toBe(act.sourceId);
      expect(decoded.activityId).toBe(act.activityId);
    }
  });

  test("Probability pack has 13 activities totaling 43 points including selJus", () => {
    const probab = PREDEFINED_ACTIVITY_PACKS.probab;
    expect(probab.activities).toHaveLength(13);

    const totalPoints = probab.activities.reduce((sum, a) => sum + a.pointsAwarded, 0);
    expect(totalPoints).toBe(43);

    const selJus = probab.activities.find((a) => a.activityId === "selJus");
    expect(selJus).toBeDefined();
    expect(selJus.pointsAwarded).toBe(10);

    const seen = new Set();
    for (const act of probab.activities) {
      expect(act.sourceId).toBe("Probab");
      expect(act.activityId.length).toBeGreaterThan(0);
      expect(act.activityId.length).toBeLessThanOrEqual(6);
      expect(seen.has(act.activityId)).toBe(false);
      seen.add(act.activityId);

      const code = generateRewardCode("student123", act.sourceId, act.activityId);
      const decoded = decodeRewardCode(code);
      expect(decoded.success).toBe(true);
      expect(decoded.sourceId).toBe(act.sourceId);
      expect(decoded.activityId).toBe(act.activityId);
    }
  });
});
