import {
  addDoc,
  collection,
  deleteDoc,
  doc,
  getDoc,
  runTransaction,
  updateDoc,
  writeBatch,
} from "firebase/firestore";
import {
  getDownloadURL,
  ref as storageRef,
  uploadBytes,
} from "firebase/storage";

import { uid, round2 } from "../utils/helpers";
import { todayISODate, addDaysISO } from "../utils/dateUtils";
import {
  parseFloatScheduleInput,
  normalizeFloatWindows,
} from "../utils/floatWindowUtils";
import { grantStreakMaxRewardCards } from "./rewardService";
import {
  incrementLinkedStreakIfNeeded,
  incrementStreaksNoFloatWindows,
} from "./streakService";

export async function updateCard({
  db,
  storage,
  classId,
  cardId,
  updates,
  alertFn = typeof window !== "undefined" ? window.alert.bind(window) : null,
}) {
  if (!classId) return;

  try {
    const cardRef = doc(db, `classes/${classId}/cards/${cardId}`);
    const snap = await getDoc(cardRef);
    if (!snap.exists()) return alertFn ? alertFn("Card not found") : undefined;

    const prev = snap.data();
    const {
      title,
      description,
      points,
      category,
      linkedStreakIds,
      lockedFile,
      unlockedFile,
    } = updates || {};

    let lockedImageURL = prev.lockedImageURL || "";
    let unlockedImageURL = prev.imageURL || "";

    const baseKey = uid(`cardedit_${cardId}`);

    if (lockedFile) {
      const keyLocked = `${baseKey}_locked_${lockedFile.name.replace(/\s+/g, "_")}`;
      const refLocked = storageRef(storage, `classes/${classId}/cards/${keyLocked}`);
      const up = await uploadBytes(refLocked, lockedFile);
      lockedImageURL = await getDownloadURL(up.ref);
    }

    if (unlockedFile) {
      const keyUnlocked = `${baseKey}_unlocked_${unlockedFile.name.replace(/\s+/g, "_")}`;
      const refUnlocked = storageRef(storage, `classes/${classId}/cards/${keyUnlocked}`);
      const up = await uploadBytes(refUnlocked, unlockedFile);
      unlockedImageURL = await getDownloadURL(up.ref);
    }

    if (!unlockedImageURL && lockedImageURL) unlockedImageURL = lockedImageURL;
    if (!lockedImageURL && unlockedImageURL) lockedImageURL = unlockedImageURL;

    const nextCategory = category || prev.category || "points";
    const cleanIds =
      nextCategory === "points"
        ? Array.from(
            new Set(
              (Array.isArray(linkedStreakIds) ? linkedStreakIds : [])
                .filter(Boolean)
                .map(String)
            )
          )
        : [];

    await updateDoc(cardRef, {
      title: (title || "").trim(),
      description: description || "",
      points: Number(points) || 0,
      category: nextCategory,
      linkedStreakIds: cleanIds,
      imageURL: unlockedImageURL,
      lockedImageURL,
      updatedAt: Date.now(),
    });
  } catch (err) {
    console.error("updateCard error", err);
    if (alertFn) alertFn("Failed to update card. See console.");
  }
}

