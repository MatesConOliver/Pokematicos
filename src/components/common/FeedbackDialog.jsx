import { useEffect } from "react";

export default function FeedbackDialog({
  notice,
  confirmation,
  pendingAction,
  levelUpNotice,
  onDismissNotice,
  onResolveConfirmation,
  onDismissLevelUp,
}) {
  useEffect(() => {
    if (!notice) return undefined;
    const timer = window.setTimeout(onDismissNotice, 4200);
    return () => window.clearTimeout(timer);
  }, [notice, onDismissNotice]);

  return (
    <>
      {pendingAction && (
        <div className="feedback-notice feedback-notice--loading" role="status" aria-live="polite">
          <span>{pendingAction}</span>
          <span className="feedback-spinner" aria-hidden="true" />
        </div>
      )}

      {notice && (
        <div className="feedback-notice" role="status">
          <span>{notice.message}</span>
          <button type="button" className="feedback-dismiss" onClick={onDismissNotice} aria-label="Close notification">
            x
          </button>
        </div>
      )}

      {/* Level Up Center Screen Modal */}
      {levelUpNotice && (
        <div className="modal-backdrop" role="presentation" style={{ zIndex: 1200 }} onClick={onDismissLevelUp}>
          <div
            className="level-up-dialog"
            role="dialog"
            aria-modal="true"
            aria-labelledby="levelup-title"
            onClick={(e) => e.stopPropagation()}
          >
            <div style={{ fontSize: 54, marginBottom: 8, filter: "drop-shadow(0 4px 10px rgba(234,179,8,0.4))" }}>
              🎉
            </div>
            <h2 id="levelup-title" style={{ margin: "0 0 8px", fontSize: 24, fontWeight: 900, color: "#854d0e" }}>
              LEVEL UP!
            </h2>
            <div style={{ fontSize: 16, fontWeight: 700, color: "#1f2937", marginBottom: 16 }}>
              {levelUpNotice.message || "Unlocked new Experience Card(s)!"}
            </div>
            {Array.isArray(levelUpNotice.cards) && levelUpNotice.cards.length > 0 && (
              <div
                style={{
                  display: "flex",
                  gap: 12,
                  justifyContent: "center",
                  flexWrap: "wrap",
                  margin: "16px 0 20px",
                }}
              >
                {levelUpNotice.cards.map((c) => {
                  const img = c.imageURL || c.lockedImageURL;
                  return (
                    <div
                      key={c.id || c.cardId}
                      style={{
                        width: 90,
                        border: "2px solid #eab308",
                        borderRadius: 12,
                        padding: 6,
                        background: "#fff",
                        boxShadow: "0 4px 12px rgba(0,0,0,0.08)",
                      }}
                    >
                      <div
                        style={{
                          width: "100%",
                          height: 100,
                          borderRadius: 8,
                          overflow: "hidden",
                          background: "#f3f4f6",
                          display: "flex",
                          alignItems: "center",
                          justifyContent: "center",
                        }}
                      >
                        {img ? (
                          <img src={img} alt={c.title} style={{ width: "100%", height: "100%", objectFit: "cover" }} />
                        ) : (
                          <span style={{ fontSize: 32 }}>⭐</span>
                        )}
                      </div>
                      <div
                        style={{
                          fontSize: 11,
                          fontWeight: 800,
                          marginTop: 6,
                          color: "#111827",
                          overflow: "hidden",
                          textOverflow: "ellipsis",
                          whiteSpace: "nowrap",
                        }}
                      >
                        {c.title}
                      </div>
                    </div>
                  );
                })}
              </div>
            )}
            <button
              type="button"
              className="btn primary"
              style={{
                background: "#eab308",
                borderColor: "#ca8a04",
                color: "#713f12",
                fontWeight: 800,
                padding: "10px 24px",
                fontSize: 15,
                borderRadius: 999,
                boxShadow: "0 6px 20px rgba(234,179,8,0.4)",
              }}
              onClick={onDismissLevelUp}
            >
              Awesome! ✨
            </button>
          </div>
        </div>
      )}

      {confirmation && (
        <div className="modal-backdrop" role="presentation">
          <div className="feedback-dialog" role="alertdialog" aria-modal="true" aria-labelledby="feedback-dialog-title">
            <div className="feedback-dialog-icon" aria-hidden="true">!</div>
            <h3 id="feedback-dialog-title">Please confirm</h3>
            <p>{confirmation.message}</p>
            <div className="feedback-dialog-actions">
              <button type="button" className="btn" onClick={() => onResolveConfirmation(false)}>
                Cancel
              </button>
              <button type="button" className="btn danger" onClick={() => onResolveConfirmation(true)}>
                Confirm
              </button>
            </div>
          </div>
        </div>
      )}
    </>
  );
}
