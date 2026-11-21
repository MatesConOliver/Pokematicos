import {
  formatHistoryDateTime,
  formatWeekdayMonthDay,
  formatWeekdayMonthDayTime,
  getHistoryEntryYear,
  getHistoryTimestamp,
} from "./dateUtils";

describe("dateUtils formatting and history timestamps", () => {
  test("formatWeekdayMonthDay formats English short weekday, short month, and unpadded day", () => {
    expect(formatWeekdayMonthDay("2026-11-05")).toBe("Thu, Nov 5");
    expect(formatWeekdayMonthDay("2026-11-21")).toBe("Sat, Nov 21");
    expect(formatWeekdayMonthDay(new Date(2026, 0, 7, 12, 0))).toBe("Wed, Jan 7");
  });

  test("formatWeekdayMonthDayTime uses middle dot and 24-hour HH:mm", () => {
    expect(formatWeekdayMonthDayTime(new Date(2026, 10, 21, 9, 5))).toBe(
      "Sat, Nov 21 · 09:05"
    );
  });

  test("formatHistoryDateTime includes HH:mm with middle dot for ISO date strings", () => {
    const dt = new Date(2026, 10, 18, 9, 5);
    const iso = dt.toISOString();

    expect(formatHistoryDateTime({ date: iso })).toBe("Wed, Nov 18 · 09:05");
  });

  test("formatHistoryDateTime includes HH:mm for numeric redeemedAt and Firestore timestamps", () => {
    const dt = new Date(2026, 10, 18, 21, 42);

    expect(formatHistoryDateTime({ redeemedAt: dt.getTime() })).toBe(
      "Wed, Nov 18 · 21:42"
    );
    expect(
      formatHistoryDateTime({ date: { toMillis: () => dt.getTime() } })
    ).toBe("Wed, Nov 18 · 21:42");
  });

  test("formatHistoryDateTime prefers redeemedAt time when date is YYYY-MM-DD only", () => {
    const dt = new Date(2026, 10, 18, 14, 7);

    expect(
      formatHistoryDateTime({ date: "2026-11-18", redeemedAt: dt.getTime() })
    ).toBe("Wed, Nov 18 · 14:07");
  });

  test("formatHistoryDateTime omits time for date-only legacy entries without redeemedAt", () => {
    expect(formatHistoryDateTime({ date: "2026-11-18" })).toBe("Wed, Nov 18");
    expect(formatHistoryDateTime({ date: "2025-11-05" })).toBe("Wed, Nov 5");
    expect(formatHistoryDateTime({})).toBe("Unknown date");
  });

  test("getHistoryEntryYear extracts the year cleanly for year-change dividers", () => {
    expect(getHistoryEntryYear({ date: "2025-12-20" })).toBe(2025);
    expect(
      getHistoryEntryYear({ redeemedAt: new Date(2026, 0, 15, 10, 0).getTime() })
    ).toBe(2026);
    expect(getHistoryEntryYear({})).toBeNull();
  });

  test("getHistoryTimestamp sorts accurately across ISO dates and Firestore timestamps", () => {
    const t1 = new Date(2026, 10, 18, 10, 0).getTime();
    const t2 = new Date(2026, 10, 18, 12, 30).getTime();

    expect(getHistoryTimestamp({ redeemedAt: t2 })).toBeGreaterThan(
      getHistoryTimestamp({ date: new Date(t1).toISOString() })
    );
  });
});
