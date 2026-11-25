import React, { useEffect, useMemo, useState } from "react";
import { formatWeekdayMonthDayTime, getYearFromInput } from "../../utils/dateUtils";
import YearDivider from "../common/YearDivider";

export default function RequestsPanel({
  pendingRequests,
  classesList = [],
  activeClassId = null,
  onApprove,
  onApproveBatch,
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

  async function bulkApprove() {
    if (!selected.length) return;
    setBusy(true);
    try {
      if (onApproveBatch) {
        await onApproveBatch(selected);
      } else {
        for (const r of selected) {
          await onApprove(r);
        }
      }
      setSelectedIds([]);
    } finally {
      setBusy(false);
    }
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
          <button className="btn primary" disabled={!selected.length || busy} onClick={bulkApprove}>
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
            (() => {
              const currentYear = new Date().getFullYear();
              let lastKnownYear = null;

              return visible.map((r) => {
                const dateLabel = formatWeekdayMonthDayTime(r.createdAt);
                const itemYear = getYearFromInput(r.createdAt);
                let showDivider = false;
                let dividerPrevYear = null;

                if (itemYear) {
                  if (lastKnownYear === null) {
                    if (itemYear !== currentYear) {
                      showDivider = true;
                      dividerPrevYear = null;
                    }
                  } else if (itemYear !== lastKnownYear) {
                    showDivider = true;
                    dividerPrevYear = lastKnownYear;
                  }
                  lastKnownYear = itemYear;
                }

                return (
                  <React.Fragment key={r.id}>
                    {showDivider && (
                      <YearDivider prevYear={dividerPrevYear} nextYear={itemYear} />
                    )}
                    <div
                      style={{
                        border: "1px solid #e2e8f0",
                        borderRadius: 12,
                        padding: 12,
                        background: "#ffffff",
                        contentVisibility: "auto",
                        containIntrinsicSize: "0 100px",
                        boxShadow: "0 1px 3px rgba(15, 23, 42, 0.04)",
                      }}
                    >
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
                            <div className="muted" style={{ fontSize: 12 }}>
                              {r.className}
                              {dateLabel ? (r.className ? ` • ${dateLabel}` : dateLabel) : ""}
                            </div>
                          </div>
                        </label>
                        <div className="pill">
                          {r.type === "both" || (r.cardId && r.amount)
                            ? `Card: ${r.cardTitle || r.cardId} + ${r.amount} pts`
                            : r.cardId || r.type === "card"
                              ? `Card: ${r.cardTitle || r.cardId}`
                              : `${r.amount} pts`}
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
                  </React.Fragment>
                );
              });
            })()
          )}
        </div>
      </div>
    </div>
  );
}
