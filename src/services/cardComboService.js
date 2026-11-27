/**
 * Service for Temporal Combo Cards in Pokemáticos.
 *
 * Combo cards live in the "points" category and are automatically awarded
 * (along with multiplied points) when a student acquires the configured
 * cards within the same natural calendar period (day, week, or month).
 */

import { parseTimestampWithPrecision } from "../utils/dateUtils";
import { uid, round2 } from "../utils/helpers";
import { isEvolutionCard, isCardUnlockedForStudent } from "./cardEvolutionService";

export const VALID_COMBO_PERIODS = ["day", "week", "month"];
export const VALID_COMBO_REPEAT_MODES = ["per_period", "once"];

function toLocalDate(value) {
  if (value instanceof Date) {
    return Number.isFinite(value.getTime()) ? value : null;
  }
  const parsed = parseTimestampWithPrecision(value);
  if (!parsed) return null;
  const d = new Date(parsed.ms);
  return Number.isFinite(d.getTime()) ? d : null;
}

/**
 * Computes a deterministic local calendar key for a natural period:
 * - "day": "YYYY-MM-DD"
 * - "week": "W:YYYY-MM-DD" (local Monday of the Monday–Sunday week)
 * - "month": "YYYY-MM"
 */
export function getNaturalPeriodKey(period = "week", dateOrInput = new Date()) {
  const d = toLocalDate(dateOrInput);
  if (!d) return "";

  const y = d.getFullYear();
  const m = String(d.getMonth() + 1).padStart(2, "0");
  const day = String(d.getDate()).padStart(2, "0");

  if (period === "day") {
    return `${y}-${m}-${day}`;
  }
  if (period === "month") {
    return `${y}-${m}`;
  }

  // Natural Monday–Sunday week in local time
  const daysSinceMonday = (d.getDay() + 6) % 7;
  const monday = new Date(d.getFullYear(), d.getMonth(), d.getDate() - daysSinceMonday);
  const wy = monday.getFullYear();
  const wm = String(monday.getMonth() + 1).padStart(2, "0");
  const wd = String(monday.getDate()).padStart(2, "0");
  return `W:${wy}-${wm}-${wd}`;
}

export function getComboPeriodLabel(period = "week") {
  if (period === "day") return "Same day";
  if (period === "month") return "Same month";
  return "Same week";
}

export function getComboPeriodShortLabel(period = "week") {
  if (period === "day") return "Daily";
  if (period === "month") return "Monthly";
  return "Weekly";
}

/**
 * Sanitizes a raw combo configuration object. Returns null if disabled/invalid.
 */
export function normalizeComboConfig(
  combo,
  { category = "points", excludeCardId = null } = {}
) {
  if ((category || "points") !== "points") return null;
  if (!combo || !combo.isCombo) return null;

  const period = VALID_COMBO_PERIODS.includes(combo.period) ? combo.period : "week";
  const repeatMode = VALID_COMBO_REPEAT_MODES.includes(combo.repeatMode)
    ? combo.repeatMode
    : "per_period";

  const countsByCardId = new Map();
  for (const req of Array.isArray(combo.requirements) ? combo.requirements : []) {
    const cardId = String(req?.cardId || "").trim();
    if (!cardId) continue;
    if (excludeCardId && cardId === excludeCardId) continue;
    const count = Math.max(1, parseInt(req?.count, 10) || 1);
    countsByCardId.set(cardId, (countsByCardId.get(cardId) || 0) + count);
  }

  const requirements = Array.from(countsByCardId.entries()).map(([cardId, count]) => ({
    cardId,
    count,
  }));

  if (requirements.length === 0) return null;

  return {
    isCombo: true,
    period,
    repeatMode,
    requirements,
  };
}

/**
 * Returns true if the card is an active points-category temporal combo card.
 */
export function isComboCard(card) {
  return Boolean(
    card &&
      (card.category || "points") === "points" &&
      card.combo &&
      card.combo.isCombo &&
      Array.isArray(card.combo.requirements) &&
      card.combo.requirements.length > 0
  );
}

/**
 * Evaluates a student's progress toward a temporal combo card in the current period.
 */
