import { getCardDisplayImage } from "../utils/cardImageUtils";
import { getHistoryTimestamp, parseTimestampWithPrecision } from "../utils/dateUtils";

export const REPORT_PERIODS = [
  { id: "week", label: "Last week" },
  { id: "twoWeeks", label: "Last 2 weeks" },
  { id: "month", label: "Last month" },
  { id: "manual", label: "Manual" },
];

export function formatDDMM(input) {
  const parsed = typeof input === "number"
    ? { ms: input }
    : parseTimestampWithPrecision(input);
  if (!parsed) return "--/--";
  const d = new Date(parsed.ms);
  const dd = String(d.getDate()).padStart(2, "0");
  const mm = String(d.getMonth() + 1).padStart(2, "0");
  return `${dd}/${mm}`;
}

export function formatDDMMYYYY(input) {
  const parsed = typeof input === "number"
    ? { ms: input }
    : parseTimestampWithPrecision(input);
  if (!parsed) return "";
  const d = new Date(parsed.ms);
  const dd = String(d.getDate()).padStart(2, "0");
  const mm = String(d.getMonth() + 1).padStart(2, "0");
  const yyyy = d.getFullYear();
  return `${dd}/${mm}/${yyyy}`;
}

export function parseDDMMYYYY(value) {
  if (typeof value !== "string") return null;
  const trimmed = value.trim();
  const match = /^(\d{1,2})\/(\d{1,2})\/(\d{4})$/.exec(trimmed);
  if (!match) return null;

  const day = Number(match[1]);
  const month = Number(match[2]);
  const year = Number(match[3]);
  if (month < 1 || month > 12 || day < 1 || day > 31) return null;

  const dt = new Date(year, month - 1, day, 0, 0, 0, 0);
  if (
    dt.getFullYear() !== year ||
    dt.getMonth() !== month - 1 ||
    dt.getDate() !== day
  ) {
    return null;
  }
  return dt;
}

export function resolveReportPeriodRange({
  period = "week",
  manualStart = "",
  manualEnd = "",
  now = new Date(),
} = {}) {
  const ref = now instanceof Date ? now : new Date(now);
  const y = ref.getFullYear();
  const m = ref.getMonth();
  const d = ref.getDate();

  const todayEnd = new Date(y, m, d, 23, 59, 59, 999);

  if (period === "week") {
    const start = new Date(y, m, d - 6, 0, 0, 0, 0);
    return {
      valid: true,
      period,
      startMs: start.getTime(),
      endMs: todayEnd.getTime(),
      startLabel: formatDDMMYYYY(start.getTime()),
      endLabel: formatDDMMYYYY(todayEnd.getTime()),
    };
  }

  if (period === "twoWeeks") {
    const start = new Date(y, m, d - 13, 0, 0, 0, 0);
    return {
      valid: true,
      period,
      startMs: start.getTime(),
      endMs: todayEnd.getTime(),
      startLabel: formatDDMMYYYY(start.getTime()),
      endLabel: formatDDMMYYYY(todayEnd.getTime()),
    };
  }

  if (period === "month") {
    let start = new Date(y, m - 1, d, 0, 0, 0, 0);
    const expectedMonth = (m - 1 + 12) % 12;
    if (start.getMonth() !== expectedMonth) {
      start = new Date(y, m, 0, 0, 0, 0, 0);
    }
    return {
      valid: true,
      period,
      startMs: start.getTime(),
      endMs: todayEnd.getTime(),
      startLabel: formatDDMMYYYY(start.getTime()),
      endLabel: formatDDMMYYYY(todayEnd.getTime()),
    };
  }

  if (period === "manual") {
    const startDt = parseDDMMYYYY(manualStart);
    const endDt = parseDDMMYYYY(manualEnd);
    if (!startDt || !endDt) {
      return {
        valid: false,
        period,
        error: "Enter both start and end dates in dd/mm/yyyy format.",
      };
    }
    const endDay = new Date(
      endDt.getFullYear(),
      endDt.getMonth(),
      endDt.getDate(),
      23,
      59,
      59,
      999
    );
    if (startDt.getTime() > endDay.getTime()) {
      return {
        valid: false,
        period,
        error: "Start date must be on or before the end date.",
      };
    }
    return {
      valid: true,
      period,
      startMs: startDt.getTime(),
      endMs: endDay.getTime(),
      startLabel: formatDDMMYYYY(startDt.getTime()),
      endLabel: formatDDMMYYYY(endDay.getTime()),
    };
  }

  return {
    valid: false,
    period,
    error: "Select a valid period.",
  };
}

function isCodeHistoryEntry(entry) {
  if (!entry || typeof entry !== "object") return false;
  if (entry.type === "evolution") return false;
  return Boolean(
    entry.isCodeRedemption ||
      entry.type === "achievement" ||
      entry.type === "achievement_card" ||
      (entry.obtainedFrom && String(entry.obtainedFrom).startsWith("activity_")) ||
      (!entry.cost &&
        (entry.pointsAwarded !== undefined || entry.source || entry.sourceId))
  );
}

