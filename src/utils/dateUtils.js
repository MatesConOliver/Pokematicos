/**
 * Date utility functions for ISO date handling
 */

function todayISODate() {
  const d = new Date();
  const y = d.getFullYear();
  const m = String(d.getMonth() + 1).padStart(2, "0");
  const day = String(d.getDate()).padStart(2, "0");
  return `${y}-${m}-${day}`; // local YYYY-MM-DD
}

function addDaysISO(isoDate, days) {
  const [y, m, d] = isoDate.split("-").map(Number);
  const dt = new Date(y, m - 1, d); // local date
  dt.setDate(dt.getDate() + Number(days || 0));
  const yy = dt.getFullYear();
  const mm = String(dt.getMonth() + 1).padStart(2, "0");
  const dd = String(dt.getDate()).padStart(2, "0");
  return `${yy}-${mm}-${dd}`;
}

function parseTimestampWithPrecision(value) {
  if (value === null || value === undefined || value === "") return null;

  if (typeof value === "number") {
    return Number.isFinite(value) && value > 0 ? { ms: value, hasTime: true } : null;
  }

  if (typeof value === "object") {
    if (typeof value.toMillis === "function") {
      const ms = value.toMillis();
      return Number.isFinite(ms) && ms > 0 ? { ms, hasTime: true } : null;
    }
    if (typeof value.toDate === "function") {
      const ms = value.toDate().getTime();
      return Number.isFinite(ms) && ms > 0 ? { ms, hasTime: true } : null;
    }
    if (typeof value.seconds === "number") {
      const ms = value.seconds * 1000;
      return Number.isFinite(ms) && ms > 0 ? { ms, hasTime: true } : null;
    }
    return null;
  }

  if (typeof value === "string") {
    const trimmed = value.trim();
    if (!trimmed) return null;
    const dateOnlyMatch = /^(\d{4})-(\d{2})-(\d{2})$/.exec(trimmed);
    if (dateOnlyMatch) {
      const y = Number(dateOnlyMatch[1]);
      const m = Number(dateOnlyMatch[2]);
      const d = Number(dateOnlyMatch[3]);
      const dt = new Date(y, m - 1, d);
      return Number.isFinite(dt.getTime()) ? { ms: dt.getTime(), hasTime: false } : null;
    }
    if (/^\d+$/.test(trimmed)) {
      const ms = Number(trimmed);
      return Number.isFinite(ms) && ms > 0 ? { ms, hasTime: true } : null;
    }
    const ms = Date.parse(trimmed);
    return Number.isFinite(ms) ? { ms, hasTime: true } : null;
  }

  return null;
}

const WEEKDAY_SHORT = ["Sun", "Mon", "Tue", "Wed", "Thu", "Fri", "Sat"];
const MONTH_SHORT = [
  "Jan",
  "Feb",
  "Mar",
  "Apr",
  "May",
  "Jun",
  "Jul",
  "Aug",
  "Sep",
  "Oct",
  "Nov",
  "Dec",
];

function formatWeekdayMonthDayFromDate(d) {
  if (!(d instanceof Date) || !Number.isFinite(d.getTime())) return "";
  const weekday = WEEKDAY_SHORT[d.getDay()];
  const month = MONTH_SHORT[d.getMonth()];
  const day = d.getDate();
  return `${weekday}, ${month} ${day}`;
}

function formatWeekdayMonthDay(input) {
  if (input instanceof Date) {
    return formatWeekdayMonthDayFromDate(input);
  }
  const parsed = parseTimestampWithPrecision(input);
  if (!parsed) return "";
  return formatWeekdayMonthDayFromDate(new Date(parsed.ms));
}

function formatWeekdayMonthDayTime(input) {
  const d =
    input instanceof Date
      ? input
      : (() => {
          const parsed = parseTimestampWithPrecision(input);
          return parsed ? new Date(parsed.ms) : null;
        })();
  if (!d || !Number.isFinite(d.getTime())) return "";
  const dateStr = formatWeekdayMonthDayFromDate(d);
  const hh = String(d.getHours()).padStart(2, "0");
  const mm = String(d.getMinutes()).padStart(2, "0");
  return `${dateStr} · ${hh}:${mm}`;
}

function getYearFromInput(input) {
  if (input instanceof Date) {
    return Number.isFinite(input.getTime()) ? input.getFullYear() : null;
  }
  const parsed = parseTimestampWithPrecision(input);
  if (!parsed) return null;
  return new Date(parsed.ms).getFullYear();
}

function resolveChosenHistoryTimestamp(entry) {
  if (!entry || typeof entry !== "object") return null;
  const dateParsed = parseTimestampWithPrecision(entry.date);
  const redeemedParsed = parseTimestampWithPrecision(entry.redeemedAt);
  const grantedParsed = parseTimestampWithPrecision(entry.grantedAt);

  return (
    (dateParsed?.hasTime ? dateParsed : null) ||
    (redeemedParsed?.hasTime ? redeemedParsed : null) ||
    (grantedParsed?.hasTime ? grantedParsed : null) ||
    dateParsed ||
    redeemedParsed ||
    grantedParsed ||
    null
  );
}

function getHistoryEntryYear(entry) {
  const chosen = resolveChosenHistoryTimestamp(entry);
  if (!chosen) return null;
  return new Date(chosen.ms).getFullYear();
}

function getHistoryTimestamp(entry) {
  if (!entry || typeof entry !== "object") return 0;
  const redeemed = parseTimestampWithPrecision(entry.redeemedAt);
  if (redeemed) return redeemed.ms;
  const dateParsed = parseTimestampWithPrecision(entry.date);
  if (dateParsed) return dateParsed.ms;
  const granted = parseTimestampWithPrecision(entry.grantedAt);
  if (granted) return granted.ms;
  return 0;
}

function formatHistoryDateTime(entry) {
  const chosen = resolveChosenHistoryTimestamp(entry);
  if (!chosen) return "Unknown date";

  const d = new Date(chosen.ms);
  if (!chosen.hasTime) return formatWeekdayMonthDayFromDate(d);
  return formatWeekdayMonthDayTime(d);
}

export {
  WEEKDAY_SHORT,
  MONTH_SHORT,
  todayISODate,
  addDaysISO,
  parseTimestampWithPrecision,
  formatWeekdayMonthDay,
  formatWeekdayMonthDayTime,
  getYearFromInput,
  getHistoryEntryYear,
  getHistoryTimestamp,
  formatHistoryDateTime,
};

