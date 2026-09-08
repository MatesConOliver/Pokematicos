import { addDoc, collection, deleteDoc, doc } from "firebase/firestore";

import { uid, round2 } from "../utils/helpers";

export async function createReward({
  db,
  classId,
  title,
  cost,
  linkedCardId,
  alertFn = typeof window !== "undefined" ? window.alert.bind(window) : null,
}) {
  if (!classId) return;
  if (!title?.trim()) {
    if (alertFn) alertFn("Reward title required");
    return;
  }

  try {
    const payload = {
      title: title.trim(),
      cost: Number(cost || 0),
      cardId: linkedCardId || null,
      createdAt: Date.now(),
    };

    await addDoc(collection(db, `classes/${classId}/rewards`), payload);
  } catch (err) {
    console.error(err);
    if (alertFn) alertFn("Failed to create reward.");
  }
}

export async function deleteReward({
  db,
  classId,
  rewardId,
  alertFn = typeof window !== "undefined" ? window.alert.bind(window) : null,
}) {
  if (!classId || !rewardId) return;
  if (!window.confirm("Delete this reward?")) return;

  try {
    await deleteDoc(doc(db, `classes/${classId}/rewards/${rewardId}`));
  } catch (err) {
    console.error(err);
    if (alertFn) alertFn("Failed to delete reward.");
  }
}

// Shared by cardService (give single/bulk) and streakService (manual +/-):
// grants the reward cards configured for a streak once it hits its maximum.
export async function grantStreakMaxRewardCards({
  rewardCardIds,
  cardsArr,
  currentPoints,
  multiplier,
  streakId,
  classId,
  getCardDataFast,
  givenRewardCardIds = new Set(),
}) {
  let points = currentPoints;

  for (const rewardCardId of Array.isArray(rewardCardIds) ? rewardCardIds : []) {
    if (!rewardCardId || givenRewardCardIds.has(rewardCardId)) continue;

    const rewardCard = await getCardDataFast(classId, rewardCardId);
    if (!rewardCard) continue;
    if ((rewardCard.category || "points") !== "points") continue;

    const pts = round2(Number(rewardCard.points || 0) * multiplier);

    pushOwnedCard({
      cardsArr,
      cardId: rewardCardId,
      cardData: rewardCard,
      pointsGranted: pts,
      streakId,
    });

    points = round2(points + pts);
    givenRewardCardIds.add(rewardCardId);
  }

  return points;
}

export function pushOwnedCard({ cardsArr, cardId, cardData, pointsGranted, streakId }) {
  cardsArr.push({
    id: uid("owned"),
    cardId,
    title: cardData.title || "",
    imageURL: cardData.imageURL || "",
    imageURL2: cardData.imageURL2 || "",
    grantedAt: new Date().toISOString(),
    pointsGranted: round2(pointsGranted || 0),
    autoFrom: { type: "streakMax", streakId },
  });
}

export function getNewExperienceCards(currentCards, currentXp, allCards) {
  const xpCards = allCards.filter((c) => c.category === "experience");
  const unlocked = xpCards.filter((c) => currentXp >= (c.points || 0));
  const newUnlocks = unlocked.filter(
    (c) => !currentCards.some((owned) => owned.cardId === c.id)
  );

  return newUnlocks;
}

export function unlockExperienceCards({ allCards, cardsArr, xpAfter, nowISO }) {
  const library = Array.isArray(allCards) ? allCards : [];
  if (library.length === 0) return cardsArr;

  const ownedCardIds = new Set(
    (Array.isArray(cardsArr) ? cardsArr : [])
      .map((owned) => owned?.cardId)
      .filter(Boolean)
  );

  const eligible = library
    .filter((c) => (c.category || "points") === "experience")
    .filter((c) => Number(c.points ?? 0) >= 0)
    .filter((c) => (Number(xpAfter) || 0) >= Number(c.points ?? 0))
    .filter((c) => c?.id && !ownedCardIds.has(c.id))
    .sort((a, b) => Number(a.points ?? 0) - Number(b.points ?? 0));

  if (eligible.length === 0) return cardsArr;

  const next = [...(Array.isArray(cardsArr) ? cardsArr : [])];

  for (const c of eligible) {
    next.push({
      id: uid("owned"),
      cardId: c.id,
      title: c.title || "",
      imageURL: c.imageURL || "",
      grantedAt: nowISO,
      pointsGranted: 0,
      autoFrom: {
        type: "xpUnlock",
        xpRequired: Number(c.points ?? 0),
        xpAt: Number(xpAfter) || 0,
      },
    });
  }

  return next;
}
