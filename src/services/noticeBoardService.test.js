import {
  buildNoticeBoardData,
  getMadridDateParts,
  MAX_NOTICE_BOARD_ITEMS,
} from "./noticeBoardService";

describe("noticeBoardService", () => {
  test("formats UTC timestamps in Europe/Madrid timezone accurately", () => {
    // November 13, 2026 23:30 UTC is already November 14, 2026 00:30 in Madrid (UTC+1)
    const parts = getMadridDateParts("2026-11-13T23:30:00.000Z");
    expect(parts).toEqual({
      dateKey: "2026-11-14",
      displayDate: "14/11/2026",
      displayTime: "00:30",
      displayDateTime: "14/11/2026 00:30",
    });
  });

  test("groups multiple students achieving the same streak maximum on the same Madrid day", () => {
    const now = Date.parse("2026-11-13T18:00:00.000Z");
    const streakConfigs = [{ id: "st_1", emoji: "🔥", max: 5 }];
    const students = [
      {
        id: "s1",
        name: "Ana",
        streaks: {
          st_1: {
            value: 5,
            maxAchievedOn: "2026-11-13",
            maxAchievedAt: "2026-11-13T10:15:00.000Z",
          },
        },
      },
      {
        id: "s2",
        name: "Luis",
        streaks: {
          st_1: {
            value: 5,
            maxAchievedOn: "2026-11-13",
            maxAchievedAt: "2026-11-13T14:20:00.000Z",
          },
        },
      },
      {
        id: "s3",
        name: "Marta",
        streaks: {
          st_1: {
            value: 5,
            maxAchievedOn: "2026-11-12",
            maxAchievedAt: "2026-11-12T15:00:00.000Z",
          },
        },
      },
    ];

    const res = buildNoticeBoardData({ students, cards: [], streakConfigs, now });

    expect(res.todayItems).toHaveLength(1);
    expect(res.todayItems[0]).toMatchObject({
      type: "streakMax",
      emoji: "🔥",
      studentNames: ["Ana", "Luis"],
      formattedDateTime: "13/11/2026 15:20", // 14:20 UTC -> 15:20 Madrid (UTC+1)
    });

    expect(res.olderItems).toHaveLength(1);
    expect(res.olderItems[0]).toMatchObject({
      type: "streakMax",
      studentNames: ["Marta"],
      formattedDateTime: "12/11/2026 16:00",
    });
  });

  test("handles individual and deduplicated group rewards showing only count of contributors with >= 1 pt", () => {
    const now = Date.parse("2026-11-13T19:00:00.000Z");
    const groupDate = "2026-11-13T12:00:00.000Z";
    const contributors = [
      { name: "Ana", cost: 5 },
      { name: "Luis", cost: 3 },
      { name: "Carlos", cost: 0 },
      { name: "Sofia", cost: 2 },
    ];

    const students = [
      {
        id: "s1",
        name: "Ana",
        rewardsHistory: [
          {
            id: "r1",
            type: "individual",
            title: "Homework Pass",
            cost: 10,
            date: "2026-11-13T16:05:00.000Z",
          },
          {
            id: "g1",
            rewardId: "rew_party",
            type: "group",
            title: "Class Party",
            cost: 5,
            date: groupDate,
            contributors,
          },
          {
            id: "evo1",
            type: "evolution",
            title: "Should be ignored",
            date: "2026-11-13T16:10:00.000Z",
          },
        ],
      },
      {
        id: "s2",
        name: "Luis",
        rewardsHistory: [
          {
            id: "g2",
            rewardId: "rew_party",
            type: "group",
            title: "Class Party",
            cost: 3,
            date: groupDate,
            contributors,
          },
        ],
      },
    ];

    const res = buildNoticeBoardData({ students, cards: [], streakConfigs: [], now });
    expect(res.todayItems).toHaveLength(2);

    const indItem = res.todayItems[0];
    expect(indItem).toMatchObject({
      type: "rewardRedeemed",
      redeemKind: "individual",
      studentName: "Ana",
      rewardTitle: "Homework Pass",
      formattedDateTime: "13/11/2026 17:05",
    });

    const grpItem = res.todayItems[1];
    expect(grpItem).toMatchObject({
      type: "rewardRedeemed",
      redeemKind: "group",
      rewardTitle: "Class Party",
      contributorCount: 3, // Ana(5), Luis(3), Sofia(2); Carlos(0) excluded
      formattedDateTime: "13/11/2026 13:00",
    });
  });

  test("includes experience cards achieved and new cards for points/rewards/experience while excluding extra cards", () => {
    const now = Date.parse("2026-11-13T18:00:00.000Z");
    const cards = [
      { id: "c1", title: "Focus +5", category: "points", points: 5, imageURL: "https://img/c1.png", createdAt: Date.parse("2026-11-13T09:00:00.000Z") },
      { id: "c2", title: "Sticker", category: "rewards", points: 15, imageURL: "https://img/c2.png", lockedImageURL: "https://img/c2_locked.png", createdAt: Date.parse("2026-11-13T10:00:00.000Z") },
      { id: "c3", title: "Scholar II", category: "experience", points: 100, imageURL: "https://img/c3.png", imageURL_B: "https://img/c3_b.png", createdAt: Date.parse("2026-11-13T11:00:00.000Z") },
      { id: "c4", title: "Secret Catalyst", category: "extra", points: 0, imageURL: "https://img/c4.png", createdAt: Date.parse("2026-11-13T12:00:00.000Z") },
    ];
    const students = [
      {
        id: "s1",
        name: "Elena",
        cards: [
          {
            id: "o1",
            cardId: "c1",
            title: "Focus +5",
            grantedAt: "2026-11-13T13:00:00.000Z",
          },
          {
            id: "o2",
            cardId: "c3",
            title: "Scholar II",
            grantedAt: "2026-11-13T14:00:00.000Z",
          },
        ],
      },
    ];

    const res = buildNoticeBoardData({ students, cards, streakConfigs: [], flagValue: "B", now });
    expect(res.items.map((i) => i.type)).toEqual([
      "experienceCard",
      "newCard",
      "newCard",
      "newCard",
    ]);
    expect(res.items.some((i) => i.cardTitle === "Secret Catalyst")).toBe(false);
    expect(res.items[0]).toMatchObject({
      type: "experienceCard",
      studentName: "Elena",
      cardTitle: "Scholar II",
      xp: 100,
      imageURL: "https://img/c3_b.png",
      formattedDateTime: "13/11/2026 15:00",
    });
    expect(res.items[2]).toMatchObject({
      type: "newCard",
      cardTitle: "Sticker",
      imageURL: "https://img/c2_locked.png",
    });
  });

  test("caps total announcements at 20, dropping oldest items when newer ones exist", () => {
    const now = Date.parse("2026-11-13T20:00:00.000Z");
    const cards = Array.from({ length: 25 }, (_, i) => ({
      id: `card_${i + 1}`,
      title: `Card ${i + 1}`,
      category: "points",
      points: 1,
      // Cards 1..15 older (Nov 12), 16..25 today (Nov 13)
      createdAt:
        i < 15
          ? Date.parse("2026-11-12T08:00:00.000Z") + i * 60000
          : Date.parse("2026-11-13T08:00:00.000Z") + (i - 15) * 60000,
    }));

    const res = buildNoticeBoardData({ students: [], cards, streakConfigs: [], now });

    expect(MAX_NOTICE_BOARD_ITEMS).toBe(20);
    expect(res.items).toHaveLength(20);
    // Newest card is Card 25 at the top
    expect(res.items[0].cardTitle).toBe("Card 25");
    // Oldest kept card is Card 6 (Cards 1..5 dropped!)
    expect(res.items[19].cardTitle).toBe("Card 6");
    expect(res.todayItems).toHaveLength(10); // Cards 25..16
    expect(res.olderItems).toHaveLength(10); // Cards 15..6
  });
});
