import React, { useState } from "react";

export default function ProfileModal({ mode, student, onClose, onSave, pastelColors = [] }) {
  const [emojis, setEmojis] = useState(student.nameEmojis || "");
  const [color, setColor] = useState(student.profileColor || "");

  const displayName = `${student.name}${emojis ? " " + emojis : ""}`;

  return (
    <div className="modal-backdrop" onClick={onClose}>
      <div className="modal" onClick={(e) => e.stopPropagation()}>
        <div style={{ display: "flex", justifyContent: "space-between", alignItems: "center", gap: 12 }}>
          <div>
            <h3 style={{ margin: 0 }}>Perfil</h3>
            <div className="muted">{displayName}</div>
          </div>
          <button className="btn" onClick={onClose}>Close</button>
        </div>

        <div style={{ marginTop: 14 }}>
          <h4 style={{ marginTop: 0 }}>Personalización</h4>

          <div style={{ marginBottom: 10 }}>
            <div className="muted" style={{ marginBottom: 6 }}>Emojis para tu nombre (no cambia el nombre)</div>
            <input
              value={emojis}
              onChange={(e) => setEmojis(e.target.value)}
              placeholder="Ej: ✨😺🔥"
              style={{ width: "100%", padding: 10, borderRadius: 10, border: "1px solid #ddd" }}
            />
          </div>

          <div style={{ marginBottom: 10 }}>
            <div className="muted" style={{ marginBottom: 6 }}>Color de fondo (pastel)</div>
            <div style={{ display: "flex", gap: 10, flexWrap: "wrap" }}>
              {pastelColors.map((c) => (
                <button
                  key={c.value}
                  className="btn"
                  onClick={() => setColor(c.value)}
                  style={{
                    width: 44,
                    height: 44,
                    borderRadius: 12,
                    background: c.value,
                    border: color === c.value ? "2px solid #111" : "1px solid #ddd",
                  }}
                  title={c.name}
                />
              ))}
              <button className="btn" onClick={() => setColor("")}>Clear</button>
            </div>
          </div>

          <div style={{ marginTop: 24, borderTop: "1px dashed #e0e0e0", paddingTop: 16 }}>
            <div style={{
              fontSize: 12,
              textTransform: "uppercase",
              letterSpacing: "1px",
              color: "#999",
              fontWeight: 700,
              marginBottom: 12,
            }}>
              Reward History
            </div>

            {(!student.rewardsHistory || student.rewardsHistory.length === 0) ? (
              <div style={{ textAlign: "center", padding: "20px", color: "#ccc", fontStyle: "italic", fontSize: 13 }}>
                No rewards redeemed yet.
              </div>
            ) : (
              <div style={{ display: "flex", flexDirection: "column", gap: 8 }}>
                {[...(student.rewardsHistory || [])]
                  .sort((a, b) => (b.date || "").localeCompare(a.date || ""))
                  .map((h) => {
                    const isGroup = h.type === "group" || h.mode === "group";
                    return (
                      <div key={h.id || Math.random()} style={{
                        background: "#fff",
                        border: "1px solid #eee",
                        borderRadius: 10,
                        padding: "10px 14px",
                        boxShadow: "0 2px 5px rgba(0,0,0,0.02)",
                        display: "flex",
                        flexDirection: "column",
                        gap: 4,
                      }}>
                        <div style={{ display: "flex", justifyContent: "space-between", alignItems: "center" }}>
                          <div style={{ fontWeight: 700, color: "#333", fontSize: 14 }}>
                            {h.title}
                          </div>
                          <div style={{
                            background: "#ffebee",
                            color: "#c62828",
                            fontWeight: 800,
                            fontSize: 12,
                            padding: "2px 8px",
                            borderRadius: 12,
                          }}>
                            -{h.cost}
                          </div>
                        </div>

                        <div style={{ display: "flex", alignItems: "center", gap: 8, fontSize: 11, color: "#888" }}>
                          <span>{h.date ? new Date(h.date).toLocaleDateString() : "Unknown date"}</span>
                          {isGroup && (
                            <span style={{
                              background: "#e3f2fd",
                              color: "#1565c0",
                              padding: "1px 6px",
                              borderRadius: 4,
                              fontWeight: 600,
                              fontSize: 10,
                            }}>
                              👥 GROUP
                            </span>
                          )}
                        </div>

                        {isGroup && h.contributors && (
                          <div style={{
                            marginTop: 6,
                            paddingTop: 6,
                            borderTop: "1px dashed #eee",
                            fontSize: 11,
                            color: "#666",
                            lineHeight: "1.4em",
                          }}>
                            <span style={{ fontWeight: 600 }}>Splitting with: </span>
                            {h.contributors
                              .filter(c => c.name !== student.name)
                              .map(c => `${c.name} (${c.cost})`)
                              .join(", ")}
                          </div>
                        )}
                      </div>
                    );
                  })}
              </div>
            )}
          </div>

          <div style={{ marginTop: 14, display: "flex", gap: 8, flexWrap: "wrap" }}>
            <button className="btn" onClick={onClose}>Cancel</button>
            <button
              className="btn primary"
              onClick={() => onSave({ nameEmojis: emojis, profileColor: color })}
            >
              Save
            </button>
          </div>

          {mode === "reader" && (
            <div className="muted" style={{ marginTop: 10 }}>
              Nota: Sin login, cualquiera con acceso podría cambiar perfiles. Si quieres evitarlo, hay que activar Auth.
            </div>
          )}
        </div>
      </div>
    </div>
  );
}
