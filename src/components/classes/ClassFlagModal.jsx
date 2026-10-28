import React, { useEffect, useState } from "react";

export default function ClassFlagModal({ flagConfig, onClose, onSave, onDelete }) {
  const [label, setLabel] = useState(flagConfig?.label || "");
  const [optionA, setOptionA] = useState(flagConfig?.optionA || "");
  const [optionB, setOptionB] = useState(flagConfig?.optionB || "");

  useEffect(() => {
    setLabel(flagConfig?.label || "");
    setOptionA(flagConfig?.optionA || "");
    setOptionB(flagConfig?.optionB || "");
  }, [flagConfig]);

  function save() {
    const config = {
      label: label.trim(),
      optionA: optionA.trim(),
      optionB: optionB.trim(),
    };
    if (!config.label || !config.optionA || !config.optionB) return;
    onSave(config);
  }

  return (
    <div className="modal-backdrop" onClick={onClose}>
      <div className="modal" role="dialog" aria-modal="true" aria-labelledby="class-flag-title" onClick={(event) => event.stopPropagation()}>
        <div style={{ display: "flex", justifyContent: "space-between", alignItems: "center", gap: 10 }}>
          <h3 id="class-flag-title" style={{ margin: 0 }}>Class flag</h3>
          <button type="button" className="btn" onClick={onClose}>Cancel</button>
        </div>
        <div style={{ display: "grid", gap: 10, marginTop: 14 }}>
          <label>
            <div className="muted" style={{ marginBottom: 4 }}>Flag name</div>
            <input className="input" value={label} onChange={(event) => setLabel(event.target.value)} placeholder="e.g. Theme" />
          </label>
          <label>
            <div className="muted" style={{ marginBottom: 4 }}>Option A label (default)</div>
            <input className="input" value={optionA} onChange={(event) => setOptionA(event.target.value)} placeholder="e.g. Fire" />
          </label>
          <label>
            <div className="muted" style={{ marginBottom: 4 }}>Option B label</div>
            <input className="input" value={optionB} onChange={(event) => setOptionB(event.target.value)} placeholder="e.g. Ice" />
          </label>
          <div style={{ display: "flex", gap: 8, flexWrap: "wrap", marginTop: 4 }}>
            <button type="button" className="btn primary" onClick={save} disabled={!label.trim() || !optionA.trim() || !optionB.trim()}>
              Save flag
            </button>
            {flagConfig && (
              <button type="button" className="btn" onClick={onDelete} style={{ color: "#b91c1c" }}>
                Delete flag
              </button>
            )}
          </div>
        </div>
      </div>
    </div>
  );
}
