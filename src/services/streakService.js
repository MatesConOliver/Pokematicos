import {
  collection,
  doc,
  getDoc,
  updateDoc,
  getDocs,
  writeBatch,
} from "firebase/firestore";

import { uid, round2 } from "../utils/helpers";
import { todayISODate, addDaysISO } from "../utils/dateUtils";
import {
  parseFloatScheduleInput,
  normalizeFloatWindows,
} from "../utils/floatWindowUtils";
import { pushOwnedCard } from "./rewardService";

export async function addStreakTypeForClass({
  db,
  classId,
  classesList,
  promptFn = typeof window !== "undefined" ? window.prompt.bind(window) : null,
  alertFn = typeof window !== "undefined" ? window.alert.bind(window) : null,
}) {
  if (!classId) {
    if (alertFn) alertFn("Select a class first");
    return;
  }

  if (!promptFn) return;

  const emoji = promptFn("Emoji for this streak (for example 🔥, 👻, ⭐):");
  if (!emoji || !emoji.trim()) return;

  const maxStr = promptFn("Maximum value for this streak (for example 5):");
  const max = Number(maxStr || "0");
  if (!Number.isFinite(max) || max <= 0) {
    if (alertFn) alertFn("Maximum must be a number greater than 0.");
    return;
  }

  const floatAns = promptFn(
    "When a student reaches this maximum streak, should this emoji float faintly in their card background? (yes/no)"
  );
  const float = !!(floatAns && floatAns.toLowerCase().startsWith("y"));

  const stickyAns = promptFn(
    "If you Reset this streak later, should the celebration (party + floating) keep showing for the rest of the day when max was reached? (yes/no)"
  );
  const stickyCelebrate = !!(stickyAns && stickyAns.toLowerCase().startsWith("y"));

  const id = uid("streak");
  const rewardCardIds = promptPickRewardCardIds({
    promptFn,
    alertFn,
    cards: (Array.isArray(classesList) ? classesList : []),
    defaultIds: [],
    label: `${emoji} streak`,
  }) ?? [];

  const newCfg = {
    id,
    emoji,
    max,
    float,
    stickyCelebrate,
    rewardCardIds,
  };

  try {
    const clsRef = doc(db, `classes/${classId}`);
    const current = (Array.isArray(classesList) ? classesList : []).find((c) => c.id === classId)?.streakConfigs || [];
    await updateDoc(clsRef, { streakConfigs: [...current, newCfg] });
    if (alertFn) alertFn("New streak type created for this class.");
  } catch (err) {
    console.error(err);
    if (alertFn) alertFn("Could not create streak type. See console for details.");
  }
}

export function promptPickRewardCardIds({
  cards,
  promptFn,
  alertFn,
  defaultIds = [],
  label = "",
} = {}) {
  const opts = (Array.isArray(cards) ? cards : [])
    .filter((c) => (c.category || "points") === "points")
    .slice()
    .sort((a, b) => String(a.title || "").localeCompare(String(b.title || "")));

  if (opts.length === 0) {
    if (alertFn) alertFn("No POINTS cards found in the library. Create a points card first.");
    return null;
  }

  const idToNum = new Map(opts.map((c, i) => [c.id, i + 1]));
  const currentNums = (defaultIds || []).map((id) => idToNum.get(id)).filter(Boolean);
  const defaultText = currentNums.length ? currentNums.join(",") : "";

  const list = opts
    .map((c, i) => `${i + 1}) ${c.title || "(untitled)"} — ${Number(c.points || 0)} pts`)
    .join("\n");

  const input = promptFn(
    `Reward card(s) when ${label || "this"} streak reaches MAX.\n` +
      `Choose numbers separated by commas (example: 1,3).\n` +
      `Leave empty for NONE.\n\n${list}`,
    defaultText
  );

  if (input == null) return undefined;
  const s = String(input).trim();
  if (!s) return [];

  const parts = s.split(",").map((x) => x.trim()).filter(Boolean);
  const picked = [];

  for (const p of parts) {
    const n = parseInt(p, 10);
    if (Number.isFinite(n) && n >= 1 && n <= opts.length) {
      picked.push(opts[n - 1].id);
      continue;
    }

    const byId = opts.find((c) => c.id === p);
    if (byId) picked.push(byId.id);
  }

  return Array.from(new Set(picked));
}

