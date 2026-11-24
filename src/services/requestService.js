import {
  addDoc,
  collection,
  deleteDoc,
  doc,
  getDoc,
  getDocs,
  query,
  where,
} from "firebase/firestore";
import { todayISODate } from "../utils/dateUtils";
import { isCardUnlockedForStudent } from "./cardEvolutionService";

export const MAX_PENDING_REQUESTS_PER_STUDENT = 3;

export function getStreakRewardCardIdSet(streakConfigs = []) {
  const ids = new Set();
  for (const cfg of Array.isArray(streakConfigs) ? streakConfigs : []) {
    if (!cfg || !Array.isArray(cfg.rewardCardIds)) continue;
    for (const id of cfg.rewardCardIds) {
      if (id) ids.add(id);
    }
  }
  return ids;
}

export function getRequestableCards(cards = [], streakConfigs = []) {
  const streakRewardCardIds = getStreakRewardCardIdSet(streakConfigs);
  return (Array.isArray(cards) ? cards : []).filter(
    (c) =>
      c &&
      (c.category || "points") === "points" &&
      !streakRewardCardIds.has(c.id)
  );
}

export async function createRequest(
  db,
  classId,
  { studentId, studentName, className, type, amount, cardId, cardTitle, note, streakConfigs },
  alertFn = null
) {
  try {
    if (cardId && getStreakRewardCardIdSet(streakConfigs).has(cardId)) {
      if (alertFn) alertFn("Cards given as a streak reward cannot be requested.");
      return false;
    }

    const pendingQ = query(
      collection(db, `classes/${classId}/requests`),
      where("studentId", "==", studentId),
      where("status", "==", "pending")
    );
    const pendingSnap = await getDocs(pendingQ);
    if (pendingSnap.size >= MAX_PENDING_REQUESTS_PER_STUDENT) {
      if (alertFn) alertFn(`You already have ${MAX_PENDING_REQUESTS_PER_STUDENT} pending requests. Wait for them to be resolved.`);
      return false;
    }

    // Determine Firestore-compatible type:
    // If a card is requested (whether card-only or combined with points), use "card"
    // as the primary document type so it complies with live Firestore security rules
    // that require d.type in ['points', 'card'].
    const docType = cardId ? "card" : "points";

    const payload = {
      studentId,
      studentName: studentName || "",
      className: className || "",
      type: docType,
      note: (note || "").toString().slice(0, 200),
      status: "pending",
      createdAt: Date.now(),
    };
    if (amount) payload.amount = Number(amount || 0);
    if (cardId) {
      payload.cardId = cardId;
      payload.cardTitle = cardTitle || "";
    }

    await addDoc(collection(db, `classes/${classId}/requests`), payload);
    return true;
  } catch (err) {
    console.error("createRequest error", err);
    if (alertFn) alertFn("Could not send request.");
    return false;
  }
}

export async function cancelRequest(db, classId, requestId, alertFn = null) {
  try {
    await deleteDoc(doc(db, `classes/${classId}/requests/${requestId}`));
    return true;
  } catch (err) {
    console.error("cancelRequest error", err);
    if (alertFn) alertFn("Could not cancel request.");
    return false;
  }
}

export async function rejectRequest(db, classId, requestId, alertFn = null) {
  try {
    await deleteDoc(doc(db, `classes/${classId}/requests/${requestId}`));
    return true;
  } catch (err) {
    console.error("rejectRequest error", err);
    if (alertFn) alertFn("Could not reject request.");
    return false;
  }
}

export async function resolveRequestApproved(db, classId, requestId, alertFn = null) {
  try {
    await deleteDoc(doc(db, `classes/${classId}/requests/${requestId}`));
    return true;
  } catch (err) {
    console.error("resolveRequestApproved error", err);
    if (alertFn) alertFn("Request was granted, but could not be cleared from the list.");
    return false;
  }
}

/**
 * Pure helper that identifies every (classId, streakId) floating streak that will
 * reach its maximum across a batch of accepted requests, grouping all affected students.
 */
