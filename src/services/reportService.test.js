import {
  buildStudentActivityReport,
  filterReportTimelineByCard,
  formatDDMM,
  parseDDMMYYYY,
  resolveReportPeriodRange,
} from "./reportService";

describe("reportService", () => {
  const now = new Date(2026, 10, 20, 15, 30, 0); // 20/11/2026 15:30 local

  test("parseDDMMYYYY validates real calendar dates", () => {
    const valid = parseDDMMYYYY("05/11/2026");
    expect(valid).not.toBeNull();
    expect(valid.getFullYear()).toBe(2026);
    expect(valid.getMonth()).toBe(10);
    expect(valid.getDate()).toBe(5);

    expect(parseDDMMYYYY("31/02/2026")).toBeNull();
    expect(parseDDMMYYYY("2026-11-20")).toBeNull();
    expect(parseDDMMYYYY("")).toBeNull();
  });

  test("resolveReportPeriodRange computes rolling windows up to today and manual dd/mm/yyyy ranges", () => {
    const week = resolveReportPeriodRange({ period: "week", now });
    expect(week.valid).toBe(true);
    expect(week.startLabel).toBe("14/11/2026");
    expect(week.endLabel).toBe("20/11/2026");

    const twoWeeks = resolveReportPeriodRange({ period: "twoWeeks", now });
    expect(twoWeeks.valid).toBe(true);
    expect(twoWeeks.startLabel).toBe("07/11/2026");
    expect(twoWeeks.endLabel).toBe("20/11/2026");

    const month = resolveReportPeriodRange({ period: "month", now });
    expect(month.valid).toBe(true);
    expect(month.startLabel).toBe("20/10/2026");
    expect(month.endLabel).toBe("20/11/2026");

    const manual = resolveReportPeriodRange({
      period: "manual",
      manualStart: "01/11/2026",
      manualEnd: "15/11/2026",
      now,
    });
    expect(manual.valid).toBe(true);
    expect(manual.startLabel).toBe("01/11/2026");
    expect(manual.endLabel).toBe("15/11/2026");

    const invalidOrder = resolveReportPeriodRange({
      period: "manual",
      manualStart: "18/11/2026",
      manualEnd: "10/11/2026",
      now,
    });
    expect(invalidOrder.valid).toBe(false);
  });

  test("buildStudentActivityReport summarizes cards by individual name, combines code+card entries, and sorts newest to oldest with dd/mm", () => {
    const cards = [
      { id: "c_pikachu", title: "Pikachu", category: "points", points: 2 },
      { id: "c_trophy", title: "Trophy Card", category: "extra", points: 0 },
      { id: "c_xp", title: "Level 2", category: "experience", points: 20 },
    ];

    const tOldOutside = new Date(2026, 10, 10, 10, 0).toISOString();
    const tCard1 = new Date(2026, 10, 15, 9, 0).toISOString();
    const tCodeBoth = new Date(2026, 10, 18, 11, 15).toISOString();
    const tCard2 = new Date(2026, 10, 19, 16, 45).toISOString();
    const tCodePoints = new Date(2026, 10, 20, 8, 20).toISOString();

    const student = {
      id: "stu_1",
      name: "Ana",
      cards: [
        { id: "o_old", cardId: "c_pikachu", title: "Pikachu", grantedAt: tOldOutside, pointsGranted: 2 },
        { id: "o_1", cardId: "c_pikachu", title: "Pikachu", grantedAt: tCard1, pointsGranted: 2 },
        {
          id: "o_code",
          cardId: "c_trophy",
          title: "Trophy Card",
          grantedAt: tCodeBoth,
          pointsGranted: 3,
          obtainedFrom: "activity_Probab_m1",
        },
        {
          id: "o_2",
          cardId: "c_pikachu",
          title: "Pikachu",
          grantedAt: tCard2,
          pointsGranted: 2,
          autoFrom: { type: "streakMax", streakId: "s1" },
        },
      ],
      rewardsHistory: [
        {
          id: "h_code_both",
          type: "achievement_card",
          activityName: "Mission 1",
          source: "Probab",
          sourceId: "Probab",
          activityId: "m1",
          pointsAwarded: 3,
          cardId: "c_trophy",
          cardTitle: "Trophy Card",
          date: tCodeBoth,
          redeemedAt: Date.parse(tCodeBoth),
          isCodeRedemption: true,
        },
        {
          id: "h_code_pts",
          type: "achievement",
          activityName: "Mission 2",
          source: "Probab",
          sourceId: "Probab",
          activityId: "m2",
          pointsAwarded: 4,
          date: tCodePoints,
          redeemedAt: Date.parse(tCodePoints),
          isCodeRedemption: true,
        },
        {
          id: "h_reward",
          type: "individual",
          title: "Homework Pass",
          cost: 10,
          date: tCard2,
        },
      ],
    };

    const report = buildStudentActivityReport({
      student,
      cards,
      period: "week",
      now,
    });

    expect(report.valid).toBe(true);
    expect(report.totalCardsReceived).toBe(3);
    expect(report.totalCodesRedeemed).toBe(2);

    // Summary grouped by individual card name (excluding out-of-range 10/11 card)
    expect(report.cardTotals).toEqual([
      expect.objectContaining({ title: "Pikachu", count: 2 }),
      expect.objectContaining({ title: "Trophy Card", count: 1 }),
    ]);

    // Timeline: 2 code events (1 combined with Trophy Card) + 2 standalone cards = 4 items, newest first
    expect(report.timeline).toHaveLength(4);
    expect(report.timeline.map((item) => [item.kind, item.title, item.dayLabel])).toEqual([
      ["code", "Mission 2", "20/11"],
      ["card", "Pikachu", "19/11"],
      ["code", "Mission 1", "18/11"],
      ["card", "Pikachu", "15/11"],
    ]);
    expect(report.timeline[2].hasCard).toBe(true);
    expect(report.timeline[2].cardTitle).toBe("Trophy Card");

    // Card filter: default ("all") returns full timeline
    expect(filterReportTimelineByCard(report.timeline, "all")).toHaveLength(4);

    // Card filter: standalone card ("pikachu") returns only those 2 card events
    expect(filterReportTimelineByCard(report.timeline, "pikachu")).toHaveLength(2);

    // Card filter: card granted via combined code entry ("trophy card") returns that combined entry
    const trophyFiltered = filterReportTimelineByCard(report.timeline, "trophy card");
    expect(trophyFiltered).toHaveLength(1);
    expect(trophyFiltered[0].kind).toBe("code");
    expect(trophyFiltered[0].title).toBe("Mission 1");
  });

  test("formatDDMM formats day and month only", () => {
    const d = new Date(2026, 0, 7, 12, 0).getTime();
    expect(formatDDMM(d)).toBe("07/01");
  });
});
