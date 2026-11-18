import { formatHistoryDateTime, getHistoryTimestamp } from "./dateUtils";

describe("dateUtils history timestamp formatting", () => {
  test("formatHistoryDateTime includes hh:mm for ISO date strings", () => {
    const dt = new Date(2026, 10, 18, 9, 5);
    const iso = dt.toISOString();

    expect(formatHistoryDateTime({ date: iso })).toBe(`${dt.toLocaleDateString()} 09:05`);
  });

  test("formatHistoryDateTime includes hh:mm for numeric redeemedAt and Firestore timestamps", () => {
    const dt = new Date(2026, 10, 18, 21, 42);

    expect(formatHistoryDateTime({ redeemedAt: dt.getTime() })).toBe(
      `${dt.toLocaleDateString()} 21:42`
    );
    expect(
      formatHistoryDateTime({ date: { toMillis: () => dt.getTime() } })
    ).toBe(`${dt.toLocaleDateString()} 21:42`);
  });

  test("formatHistoryDateTime prefers redeemedAt time when date is YYYY-MM-DD only", () => {
    const dt = new Date(2026, 10, 18, 14, 7);

    expect(
      formatHistoryDateTime({ date: "2026-11-18", redeemedAt: dt.getTime() })
    ).toBe(`${dt.toLocaleDateString()} 14:07`);
  });

  test("formatHistoryDateTime omits time for date-only legacy entries without redeemedAt", () => {
    const dt = new Date(2026, 10, 18);

    expect(formatHistoryDateTime({ date: "2026-11-18" })).toBe(dt.toLocaleDateString());
    expect(formatHistoryDateTime({})).toBe("Unknown date");
  });

  test("getHistoryTimestamp sorts accurately across ISO dates and Firestore timestamps", () => {
    const t1 = new Date(2026, 10, 18, 10, 0).getTime();
    const t2 = new Date(2026, 10, 18, 12, 30).getTime();

    expect(getHistoryTimestamp({ redeemedAt: t2 })).toBeGreaterThan(
      getHistoryTimestamp({ date: new Date(t1).toISOString() })
    );
  });
});
