import React from "react";

// Eye icon; crossed with a red line when the interface is visible ("hide" action).
export default function EyeToggleButton({ focusMode, onToggle, inline = false }) {
  const label = focusMode ? "Show interface" : "Hide interface (background only)";
  return (
    <button
      type="button"
      onClick={onToggle}
      title={label}
      aria-label={label}
      style={{
        ...(inline
          ? { flexShrink: 0 }
          : { position: "fixed", top: 12, right: 12, zIndex: 2000 }),
        width: 40,
        height: 40,
        borderRadius: 999,
        border: "1px solid #e5e7eb",
        background: "rgba(255,255,255,0.95)",
        boxShadow: "0 2px 8px rgba(0,0,0,0.3)",
        cursor: "pointer",
        display: "flex",
        alignItems: "center",
        justifyContent: "center",
      }}
    >
      <svg width="24" height="24" viewBox="0 0 24 24" fill="none" aria-hidden="true">
        <path
          d="M1.5 12S5.5 5 12 5s10.5 7 10.5 7-4 7-10.5 7S1.5 12 1.5 12z"
          stroke="#111827"
          strokeWidth="2"
          strokeLinejoin="round"
        />
        <circle cx="12" cy="12" r="3" fill="#111827" />
        {!focusMode && (
          <line x1="3" y1="21" x2="21" y2="3" stroke="#dc2626" strokeWidth="2.5" strokeLinecap="round" />
        )}
      </svg>
    </button>
  );
}
