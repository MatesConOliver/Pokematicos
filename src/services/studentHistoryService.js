import { getHistoryTimestamp } from "../utils/dateUtils";

/**
 * Combines a student's `rewardsHistory` entries (rewards, codes, evolutions)
 * with Experience cards achieved in `student.cards`, sorted newest -> oldest.
 */
export function buildStudentHistoryEntries({
  student,
  rewardsHistory = null,
  allCards = [],
} = {}) {
  const baseHistory = Array.isArray(rewardsHistory)
    ? rewardsHistory
    : Array.isArray(student?.rewardsHistory)
    ? student.rewardsHistory
    : [];

  const cardsById = new Map();
  (Array.isArray(allCards) ? allCards : []).forEach((c) => {
    if (c?.id) cardsById.set(c.id, c);
  });

  const existingExperienceCardIds = new Set();
  const existingObtainedFrom = new Set();

  baseHistory.forEach((h) => {
    if (!h || typeof h !== "object") return;
    if (h.type === "experience" && h.cardId) {
      existingExperienceCardIds.add(h.cardId);
    }
    if (h.obtainedFrom) {
      existingObtainedFrom.add(String(h.obtainedFrom));
    } else if ((h.sourceId || h.source) && h.activityId) {
      existingObtainedFrom.add(`activity_${h.sourceId || h.source}_${h.activityId}`);
    }
  });

  const autoCardEntries = [];
  const seenXpCardIds = new Set();

  (Array.isArray(student?.cards) ? student.cards : []).forEach((owned, idx) => {
    if (!owned || typeof owned !== "object") return;

    const cardMeta = owned.cardId ? cardsById.get(owned.cardId) : null;
    const isExperience =
      cardMeta?.category === "experience" ||
      owned.autoFrom?.type === "xpUnlock" ||
      owned.autoFrom?.streakId === "xp_unlock";
    const isCombo = owned.autoFrom?.type === "combo";

    if (isExperience) {
      if (owned.obtainedFrom && existingObtainedFrom.has(String(owned.obtainedFrom))) {
        return;
      }

      if (owned.cardId) {
        if (existingExperienceCardIds.has(owned.cardId) || seenXpCardIds.has(owned.cardId)) {
          return;
        }
        seenXpCardIds.add(owned.cardId);
      }

      const title =
        String(cardMeta?.title || owned.title || "Experience Card").trim() ||
        "Experience Card";
      const rawXp = cardMeta?.points ?? owned.autoFrom?.xpRequired;
      const xpRequired =
        rawXp !== undefined && rawXp !== null && Number.isFinite(Number(rawXp))
          ? Number(rawXp)
          : null;
      const timestampValue = owned.grantedAt ?? owned.obtainedAt ?? owned.date ?? null;

      autoCardEntries.push({
        id: `xp_${owned.id || owned.cardId || idx}`,
        type: "experience",
        cardId: owned.cardId || null,
        title,
        xpRequired,
        date: timestampValue,
        grantedAt: timestampValue,
      });
      return;
    }

    if (isCombo) {
      const title =
        String(cardMeta?.title || owned.title || "Combo Card").trim() ||
        "Combo Card";
      const timestampValue = owned.grantedAt ?? owned.obtainedAt ?? owned.date ?? null;

      autoCardEntries.push({
        id: `combo_${owned.id || owned.cardId || idx}`,
        type: "combo",
        cardId: owned.cardId || null,
        title,
        pointsAwarded: Number(owned.pointsGranted ?? cardMeta?.points ?? 0),
        period: owned.autoFrom?.period || cardMeta?.combo?.period || "week",
        date: timestampValue,
        grantedAt: timestampValue,
      });
    }
  });

  return [...baseHistory, ...autoCardEntries].sort((a, b) => {
    const diff = getHistoryTimestamp(b) - getHistoryTimestamp(a);
    if (diff !== 0) return diff;
    return Number(b?.xpRequired ?? 0) - Number(a?.xpRequired ?? 0);
  });
}
