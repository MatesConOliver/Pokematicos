import React from "react";

export default function RequestsPanel({ pendingRequests, onApprove, onReject, onClose }) {
  return (
    <div className="modal-backdrop" onClick={onClose}>
      <div className="modal" onClick={(e) => e.stopPropagation()} style={{ maxWidth: 520 }}>
        <div style={{ display: "flex", justifyContent: "space-between", alignItems: "center", gap: 12 }}>
          <h3 style={{ margin: 0 }}>Peticiones pendientes</h3>
          <button className="btn" onClick={onClose}>Close</button>
        </div>

        <div style={{ marginTop: 14, display: "flex", flexDirection: "column", gap: 10, maxHeight: 480, overflowY: "auto" }}>
          {!pendingRequests.length ? (
            <div className="muted">No hay peticiones pendientes.</div>
          ) : (
            pendingRequests.map((r) => (
              <div key={r.id} style={{ border: "1px solid #eee", borderRadius: 10, padding: 10 }}>
                <div style={{ display: "flex", justifyContent: "space-between", gap: 8 }}>
                  <div>
                    <div style={{ fontWeight: 800 }}>{r.studentName || "Student"}</div>
                    <div className="muted" style={{ fontSize: 12 }}>{r.className}</div>
                  </div>
                  <div className="pill">
                    {r.type === "card" ? `Card: ${r.cardTitle || r.cardId}` : `${r.amount} pts`}
                  </div>
                </div>

                {r.note && (
                  <div style={{ marginTop: 8, fontSize: 13, color: "#555", fontStyle: "italic" }}>
                    "{r.note}"
                  </div>
                )}

                <div style={{ marginTop: 10, display: "flex", gap: 8 }}>
                  <button className="btn primary" onClick={() => onApprove(r)}>Aceptar</button>
                  <button className="btn" onClick={() => onReject(r)}>Rechazar</button>
                </div>
              </div>
            ))
          )}
        </div>
      </div>
    </div>
  );
}
