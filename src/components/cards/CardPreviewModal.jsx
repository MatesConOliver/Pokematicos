import React, { useEffect } from "react";
import { isEvolutionCard, checkEvolutionEligibility } from "../../services/cardEvolutionService";

export default function CardPreviewModal({
  cardPreview,
  onClose,
  onNavigate,
  cardsById,
  activeStudent,
  defaultCatalystCardId,
  onEvolve,
}) {
  useEffect(() => {
    if (!cardPreview) return;

    function handleKeyDown(event) {
      if (event.target && (event.target.tagName === "INPUT" || event.target.tagName === "TEXTAREA")) return;

      if (event.key === "ArrowLeft") {
        event.preventDefault();
        onNavigate?.(-1);
      } else if (event.key === "ArrowRight") {
        event.preventDefault();
        onNavigate?.(1);
      } else if (event.key === "Escape") {
        event.preventDefault();
        onClose?.();
      }
    }

    window.addEventListener("keydown", handleKeyDown);
    return () => {
      window.removeEventListener("keydown", handleKeyDown);
    };
  }, [cardPreview, onNavigate, onClose]);

  if (!cardPreview) return null;

  const isEvo = cardPreview.isLibraryCard && isEvolutionCard(cardPreview);
  const baseCard = isEvo && cardsById ? cardsById.get(cardPreview.evolution?.baseCardId) : null;
  const catalystCard =
    isEvo && cardsById && cardPreview.evolution?.catalystCardId
      ? cardsById.get(cardPreview.evolution.catalystCardId)
      : defaultCatalystCardId && cardsById
      ? cardsById.get(defaultCatalystCardId)
      : null;

  const eligibility =
    isEvo && activeStudent
      ? checkEvolutionEligibility({
          student: activeStudent,
          evolutionCard: cardPreview,
          catalystCardId: defaultCatalystCardId,
        })
      : null;

  return (
    <div className="modal-backdrop" onClick={onClose}>
      {cardPreview.isLibraryCard ? (
        <div className="modal" onClick={(event) => event.stopPropagation()} style={{ maxWidth: 640 }}>
          <div style={{ display: "flex", gap: 16, flexWrap: "wrap" }}>
            <div
              style={{
                width: 320,
                maxWidth: "100%",
                height: 440,
                maxHeight: "65vh",
                background: "#f6f6f6",
                borderRadius: 14,
                overflow: "hidden",
                boxShadow: "0 4px 12px rgba(0,0,0,0.1)",
              }}
            >
              {cardPreview.imageURL ? (
                <img
                  src={cardPreview.imageURL}
                  alt={cardPreview.title}
                  style={{ width: "100%", height: "100%", objectFit: "contain" }}
                />
              ) : (
                <div style={{ padding: 12 }}>{cardPreview.title}</div>
              )}
            </div>

            <div style={{ flex: 1, minWidth: 240, display: "flex", flexDirection: "column" }}>
              <div style={{ display: "flex", alignItems: "center", gap: 8, flexWrap: "wrap" }}>
                <h3 style={{ margin: 0, fontSize: 20 }}>{cardPreview.title}</h3>
                {isEvo && (
                  <span
                    style={{
                      fontSize: 11,
                      padding: "3px 8px",
                      borderRadius: 999,
                      background: eligibility?.isAlreadyUnlocked ? "#dcfce7" : "#ede9fe",
                      color: eligibility?.isAlreadyUnlocked ? "#166534" : "#6d28d9",
                      fontWeight: 800,
                    }}
                  >
                    🧬 {eligibility?.isAlreadyUnlocked ? "Evolución Desbloqueada" : "Carta de Evolución"}
                  </span>
                )}
              </div>

              <div className="muted" style={{ marginTop: 6, fontSize: 13 }}>{cardPreview.description}</div>
              <div style={{ marginTop: 8, fontWeight: 800, fontSize: 14, color: "#0f172a" }}>
                {cardPreview.points || 0} pts
              </div>

              {/* Evolution requirement details */}
              {isEvo && (
                <div
                  style={{
                    marginTop: 14,
                    padding: 12,
                    borderRadius: 12,
                    background: "#f8faff",
                    border: "1px solid #c7d2fe",
                  }}
                >
                  <div style={{ fontWeight: 800, fontSize: 13, color: "#4338ca", marginBottom: 6 }}>
                    Requisitos de Evolución:
                  </div>

                  <div style={{ fontSize: 12, display: "grid", gap: 6, color: "#334155" }}>
                    <div style={{ display: "flex", justifyContent: "space-between", alignItems: "center" }}>
                      <span>
                        🃏 Carta base: <b>{baseCard?.title || "Carta Previa"}</b>
                      </span>
                      <span
                        style={{
                          padding: "2px 8px",
                          borderRadius: 999,
                          fontWeight: 700,
                          fontSize: 11,
                          background: eligibility?.hasCopies ? "#dcfce7" : "#f1f5f9",
                          color: eligibility?.hasCopies ? "#166534" : "#475569",
                        }}
                      >
                        {eligibility ? `${eligibility.currentCopies} / ${cardPreview.evolution?.requiredCopies || 1}` : `${cardPreview.evolution?.requiredCopies || 1} necesarias`}
                      </span>
                    </div>

                    <div style={{ display: "flex", justifyContent: "space-between", alignItems: "center" }}>
                      <span>
                        🔮 Catalizador: <b>{catalystCard?.title || "Piedra / Objeto"}</b>
                      </span>
                      <span
                        style={{
                          padding: "2px 8px",
                          borderRadius: 999,
                          fontWeight: 700,
                          fontSize: 11,
                          background: eligibility?.hasCatalyst ? "#e0e7ff" : "#fee2e2",
                          color: eligibility?.hasCatalyst ? "#4338ca" : "#991b1b",
                        }}
                      >
                        {!catalystCard
                          ? "Sin configurar"
                          : eligibility?.hasCatalyst
                          ? "Disponible ✓"
                          : "1 Necesario"}
                      </span>
                    </div>
                  </div>

                  {activeStudent && (
                    <div style={{ marginTop: 8, fontSize: 11, color: "#64748b" }}>
                      Progreso de: <b>{activeStudent.name}</b>
                    </div>
                  )}

                  {eligibility?.canEvolve && (
                    <button
                      className="btn"
                      onClick={() => {
                        onClose?.();
                        onEvolve?.(cardPreview);
                      }}
                      style={{
                        width: "100%",
                        marginTop: 10,
                        padding: "8px 14px",
                        fontSize: 13,
                        fontWeight: 800,
                        background: "linear-gradient(135deg, #8b5cf6, #ec4899)",
                        color: "#ffffff",
                        border: "none",
                        borderRadius: 10,
                        boxShadow: "0 3px 10px rgba(139, 92, 246, 0.4)",
                        cursor: "pointer",
                      }}
                    >
                      ✨ ¡Evolucionar ahora!
                    </button>
                  )}
                </div>
              )}

              <div style={{ marginTop: "auto", paddingTop: 16, display: "flex", gap: 8, flexWrap: "wrap" }}>
                <button className="btn" onClick={onClose}>
                  Cerrar
                </button>
              </div>
            </div>
          </div>
        </div>
      ) : (
        <OwnedCardViewer
          cardPreview={cardPreview}
          onClose={onClose}
          onNavigate={onNavigate}
        />
      )}
    </div>
  );
}

