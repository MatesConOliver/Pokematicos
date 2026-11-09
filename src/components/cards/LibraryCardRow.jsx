import React from "react";
import { getCardDisplayImage } from "../../utils/cardImageUtils";

export default function LibraryCardRow({
  c,
  mode,
  flagValue = "A",
  onPreview,
  onGive = () => {},
  onDelete,
  onEdit = () => {},
}) {
  const showURL = getCardDisplayImage(c, flagValue, true);

  return (
    <div
      style={{
        display: "flex",
        gap: 12,
        alignItems: "center",
        border: "1px solid #e2e8f0",
        padding: 12,
        borderRadius: 14,
        background: "#ffffff",
        boxShadow: "0 2px 8px rgba(15, 23, 42, 0.05)",
        marginBottom: 10,
        color: "#0f172a",
        contentVisibility: "auto",
        containIntrinsicSize: "0 110px",
      }}
    >
      <div
        style={{
          width: 68,
          height: 86,
          background: "#f8fafc",
          border: "1px solid #e2e8f0",
          cursor: "pointer",
          borderRadius: 8,
          overflow: "hidden",
          boxShadow: "0 2px 6px rgba(0, 0, 0, 0.06)",
        }}
        onClick={onPreview}
        title="Click to preview card"
      >
        {showURL ? (
          <img
            src={showURL}
            alt={c.title}
            style={{ width: "100%", height: "100%", objectFit: "cover" }}
          />
        ) : (
          <div style={{ padding: 6, fontSize: 11, color: "#1e293b" }}>{c.title}</div>
        )}
      </div>
      <div style={{ flex: 1 }}>
        <div style={{ fontWeight: 900, fontSize: 15, color: "#0f172a" }}>{c.title}</div>
        <div className="muted" style={{ color: "#64748b" }}>{c.description}</div>
        <div style={{ marginTop: 6, fontWeight: 900, color: "#0f172a", display: "flex", alignItems: "center", gap: 4 }}>
          <span>{c.points || 0} pts</span>
        </div>
      </div>
      {mode === "admin" && (
        <div style={{ display: "flex", flexDirection: "column", gap: 8 }}>
          {(c.category || "points") !== "rewards" && (
            <button
              className="btn primary"
              onClick={onGive}
            >
              Give card
            </button>
          )}

          <button
            className="btn"
            onClick={onEdit}
            style={{
              background: "#ffffff",
              border: "1px solid #e2e8f0",
              color: "#1e293b",
            }}
          >
            Edit
          </button>

          <button
            className="btn"
            onClick={onDelete}
            style={{
              background: "#ffffff",
              border: "1px solid #fecaca",
              color: "#dc2626",
            }}
          >
            Delete
          </button>
        </div>
      )}
    </div>
  );
}
