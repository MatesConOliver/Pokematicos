import React, { useEffect, useMemo, useState } from "react";

export default function RequestsPanel({
  pendingRequests,
  classesList = [],
  activeClassId = null,
  onApprove,
  onReject,
  onClose,
}) {
  const [scope, setScope] = useState(activeClassId || "all");
  const [selectedIds, setSelectedIds] = useState([]);
  const [busy, setBusy] = useState(false);

  const visible = useMemo(
    () => (scope === "all" ? pendingRequests : pendingRequests.filter((r) => r.classId === scope)),
    [pendingRequests, scope]
  );

  // Drop selections that disappeared (resolved) or are out of the current scope.
  useEffect(() => {
    const ids = new Set(visible.map((r) => r.id));
    setSelectedIds((prev) => (prev.every((id) => ids.has(id)) ? prev : prev.filter((id) => ids.has(id))));
  }, [visible]);

  const allSelected = visible.length > 0 && selectedIds.length === visible.length;
  const selected = visible.filter((r) => selectedIds.includes(r.id));

  function toggle(id) {
    setSelectedIds((prev) => (prev.includes(id) ? prev.filter((x) => x !== id) : [...prev, id]));
  }

  async function bulk(handler) {
    setBusy(true);
    try {
      for (const r of selected) {
        await handler(r);
      }
      setSelectedIds([]);
    } finally {
      setBusy(false);
    }
  }

  return (
    <div className="modal-backdrop" onClick={onClose}>
      <div className="modal" onClick={(e) => e.stopPropagation()} style={{ maxWidth: 520 }}>
        <div style={{ display: "flex", justifyContent: "space-between", alignItems: "center", gap: 12 }}>
          <h3 style={{ margin: 0 }}>Pending requests</h3>
          <button className="btn" onClick={onClose}>Close</button>
        </div>

        <div style={{ marginTop: 12, display: "flex", gap: 8, alignItems: "center", flexWrap: "wrap" }}>
          <select className="select" style={{ width: "auto" }} value={scope} onChange={(e) => setScope(e.target.value)}>
            <option value="all">All classes</option>
            {classesList.map((c) => (
              <option key={c.id} value={c.id}>{c.name}</option>
            ))}
          </select>
          <button
            className="btn"
            disabled={!visible.length || busy}
            onClick={() => setSelectedIds(allSelected ? [] : visible.map((r) => r.id))}
          >
            {allSelected ? "Deselect all" : "Select all"}
          </button>
          <button className="btn primary" disabled={!selected.length || busy} onClick={() => bulk(onApprove)}>
            Accept selected ({selected.length})
          </button>
          <button className="btn" disabled={!selected.length || busy} onClick={() => bulk(onReject)}>
            Reject selected
          </button>
        </div>

        <div style={{ marginTop: 14, display: "flex", flexDirection: "column", gap: 10, maxHeight: 480, overflowY: "auto" }}>
          {!visible.length ? (
            <div className="muted">No pending requests.</div>
          ) : (
            visible.map((r) => (
              <div key={r.id} style={{ border: "1px solid #eee", borderRadius: 10, padding: 10 }}>
                <div style={{ display: "flex", justifyContent: "space-between", gap: 8 }}>
                  <label style={{ display: "flex", gap: 8, alignItems: "flex-start", cursor: "pointer" }}>
                    <input
                      type="checkbox"
                      checked={selectedIds.includes(r.id)}
                      onChange={() => toggle(r.id)}
                      disabled={busy}
                    />
                    <div>
                      <div style={{ fontWeight: 800 }}>{r.studentName || "Student"}</div>
                      <div className="muted" style={{ fontSize: 12 }}>{r.className}</div>
                    </div>
                  </label>
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
                  <button className="btn primary" disabled={busy} onClick={() => onApprove(r)}>Accept</button>
                  <button className="btn" disabled={busy} onClick={() => onReject(r)}>Reject</button>
                </div>
              </div>
            ))
          )}
        </div>
      </div>
    </div>
  );
}