export async function setStreakRewardCardsForClass({
  db,
  classId,
  classesList,
  cards,
  promptFn = typeof window !== "undefined" ? window.prompt.bind(window) : null,
  alertFn = typeof window !== "undefined" ? window.alert.bind(window) : null,
  streakId,
  cfg,
}) {
  if (!promptFn) return;

  try {
    const current = (Array.isArray(classesList) ? classesList : []).find((c) => c.id === classId)?.streakConfigs || [];
    const found = current.find((c) => c.id === streakId) || cfg || null;
    const existing = Array.isArray(found?.rewardCardIds) ? found.rewardCardIds : [];

    const next = promptPickRewardCardIds({
      cards,
      promptFn,
      alertFn,
      defaultIds: existing,
      label: found?.emoji ? `${found.emoji} streak` : "this streak",
    });

    if (next === null) return;
    if (next === undefined) return;

    const nextConfigs = current.map((c) =>
      c.id === streakId ? { ...c, rewardCardIds: next } : c
    );

    await updateDoc(doc(db, `classes/${classId}`), { streakConfigs: nextConfigs });
  } catch (e) {
    console.error("setStreakRewardCardsForClass error", e);
    if (alertFn) alertFn("Could not set reward cards. See console.");
  }
}

export async function changeStudentStreakValue({
  db,
  classId,
  studentId,
  streakId,
  delta,
  maxValueOrCfg,
  promptFn = typeof window !== "undefined" ? window.prompt.bind(window) : null,
  alertFn = typeof window !== "undefined" ? window.alert.bind(window) : null,
  getCardDataFast,
}) {
  try {
    const studentRef = doc(db, `classes/${classId}/students/${studentId}`);
    const snap = await getDoc(studentRef);
    if (!snap.exists()) return;
    const data = snap.data();

    const streaks = data.streaks || {};
    const existingEntry = streaks[streakId] || {};
    const current = existingEntry.value || 0;

    const cfg = maxValueOrCfg && typeof maxValueOrCfg === "object" ? maxValueOrCfg : null;
    const maxValue =
      typeof maxValueOrCfg === "number"
        ? maxValueOrCfg
        : typeof cfg?.max === "number"
        ? cfg.max
        : 0;

    let next = current + delta;
    if (next < 0) next = 0;
    if (typeof maxValue === "number" && maxValue > 0 && next > maxValue) {
      next = maxValue;
    }

    const today = todayISODate();
    const prevMaxAchievedOn = existingEntry.maxAchievedOn || "";

    const reachedMaxNow = delta > 0 && typeof maxValue === "number" && maxValue > 0 && next === maxValue;
    const crossedToMax = reachedMaxNow && current < maxValue;

    let floatWindows = Array.isArray(existingEntry.floatWindows) ? existingEntry.floatWindows : [];

    if (crossedToMax && cfg?.float) {
      const defaultDelay = 7;
      const defaultDur = 7;

      const delayStr = promptFn(
        `🎉 ${data.name || "Student"} reached the maximum for ${cfg.emoji || "this"} streak!\nFloating emoji: how many DAYS after today should it start?\n(Example: 0 = today, 7 = next week)`,
        String(defaultDelay)
      );
      const durationStr = promptFn(
        `How many DAYS should the floating emoji last? (Example: 7 = one full week)`,
        String(defaultDur)
      );

      let delayDays = parseInt((delayStr ?? String(defaultDelay)).trim(), 10);
      if (!Number.isFinite(delayDays) || delayDays < 0) delayDays = defaultDelay;

      let durationDays = parseInt((durationStr ?? String(defaultDur)).trim(), 10);
      if (!Number.isFinite(durationDays) || durationDays <= 0) durationDays = defaultDur;

      const start = addDaysISO(today, delayDays);
      const end = addDaysISO(start, durationDays - 1);

      floatWindows = normalizeFloatWindows([...floatWindows, { start, end }], today);
    } else {
      floatWindows = normalizeFloatWindows(floatWindows, today);
    }

    const updatedEntry = {
      ...existingEntry,
      value: next,
      lastUpdated: delta > 0 ? today : (existingEntry.lastUpdated || ""),
      maxAchievedOn: reachedMaxNow ? today : prevMaxAchievedOn,
      floatWindows,
    };

    const updatedStreaks = {
      ...streaks,
      [streakId]: updatedEntry,
    };

    const payload = { streaks: updatedStreaks };

    if (crossedToMax) {
      const rewardIds = Array.isArray(cfg?.rewardCardIds) ? cfg.rewardCardIds : [];
      if (rewardIds.length) {
        const multiplier = typeof data.multiplier === "number" ? data.multiplier : 1;
        const cardsArr = Array.isArray(data.cards) ? [...data.cards] : [];
        let currentPoints = Number(data.currentPoints || 0);

        const dedupe = new Set();

        for (const rewardCardId of rewardIds) {
          if (!rewardCardId || dedupe.has(rewardCardId)) continue;

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

          currentPoints = round2(currentPoints + pts);
          dedupe.add(rewardCardId);
        }

        payload.cards = cardsArr;
        payload.currentPoints = currentPoints;
      }
    }

    await updateDoc(studentRef, payload);
  } catch (err) {
    console.error("changeStudentStreakValue error", err);
    if (alertFn) alertFn("Could not update streak. See console.");
  }
}

