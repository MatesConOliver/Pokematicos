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

    expect(seen).toEqual(
      new Set([
        "cstRev",
        "cstPst",
        "cstRet",
        "cstInf",
        "cstCoh",
        "expMue",
        "expTab",
        "expAgr",
        "expDis",
        "expAud",
        "expReg",
        "pruFin",
      ])
    );
  });

  test("Probability pack has 18 activities totaling 39 points (1 pt first traces, 2 pts completion traces, 3 pts seals)", () => {
    const probab = PREDEFINED_ACTIVITY_PACKS.probab;
    expect(probab.activities).toHaveLength(18);

    const totalPoints = probab.activities.reduce((sum, a) => sum + a.pointsAwarded, 0);
    expect(totalPoints).toBe(39);

    const firstTraces = ["huePre", "hueTab", "hueAyu", "hueCon", "hueRet"];
    const completedTraces = ["huePrC", "hueTaC", "hueAyC", "hueCoC", "hueReC"];
    for (const act of probab.activities) {
      if (firstTraces.includes(act.activityId)) {
        expect(act.pointsAwarded).toBe(1);
      } else if (completedTraces.includes(act.activityId)) {
        expect(act.pointsAwarded).toBe(2);
      } else {
        expect(act.activityId.startsWith("sel")).toBe(true);
        expect(act.pointsAwarded).toBe(3);
      }
    }

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

    expect(seen).toEqual(
      new Set([
        "huePre",
        "huePrC",
        "hueTab",
        "hueTaC",
        "hueAyu",
        "hueAyC",
        "hueCon",
        "hueCoC",
        "hueRet",
        "hueReC",
        "selRep",
        "selInv",
        "selOrg",
        "selPat",
        "selReg",
        "selCmp",
        "selJus",
        "selTrn",
      ])
    );
  });

  test("Rationals 3º ESO pack has 17 activities totaling 50 points (24 pts spaces + 26 pts achievements)", () => {
    const ration = PREDEFINED_ACTIVITY_PACKS.ration;
    expect(ration.activities).toHaveLength(17);

    const spaceActs = ration.activities.filter((a) => a.activityId.startsWith("m"));
    const achActs = ration.activities.filter((a) => !a.activityId.startsWith("m"));
    expect(spaceActs).toHaveLength(5);
    expect(achActs).toHaveLength(12);

    const spacePoints = spaceActs.reduce((sum, a) => sum + a.pointsAwarded, 0);
    const achPoints = achActs.reduce((sum, a) => sum + a.pointsAwarded, 0);
    expect(spacePoints).toBe(24);
    expect(achPoints).toBe(26);
    expect(spacePoints + achPoints).toBe(50);

    const seen = new Set();
    for (const act of ration.activities) {
      expect(act.sourceId).toBe("ration");
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

    expect(seen).toEqual(
      new Set([
        "m1sion",
        "m2sion",
        "m3sion",
        "m4sion",
        "m5sion",
        "logro1",
        "logro2",
        "logro3",
        "logro4",
        "logro5",
        "logro6",
        "logro7",
        "logro8",
        "logro9",
        "logr10",
        "logr11",
        "logr12",
      ])
    );
  });
});
