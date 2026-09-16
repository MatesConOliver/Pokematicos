import React, { useState } from "react";

export default function PinGateModal({ student, onClose, onSubmit }) {
  const [pin, setPin] = useState("");

  function handleSubmit() {
    onSubmit(pin);
    setPin("");
  }

  return (
    <div className="modal-backdrop" onClick={onClose}>
      <div className="modal" onClick={(e) => e.stopPropagation()} style={{ maxWidth: 340 }}>
        <div style={{ display: "flex", justifyContent: "space-between", alignItems: "center", gap: 12 }}>
          <div>
            <h3 style={{ margin: 0 }}>Introduce el PIN</h3>
            <div className="muted">{student.name}</div>
          </div>
          <button className="btn" onClick={onClose}>Close</button>
        </div>

        <div style={{ marginTop: 16 }}>
          <input
            autoFocus
            type="text"
            name="studentPinGate"
            autoComplete="off"
            inputMode="numeric"
            pattern="[0-9]*"
            maxLength={4}
            value={pin}
            onChange={(e) => setPin(e.target.value.replace(/\D/g, "").slice(0, 4))}
            onKeyDown={(e) => {
              if (e.key === "Enter") handleSubmit();
            }}
            placeholder="••••"
            style={{
              width: "100%",
              padding: 14,
              borderRadius: 10,
              border: "1px solid #ddd",
              fontSize: 24,
              textAlign: "center",
              letterSpacing: 8,
              WebkitTextSecurity: "disc",
            }}
          />
        </div>

        <div style={{ marginTop: 16, display: "flex", gap: 8, flexWrap: "wrap" }}>
          <button className="btn" onClick={onClose}>Cancelar</button>
          <button className="btn primary" disabled={pin.length !== 4} onClick={handleSubmit}>
            Entrar
          </button>
        </div>
      </div>
    </div>
  );
}