function OwnedCardViewer({ cardPreview, onClose, onNavigate }) {
  const ownedList = cardPreview.ownedList || null;
  const ownedIndex = Number.isFinite(cardPreview.ownedIndex) ? cardPreview.ownedIndex : 0;
  const currentOwned = ownedList ? ownedList[ownedIndex] : cardPreview;

  return (
    <div
      className="ownedCardModal"
      onClick={(event) => event.stopPropagation()}
      style={{
        maxWidth: "min(85vw, 720px)",
        width: "85vw",
        height: "min(70vh, 520px)",
        maxHeight: "70vh",
        borderRadius: 16,
        overflow: "hidden",
        background: "transparent",
        position: "relative",
        boxShadow: "0 12px 30px rgba(0,0,0,0.5)",
        display: "flex",
        alignItems: "center",
        justifyContent: "center",
      }}
    >
      {currentOwned?.imageURL ? (
        <>
          <img
            src={currentOwned.imageURL}
            alt=""
            style={{ width: "100%", height: "100%", objectFit: "contain", display: "block" }}
          />

          <button
            type="button"
            className="cardNavBtn cardNavLeft"
            disabled={!ownedList || ownedIndex <= 0}
            onClick={(event) => {
              event.stopPropagation();
              onNavigate(-1);
            }}
            aria-label="Previous card"
          >
            <span className="cardNavIcon" aria-hidden="true">‹</span>
          </button>

          <button
            type="button"
            className="cardNavBtn cardNavRight"
            disabled={!ownedList || ownedIndex >= ownedList.length - 1}
            onClick={(event) => {
              event.stopPropagation();
              onNavigate(1);
            }}
            aria-label="Next card"
          >
            <span className="cardNavIcon" aria-hidden="true">›</span>
          </button>

          {ownedList && ownedList.length > 0 && (
            <div className="cardNavCounter">
              {ownedIndex + 1} / {ownedList.length}
            </div>
          )}
        </>
      ) : (
        <div style={{ padding: 16, color: "white", textAlign: "center" }}>
          {cardPreview.title || "Card"}
        </div>
      )}

      <button
        type="button"
        onClick={onClose}
        aria-label="Close card preview"
        style={{
          position: "absolute",
          top: 8,
          right: 8,
          borderRadius: "999px",
          border: "none",
          padding: "4px 8px",
          fontSize: 14,
          cursor: "pointer",
          background: "rgba(0,0,0,0.6)",
          color: "white",
        }}
      >
        ✕
      </button>
    </div>
  );
}
