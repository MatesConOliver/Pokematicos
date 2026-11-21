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
  if (!entry || typeof entry !== "object") return "Unknown date";
  const dateParsed = parseTimestampWithPrecision(entry.date);
  const redeemedParsed = parseTimestampWithPrecision(entry.redeemedAt);
  const grantedParsed = parseTimestampWithPrecision(entry.grantedAt);

  const chosen =
    (dateParsed?.hasTime ? dateParsed : null) ||
    (redeemedParsed?.hasTime ? redeemedParsed : null) ||
    (grantedParsed?.hasTime ? grantedParsed : null) ||
    dateParsed ||
    redeemedParsed ||
    grantedParsed;

  if (!chosen) return "Unknown date";

  const d = new Date(chosen.ms);
  const dateStr = d.toLocaleDateString();
  if (!chosen.hasTime) return dateStr;

  const hh = String(d.getHours()).padStart(2, "0");
  const mm = String(d.getMinutes()).padStart(2, "0");
  return `${dateStr} ${hh}:${mm}`;
}

export { todayISODate, addDaysISO, parseTimestampWithPrecision, getHistoryTimestamp, formatHistoryDateTime };
