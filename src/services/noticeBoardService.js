import { getCardDisplayImage } from "../utils/cardImageUtils";

export const MADRID_TIMEZONE = "Europe/Madrid";
export const MAX_NOTICE_BOARD_ITEMS = 20;

const MADRID_PARTS_FORMATTER = new Intl.DateTimeFormat("en-GB", {
  timeZone: MADRID_TIMEZONE,
  year: "numeric",
  month: "2-digit",
  day: "2-digit",
  hour: "2-digit",
  minute: "2-digit",
  hourCycle: "h23",
});

export function parseNoticeTimestamp(value) {
  if (value === null || value === undefined || value === "") return null;

  if (typeof value === "number") {
    return Number.isFinite(value) && value > 0 ? value : null;
  }

  if (typeof value === "object") {
    if (typeof value.toMillis === "function") {
      const ms = value.toMillis();
      return Number.isFinite(ms) && ms > 0 ? ms : null;
    }
    if (typeof value.toDate === "function") {
      const ms = value.toDate().getTime();
      return Number.isFinite(ms) && ms > 0 ? ms : null;
    }
    if (typeof value.seconds === "number") {
      const ms = value.seconds * 1000;
      return Number.isFinite(ms) && ms > 0 ? ms : null;
    }
    return null;
  }

  if (typeof value === "string") {
    const trimmed = value.trim();
    if (!trimmed) return null;
    if (/^\d{4}-\d{2}-\d{2}$/.test(trimmed)) {
      const ms = Date.parse(`${trimmed}T12:00:00Z`);
      return Number.isFinite(ms) ? ms : null;
    }
    if (/^\d+$/.test(trimmed)) {
      const ms = Number(trimmed);
      return Number.isFinite(ms) && ms > 0 ? ms : null;
    }
    const ms = Date.parse(trimmed);
    return Number.isFinite(ms) ? ms : null;
  }

  return null;
}

export function getMadridDateParts(input = Date.now()) {
  const ms = typeof input === "number" ? input : parseNoticeTimestamp(input);
  if (ms === null) return null;

  const parts = MADRID_PARTS_FORMATTER.formatToParts(new Date(ms));
  const map = {};
  for (const part of parts) {
    if (part.type !== "literal") map[part.type] = part.value;
  }

  const year = map.year || "0000";
  const month = map.month || "00";
  const day = map.day || "00";
  const hour = map.hour || "00";
  const minute = map.minute || "00";

  return {
    dateKey: `${year}-${month}-${day}`,
    displayDate: `${day}/${month}/${year}`,
    displayTime: `${hour}:${minute}`,
    displayDateTime: `${day}/${month}/${year} ${hour}:${minute}`,
  };
}

function formatLegacyDateOnly(isoDate) {
  if (typeof isoDate !== "string" || !/^\d{4}-\d{2}-\d{2}$/.test(isoDate)) {
    return isoDate || "";
  }
  const [y, m, d] = isoDate.split("-");
  return `${d}/${m}/${y}`;
}

