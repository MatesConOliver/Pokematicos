import React, { useState } from "react";

export default function BulkStreakModal({
  className,
  students,
  streakConfigs,
  onClose,
  onBulkChange,
  onBulkReset,
  onCreateStreakType,
}) {
  const [selectedIds, setSelectedIds] = useState([]);

  const allSelected = students.length > 0 && selectedIds.length === students.length;

  function toggleStudent(id) {
    setSelectedIds((prev) =>
      prev.includes(id) ? prev.filter((x) => x !== id) : [...prev, id]
    );
  }

  function toggleSelectAll() {
    setSelectedIds(allSelected ? [] : students.map((s) => s.id));
  }

  return (
    <div className="modal-backdrop" onClick={onClose}>
      <div className="modal" onClick={(e) => e.stopPropagation()} style={{ maxWidth: 640 }}>
        <div style={{ display: "flex", justifyContent: "space-between", alignItems: "center", gap: 12 }}>
          <h3 style={{ margin: 0 }}>Manage streaks — {className}</h3>
          <button className="btn" onClick={onClose}>Close</button>
        </div>

        <div style={{ marginTop: 12 }}>
          <div style={{ display: "flex", justifyContent: "space-between", alignItems: "center" }}>
            <h4 style={{ margin: 0 }}>Students</h4>
            <button className="btn" onClick={toggleSelectAll}>
              {allSelected ? "Unselect all" : "Select all"}
            </button>
          </div>

          <div
            style={{
              marginTop: 8,
              maxHeight: 160,
              overflowY: "auto",
              border: "1px solid #eee",
              borderRadius: 8,
              padding: 8,
              display: "flex",
              flexDirection: "column",
              gap: 4,
            }}
          >
            {students.length === 0 && <div className="muted">No students in this class.</div>}
            {students.map((s) => (
              <label key={s.id} style={{ display: "flex", alignItems: "center", gap: 8 }}>
                <input
                  type="checkbox"
                  checked={selectedIds.includes(s.id)}
                  onChange={() => toggleStudent(s.id)}
                />
                <span>{s.name}</span>
              </label>
            ))}
          </div>
          <div className="muted" style={{ marginTop: 4 }}>
            {selectedIds.length} of {students.length} selected
          </div>
        </div>

        <div style={{ marginTop: 16 }}>
          <h4 style={{ margin: 0 }}>Streak types</h4>
          {streakConfigs.length === 0 ? (
            <div className="muted" style={{ marginTop: 8 }}>No streak types yet for this class.</div>
          ) : (
            <div style={{ marginTop: 8, display: "flex", flexDirection: "column", gap: 10 }}>
              {streakConfigs.map((cfg) => (
                <div
                  key={cfg.id}
                  style={{
                    border: "1px solid #e5e7eb",
                    borderRadius: 8,
                    padding: 10,
                    display: "flex",
                    justifyContent: "space-between",
                    alignItems: "center",
                    gap: 8,
                  }}
                >
                  <div style={{ fontWeight: 700 }}>
                    {cfg.emoji} streak (max {cfg.max})
                  </div>
                  <div style={{ display: "flex", gap: 6 }}>
                    <button
                      className="btn"
                      disabled={selectedIds.length === 0}
                      onClick={() => onBulkChange(cfg, -1, selectedIds)}
                    >
                      -1
                    </button>
                    <button
                      className="btn"
                      disabled={selectedIds.length === 0}
                      onClick={() => onBulkChange(cfg, +1, selectedIds)}
                    >
                      +1
                    </button>
                    <button
                      className="btn"
                      disabled={selectedIds.length === 0}
                      onClick={() => onBulkReset(cfg, selectedIds)}
                    >
                      Reset to 0
                    </button>
                  </div>
                </div>
              ))}
            </div>
          )}
        </div>

        <div style={{ marginTop: 16, borderTop: "1px solid #eee", paddingTop: 12 }}>
          <button className="btn primary" onClick={onCreateStreakType}>New streak type</button>
        </div>
      </div>
    </div>
  );
}