function getCardSourceLabel(owned) {
  if (!owned || typeof owned !== "object") return "Card granted";
  if (owned.obtainedFrom && String(owned.obtainedFrom).startsWith("activity_")) {
    return "Code reward";
  }
  const autoType = owned.autoFrom?.type;
  if (autoType === "streakMax") {
    const streakId = owned.autoFrom?.streakId;
    if (streakId === "reward") return "Reward redeemed";
    if (streakId === "reward_group") return "Group reward";
    return "Streak max bonus";
  }
  if (autoType === "xpUnlock") return "XP level unlock";
  return "Card granted";
}

export function buildStudentActivityReport({
  student,
  cards = [],
  achievements = [],
  flagValue = "A",
  period = "week",
  manualStart = "",
  manualEnd = "",
  now = new Date(),
} = {}) {
  const range = resolveReportPeriodRange({ period, manualStart, manualEnd, now });
  if (!range.valid) {
    return {
      valid: false,
      error: range.error,
      range,
      cardTotals: [],
      timeline: [],
      totalCardsReceived: 0,
      totalCodesRedeemed: 0,
    };
  }

  if (!student) {
    return {
      valid: true,
      range,
      cardTotals: [],
      timeline: [],
      totalCardsReceived: 0,
      totalCodesRedeemed: 0,
    };
  }

  const cardsById = new Map();
  (Array.isArray(cards) ? cards : []).forEach((c) => {
    if (c?.id) cardsById.set(c.id, c);
  });

  // 1. Collect all cards received by the student within the selected period
  const ownedCardsInRange = [];
  (Array.isArray(student.cards) ? student.cards : []).forEach((owned, idx) => {
    if (!owned || typeof owned !== "object") return;
    const parsed =
      parseTimestampWithPrecision(owned.grantedAt) ||
      parseTimestampWithPrecision(owned.obtainedAt) ||
      parseTimestampWithPrecision(owned.date);
    if (!parsed) return;
    if (parsed.ms < range.startMs || parsed.ms > range.endMs) return;

    const cardMeta = owned.cardId ? cardsById.get(owned.cardId) : null;
    const title =
      String(cardMeta?.title || owned.title || owned.cardId || "Card").trim() ||
      "Card";
    const imageURL = cardMeta
      ? getCardDisplayImage(cardMeta, flagValue, false) ||
        owned.imageURL ||
        ""
      : owned.imageURL || "";

    ownedCardsInRange.push({
      idx,
      id: owned.id || `card_${idx}`,
      cardId: owned.cardId || null,
      title,
      imageURL,
      obtainedFrom: owned.obtainedFrom || "",
      pointsGranted: Number(owned.pointsGranted || 0),
      sourceLabel: getCardSourceLabel(owned),
      timestamp: parsed.ms,
      dayLabel: formatDDMM(parsed.ms),
    });
  });

  // Summarize total cards received by individual card name
  const totalsByName = new Map();
  ownedCardsInRange.forEach((item) => {
    const key = item.title.toLowerCase();
    if (!totalsByName.has(key)) {
      totalsByName.set(key, {
        key,
        cardId: item.cardId,
        title: item.title,
        imageURL: item.imageURL,
        count: 0,
      });
    }
    const bucket = totalsByName.get(key);
    bucket.count += 1;
    if (!bucket.imageURL && item.imageURL) bucket.imageURL = item.imageURL;
  });

  const cardTotals = Array.from(totalsByName.values()).sort((a, b) => {
    if (b.count !== a.count) return b.count - a.count;
    return a.title.localeCompare(b.title);
  });

  // 2. Collect redeemed codes from rewardsHistory (+ any missing achievements subcollection records)
  const codeEntries = [];
  const seenActivityKeys = new Set();

  (Array.isArray(student.rewardsHistory) ? student.rewardsHistory : []).forEach(
    (h, idx) => {
      if (!isCodeHistoryEntry(h)) return;
      const ts = getHistoryTimestamp(h);
      if (!ts || ts < range.startMs || ts > range.endMs) return;

      const sourceId = h.sourceId || h.source || "";
      const activityId = h.activityId || "";
      const compKey = sourceId && activityId ? `${sourceId}_${activityId}` : "";
      if (compKey) seenActivityKeys.add(compKey);

      const expectedObtainedFrom =
        h.obtainedFrom || (compKey ? `activity_${compKey}` : "");

      const cardMeta = h.cardId ? cardsById.get(h.cardId) : null;
      const cardTitle = cardMeta?.title || h.cardTitle || h.cardName || "";
      const cardImg = cardMeta
        ? getCardDisplayImage(cardMeta, flagValue, false) || ""
        : "";

      codeEntries.push({
        id: h.id || `code_${idx}_${ts}`,
        activityName: h.activityName || h.title || h.name || "Activity code",
        sourceLabel: h.source || h.sourceId || "Code",
        pointsAwarded: Number(h.pointsAwarded ?? 0),
        cardId: h.cardId || null,
        cardTitle,
        imageURL: cardImg,
        expectedObtainedFrom,
        timestamp: ts,
        dayLabel: formatDDMM(ts),
      });
    }
  );

  (Array.isArray(achievements) ? achievements : []).forEach((ach, idx) => {
    if (!ach || typeof ach !== "object") return;
    const sourceId = ach.sourceId || "";
    const activityId = ach.activityId || "";
    const compKey = sourceId && activityId ? `${sourceId}_${activityId}` : "";
    if (compKey && seenActivityKeys.has(compKey)) return;

    const parsed = parseTimestampWithPrecision(ach.redeemedAt ?? ach.date);
    if (!parsed || parsed.ms < range.startMs || parsed.ms > range.endMs) return;
    if (compKey) seenActivityKeys.add(compKey);

    const cardId = ach.cardId || ach.linkedCardId || ach.rewardCardId || null;
    const cardMeta = cardId ? cardsById.get(cardId) : null;
    const cardTitle = cardMeta?.title || ach.cardName || "";
    const cardImg = cardMeta
      ? getCardDisplayImage(cardMeta, flagValue, false) || ""
      : "";

    codeEntries.push({
      id: ach.id || `ach_${compKey || idx}_${parsed.ms}`,
      activityName: ach.activityName || ach.name || activityId || "Activity code",
      sourceLabel: sourceId || "Code",
      pointsAwarded: Number(ach.effectivePointsAwarded ?? ach.pointsAwarded ?? 0),
      cardId,
      cardTitle,
      imageURL: cardImg,
      expectedObtainedFrom: compKey ? `activity_${compKey}` : "",
      timestamp: parsed.ms,
      dayLabel: formatDDMM(parsed.ms),
    });
  });

  // 3. Combine code redemptions with any card they granted so the timeline shows a single combined entry
  const consumedCardIndices = new Set();
  const timeline = [];

  codeEntries.forEach((code) => {
    let matchedCard = null;

    if (code.expectedObtainedFrom) {
      matchedCard =
        ownedCardsInRange.find(
          (c) =>
            !consumedCardIndices.has(c.idx) &&
            c.obtainedFrom === code.expectedObtainedFrom
        ) || null;
    }

    if (!matchedCard && code.cardId) {
      matchedCard =
        ownedCardsInRange.find(
          (c) =>
            !consumedCardIndices.has(c.idx) &&
            c.cardId === code.cardId &&
            Math.abs(c.timestamp - code.timestamp) <= 10000
        ) || null;
    }

    if (matchedCard) {
      consumedCardIndices.add(matchedCard.idx);
    }

    const resolvedCardTitle = matchedCard?.title || code.cardTitle || "";
    const resolvedCardId = matchedCard?.cardId || code.cardId || null;
    const resolvedImage = matchedCard?.imageURL || code.imageURL || "";

    timeline.push({
      id: `tl_code_${code.id}`,
      kind: "code",
      hasCard: Boolean(matchedCard || resolvedCardTitle),
      title: code.activityName,
      sourceLabel: code.sourceLabel,
      pointsAwarded: code.pointsAwarded,
      cardId: resolvedCardId,
      cardTitle: resolvedCardTitle,
      imageURL: resolvedImage,
      timestamp: code.timestamp,
      dayLabel: code.dayLabel,
    });
  });

  ownedCardsInRange.forEach((card) => {
    if (consumedCardIndices.has(card.idx)) return;
    timeline.push({
      id: `tl_card_${card.id}`,
      kind: "card",
      title: card.title,
      cardId: card.cardId,
      imageURL: card.imageURL,
      pointsGranted: card.pointsGranted,
      sourceLabel: card.sourceLabel,
      timestamp: card.timestamp,
      dayLabel: card.dayLabel,
    });
  });

  // Sort newest -> oldest
  timeline.sort((a, b) => {
    if (b.timestamp !== a.timestamp) return b.timestamp - a.timestamp;
    return String(a.id).localeCompare(String(b.id));
  });

  return {
    valid: true,
    range,
    cardTotals,
    timeline,
    totalCardsReceived: ownedCardsInRange.length,
    totalCodesRedeemed: codeEntries.length,
  };
}

export function filterReportTimelineByCard(timeline = [], cardKey = "all") {
  const safeTimeline = Array.isArray(timeline) ? timeline : [];
  const normalized = String(cardKey || "all").trim().toLowerCase();
  if (!normalized || normalized === "all") return safeTimeline;

  return safeTimeline.filter((item) => {
    if (!item || typeof item !== "object") return false;
    if (item.kind === "card") {
      return String(item.title || "").trim().toLowerCase() === normalized;
    }
    if (item.kind === "code" && item.hasCard) {
      return String(item.cardTitle || "").trim().toLowerCase() === normalized;
    }
    return false;
  });
}
