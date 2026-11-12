import { round2, formatPoints, uid, safeLower } from "./helpers";

describe("helpers", () => {
  describe("round2 and formatPoints", () => {
    test("handles normal numbers and integers", () => {
      expect(round2(100)).toBe(100);
      expect(formatPoints(100)).toBe(100);
      expect(round2(50.5)).toBe(50.5);
      expect(formatPoints(50.5)).toBe(50.5);
    });

    test("fixes IEEE 754 floating point precision drift", () => {
      // 100.000000002 -> 100
      expect(round2(100.000000002)).toBe(100);
      expect(formatPoints(100.000000002)).toBe(100);

      // 74.888888888889 -> 74.89
      expect(round2(74.888888888889)).toBe(74.89);
      expect(formatPoints(74.888888888889)).toBe(74.89);

      // 0.1 + 0.2 = 0.30000000000000004
      expect(round2(0.1 + 0.2)).toBe(0.3);
      expect(formatPoints(0.1 + 0.2)).toBe(0.3);
    });

    test("handles null, undefined, strings, and zero gracefully", () => {
      expect(round2(0)).toBe(0);
      expect(formatPoints(0)).toBe(0);
      expect(round2(null)).toBe(0);
      expect(formatPoints(null)).toBe(0);
      expect(round2(undefined)).toBe(0);
      expect(formatPoints(undefined)).toBe(0);
      expect(round2("42.75")).toBe(42.75);
      expect(formatPoints("42.75")).toBe(42.75);
    });
  });

  describe("safeLower", () => {
    test("lowercases strings safely", () => {
      expect(safeLower("HELLO")).toBe("hello");
      expect(safeLower(null)).toBe("");
      expect(safeLower(undefined)).toBe("");
    });
  });

  describe("uid", () => {
    test("generates prefixed unique ids", () => {
      const id1 = uid("test");
      const id2 = uid("test");
      expect(id1.startsWith("test_")).toBe(true);
      expect(id1).not.toBe(id2);
    });
  });
});