export function collectBatchFloatingMaxHits({
  requests = [],
  classById = new Map(),
  cardByKey = new Map(),
  studentByKey = new Map(),
  today = todayISODate(),
}) {
  const hitsByStreakKey = new Map();
  const simulatedUpdatedToday = new Set();

  for (const r of Array.isArray(requests) ? requests : []) {
    if (!r?.classId || !r?.studentId || !r?.cardId) continue;
    const grantsCard = r.type === "card" || r.type === "both" || Boolean(r.cardTitle);
    if (!grantsCard) continue;

    const cls = classById.get(r.classId);
    const card = cardByKey.get(`${r.classId}:${r.cardId}`);
    const stu = studentByKey.get(`${r.classId}:${r.studentId}`);
    if (!cls || !card || !stu) continue;

    if ((card.category || "points") !== "points") continue;
    if (!isCardUnlockedForStudent(stu, { id: r.cardId, ...card })) continue;

    const linkedIds = Array.isArray(card.linkedStreakIds) ? card.linkedStreakIds.filter(Boolean) : [];
    const streakConfigs = Array.isArray(cls.streakConfigs) ? cls.streakConfigs : [];

    for (const streakId of linkedIds) {
      const cfg = streakConfigs.find((c) => c.id === streakId);
      if (!cfg || !cfg.float) continue;

      const prev = (stu.streaks && stu.streaks[streakId]) || { value: 0, lastUpdated: "" };
      if ((prev.lastUpdated || "") === today) continue;

      const simKey = `${r.classId}:${r.studentId}:${streakId}`;
      if (simulatedUpdatedToday.has(simKey)) continue;
      simulatedUpdatedToday.add(simKey);

      const max = typeof cfg.max === "number" ? cfg.max : 0;
      let nextVal = (prev.value || 0) + 1;
      if (max > 0 && nextVal > max) nextVal = max;

      const crossedToMax = max > 0 && nextVal === max && (prev.value || 0) < max;
      if (!crossedToMax) continue;

      const groupKey = `${r.classId}:${streakId}`;
      if (!hitsByStreakKey.has(groupKey)) {
        hitsByStreakKey.set(groupKey, {
          classId: r.classId,
          streakId,
          cfg,
          students: [],
        });
      }
      hitsByStreakKey.get(groupKey).students.push({
        studentId: r.studentId,
        studentName: stu.name || r.studentName || "Student",
      });
    }
  }

  return hitsByStreakKey;
}

/**
 * Fetches needed class/card/student records for a batch of requests, prompts once per
 * floating streak that reaches max, and returns { classById, batchScheduleFn }.
 */
export async function prepareBatchFloatSchedules({
  db,
  requests = [],
  scheduleFn = null,
  getCardDataFast = null,
}) {
  const classById = new Map();
  const cardByKey = new Map();
  const studentByKey = new Map();

  const cardRequests = (Array.isArray(requests) ? requests : []).filter(
    (r) => r?.classId && r?.studentId && r?.cardId && (r.type === "card" || r.type === "both" || r.cardTitle)
  );

  const uniqueClassIds = Array.from(new Set(cardRequests.map((r) => r.classId)));
  const uniqueCardKeys = Array.from(new Set(cardRequests.map((r) => `${r.classId}:${r.cardId}`)));
  const uniqueStudentKeys = Array.from(new Set(cardRequests.map((r) => `${r.classId}:${r.studentId}`)));

  await Promise.all([
    ...uniqueClassIds.map(async (cId) => {
      const snap = await getDoc(doc(db, `classes/${cId}`));
      if (snap.exists()) classById.set(cId, { id: cId, ...snap.data() });
    }),
    ...uniqueCardKeys.map(async (key) => {
      const [cId, cardId] = key.split(":");
      const data = getCardDataFast
        ? await getCardDataFast(cId, cardId)
        : await getDoc(doc(db, `classes/${cId}/cards/${cardId}`)).then((s) =>
            s.exists() ? { id: cardId, ...s.data() } : null
          );
      if (data) cardByKey.set(key, data);
    }),
    ...uniqueStudentKeys.map(async (key) => {
      const [cId, sId] = key.split(":");
      const snap = await getDoc(doc(db, `classes/${cId}/students/${sId}`));
      if (snap.exists()) studentByKey.set(key, { id: sId, ...snap.data() });
    }),
  ]);

  const today = todayISODate();
  const hitsByStreakKey = collectBatchFloatingMaxHits({
    requests: cardRequests,
    classById,
    cardByKey,
    studentByKey,
    today,
  });

  const scheduleCache = new Map();

  if (scheduleFn) {
    for (const [groupKey, group] of hitsByStreakKey.entries()) {
      const emoji = group.cfg?.emoji || "";
      const streakLabel = emoji ? `${emoji} streak` : "this streak";
      const names = group.students.map((s) => s.studentName);
      const preview = names.slice(0, 12).join(", ");
      const more = names.length > 12 ? ` (+${names.length - 12} more)` : "";

      const message =
        names.length === 1
          ? `🎉 Max reached for ${names[0]}. ${streakLabel} floating schedule applies to this student.`
          : `🎉 ${streakLabel} reached its maximum today for ${names.length} students: ${preview}${more}. This schedule applies to all of them.`;

      const parsed = await scheduleFn({
        delayDays: 7,
        durationDays: 7,
        classId: group.classId,
        streakId: group.streakId,
        message,
      });
      scheduleCache.set(groupKey, parsed || null);
    }
  }

  const batchScheduleFn = async (reqOpts) => {
    const cacheKey = `${reqOpts?.classId || ""}:${reqOpts?.streakId || ""}`;
    if (reqOpts?.streakId && scheduleCache.has(cacheKey)) {
      return scheduleCache.get(cacheKey);
    }
    const res = scheduleFn ? await scheduleFn(reqOpts) : null;
    if (reqOpts?.streakId) {
      scheduleCache.set(cacheKey, res || null);
    }
    return res;
  };

  return { classById, batchScheduleFn };
}