export function evaluateComboProgress({
  student,
  comboCard,
  allCards = [],
  now = new Date(),
} = {}) {
  const safeAllCards = Array.isArray(allCards) ? allCards : [];
  const cardsById = new Map(safeAllCards.filter((c) => c?.id).map((c) => [c.id, c]));

  if (!isComboCard(comboCard)) {
    return {
      isCombo: false,
      period: "week",
      periodKey: "",
      repeatMode: "per_period",
      isAlreadyClaimed: false,
      isClaimedThisPeriod: false,
      evolutionLocked: false,
      requirementsProgress: [],
      completedRequirements: 0,
      totalRequirements: 0,
      progressRatio: 0,
      isCompleteNow: false,
      canTriggerNow: false,
    };
  }

  const evolutionLocked =
    isEvolutionCard(comboCard) && !isCardUnlockedForStudent(student, comboCard);

  const period = VALID_COMBO_PERIODS.includes(comboCard.combo.period)
    ? comboCard.combo.period
    : "week";
  const repeatMode = VALID_COMBO_REPEAT_MODES.includes(comboCard.combo.repeatMode)
    ? comboCard.combo.repeatMode
    : "per_period";
  const periodKey = getNaturalPeriodKey(period, now);
  const ownedCards = Array.isArray(student?.cards) ? student.cards : [];

  const countsThisPeriod = new Map();
  let isClaimedThisPeriod = false;
  let isClaimedEver = false;

  for (const owned of ownedCards) {
    if (!owned || typeof owned !== "object") continue;

    if (
      owned.cardId === comboCard.id ||
      (owned.autoFrom?.type === "combo" && owned.autoFrom?.comboCardId === comboCard.id)
    ) {
      isClaimedEver = true;
    }

    const ts = owned.grantedAt ?? owned.obtainedAt ?? owned.date;
    const ownedPeriodKey = ts ? getNaturalPeriodKey(period, ts) : "";

    if (
      (owned.autoFrom?.type === "combo" &&
        owned.autoFrom?.comboCardId === comboCard.id &&
        owned.autoFrom?.periodKey === periodKey) ||
      (owned.cardId === comboCard.id && ownedPeriodKey === periodKey)
    ) {
      isClaimedThisPeriod = true;
    }

    if (owned.cardId && ownedPeriodKey === periodKey) {
      countsThisPeriod.set(owned.cardId, (countsThisPeriod.get(owned.cardId) || 0) + 1);
    }
  }

  const isAlreadyClaimed = repeatMode === "once" ? isClaimedEver : isClaimedThisPeriod;

  let totalNeededUnits = 0;
  let totalFulfilledUnits = 0;

  const requirementsProgress = comboCard.combo.requirements.map((req) => {
    const requiredCount = Math.max(1, parseInt(req?.count, 10) || 1);
    const currentCount = countsThisPeriod.get(req.cardId) || 0;
    const reqCard = cardsById.get(req.cardId) || null;
    totalNeededUnits += requiredCount;
    totalFulfilledUnits += Math.min(currentCount, requiredCount);
    return {
      cardId: req.cardId,
      card: reqCard,
      title: reqCard?.title || req.cardId,
      currentCount,
      requiredCount,
      met: currentCount >= requiredCount,
    };
  });

  const completedRequirements = requirementsProgress.filter((r) => r.met).length;
  const totalRequirements = requirementsProgress.length;
  const isCompleteNow =
    totalRequirements > 0 && requirementsProgress.every((r) => r.met);
  const progressRatio =
    isAlreadyClaimed
      ? 1
      : totalNeededUnits > 0
      ? Math.min(1, totalFulfilledUnits / totalNeededUnits)
      : 0;

  return {
    isCombo: true,
    period,
    periodKey,
    repeatMode,
    isAlreadyClaimed,
    isClaimedThisPeriod,
    evolutionLocked,
    requirementsProgress,
    completedRequirements,
    totalRequirements,
    progressRatio,
    isCompleteNow,
    canTriggerNow: isCompleteNow && !isAlreadyClaimed && !evolutionLocked,
  };
}

/**
 * Evaluates all combo cards in `allCards` against `cardsArr` (which should already
 * contain any newly acquired cards) and appends any newly completed combo cards
 * along with multiplied points.
 *
 * Mutates `cardsArr` in place (matching `grantStreakMaxRewardCards`) and returns
 * `{ currentPoints, grantedComboCards }`.
 */
export function applyComboCardGrants({
  cardsArr,
  currentPoints = 0,
  multiplier = 1,
  allCards = [],
  now = new Date(),
  student = null,
} = {}) {
  const safeCardsArr = Array.isArray(cardsArr) ? cardsArr : [];
  const comboCards = (Array.isArray(allCards) ? allCards : []).filter((c) => isComboCard(c));

  if (comboCards.length === 0) {
    return {
      currentPoints: round2(Number(currentPoints || 0)),
      grantedComboCards: [],
    };
  }

  let nextPoints = round2(Number(currentPoints || 0));
  const grantedComboCards = [];
  const unlockedEvolutionIds = Array.isArray(student?.unlockedEvolutionIds)
    ? student.unlockedEvolutionIds
    : [];
  const nowIso = toLocalDate(now)?.toISOString() || new Date().toISOString();

  // Bound passes to prevent any possible cycle issues; normally completes in 1 pass,
  // or N passes for chained combos (Combo B requiring Combo A).
  const maxPasses = comboCards.length + 1;
  for (let pass = 0; pass < maxPasses; pass++) {
    let grantedInPass = false;

    for (const comboCard of comboCards) {
      if (
        !isCardUnlockedForStudent({ unlockedEvolutionIds }, comboCard)
      ) {
        continue;
      }

      const progress = evaluateComboProgress({
        student: { cards: safeCardsArr, unlockedEvolutionIds },
        comboCard,
        allCards,
        now,
      });

      if (!progress.canTriggerNow) continue;

      const basePts = Number(comboCard.points || 0);
      const effectivePts = round2(basePts * Number(multiplier ?? 1));

      safeCardsArr.push({
        id: uid("owned"),
        cardId: comboCard.id,
        title: comboCard.title || "",
        imageURL: comboCard.imageURL || "",
        imageURL2: comboCard.imageURL2 || "",
        grantedAt: nowIso,
        pointsGranted: effectivePts,
        autoFrom: {
          type: "combo",
          comboCardId: comboCard.id,
          period: progress.period,
          periodKey: progress.periodKey,
        },
      });

      nextPoints = round2(nextPoints + effectivePts);
      grantedComboCards.push({
        cardId: comboCard.id,
        title: comboCard.title || "",
        pointsGranted: effectivePts,
        period: progress.period,
        periodKey: progress.periodKey,
      });
      grantedInPass = true;
    }

    if (!grantedInPass) break;
  }

  return {
    currentPoints: nextPoints,
    grantedComboCards,
  };
}