export function buildNoticeBoardData({
  students = [],
  cards = [],
  rewards = [],
  streakConfigs = [],
  flagValue = "A",
  now = Date.now(),
  maxItems = MAX_NOTICE_BOARD_ITEMS,
} = {}) {
  const safeStudents = Array.isArray(students) ? students : [];
  const safeCards = Array.isArray(cards) ? cards : [];
  const safeRewards = Array.isArray(rewards) ? rewards : [];
  const safeStreakConfigs = Array.isArray(streakConfigs) ? streakConfigs : [];

  const todayParts = getMadridDateParts(now);
  const todayMadridKey = todayParts ? todayParts.dateKey : "";

  const cardsById = new Map();
  const rewardCardByTitle = new Map();
  safeCards.forEach((c) => {
    if (c?.id) cardsById.set(c.id, c);
    if ((c?.category || "points") === "rewards" && c?.title) {
      const key = String(c.title).trim().toLowerCase();
      if (key && !rewardCardByTitle.has(key)) rewardCardByTitle.set(key, c);
    }
  });

  const rewardCardByRewardId = new Map();
  safeRewards.forEach((r) => {
    if (r?.id && r?.cardId && cardsById.has(r.cardId)) {
      rewardCardByRewardId.set(r.id, cardsById.get(r.cardId));
    }
  });

  const streakCfgById = new Map();
  safeStreakConfigs.forEach((cfg) => {
    if (cfg?.id) streakCfgById.set(cfg.id, cfg);
  });

  const rawItems = [];

  // 1. Max streaks achieved that day (grouped per streak + Madrid day)
  const streakGroups = new Map();
  for (const student of safeStudents) {
    if (!student) continue;
    const studentName = String(student.name || "Student").trim() || "Student";
    const streaks = student.streaks && typeof student.streaks === "object" ? student.streaks : {};

    for (const [streakId, entry] of Object.entries(streaks)) {
      if (!entry || typeof entry !== "object") continue;

      const timedMs = parseNoticeTimestamp(entry.maxAchievedAt);
      const legacyDateStr =
        typeof entry.maxAchievedOn === "string" && /^\d{4}-\d{2}-\d{2}$/.test(entry.maxAchievedOn)
          ? entry.maxAchievedOn
          : "";

      if (timedMs === null && !legacyDateStr) continue;

      let dateKey = "";
      let ts = 0;
      let hasTime = false;

      if (timedMs !== null) {
        const mParts = getMadridDateParts(timedMs);
        dateKey = mParts.dateKey;
        ts = timedMs;
        hasTime = true;
      } else {
        dateKey = legacyDateStr;
        ts = parseNoticeTimestamp(`${legacyDateStr}T00:00:00Z`) || 0;
        hasTime = false;
      }

      const groupKey = `${streakId}__${dateKey}`;
      if (!streakGroups.has(groupKey)) {
        streakGroups.set(groupKey, {
          streakId,
          dateKey,
          studentNames: [],
          nameSet: new Set(),
          latestTimedMs: hasTime ? ts : null,
          fallbackTs: ts,
        });
      }

      const grp = streakGroups.get(groupKey);
      const dedupeNameKey = `${student.id || studentName}`;
      if (!grp.nameSet.has(dedupeNameKey)) {
        grp.nameSet.add(dedupeNameKey);
        grp.studentNames.push(studentName);
      }

      if (hasTime && (grp.latestTimedMs === null || ts > grp.latestTimedMs)) {
        grp.latestTimedMs = ts;
      }
      if (ts > grp.fallbackTs) {
        grp.fallbackTs = ts;
      }
    }
  }

  for (const [groupKey, grp] of streakGroups.entries()) {
    const cfg = streakCfgById.get(grp.streakId) || null;
    const emoji = cfg?.emoji || "🔥";
    const finalTs = grp.latestTimedMs !== null ? grp.latestTimedMs : grp.fallbackTs;
    const hasExactTime = grp.latestTimedMs !== null;
    const mParts = getMadridDateParts(finalTs);

    rawItems.push({
      id: `streakMax:${groupKey}`,
      type: "streakMax",
      timestamp: finalTs,
      madridDateKey: grp.dateKey,
      formattedDateTime: hasExactTime && mParts
        ? mParts.displayDateTime
        : formatLegacyDateOnly(grp.dateKey),
      hasExactTime,
      emoji,
      streakMax: typeof cfg?.max === "number" ? cfg.max : null,
      studentNames: grp.studentNames,
    });
  }

  // 2. Rewards redeemed (individual + deduplicated group redeems)
  const groupRedeems = new Map();

  for (const student of safeStudents) {
    if (!student) continue;
    const studentName = String(student.name || "Student").trim() || "Student";
    const history = Array.isArray(student.rewardsHistory) ? student.rewardsHistory : [];

    for (let idx = 0; idx < history.length; idx++) {
      const entry = history[idx];
      if (!entry || typeof entry !== "object") continue;
      if (entry.type !== "individual" && entry.type !== "group") continue;

      const ts = parseNoticeTimestamp(entry.date ?? entry.redeemedAt);
      if (ts === null) continue;
      const mParts = getMadridDateParts(ts);
      if (!mParts) continue;

      const rewardTitle = String(entry.title || entry.name || "Reward").trim() || "Reward";
      const linkedRewardCard =
        (entry.cardId && cardsById.get(entry.cardId)) ||
        (entry.rewardId && (cardsById.get(entry.rewardId) || rewardCardByRewardId.get(entry.rewardId))) ||
        rewardCardByTitle.get(rewardTitle.toLowerCase()) ||
        null;
      const rewardImageURL = linkedRewardCard
        ? getCardDisplayImage(linkedRewardCard, flagValue, false)
        : "";

      if (entry.type === "individual") {
        rawItems.push({
          id: `reward:ind:${student.id || studentName}:${entry.id || `${ts}_${idx}`}`,
          type: "rewardRedeemed",
          redeemKind: "individual",
          timestamp: ts,
          madridDateKey: mParts.dateKey,
          formattedDateTime: mParts.displayDateTime,
          hasExactTime: true,
          studentName,
          rewardTitle,
          cost: Number(entry.cost || 0),
          imageURL: rewardImageURL,
        });
      } else {
        const groupKey = `${entry.date || ts}__${entry.rewardId || ""}__${rewardTitle}`;
        if (!groupRedeems.has(groupKey)) {
          const contributors = Array.isArray(entry.contributors) ? entry.contributors : [];
          const hasContributorsList = contributors.length > 0;
          const contributorCount = hasContributorsList
            ? contributors.filter((c) => Number(c?.cost || 0) >= 1).length
            : 0;

          groupRedeems.set(groupKey, {
            groupKey,
            timestamp: ts,
            madridDateKey: mParts.dateKey,
            formattedDateTime: mParts.displayDateTime,
            rewardTitle,
            imageURL: rewardImageURL,
            hasContributorsList,
            contributorCount,
            fallbackParticipantKeys: new Set(),
          });
        }

        const grp = groupRedeems.get(groupKey);
        if (!grp.hasContributorsList && Number(entry.cost || 0) >= 1) {
          grp.fallbackParticipantKeys.add(student.id || studentName);
        }
      }
    }
  }

  for (const grp of groupRedeems.values()) {
    const peopleCount = grp.hasContributorsList
      ? grp.contributorCount
      : grp.fallbackParticipantKeys.size;

    rawItems.push({
      id: `reward:grp:${grp.groupKey}`,
      type: "rewardRedeemed",
      redeemKind: "group",
      timestamp: grp.timestamp,
      madridDateKey: grp.madridDateKey,
      formattedDateTime: grp.formattedDateTime,
      hasExactTime: true,
      rewardTitle: grp.rewardTitle,
      contributorCount: peopleCount,
      imageURL: grp.imageURL || "",
    });
  }

  // 3. Experience cards achieved by whom
  const seenXpCardStudent = new Set();
  for (const student of safeStudents) {
    if (!student) continue;
    const studentName = String(student.name || "Student").trim() || "Student";
    const ownedCards = Array.isArray(student.cards) ? student.cards : [];

    for (let idx = 0; idx < ownedCards.length; idx++) {
      const owned = ownedCards[idx];
      if (!owned || typeof owned !== "object") continue;

      const cardMeta = owned.cardId ? cardsById.get(owned.cardId) : null;
      const isExperience =
        cardMeta?.category === "experience" ||
        owned.autoFrom?.type === "xpUnlock" ||
        owned.autoFrom?.streakId === "xp_unlock";

      if (!isExperience) continue;

      const ts = parseNoticeTimestamp(owned.grantedAt ?? owned.obtainedAt);
      if (ts === null) continue;
      const mParts = getMadridDateParts(ts);
      if (!mParts) continue;

      const dedupeKey = `${student.id || studentName}__${owned.cardId || owned.id || idx}`;
      if (seenXpCardStudent.has(dedupeKey)) continue;
      seenXpCardStudent.add(dedupeKey);

      const cardTitle = String(cardMeta?.title || owned.title || "Experience Card").trim() || "Experience Card";
      const rawXp = cardMeta?.points ?? owned.autoFrom?.xpRequired;
      const xp = rawXp !== undefined && rawXp !== null && Number.isFinite(Number(rawXp)) ? Number(rawXp) : null;
      const imageURL = getCardDisplayImage(cardMeta || owned, flagValue, false);

      rawItems.push({
        id: `xp:${dedupeKey}`,
        type: "experienceCard",
        timestamp: ts,
        madridDateKey: mParts.dateKey,
        formattedDateTime: mParts.displayDateTime,
        hasExactTime: true,
        studentName,
        cardTitle,
        xp,
        imageURL,
      });
    }
  }

  // 4. New cards added to points, rewards, or experience library (exclude extra)
  for (const card of safeCards) {
    if (!card || typeof card !== "object") continue;
    const cat = card.category || "points";
    if (cat !== "points" && cat !== "rewards" && cat !== "experience") continue;

    const ts = parseNoticeTimestamp(card.createdAt);
    if (ts === null) continue;
    const mParts = getMadridDateParts(ts);
    if (!mParts) continue;

    const cardTitle = String(card.title || "Untitled card").trim() || "Untitled card";
    const imageURL = getCardDisplayImage(card, flagValue, true);

    rawItems.push({
      id: `newCard:${card.id || `${cat}_${ts}_${cardTitle}`}`,
      type: "newCard",
      timestamp: ts,
      madridDateKey: mParts.dateKey,
      formattedDateTime: mParts.displayDateTime,
      hasExactTime: true,
      cardTitle,
      category: cat,
      points: Number(card.points || 0),
      imageURL,
    });
  }

  // Sort newest first; keep top N (default 20)
  rawItems.sort((a, b) => {
    if (b.timestamp !== a.timestamp) return b.timestamp - a.timestamp;
    return String(a.id).localeCompare(String(b.id));
  });

  const items = rawItems.slice(0, maxItems);
  const todayItems = items.filter((item) => item.madridDateKey === todayMadridKey);
  const olderItems = items.filter((item) => item.madridDateKey !== todayMadridKey);

  return {
    items,
    todayItems,
    olderItems,
    todayMadridKey,
  };
}
