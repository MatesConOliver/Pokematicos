import {
  doc,
  getDoc,
  updateDoc,
  writeBatch,
  increment,
} from "firebase/firestore";

import { pushOwnedCard, getNewExperienceCards } from "./rewardService";

export async function quickAddPoints({
  db,
  classId,
  studentId,
  amount,
  alertFn = typeof window !== "undefined" ? window.alert.bind(window) : null,
}) {
  const rawAmount = Number(amount || 0);
  if (!Number.isFinite(rawAmount) || rawAmount === 0) return;

  try {
    const studentRef = doc(db, `classes/${classId}/students/${studentId}`);
    const snap = await getDoc(studentRef);
    if (!snap.exists()) return;
    const sdata = snap.data();
    const mult = typeof sdata.multiplier === "number" ? sdata.multiplier : 1;
    const effective = Number((rawAmount * mult).toFixed(2));
    await updateDoc(studentRef, { currentPoints: increment(effective) });
  } catch (err) {
    console.error("quickAddPoints error", err);
    if (alertFn) alertFn("Could not add points.");
    throw err;
  }
}

export async function removeOwnedCardsBulk({
  db,
  classId,
  studentId,
  ownedIds,
  alertFn = typeof window !== "undefined" ? window.alert.bind(window) : null,
}) {
  if (!ownedIds?.length) return;
  try {
    const studentRef = doc(db, `classes/${classId}/students/${studentId}`);
    const snap = await getDoc(studentRef);
    if (!snap.exists()) return;
    const sdata = snap.data();
    const nextCards = (sdata.cards || []).filter((c) => !ownedIds.includes(c.id));
    await updateDoc(studentRef, { cards: nextCards });
  } catch (err) {
    console.error(err);
    if (alertFn) alertFn("Failed to remove cards.");
  }
}

export async function redeemIndividual({
  db,
  classId,
  studentId,
  rewardId,
  rewards,
  students,
  cards,
  alertFn = typeof window !== "undefined" ? window.alert.bind(window) : null,
  confirmFn = typeof window !== "undefined" ? window.confirm.bind(window) : null,
}) {
  if (!classId || !studentId || !rewardId) return;
  const r = rewards.find((x) => x.id === rewardId);
  if (!r) return alertFn ? alertFn("Reward not found") : undefined;

  const cost = Number(r.cost || 0);
  const s = students.find((x) => x.id === studentId);
  if (!s) return;

  if ((s.currentPoints || 0) < cost) {
    return alertFn ? alertFn("Not enough points!") : undefined;
  }

  if (confirmFn && !(await confirmFn(`Redeem "${r.title}" for ${cost} points?`))) return;

  try {
    const studentRef = doc(db, `classes/${classId}/students/${studentId}`);
    const now = new Date().toISOString();
    const oldXp = Number(s.xp || 0);
    const newXp = oldXp + cost;

    const historyEntry = {
      id: `${Date.now()}-${Math.random().toString(16).slice(2)}`,
      rewardId,
      title: r.title,
      cost,
      date: now,
      type: "individual",
    };

    let newCards = [...(s.cards || [])];

    if (r.cardId) {
      const linkedCard = cards.find((c) => c.id === r.cardId);
      if (linkedCard) {
        pushOwnedCard({
          cardsArr: newCards,
          cardId: r.cardId,
          cardData: linkedCard,
          pointsGranted: 0,
          streakId: "reward",
        });
      }
    }

    const unlockedXpCards = getNewExperienceCards(newCards, newXp, cards);
    unlockedXpCards.forEach((c) => {
      pushOwnedCard({
        cardsArr: newCards,
        cardId: c.id,
        cardData: c,
        pointsGranted: 0,
        streakId: "xp_unlock",
      });
    });

    await updateDoc(studentRef, {
      currentPoints: increment(-cost),
      xp: newXp,
      rewardsHistory: [...(s.rewardsHistory || []), historyEntry],
      cards: newCards,
    });

    if (unlockedXpCards.length > 0 && alertFn) {
      alertFn({
        message: `Unlocked ${unlockedXpCards.length} new Experience Card(s)!`,
        cards: unlockedXpCards,
      });
    }

    return true;
  } catch (err) {
    console.error(err);
    if (alertFn) alertFn("Failed to redeem.");
    return false;
  }
}

export async function redeemGroup({
  db,
  classId,
  rewardId,
  participants,
  rewards,
  students,
  cards,
  alertFn = typeof window !== "undefined" ? window.alert.bind(window) : null,
  confirmFn = typeof window !== "undefined" ? window.confirm.bind(window) : null,
}) {
  if (!participants || participants.length === 0) return;
  const r = rewards.find((x) => x.id === rewardId);
  if (!r) return;

  if (confirmFn && !(await confirmFn(`Redeem "${r.title}" for group?`))) return;

  try {
    const batch = writeBatch(db);
    const now = new Date().toISOString();
    const contributors = participants.map(([sid, share]) => {
      const sName = students.find((s) => s.id === sid)?.name || "Unknown";
      return { name: sName, cost: Number(share) };
    });

    let anyoneLeveledUp = false;

    for (const [sid, share] of participants) {
      const st = students.find((s) => s.id === sid);
      if (!st) continue;

      const studentRef = doc(db, `classes/${classId}/students/${sid}`);
      const costNum = Number(share);
      const oldXp = Number(st.xp || 0);
      const newXp = oldXp + costNum;

      const historyEntry = {
        id: `${Date.now()}-${Math.random().toString(16).slice(2)}`,
        rewardId,
        title: r.title,
        cost: costNum,
        date: now,
        type: "group",
        contributors,
      };

      let newCards = [...(st.cards || [])];

      if (r.cardId) {
        const linkedCard = cards.find((c) => c.id === r.cardId);
        if (linkedCard) {
          pushOwnedCard({
            cardsArr: newCards,
            cardId: r.cardId,
            cardData: linkedCard,
            pointsGranted: 0,
            streakId: "reward_group",
          });
        }
      }

      const unlockedXpCards = getNewExperienceCards(newCards, newXp, cards);
      if (unlockedXpCards.length > 0) anyoneLeveledUp = true;

      unlockedXpCards.forEach((c) => {
        pushOwnedCard({
          cardsArr: newCards,
          cardId: c.id,
          cardData: c,
          pointsGranted: 0,
          streakId: "xp_unlock",
        });
      });

      const nextHistory = [...(st.rewardsHistory || []), historyEntry];

      batch.update(studentRef, {
        currentPoints: increment(-costNum),
        xp: increment(costNum),
        rewardsHistory: nextHistory,
        cards: newCards,
      });
    }

    await batch.commit();

    if (anyoneLeveledUp && alertFn) {
      alertFn("🎉 Some students leveled up and unlocked Experience Cards!");
    }

    return true;
  } catch (err) {
    console.error(err);
    if (alertFn) alertFn("Failed group redeem.");
    return false;
  }
}
