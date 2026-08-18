/**
 * Float window utilities for streak scheduling
 */

import { addDaysISO } from "./dateUtils";

function parseFloatScheduleInput(input, defaults = { delayDays: 7, durationDays: 7 }) {
  const fallback = {
    delayDays: Number.isFinite(defaults.delayDays) ? defaults.delayDays : 7,
    durationDays: Number.isFinite(defaults.durationDays) ? defaults.durationDays : 7,
  };

  if (input == null) return fallback;
  const s = String(input).trim();
  if (!s) return fallback;

  // 1) "a,b" format
  if (s.includes(",")) {
    const [a, b] = s.split(",").map((x) => x.trim());
    const delay = parseInt(a, 10);
    const dur = parseInt(b, 10);
    return {
      delayDays: Number.isFinite(delay) && delay >= 0 ? delay : fallback.delayDays,
      durationDays: Number.isFinite(dur) && dur > 0 ? dur : fallback.durationDays,
    };
  }

  // 2) key=value format: start=7 duration=10 (order doesn't matter)
  const mStart = s.match(/(?:start|delay)\s*=\s*(-?\d+)/i);
  const mDur = s.match(/(?:duration|days)\s*=\s*(-?\d+)/i);

  if (mStart || mDur) {
    const delay = mStart ? parseInt(mStart[1], 10) : fallback.delayDays;
    const dur = mDur ? parseInt(mDur[1], 10) : fallback.durationDays;
    return {
      delayDays: Number.isFinite(delay) && delay >= 0 ? delay : fallback.delayDays,
      durationDays: Number.isFinite(dur) && dur > 0 ? dur : fallback.durationDays,
    };
  }

  // 3) two numbers: "7 14"
  const nums = s.match(/-?\d+/g) || [];
  if (nums.length >= 2) {
    const delay = parseInt(nums[0], 10);
    const dur = parseInt(nums[1], 10);
    return {
      delayDays: Number.isFinite(delay) && delay >= 0 ? delay : fallback.delayDays,
      durationDays: Number.isFinite(dur) && dur > 0 ? dur : fallback.durationDays,
    };
  }

  // 4) single number means delay; use default duration
  const one = parseInt(nums[0], 10);
  return {
    delayDays: Number.isFinite(one) && one >= 0 ? one : fallback.delayDays,
    durationDays: fallback.durationDays,
  };
}

function normalizeFloatWindows(windows, today) {
  const list = Array.isArray(windows) ? windows : [];
  const cleaned = list
    .filter((w) => w && typeof w.start === "string" && typeof w.end === "string" && w.start && w.end)
    // prune windows fully in the past
    .filter((w) => !today || w.end >= today)
    .sort((a, b) => (a.start < b.start ? -1 : a.start > b.start ? 1 : 0));

  const merged = [];
  for (const w of cleaned) {
    if (merged.length === 0) {
      merged.push({ start: w.start, end: w.end });
      continue;
    }
    const last = merged[merged.length - 1];
    // merge if overlaps OR is adjacent (end + 1 day >= next.start)
    const lastEndPlus1 = addDaysISO(last.end, 1);
    if (w.start <= lastEndPlus1) {
      if (w.end > last.end) last.end = w.end;
    } else {
      merged.push({ start: w.start, end: w.end });
    }
  }
  return merged;
}

function isTodayInFloatWindows(today, windows) {
  if (!today) return false;
  const list = Array.isArray(windows) ? windows : [];
  return list.some((w) => w && w.start <= today && today <= w.end);
}

export { parseFloatScheduleInput, normalizeFloatWindows, isTodayInFloatWindows };
