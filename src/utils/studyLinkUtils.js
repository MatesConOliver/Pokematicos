const LOCAL_FILE_EXTENSIONS = /\.(html?|pdf|png|jpe?g|gif|webp|svg|txt|json|csv|mp3|mp4)$/i;

/**
 * Normalize a user-entered study link (local folder path or external website URL).
 * Returns "" if empty or using an unsafe scheme (e.g. javascript:, data:).
 */
export function normalizeStudyLink(rawInput) {
  const raw = String(rawInput || "").trim().replace(/\\/g, "/");
  if (!raw) return "";

  const lower = raw.toLowerCase();
  if (/^(javascript|data|vbscript|file):/i.test(lower)) {
    return "";
  }

  if (/^https?:\/\//i.test(raw)) {
    try {
      const parsed = new URL(raw);
      if (parsed.protocol !== "http:" && parsed.protocol !== "https:") return "";
      return parsed.href;
    } catch {
      return "";
    }
  }

  if (/^localhost(?::\d+)?(?:\/|$)/i.test(raw)) {
    return `http://${raw}`;
  }

  if (raw.startsWith("./")) {
    return `/${raw.slice(2).replace(/^\/+/, "")}`;
  }

  if (raw.startsWith("/")) {
    const cleanPath = `/${raw.replace(/^\/+/, "")}`;
    if (cleanPath === "/") return "";
    return cleanPath;
  }

  const firstSegment = raw.split("/")[0];
  const looksLikeExternalHost =
    !raw.includes(" ") &&
    !LOCAL_FILE_EXTENSIONS.test(firstSegment) &&
    /^[a-z0-9-]+(?:\.[a-z0-9-]+)+(?::\d+)?$/i.test(firstSegment);

  if (looksLikeExternalHost) {
    try {
      const parsed = new URL(`https://${raw}`);
      return parsed.href;
    } catch {
      return "";
    }
  }

  return `/${raw.replace(/^\/+/, "")}`;
}

/**
 * Convert a normalized study link into a safe, properly encoded href attribute.
 */
export function toSafeStudyHref(link) {
  const normalized = normalizeStudyLink(link);
  if (!normalized) return "";

  if (/^https?:\/\//i.test(normalized)) {
    return normalized;
  }

  if (normalized.startsWith("/")) {
    try {
      return encodeURI(decodeURI(normalized));
    } catch {
      return encodeURI(normalized);
    }
  }

  return "";
}

export function isExternalStudyLink(link) {
  const normalized = normalizeStudyLink(link);
  return /^https?:\/\//i.test(normalized);
}
