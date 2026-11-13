import React, { useState } from "react";
import { getCardDisplayImage } from "../../utils/cardImageUtils";
import { isEvolutionCard, checkEvolutionEligibility } from "../../services/cardEvolutionService";

export default function LibraryCardRow({
  c,
  mode,
  flagValue = "A",
  activeStudent,
  defaultCatalystCardId,
  childEvolutions = [],
  onPreview,
  onGive = () => {},
  onDelete,
  onEdit = () => {},
  onDropCatalyst,
  onEvolve,
}) {
  const [isDragOver, setIsDragOver] = useState(false);
  const isEvo = isEvolutionCard(c);
  const hasChildEvolutions = Array.isArray(childEvolutions) && childEvolutions.length > 0;

  const eligibility =
    isEvo && activeStudent
      ? checkEvolutionEligibility({
          student: activeStudent,
          evolutionCard: c,
          catalystCardId: defaultCatalystCardId,
        })
      : null;

  const isUnlockedByStudent = Boolean(eligibility?.isAlreadyUnlocked);
  // For normal cards, library shows locked preview. For evolution cards, show unlocked once student unlocks it.
  const isImgLocked = isEvo ? !isUnlockedByStudent : true;
  const showURL = getCardDisplayImage(c, flagValue, isImgLocked);

  return (
    <div
      onDragOver={(e) => {
        if (hasChildEvolutions) {
          e.preventDefault();
          e.dataTransfer.dropEffect = "copy";
          setIsDragOver(true);
        }
      }}
      onDragLeave={() => setIsDragOver(false)}
      onDrop={(e) => {
        setIsDragOver(false);
        if (hasChildEvolutions && onDropCatalyst) {
          onDropCatalyst(e, c, childEvolutions);
        }
      }}
      style={{
        display: "flex",
        gap: 12,
        alignItems: "center",
        border: isDragOver ? "2px dashed #8b5cf6" : isEvo ? "1px solid #c7d2fe" : "1px solid #e2e8f0",
        padding: 12,
        borderRadius: 14,
        background: isDragOver ? "#f5f3ff" : isEvo ? "#faf5ff" : "#ffffff",
        boxShadow: "0 2px 8px rgba(15, 23, 42, 0.05)",
        marginBottom: 10,
        color: "#0f172a",
        contentVisibility: "auto",
        containIntrinsicSize: "0 110px",
        transition: "all 0.2s ease",
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
          position: "relative",
          flexShrink: 0,
        }}
        onClick={onPreview}
        title="Click to preview card"
      >
        {showURL ? (
          <img
            src={showURL}
            alt={c.title}
            style={{
              width: "100%",
              height: "100%",
              objectFit: "cover",
              filter: isEvo && !isUnlockedByStudent && mode !== "admin" ? "grayscale(0.6)" : "none",
            }}
          />
        ) : (
          <div style={{ padding: 6, fontSize: 11, color: "#1e293b" }}>{c.title}</div>
        )}

        {isEvo && !isUnlockedByStudent && mode !== "admin" && (
          <div
            style={{
              position: "absolute",
              inset: 0,
              background: "rgba(15, 23, 42, 0.35)",
              display: "flex",
              alignItems: "center",
              justifyContent: "center",
              fontSize: 18,
            }}
          >
            🔒
          </div>
        )}
      </div>

      <div style={{ flex: 1, minWidth: 0 }}>
        <div style={{ display: "flex", alignItems: "center", gap: 6, flexWrap: "wrap" }}>
          <span style={{ fontWeight: 900, fontSize: 15, color: "#0f172a" }}>{c.title}</span>
          {isEvo && (
            <span
              style={{
                fontSize: 11,
                padding: "2px 8px",
                borderRadius: 999,
                background: isUnlockedByStudent ? "#dcfce7" : "#ede9fe",
                color: isUnlockedByStudent ? "#166534" : "#6d28d9",
                fontWeight: 700,
              }}
            >
              🧬 {isUnlockedByStudent ? "Evolution unlocked" : "Evolution"}
            </span>
          )}
          {hasChildEvolutions && (
            <span
              style={{
                fontSize: 11,
                padding: "2px 8px",
                borderRadius: 999,
                background: isDragOver ? "#ddd6fe" : "#fef3c7",
                color: isDragOver ? "#5b21b6" : "#92400e",
                fontWeight: 700,
              }}
              title="Drag the catalyst onto this card to evolve"
            >
              🔮 Can evolve
            </span>
          )}
        </div>

        {(!isEvo || isUnlockedByStudent || mode === "admin") && (
          <div className="muted" style={{ color: "#64748b", fontSize: 13, marginTop: 2 }}>
            {c.description}
          </div>
        )}

        {/* Evolution requirements progress tracker */}
        {isEvo && (
          <div style={{ marginTop: 6, display: "flex", gap: 6, flexWrap: "wrap", alignItems: "center" }}>
            <span
              style={{
                fontSize: 11,
                padding: "2px 6px",
                borderRadius: 6,
                background: eligibility?.hasCopies ? "#dcfce7" : "#f1f5f9",
                color: eligibility?.hasCopies ? "#15803d" : "#475569",
                fontWeight: 700,
                border: "1px solid rgba(0,0,0,0.06)",
              }}
              title="Copies of base card owned"
            >
              🃏 Owned: {eligibility ? eligibility.currentCopies : 0}/{c.evolution?.requiredCopies || 1}
            </span>

            {eligibility?.canEvolve && (
              <button
                className="btn"
                onClick={(e) => {
                  e.stopPropagation();
                  onEvolve?.(c);
                }}
                style={{
                  padding: "2px 10px",
                  fontSize: 11,
                  fontWeight: 800,
                  background: "linear-gradient(135deg, #8b5cf6, #ec4899)",
                  color: "#ffffff",
                  border: "none",
                  borderRadius: 999,
                  boxShadow: "0 2px 8px rgba(139, 92, 246, 0.4)",
                  cursor: "pointer",
                }}
              >
                ✨ ¡Evolucionar!
              </button>
            )}
          </div>
        )}

        {(c.category || "points") !== "extra" && (
          <div style={{ marginTop: 6, fontWeight: 900, color: "#0f172a", display: "flex", alignItems: "center", gap: 4 }}>
            <span>
              {(c.category || "points") === "rewards"
                ? `Cost: ${c.points || 0} pts`
                : `${c.points || 0} ${(c.category || "points") === "experience" ? "XP" : "pts"}`}
            </span>
          </div>
        )}
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
