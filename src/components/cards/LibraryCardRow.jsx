import React from "react";

export default function LibraryCardRow({ c, mode, onPreview, onGive = () => {}, onDelete, onEdit = () => {} }) {
  const showURL = c.lockedImageURL || c.imageURL;
  return (
    <div
      style={{
        display: "flex",
        gap: 10,
        alignItems: "center",
        border: "1px solid #eee",
        padding: 10,
        borderRadius: 10,
        background: "#ffffff",
        marginBottom: 10,
      }}
    >
      <div
        style={{
          width: 68,
          height: 86,
          background: "#fafafa",
          cursor: "pointer",
          borderRadius: 8,
          overflow: "hidden",
        }}
        onClick={onPreview}
      >
        {showURL ? (
          <img
            src={showURL}
            alt={c.title}
            style={{ width: "100%", height: "100%", objectFit: "cover" }}
          />
        ) : (
          <div style={{ padding: 6 }}>{c.title}</div>
        )}
      </div>
      <div style={{ flex: 1 }}>
        <div style={{ fontWeight: 900 }}>{c.title}</div>
        <div className="muted">{c.description}</div>
        <div style={{ marginTop: 6, fontWeight: 900 }}>{c.points || 0} pts</div>
      </div>
      {mode === "admin" && (
        <div style={{ display: "flex", flexDirection: "column", gap: 8 }}>
          {(c.category || "points") !== "rewards" && (
            <button className="btn primary" onClick={onGive}>
              Give card
            </button>
          )}

          <button className="btn" onClick={onEdit}>
            Edit
          </button>

          <button className="btn" onClick={onDelete} style={{ color: "#c82424ff", borderColor: "#fecaca" }}>
            Delete
          </button>
        </div>
      )}
    </div>
  );
}
