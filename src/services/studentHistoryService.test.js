import { buildStudentHistoryEntries } from "./studentHistoryService";

describe("studentHistoryService", () => {
  test("merges Experience cards achieved from student.cards with rewardsHistory sorted newest to oldest", () => {
    const allCards = [
      { id: "xp_1", title: "Apprentice I", category: "experience", points: 10 },
      { id: "xp_2", title: "Scholar II", category: "experience", points: 50 },
      { id: "pts_1", title: "Pikachu", category: "points", points: 2 },
    ];

    const student = {
      id: "stu_1",
      name: "Ana",
      cards: [
        {
          id: "owned_pts",
          cardId: "pts_1",
          title: "Pikachu",
          grantedAt: "2026-11-10T10:00:00.000Z",
        },
        {
          id: "owned_xp_1",
          cardId: "xp_1",
          title: "Apprentice I",
          grantedAt: "2026-11-12T09:15:00.000Z",
          autoFrom: { type: "xpUnlock", xpRequired: 10, xpAt: 15 },
        },
        {
          id: "owned_xp_2",
          cardId: "xp_2",
          title: "Scholar II",
          grantedAt: "2026-11-20T16:45:00.000Z",
          autoFrom: { streakId: "xp_unlock" },
        },
      ],
      rewardsHistory: [
        {
          id: "rew_1",
          type: "individual",
          title: "Homework Pass",
          cost: 15,
          date: "2026-11-15T14:00:00.000Z",
        },
      ],
    };

    const entries = buildStudentHistoryEntries({ student, allCards });

    expect(entries.map((e) => [e.type, e.title])).toEqual([
      ["experience", "Scholar II"],
      ["individual", "Homework Pass"],
      ["experience", "Apprentice I"],
    ]);

    expect(entries[0]).toMatchObject({
      cardId: "xp_2",
      xpRequired: 50,
      date: "2026-11-20T16:45:00.000Z",
      grantedAt: "2026-11-20T16:45:00.000Z",
    });
    expect(entries[2]).toMatchObject({
      cardId: "xp_1",
      xpRequired: 10,
      date: "2026-11-12T09:15:00.000Z",
    });
  });

  test("prefers reconciled rewardsHistory when passed and avoids duplicating existing experience entries", () => {
    const allCards = [
      { id: "xp_1", title: "Apprentice I", category: "experience", points: 10 },
    ];
    const student = {
      id: "stu_1",
      cards: [
        {
          id: "owned_xp_1",
          cardId: "xp_1",
          title: "Apprentice I",
          grantedAt: "2026-11-12T09:15:00.000Z",
          autoFrom: { type: "xpUnlock", xpRequired: 10 },
        },
      ],
      rewardsHistory: [],
    };
    const reconciled = [
      {
        id: "existing_xp",
        type: "experience",
        cardId: "xp_1",
        title: "Apprentice I",
        date: "2026-11-12T09:15:00.000Z",
      },
    ];

    const entries = buildStudentHistoryEntries({
      student,
      rewardsHistory: reconciled,
      allCards,
    });

    expect(entries).toHaveLength(1);
    expect(entries[0].id).toBe("existing_xp");
  });

  test("handles Experience card detected solely from autoFrom when card metadata was removed", () => {
    const student = {
      id: "stu_1",
      cards: [
        {
          id: "owned_legacy_xp",
          cardId: "deleted_xp_card",
          title: "Veteran",
          obtainedAt: "2025-12-03T11:20:00.000Z",
          autoFrom: { type: "xpUnlock", xpRequired: 200 },
        },
      ],
      rewardsHistory: [],
    };

    const entries = buildStudentHistoryEntries({ student, allCards: [] });

    expect(entries).toHaveLength(1);
    expect(entries[0]).toMatchObject({
      type: "experience",
      title: "Veteran",
      xpRequired: 200,
      date: "2025-12-03T11:20:00.000Z",
    });
  });
});
