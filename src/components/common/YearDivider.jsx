import React from "react";

/**
 * Compact single-line horizontal year-transition divider for date-ordered lists.
 * In newest-first lists: `prevYear` is the newer year above (e.g. 2026),
 * `nextYear` is the older year below (e.g. 2025).
 */
export default function YearDivider({ prevYear, nextYear }) {
  if (!prevYear && !nextYear) return null;

  const hasTransition = Boolean(prevYear && nextYear && prevYear !== nextYear);

  return (
    <div
      role="separator"
      aria-label={
        hasTransition
          ? `Year change: ${prevYear} above, ${nextYear} below`
          : `Year ${nextYear || prevYear}`
      }
      style={{
        display: "flex",
        alignItems: "center",
        gap: 10,
        margin: "4px 0",
        userSelect: "none",
      }}
    >
      <div
        style={{
          flex: 1,
          height: 1,
          background: "linear-gradient(90deg, transparent, #cbd5e1)",
        }}
      />
      <span
        style={{
          display: "inline-flex",
          alignItems: "center",
          gap: 6,
          padding: "2px 10px",
          borderRadius: 999,
          background: "rgba(241, 245, 249, 0.96)",
          border: "1px solid #cbd5e1",
          fontSize: 11,
          fontWeight: 800,
          color: "#475569",
          letterSpacing: "0.03em",
          whiteSpace: "nowrap",
          boxShadow: "0 1px 2px rgba(15, 23, 42, 0.04)",
        }}
      >
        {hasTransition ? (
          <>
            <span>↑ {prevYear}</span>
            <span style={{ color: "#94a3b8", fontWeight: 600 }}>·</span>
            <span>↓ {nextYear}</span>
          </>
        ) : (
          <span>↓ {nextYear || prevYear}</span>
        )}
      </span>
      <div
        style={{
          flex: 1,
          height: 1,
          background: "linear-gradient(90deg, #cbd5e1, transparent)",
        }}
      />
    </div>
  );
}
