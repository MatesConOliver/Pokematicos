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
      year: 2026,
      dateKey: "2026-11-14",
      displayDate: "Sat, Nov 14",
      displayTime: "00:30",
      displayDateTime: "Sat, Nov 14 · 00:30",
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
      year: 2026,
      studentNames: ["Ana", "Luis"],
      formattedDateTime: "Fri, Nov 13 · 15:20", // 14:20 UTC -> 15:20 Madrid (UTC+1)
    });

    expect(res.olderItems).toHaveLength(1);
    expect(res.olderItems[0]).toMatchObject({
      type: "streakMax",
      year: 2026,
      studentNames: ["Marta"],
      formattedDateTime: "Thu, Nov 12 · 16:00",
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
      formattedDateTime: "Fri, Nov 13 · 17:05",
    });

    const grpItem = res.todayItems[1];
    expect(grpItem).toMatchObject({
      type: "rewardRedeemed",
      redeemKind: "group",
      rewardTitle: "Class Party",
      contributorCount: 3, // Ana(5), Luis(3), Sofia(2); Carlos(0) excluded
      formattedDateTime: "Fri, Nov 13 · 13:00",
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
        flagValue: "B",
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
      formattedDateTime: "Fri, Nov 13 · 15:00",
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

  test("handles admin News messages: multiple pinned at top, optional title/text, unpinned follow normal Today/Older 20-item logic", () => {
    const now = Date.parse("2026-11-13T18:00:00.000Z");
    const cards = Array.from({ length: 20 }, (_, i) => ({
      id: `card_${i + 1}`,
      title: `Card ${i + 1}`,
      category: "points",
      points: 1,
      createdAt: Date.parse("2026-11-13T08:00:00.000Z") + i * 60000,
    }));

    const newsMessages = [
      {
        id: "m_pinned_old",
        title: "Exam Friday",
        text: "",
        pinned: true,
        createdAt: Date.parse("2026-11-10T10:00:00.000Z"),
      },
      {
        id: "m_pinned_new",
        title: "",
        text: "Bring scissors tomorrow!",
        pinned: true,
        createdAt: Date.parse("2026-11-13T12:00:00.000Z"),
      },
      {
        id: "m_unpinned_today",
        title: "Bonus Reminder",
        text: "Extra XP today",
        pinned: false,
        createdAt: Date.parse("2026-11-13T15:00:00.000Z"),
      },
      {
        id: "m_unpinned_pushed_out",
        title: "Very Old Unpinned",
        text: "Should drop past 20",
        pinned: false,
        createdAt: Date.parse("2026-11-01T10:00:00.000Z"),
      },
      {
        id: "m_empty",
        title: "   ",
        text: "",
        pinned: true,
        createdAt: Date.parse("2026-11-13T16:00:00.000Z"),
      },
    ];

    const res = buildNoticeBoardData({
      students: [],
      cards,
      streakConfigs: [],
      newsMessages,
      now,
    });

    // Multiple pinned messages stay at the top, newest pinned first; empty ignored
    expect(res.pinnedItems.map((i) => i.messageId)).toEqual(["m_pinned_new", "m_pinned_old"]);
    expect(res.pinnedItems[0]).toMatchObject({ title: "", text: "Bring scissors tomorrow!" });
    expect(res.pinnedItems[1]).toMatchObject({ title: "Exam Friday", text: "" });

    // Unpinned pool capped at 20: m_unpinned_today is newest, Card 1..Card 19 follow, m_unpinned_pushed_out dropped
    expect(res.unpinnedItems).toHaveLength(20);
    expect(res.todayItems[0]).toMatchObject({
      type: "adminMessage",
      messageId: "m_unpinned_today",
      pinned: false,
    });
    expect(res.unpinnedItems.some((i) => i.messageId === "m_unpinned_pushed_out")).toBe(false);
  });

  test("shows code redemptions that reward a card or card+points and hides points-only code redemptions", () => {
    const now = Date.parse("2026-11-13T18:00:00.000Z");
    const cards = [
      {
        id: "card_drag",
        title: "Charizard",
        category: "points",
        points: 5,
        imageURL: "https://img/charizard.png",
        imageURL_B: "https://img/charizard_b.png",
        createdAt: Date.parse("2026-11-01T09:00:00.000Z"),
      },
      {
        id: "card_pika",
        title: "Pikachu",
        category: "points",
        points: 2,
        imageURL: "https://img/pika.png",
        createdAt: Date.parse("2026-11-01T09:00:00.000Z"),
      },
    ];

    const students = [
      {
        id: "s1",
        name: "Ana",
        flagValue: "B",
        cards: [
          {
            id: "owned_1",
            cardId: "card_drag",
            title: "Charizard",
            obtainedFrom: "activity_Radica_m1sion",
            grantedAt: "2026-11-13T15:00:00.000Z",
            pointsGranted: 10,
          },
          {
            id: "owned_2",
            cardId: "card_pika",
            title: "Pikachu",
            obtainedFrom: "activity_Radica_m2sion",
            grantedAt: "2026-11-13T14:00:00.000Z",
            pointsGranted: 0,
          },
        ],
        rewardsHistory: [
          {
            id: "h_both",
            type: "achievement_card",
            isCodeRedemption: true,
            sourceId: "Radica",
            activityId: "m1sion",
            activityName: "Mission 1",
            cardId: "card_drag",
            cardTitle: "Charizard",
            pointsAwarded: 10,
            date: "2026-11-13T15:00:00.000Z",
            redeemedAt: Date.parse("2026-11-13T15:00:00.000Z"),
          },
          {
            id: "h_card_only",
            type: "card",
            isCodeRedemption: true,
            sourceId: "Radica",
            activityId: "m2sion",
            activityName: "Mission 2",
            cardId: "card_pika",
            cardTitle: "Pikachu",
            pointsAwarded: 0,
            date: "2026-11-13T14:00:00.000Z",
            redeemedAt: Date.parse("2026-11-13T14:00:00.000Z"),
          },
          {
            id: "h_points_only",
            type: "achievement",
            isCodeRedemption: true,
            sourceId: "Radica",
            activityId: "m3sion",
            activityName: "Mission 3 Points Only",
            pointsAwarded: 15,
            date: "2026-11-13T16:00:00.000Z",
            redeemedAt: Date.parse("2026-11-13T16:00:00.000Z"),
          },
        ],
      },
      {
        id: "s2",
        name: "Luis",
        cards: [
          {
            id: "owned_legacy",
            cardId: "card_pika",
            title: "Pikachu",
            obtainedFrom: "activity_Radica_m4sion",
            grantedAt: "2026-11-13T13:00:00.000Z",
            pointsGranted: 5,
          },
        ],
        rewardsHistory: [],
      },
    ];

    const res = buildNoticeBoardData({
      students,
      cards,
      streakConfigs: [],
      flagValue: "B",
      now,
    });

    const codeEvents = res.items.filter((i) => i.type === "codeCardRedeemed");
    expect(codeEvents).toHaveLength(3);

    expect(codeEvents[0]).toMatchObject({
      type: "codeCardRedeemed",
      studentName: "Ana",
      cardTitle: "Charizard",
      activityName: "Mission 1",
      pointsAwarded: 10,
      imageURL: "https://img/charizard_b.png",
      formattedDateTime: "Fri, Nov 13 · 16:00",
    });

    expect(codeEvents[1]).toMatchObject({
      type: "codeCardRedeemed",
      studentName: "Ana",
      cardTitle: "Pikachu",
      activityName: "Mission 2",
      pointsAwarded: 0,
      imageURL: "https://img/pika.png",
      formattedDateTime: "Fri, Nov 13 · 15:00",
    });

    expect(codeEvents[2]).toMatchObject({
      type: "codeCardRedeemed",
      studentName: "Luis",
      cardTitle: "Pikachu",
      pointsAwarded: 5,
      imageURL: "https://img/pika.png",
      formattedDateTime: "Fri, Nov 13 · 14:00",
    });

    expect(
      res.items.some((i) => i.activityName === "Mission 3 Points Only")
    ).toBe(false);
  });

  test("formats legacy date-only streak achievements as unpadded Weekday, Mon D and exposes year metadata", () => {
    const now = Date.parse("2026-02-10T12:00:00.000Z");
    const students = [
      {
        id: "s1",
        name: "Ana",
        streaks: {
          st_1: {
            value: 5,
            maxAchievedOn: "2025-12-05",
          },
        },
      },
    ];

    const res = buildNoticeBoardData({
      students,
      cards: [],
      streakConfigs: [{ id: "st_1", emoji: "🔥", max: 5 }],
      now,
    });

    expect(res.currentYear).toBe(2026);
    expect(res.olderItems[0]).toMatchObject({
      year: 2025,
      formattedDateTime: "Fri, Dec 5",
      hasExactTime: false,
    });
  });

  test("uses each student's own flagValue for code redemptions, individual rewards, and experience cards", () => {
    const now = Date.parse("2026-11-13T18:00:00.000Z");
    const cards = [
      {
        id: "card_drag",
        title: "Charizard",
        category: "points",
        points: 5,
        imageURL: "https://img/charizard_a.png",
        imageURL_B: "https://img/charizard_b.png",
        createdAt: Date.parse("2026-11-01T09:00:00.000Z"),
      },
      {
        id: "card_rew",
        title: "Golden Pass",
        category: "rewards",
        points: 10,
        imageURL: "https://img/pass_a.png",
        imageURL_B: "https://img/pass_b.png",
        lockedImageURL: "https://img/pass_locked_a.png",
        lockedImageURL_B: "https://img/pass_locked_b.png",
        createdAt: Date.parse("2026-11-13T08:00:00.000Z"),
      },
      {
        id: "card_xp",
        title: "Master Scholar",
        category: "experience",
        points: 100,
        imageURL: "https://img/xp_a.png",
        imageURL_B: "https://img/xp_b.png",
        createdAt: Date.parse("2026-11-01T09:00:00.000Z"),
      },
    ];

    const students = [
      {
        id: "s_b",
        name: "Elena",
        flagValue: "B",
        cards: [
          {
            id: "o_code_b",
            cardId: "card_drag",
            title: "Charizard",
            obtainedFrom: "activity_Act_m1",
            grantedAt: "2026-11-13T15:00:00.000Z",
          },
          {
            id: "o_xp_b",
            cardId: "card_xp",
            title: "Master Scholar",
            grantedAt: "2026-11-13T14:00:00.000Z",
          },
        ],
        rewardsHistory: [
          {
            id: "h_rew_b",
            type: "individual",
            cardId: "card_rew",
            title: "Golden Pass",
            cost: 10,
            date: "2026-11-13T16:00:00.000Z",
          },
          {
            id: "h_code_b",
            type: "achievement_card",
            isCodeRedemption: true,
            sourceId: "Act",
            activityId: "m1",
            activityName: "Mission B",
            cardId: "card_drag",
            cardTitle: "Charizard",
            date: "2026-11-13T15:00:00.000Z",
          },
        ],
      },
      {
        id: "s_a",
        name: "Marco",
        flagValue: "A",
        cards: [
          {
            id: "o_code_a",
            cardId: "card_drag",
            title: "Charizard",
            obtainedFrom: "activity_Act_m2",
            grantedAt: "2026-11-13T13:00:00.000Z",
          },
        ],
        rewardsHistory: [
          {
            id: "h_rew_a",
            type: "individual",
            cardId: "card_rew",
            title: "Golden Pass",
            cost: 10,
            date: "2026-11-13T13:30:00.000Z",
          },
        ],
      },
    ];

    // Even when library toggle is "A", student B's reward/code/xp notices show B art
    const resViewA = buildNoticeBoardData({
      students,
      cards,
      streakConfigs: [],
      flagValue: "A",
      flagEnabled: true,
      now,
    });

    expect(resViewA.items.find((i) => i.type === "rewardRedeemed" && i.studentName === "Elena").imageURL).toBe("https://img/pass_b.png");
    expect(resViewA.items.find((i) => i.type === "codeCardRedeemed" && i.studentName === "Elena").imageURL).toBe("https://img/charizard_b.png");
    expect(resViewA.items.find((i) => i.type === "experienceCard" && i.studentName === "Elena").imageURL).toBe("https://img/xp_b.png");
    expect(resViewA.items.find((i) => i.type === "rewardRedeemed" && i.studentName === "Marco").imageURL).toBe("https://img/pass_a.png");
    expect(resViewA.items.find((i) => i.type === "codeCardRedeemed" && i.studentName === "Marco").imageURL).toBe("https://img/charizard_a.png");
    expect(resViewA.items.find((i) => i.type === "newCard" && i.cardTitle === "Golden Pass").imageURL).toBe("https://img/pass_locked_a.png");

    // Even when library toggle is "B", student A's notices keep A art while newCard previews B
    const resViewB = buildNoticeBoardData({
      students,
      cards,
      streakConfigs: [],
      flagValue: "B",
      flagEnabled: true,
      now,
    });
    expect(resViewB.items.find((i) => i.type === "rewardRedeemed" && i.studentName === "Marco").imageURL).toBe("https://img/pass_a.png");
    expect(resViewB.items.find((i) => i.type === "codeCardRedeemed" && i.studentName === "Marco").imageURL).toBe("https://img/charizard_a.png");
    expect(resViewB.items.find((i) => i.type === "newCard" && i.cardTitle === "Golden Pass").imageURL).toBe("https://img/pass_locked_b.png");

    // When flags are disabled for the class, always show option A art
    const resDisabled = buildNoticeBoardData({
      students,
      cards,
      streakConfigs: [],
      flagValue: "B",
      flagEnabled: false,
      now,
    });
    expect(resDisabled.items.find((i) => i.type === "rewardRedeemed" && i.studentName === "Elena").imageURL).toBe("https://img/pass_a.png");
    expect(resDisabled.items.find((i) => i.type === "codeCardRedeemed" && i.studentName === "Elena").imageURL).toBe("https://img/charizard_a.png");
  });
});