export async function createCard({
  db,
  storage,
  classId,
  title,
  description,
  points = 0,
  category = "points",
  linkedStreakIds = [],
  lockedFile,
  unlockedFile,
  lockedFileInputRef,
  unlockedFileInputRef,
  alertFn = typeof window !== "undefined" ? window.alert.bind(window) : null,
}) {
  if (!classId) return;
  if (!title?.trim()) {
    if (alertFn) alertFn("Card title required");
    return;
  }

  try {
    const baseKey = uid("card");
    let lockedImageURL = "";
    let unlockedImageURL = "";

    if (lockedFile) {
      const keyLocked = `${baseKey}_locked_${lockedFile.name.replace(/\s+/g, "_")}`;
      const refLocked = storageRef(storage, `classes/${classId}/cards/${keyLocked}`);
      const snapLocked = await uploadBytes(refLocked, lockedFile);
      lockedImageURL = await getDownloadURL(snapLocked.ref);
    }

    if (unlockedFile) {
      const keyUnlocked = `${baseKey}_unlocked_${unlockedFile.name.replace(/\s+/g, "_")}`;
      const refUnlocked = storageRef(storage, `classes/${classId}/cards/${keyUnlocked}`);
      const snapUnlocked = await uploadBytes(refUnlocked, unlockedFile);
      unlockedImageURL = await getDownloadURL(snapUnlocked.ref);
    }

    if (!unlockedImageURL && lockedImageURL) unlockedImageURL = lockedImageURL;
    if (!lockedImageURL && unlockedImageURL) lockedImageURL = unlockedImageURL;

    const cleanLinked = Array.isArray(linkedStreakIds) ? linkedStreakIds.filter(Boolean) : [];

    const payload = {
      title: title.trim(),
      description: description || "",
      points: Number(points) || 0,
      category: category || "points",
      linkedStreakIds: category === "points" ? cleanLinked : [],
      imageURL: unlockedImageURL,
      lockedImageURL,
      createdAt: Date.now(),
    };

    await addDoc(collection(db, `classes/${classId}/cards`), payload);

    if (lockedFileInputRef?.current) lockedFileInputRef.current.value = "";
    if (unlockedFileInputRef?.current) unlockedFileInputRef.current.value = "";
  } catch (err) {
    console.error("createCard err:", err);
    if (alertFn) alertFn("Failed to add card. Check Storage permissions or console.");
  }
}

export async function deleteCard({
  db,
  classId,
  cardId,
  alertFn = typeof window !== "undefined" ? window.alert.bind(window) : null,
  confirmFn = typeof window !== "undefined" ? window.confirm.bind(window) : null,
}) {
  if (confirmFn && !(await confirmFn("Delete this library card?"))) return;
  try {
    await deleteDoc(doc(db, `classes/${classId}/cards/${cardId}`));
  } catch (err) {
    console.error(err);
    if (alertFn) alertFn("Failed to delete card.");
  }
}

export async function giveCardToStudent({
  db,
  classId,
  studentId,
  cardId,
  activeClass,
  alertFn = typeof window !== "undefined" ? window.alert.bind(window) : null,
  getCardDataFast,
  scheduleFn,
}) {
  try {
    const cardSnap = await getDoc(doc(db, `classes/${classId}/cards/${cardId}`));
    if (!cardSnap.exists()) return alertFn ? alertFn("Card not found") : undefined;
    const cardData = cardSnap.data();

    const category = cardData.category || "points";
    if (category === "rewards") return;

    const studentRef = doc(db, `classes/${classId}/students/${studentId}`);
    const studentSnap = await getDoc(studentRef);
    if (!studentSnap.exists()) return alertFn ? alertFn("Student not found") : undefined;
    const sdata = studentSnap.data();

    const multiplier = typeof sdata.multiplier === "number" ? sdata.multiplier : 1;

    let basePoints = 0;
    if (category === "points") basePoints = Number(cardData.points || 0);

    // Compute only the NEW card entries / points delta here. The final merge
    // happens inside a transaction against the freshest server state, so a
    // concurrent grant to the same student (e.g. two approved requests in a
    // row) can never silently overwrite/lose the other one's card.
    const effectivePoints = round2(basePoints * multiplier);
    const newEntries = [
      {
        id: uid("owned"),
        cardId,
        title: cardData.title,
        imageURL: cardData.imageURL || "",
        grantedAt: new Date().toISOString(),
        pointsGranted: effectivePoints,
      },
    ];

    let pointsDelta = effectivePoints;
    const linkedIds =
      category === "points"
        ? (Array.isArray(cardData.linkedStreakIds) ? cardData.linkedStreakIds : [])
        : [];

    const res = await incrementLinkedStreakIfNeeded(sdata, linkedIds, {
      allowPrompts: true,
      studentName: sdata.name || "",
      scheduleFn,
    }, activeClass);

    const nextStreaks = res?.nextStreaks || null;
    const crossedMaxIds = Array.isArray(res?.crossedMaxIds) ? res.crossedMaxIds : [];

    if (crossedMaxIds.length) {
      const streakConfigs = activeClass?.streakConfigs || [];
      const givenRewardCardIds = new Set();

      for (const streakId of crossedMaxIds) {
        const cfg = streakConfigs.find((c) => c.id === streakId);
        const rewardIds = Array.isArray(cfg?.rewardCardIds) ? cfg.rewardCardIds : [];
        pointsDelta = await grantStreakMaxRewardCards({
          rewardCardIds: rewardIds,
          cardsArr: newEntries,
          currentPoints: pointsDelta,
          multiplier,
          streakId,
          classId,
          getCardDataFast,
          givenRewardCardIds,
        });
      }
    }

    await runTransaction(db, async (tx) => {
      const freshSnap = await tx.get(studentRef);
      if (!freshSnap.exists()) return;
      const freshData = freshSnap.data();
      const freshCards = Array.isArray(freshData.cards) ? freshData.cards : [];

      const payload = {
        cards: [...freshCards, ...newEntries],
        currentPoints: round2((freshData.currentPoints || 0) + pointsDelta),
      };
      if (nextStreaks) payload.streaks = nextStreaks;

      tx.update(studentRef, payload);
    });
  } catch (err) {
    console.error(err);
    if (alertFn) alertFn("Failed to give card.");
    throw err;
  }
}