export async function resetStudentStreak({
  db,
  classId,
  studentId,
  streakId,
  alertFn = typeof window !== "undefined" ? window.alert.bind(window) : null,
}) {
  try {
    const studentRef = doc(db, `classes/${classId}/students/${studentId}`);
    const snap = await getDoc(studentRef);
    if (!snap.exists()) return;
    const data = snap.data();
    const streaks = data.streaks || {};

    const prev = streaks[streakId] || {};
    const updatedEntry = {
      value: 0,
      lastUpdated: "",
      maxAchievedOn: prev.maxAchievedOn || "",
      floatWindows: Array.isArray(prev.floatWindows) ? prev.floatWindows : [],
    };

    const updatedStreaks = {
      ...streaks,
      [streakId]: updatedEntry,
    };

    await updateDoc(studentRef, { streaks: updatedStreaks });
  } catch (err) {
    console.error("resetStudentStreak error", err);
    if (alertFn) alertFn("Could not reset streak.");
  }
}

export async function deleteStreakTypeForClass({
  db,
  classId,
  streakId,
  alertFn = typeof window !== "undefined" ? window.alert.bind(window) : null,
}) {
  if (
    typeof window !== "undefined" &&
    !window.confirm(
      "Delete this streak type for the whole class? This cannot be undone.\n\nThis will also remove it (and any floating windows) from every student."
    )
  ) {
    return;
  }

  try {
    const classRef = doc(db, `classes/${classId}`);
    const snap = await getDoc(classRef);
    if (!snap.exists()) return;
    const data = snap.data();
    const list = data.streakConfigs || [];
    const updated = list.filter((cfg) => cfg.id !== streakId);
    await updateDoc(classRef, { streakConfigs: updated });

    const studentsSnap = await getDocs(collection(db, `classes/${classId}/students`));
    let batch = writeBatch(db);
    let writes = 0;

    for (const sdoc of studentsSnap.docs) {
      const sdata = sdoc.data();
      const streaks = sdata.streaks || {};
      if (!streaks[streakId]) continue;

      const nextStreaks = { ...streaks };
      delete nextStreaks[streakId];

      batch.update(sdoc.ref, { streaks: nextStreaks });
      writes++;

      if (writes >= 450) {
        await batch.commit();
        batch = writeBatch(db);
        writes = 0;
      }
    }
    if (writes > 0) await batch.commit();
  } catch (err) {
    console.error("deleteStreakTypeForClass error", err);
    if (alertFn) alertFn("Could not delete streak. See console.");
  }
}

