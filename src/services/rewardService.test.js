import { buildUnifiedRewards } from "./rewardService";

describe("buildUnifiedRewards", () => {
  test("converts rewards-category cards into redeemable rewards using card points as cost", () => {
    const cards = [
      { id: "c_pts", title: "Point Card", category: "points", points: 10 },
      {
        id: "c_rew",
        title: "Piedra Trueno",
        description: "Evoluciona a Raichu",
        category: "rewards",
        points: 25,
      },
      { id: "c_xp", title: "Level 2", category: "experience", points: 50 },
    ];

    const result = buildUnifiedRewards(cards, []);

    expect(result).toHaveLength(1);
    expect(result[0]).toEqual({
      id: "c_rew",
      title: "Piedra Trueno",
      description: "Evoluciona a Raichu",
      cost: 25,
      cardId: "c_rew",
      legacyRewardId: null,
      isCardReward: true,
    });
  });

  test("merges matching legacy rewards without duplicating and always uses the reward card points", () => {
    const cards = [
      {
        id: "c_rew1",
        title: "Carta Recompensa 1",
        description: "Desc 1",
        category: "rewards",
        points: 30,
      },
    ];
    const legacyRewards = [
      {
        id: "leg_1",
        title: "Old Title",
        cost: 15,
        cardId: "c_rew1",
      },
    ];

    const result = buildUnifiedRewards(cards, legacyRewards);

    expect(result).toHaveLength(1);
    expect(result[0]).toEqual({
      id: "c_rew1",
      title: "Carta Recompensa 1",
      description: "Desc 1",
      cost: 30,
      cardId: "c_rew1",
      legacyRewardId: "leg_1",
      isCardReward: true,
    });
  });

  test("preserves unmatched legacy rewards if any exist", () => {
    const cards = [
      {
        id: "c_rew1",
        title: "Carta Recompensa 1",
        description: "Desc 1",
        category: "rewards",
        points: 20,
      },
    ];
    const legacyRewards = [
      { id: "leg_orphan", title: "Legacy Reward", cost: 10, cardId: "deleted_card" },
    ];

    const result = buildUnifiedRewards(cards, legacyRewards);

    expect(result).toHaveLength(2);
    expect(result[0].id).toBe("c_rew1");
    expect(result[1]).toMatchObject({
      id: "leg_orphan",
      title: "Legacy Reward",
      cost: 10,
      isLegacy: true,
    });
  });
});