export async function giveCardToStudentsBulk({
  db,
  classId,
  cardId,
  studentIds,
  activeClass,
  alertFn = typeof window !== "undefined" ? window.alert.bind(window) : null,
  getCardDataFast,
}) {
  if (!classId) return;
  if (!Array.isArray(studentIds) || studentIds.length === 0) return;

  const floatHitsByStreak = new Map();

  try {
    const cardSnap = await getDoc(doc(db, `classes/${classId}/cards/${cardId}`));
    if (!cardSnap.exists()) return alertFn ? alertFn("Card not found") : undefined;
    const cardData = cardSnap.data();

    const category = cardData.category || "points";
    if (category === "rewards") return alertFn ? alertFn("Rewards cards can't be given directly.") : undefined;

    const basePoints = category === "points" ? Number(cardData.points || 0) : 0;
    const linkedIds =
      category === "points"
        ? (Array.isArray(cardData.linkedStreakIds) ? cardData.linkedStreakIds : [])
        : [];

    const streakConfigs = activeClass?.streakConfigs || [];
    const today = todayISODate();
    const pending = [];
    const maxHitsByStreak = new Map();

    for (let i = 0; i < studentIds.length; i++) {
      const studentId = studentIds[i];
      const studentRef = doc(db, `classes/${classId}/students/${studentId}`);
      const studentSnap = await getDoc(studentRef);
      if (!studentSnap.exists()) continue;
      const sdata = studentSnap.data();

      const multiplier = typeof sdata.multiplier === "number" ? sdata.multiplier : 1;
      const effectivePoints = round2(basePoints * multiplier);

      const cardsArr = Array.isArray(sdata.cards) ? [...sdata.cards] : [];
      cardsArr.push({
        id: uid("owned"),
        cardId,
        title: cardData.title,
        imageURL: cardData.imageURL || "",
        grantedAt: new Date().toISOString(),
        pointsGranted: effectivePoints,
      });

      const currentPoints = round2((sdata.currentPoints || 0) + effectivePoints);

      let nextStreaks = null;
      let crossedFloatIds = [];
      let crossedMaxIds = [];

      if (linkedIds.length > 0) {
        const res = incrementStreaksNoFloatWindows(sdata, linkedIds, streakConfigs);
        nextStreaks = res.nextStreaks;
        crossedFloatIds = res.crossedFloatIds;
        crossedMaxIds = Array.isArray(res.crossedMaxIds) ? res.crossedMaxIds : [];
      }

      const idx = pending.length;
      pending.push({
        studentRef,
        studentName: sdata.name || studentId,
        multiplier,
        cardsArr,
        currentPoints,
        nextStreaks,
      });

      for (const streakId of crossedFloatIds) {
        if (!floatHitsByStreak.has(streakId)) floatHitsByStreak.set(streakId, []);
        floatHitsByStreak.get(streakId).push({ idx, name: sdata.name || studentId });
      }

      for (const streakId of crossedMaxIds) {
        if (!maxHitsByStreak.has(streakId)) maxHitsByStreak.set(streakId, []);
        maxHitsByStreak.get(streakId).push({ idx, name: sdata.name || studentId });
      }
    }

    const defaultDelay = 7;
    const defaultDur = 7;

    for (const [streakId, hits] of maxHitsByStreak.entries()) {
      const cfg = streakConfigs.find((c) => c.id === streakId) || null;
      const emoji = cfg?.emoji || "⭐";
      const names = hits.map((h) => h.name);
      const preview = names.slice(0, 12).join(", ");
      const more = names.length > 12 ? ` (+${names.length - 12} more)` : "";

      const schedule = scheduleFn
        ? await scheduleFn({
            delayDays: defaultDelay,
            durationDays: defaultDur,
            message: `🎉 ${emoji} streak reached its maximum today for ${names.length} students: ${preview}${more}. This schedule applies to all of them.`,
          })
        : parseFloatScheduleInput(null, { delayDays: defaultDelay, durationDays: defaultDur });
      if (!schedule) continue;

      const { delayDays, durationDays } = schedule;

      const start = addDaysISO(today, delayDays);
      const end = addDaysISO(start, durationDays - 1);

      for (const h of hits) {
        const item = pending[h.idx];
        if (!item?.nextStreaks) continue;

        const prevEntry = item.nextStreaks[streakId] || {
          value: 0,
          lastUpdated: today,
          maxAchievedOn: today,
          floatWindows: [],
        };
        let floatWindows = Array.isArray(prevEntry.floatWindows) ? prevEntry.floatWindows : [];
        floatWindows = normalizeFloatWindows([...floatWindows, { start, end }], today);

        item.nextStreaks = {
          ...item.nextStreaks,
          [streakId]: { ...prevEntry, floatWindows },
        };
      }
    }

    const rewardCache = new Map();

    for (const [streakId, hits] of maxHitsByStreak.entries()) {
      const cfg = streakConfigs.find((c) => c.id === streakId) || null;
      const rewardIds = Array.isArray(cfg?.rewardCardIds) ? cfg.rewardCardIds : [];
      if (rewardIds.length === 0) continue;

      for (const rewardCardId of rewardIds) {
        if (!rewardCardId) continue;
        if (!rewardCache.has(rewardCardId)) {
          const cd = await getCardDataFast(classId, rewardCardId);
          rewardCache.set(rewardCardId, cd || null);
        }
      }

      for (const h of hits) {
        const item = pending[h.idx];
        if (!item) continue;

        item._rewardDone = item._rewardDone || new Set();

        const mult = typeof item.multiplier === "number" ? item.multiplier : 1;
        item.currentPoints = await grantStreakMaxRewardCards({
          rewardCardIds: rewardIds,
          cardsArr: item.cardsArr,
          currentPoints: item.currentPoints,
          multiplier: mult,
          streakId,
          classId,
          getCardDataFast: async (cId, cardId) => rewardCache.get(cardId) || null,
          givenRewardCardIds: item._rewardDone,
        });
      }
    }

    let batch = writeBatch(db);
    let writes = 0;
    let given = 0;

    for (const item of pending) {
      const payload = { cards: item.cardsArr, currentPoints: item.currentPoints };
      if (item.nextStreaks) payload.streaks = item.nextStreaks;

      batch.update(item.studentRef, payload);
      writes += 1;
      given += 1;

      if (writes >= 450) {
        await batch.commit();
        batch = writeBatch(db);
        writes = 0;
      }
    }

    if (writes > 0) await batch.commit();
    if (alertFn) alertFn(`Card given to ${given} student${given === 1 ? "" : "s"}.`);
  } catch (err) {
    console.error("giveCardToStudentsBulk error", err);
    if (alertFn) alertFn("Failed to give card to students. See console.");
  }
}