export function incrementLinkedStreakIfNeeded(sdata, idsOrId, opts = {}, activeClass = null) {
  const today = todayISODate();
  const ids = Array.isArray(idsOrId)
    ? idsOrId.filter(Boolean)
    : (idsOrId ? [idsOrId] : []);

  if (ids.length === 0) return null;

  const streaks = { ...(sdata.streaks || {}) };
  let changed = false;

  const allowPrompts = opts.allowPrompts !== false;
  const studentName = opts.studentName || sdata.name || "Student";
  const progress = opts.progressLabel ? ` (${opts.progressLabel})` : "";
  const crossedMaxIds = [];
  const defaultDelay = Number.isFinite(opts.defaultDelayDays) ? opts.defaultDelayDays : 7;
  const defaultDur = Number.isFinite(opts.defaultDurationDays) ? opts.defaultDurationDays : 7;

  for (const id of ids) {
    const prev = streaks[id] || { value: 0, lastUpdated: "", maxAchievedOn: "", floatWindows: [] };
    if ((prev.lastUpdated || "") === today) continue;

    const cfg = (activeClass?.streakConfigs || []).find((c) => c.id === id) || null;
    const max = typeof cfg?.max === "number" ? cfg.max : 0;

    let nextVal = (prev.value || 0) + 1;
    if (max > 0 && nextVal > max) nextVal = max;

    const crossedToMax = max > 0 && nextVal === max && (prev.value || 0) < max;
    if (crossedToMax) crossedMaxIds.push(id);

    let floatWindows = Array.isArray(prev.floatWindows) ? prev.floatWindows : [];
    floatWindows = normalizeFloatWindows(floatWindows, today);

    if (crossedToMax && cfg?.float) {
      let delayDays = defaultDelay;
      let durationDays = defaultDur;

      if (allowPrompts && typeof window !== "undefined") {
        const streakLabel = cfg?.emoji ? `${cfg.emoji} streak` : "this streak";

        const input = window.prompt(
          `🎉 Max reached for ${studentName}${progress}!\n\n` +
            `${streakLabel}: floating emoji schedule\n` +
            `Type: delay,duration\n` +
            `Examples:\n` +
            `  0,7   (start today, 7 days)\n` +
            `  7,14  (start in 7 days, 14 days)\n` +
            `  start=3 duration=10\n`,
          `${defaultDelay},${defaultDur}`
        );

        const parsed = parseFloatScheduleInput(input, {
          delayDays: defaultDelay,
          durationDays: defaultDur,
        });

        delayDays = parsed.delayDays;
        durationDays = parsed.durationDays;
      }

      const start = addDaysISO(today, delayDays);
      const end = addDaysISO(start, durationDays - 1);
      floatWindows = normalizeFloatWindows([...floatWindows, { start, end }], today);
    }

    streaks[id] = {
      ...prev,
      value: nextVal,
      lastUpdated: today,
      maxAchievedOn: crossedToMax ? today : (prev.maxAchievedOn || ""),
      floatWindows,
    };

    changed = true;
  }

  return { nextStreaks: changed ? streaks : null, crossedMaxIds };
}

export function incrementStreaksNoFloatWindows(sdata, ids, streakConfigs) {
  const today = todayISODate();
  const streaks = { ...(sdata.streaks || {}) };
  let changed = false;

  const crossedFloatIds = [];
  const crossedMaxIds = [];

  for (const id of (Array.isArray(ids) ? ids.filter(Boolean) : [])) {
    const prev = streaks[id] || { value: 0, lastUpdated: "", maxAchievedOn: "", floatWindows: [] };

    if ((prev.lastUpdated || "") === today) continue;

    const cfg = (streakConfigs || []).find((c) => c.id === id) || null;
    const max = typeof cfg?.max === "number" ? cfg.max : 0;

    let nextVal = (prev.value || 0) + 1;
    if (max > 0 && nextVal > max) nextVal = max;

    const crossedToMax = max > 0 && nextVal === max && (prev.value || 0) < max;

    let floatWindows = Array.isArray(prev.floatWindows) ? prev.floatWindows : [];
    floatWindows = normalizeFloatWindows(floatWindows, today);

    if (crossedToMax) crossedMaxIds.push(id);
    if (crossedToMax && cfg?.float) crossedFloatIds.push(id);

    streaks[id] = {
      ...prev,
      value: nextVal,
      lastUpdated: today,
      maxAchievedOn: crossedToMax ? today : (prev.maxAchievedOn || ""),
      floatWindows,
    };

    changed = true;
  }

  return { nextStreaks: changed ? streaks : null, crossedFloatIds, crossedMaxIds };
}
