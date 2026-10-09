export default function CardPreviewModal({ cardPreview, onClose, onNavigate }) {
  if (!cardPreview) return null;

  return (
    <div className="modal-backdrop" onClick={onClose}>
      {cardPreview.isLibraryCard ? (
        <div className="modal" onClick={(event) => event.stopPropagation()}>
          <div style={{ display: "flex", gap: 12, flexWrap: "wrap" }}>
            <div
              style={{
                width: 360,
                maxWidth: "100%",
                height: 500,
                maxHeight: "70vh",
                background: "#f6f6f6",
                borderRadius: 8,
                overflow: "hidden",
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

            <div style={{ flex: 1, minWidth: 220 }}>
              <h3 style={{ marginTop: 0 }}>{cardPreview.title}</h3>
              <div className="muted">{cardPreview.description}</div>
              <div style={{ marginTop: 8, fontWeight: 700 }}>
                {cardPreview.points || 0} pts
              </div>

              <div style={{ marginTop: 12, display: "flex", gap: 8, flexWrap: "wrap" }}>
                <button className="btn" onClick={onClose}>
                  Close
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
