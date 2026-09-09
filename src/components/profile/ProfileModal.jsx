import React, { useState } from "react";

export default function ProfileModal({
  mode,
  student,
  onClose,
  onSave,
  onChangePin,
  onValidationError,
  pastelColors = [],
  giveableCards = [],
  myPendingRequests = [],
  onCreateRequest,
  onCancelRequest,
}) {
  const [emojis, setEmojis] = useState(student.nameEmojis || "");
  const [color, setColor] = useState(student.profileColor || "");
  const [currentPin, setCurrentPin] = useState("");
  const [newPin, setNewPin] = useState("");
  const [newPinConfirm, setNewPinConfirm] = useState("");
  const [requestType, setRequestType] = useState("points");
  const [requestCardId, setRequestCardId] = useState("");
  const [requestAmount, setRequestAmount] = useState("");
  const [requestNote, setRequestNote] = useState("");

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

          {onCreateRequest && (
            <div style={{ marginTop: 24, borderTop: "1px dashed #e0e0e0", paddingTop: 16 }}>
              <div style={{
                fontSize: 12,
                textTransform: "uppercase",
                letterSpacing: "1px",
                color: "#999",
                fontWeight: 700,
                marginBottom: 12,
              }}>
                Pedir algo al profe
              </div>

              {myPendingRequests.length > 0 && (
                <div style={{ display: "flex", flexDirection: "column", gap: 8, marginBottom: 12 }}>
                  {myPendingRequests.map((r) => (
                    <div key={r.id} style={{
                      display: "flex",
                      justifyContent: "space-between",
                      alignItems: "center",
                      gap: 8,
                      background: "#fff",
                      border: "1px solid #eee",
                      borderRadius: 10,
                      padding: "8px 12px",
                    }}>
                      <div style={{ fontSize: 13 }}>
                        {r.type === "card" ? `🃏 ${r.cardTitle || r.cardId}` : `⭐ ${r.amount} pts`}
                        <span className="muted" style={{ marginLeft: 6 }}>pendiente</span>
                      </div>
                      {onCancelRequest && (
                        <button className="btn" style={{ fontSize: 12 }} onClick={() => onCancelRequest(r)}>
                          Cancelar
                        </button>
                      )}
                    </div>
                  ))}
                </div>
              )}

              {myPendingRequests.length >= 3 ? (
                <div className="muted">Ya tienes 3 peticiones pendientes. Espera a que se resuelvan.</div>
              ) : (
                <div style={{ display: "grid", gap: 10, maxWidth: 320 }}>
                  <div style={{ display: "flex", gap: 14 }}>
                    <label style={{ display: "flex", gap: 6, alignItems: "center" }}>
                      <input
                        type="radio"
                        name="requestType"
                        checked={requestType === "points"}
                        onChange={() => setRequestType("points")}
                      />
                      Puntos
                    </label>
                    <label style={{ display: "flex", gap: 6, alignItems: "center" }}>
                      <input
                        type="radio"
                        name="requestType"
                        checked={requestType === "card"}
                        onChange={() => setRequestType("card")}
                      />
                      Carta
                    </label>
                  </div>

                  {requestType === "points" ? (
                    <input
                      type="number"
                      min="1"
                      placeholder="Cantidad de puntos"
                      value={requestAmount}
                      onChange={(e) => setRequestAmount(e.target.value)}
                      style={{ width: "100%", padding: 10, borderRadius: 10, border: "1px solid #ddd" }}
                    />
                  ) : (
                    <select
                      value={requestCardId}
                      onChange={(e) => setRequestCardId(e.target.value)}
                      style={{ padding: 10, borderRadius: 10, border: "1px solid #ddd" }}
                    >
                      <option value="">-- elige una carta --</option>
                      {giveableCards.map((c) => (
                        <option key={c.id} value={c.id}>{c.title}</option>
                      ))}
                    </select>
                  )}

                  <textarea
                    placeholder="Explica por qué (opcional)"
                    value={requestNote}
                    onChange={(e) => setRequestNote(e.target.value)}
                    rows={2}
                    style={{ width: "100%", padding: 10, borderRadius: 10, border: "1px solid #ddd", resize: "vertical" }}
                  />

                  <button
                    className="btn primary"
                    onClick={async () => {
                      if (requestType === "points" && Number(requestAmount) <= 0) {
                        if (onValidationError) onValidationError("Indica una cantidad de puntos válida.");
                        return;
                      }
                      if (requestType === "card" && !requestCardId) {
                        if (onValidationError) onValidationError("Elige una carta.");
                        return;
                      }
                      const ok = await onCreateRequest({
                        type: requestType,
                        amount: requestType === "points" ? Number(requestAmount) : undefined,
                        cardId: requestType === "card" ? requestCardId : undefined,
                        cardTitle: requestType === "card" ? giveableCards.find((c) => c.id === requestCardId)?.title : undefined,
                        note: requestNote,
                      });
                      if (ok) {
                        setRequestAmount("");
                        setRequestCardId("");
                        setRequestNote("");
                      }
                    }}
                  >
                    Enviar petición
                  </button>
                </div>
              )}
            </div>
          )}

          {onChangePin && (
            <div style={{ marginTop: 24, borderTop: "1px dashed #e0e0e0", paddingTop: 16 }}>
              <div style={{
                fontSize: 12,
                textTransform: "uppercase",
                letterSpacing: "1px",
                color: "#999",
                fontWeight: 700,
                marginBottom: 12,
              }}>
                Cambiar PIN
              </div>

              <div style={{ display: "grid", gap: 10, maxWidth: 260 }}>
                <div>
                  <div className="muted" style={{ marginBottom: 6 }}>PIN actual</div>
                  <input
                    type="text"
                    name="studentPinCurrent"
                    autoComplete="off"
                    inputMode="numeric"
                    maxLength={4}
                    value={currentPin}
                    onChange={(e) => setCurrentPin(e.target.value.replace(/\D/g, "").slice(0, 4))}
                    style={{ width: "100%", padding: 10, borderRadius: 10, border: "1px solid #ddd", WebkitTextSecurity: "disc" }}
                  />
                </div>
                <div>
                  <div className="muted" style={{ marginBottom: 6 }}>Nuevo PIN (4 dígitos)</div>
                  <input
                    type="text"
                    name="studentPinNew"
                    autoComplete="off"
                    inputMode="numeric"
                    maxLength={4}
                    value={newPin}
                    onChange={(e) => setNewPin(e.target.value.replace(/\D/g, "").slice(0, 4))}
                    style={{ width: "100%", padding: 10, borderRadius: 10, border: "1px solid #ddd", WebkitTextSecurity: "disc" }}
                  />
                </div>
                <div>
                  <div className="muted" style={{ marginBottom: 6 }}>Confirmar nuevo PIN</div>
                  <input
                    type="text"
                    name="studentPinNewConfirm"
                    autoComplete="off"
                    inputMode="numeric"
                    maxLength={4}
                    value={newPinConfirm}
                    onChange={(e) => setNewPinConfirm(e.target.value.replace(/\D/g, "").slice(0, 4))}
                    style={{ width: "100%", padding: 10, borderRadius: 10, border: "1px solid #ddd", WebkitTextSecurity: "disc" }}
                  />
                </div>
                <button
                  className="btn"
                  onClick={async () => {
                    if (newPin.length !== 4 || newPin !== newPinConfirm) {
                      if (onValidationError) onValidationError("Los nuevos PIN no coinciden o no tienen 4 dígitos.");
                      return;
                    }
                    const ok = await onChangePin(currentPin, newPin);
                    if (ok) {
                      setCurrentPin("");
                      setNewPin("");
                      setNewPinConfirm("");
                    }
                  }}
                >
                  Cambiar PIN
                </button>
              </div>
            </div>
          )}

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
