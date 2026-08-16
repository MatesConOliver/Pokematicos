import React, { useState } from "react";

export default function CardEditModal({ card, streakConfigs = [], onClose, onSave }) {
  const [title, setTitle] = useState(card.title || "");
  const [description, setDescription] = useState(card.description || "");
  const [points, setPoints] = useState(card.points ?? 0);
  const [category, setCategory] = useState(card.category || "points");

  const [linkedStreakIds, setLinkedStreakIds] = useState(
    () => (Array.isArray(card.linkedStreakIds) ? card.linkedStreakIds.filter(Boolean).map(String) : [])
  );
  const [streakPick, setStreakPick] = useState("");
  const [streakLookup, setStreakLookup] = useState("");

  const [lockedFile, setLockedFile] = useState(null);
  const [unlockedFile, setUnlockedFile] = useState(null);

  function addStreakId(id) {
    if (!id) return;
    setLinkedStreakIds((prev) => (prev.includes(id) ? prev : [...prev, id]));
    setStreakPick("");
  }

  function removeStreakId(id) {
    setLinkedStreakIds((prev) => prev.filter((x) => x !== id));
  }

  function resolveStreakIdFromText(txt) {
    const t = (txt || "").trim();
    if (!t) return "";
    const n = parseInt(t, 10);
    if (Number.isFinite(n) && n >= 1 && n <= streakConfigs.length) return streakConfigs[n - 1].id;
    const byEmoji = streakConfigs.find((cfg) => (cfg.emoji || "").trim() === t);
    return byEmoji ? byEmoji.id : "";
  }

  function streakLabel(id) {
    const idx = streakConfigs.findIndex((c) => c.id === id);
    const cfg = idx >= 0 ? streakConfigs[idx] : null;
    if (!cfg) return id;
    return `${idx + 1} — ${cfg.emoji} (max ${cfg.max})`;
  }

  return (
    <div className="modal-backdrop" onClick={onClose}>
      <div className="modal" onClick={(e) => e.stopPropagation()} style={{ maxWidth: 720 }}>
        <div style={{ display: "flex", justifyContent: "space-between", alignItems: "center", gap: 10 }}>
          <h3 style={{ margin: 0 }}>Edit card</h3>
          <button className="btn" onClick={onClose}>Close</button>
        </div>

        <div style={{ display: "grid", gap: 10, marginTop: 12 }}>
          <input className="input" value={title} onChange={(e) => setTitle(e.target.value)} placeholder="Title" />

          <textarea
            className="input"
            style={{ height: 90 }}
            value={description}
            onChange={(e) => setDescription(e.target.value)}
            placeholder="Description"
          />

          <div style={{ display: "flex", gap: 10, flexWrap: "wrap" }}>
            <input
              className="input"
              type="number"
              value={points}
              onChange={(e) => setPoints(e.target.value)}
              style={{ width: 140 }}
              placeholder="Points"
            />

            <select
              className="select"
              value={category}
              onChange={(e) => {
                const next = e.target.value;
                setCategory(next);
                if (next !== "points") {
                  setLinkedStreakIds([]);
                  setStreakPick("");
                  setStreakLookup("");
                }
              }}
              style={{ width: 220 }}
            >
              <option value="points">Points</option>
              <option value="rewards">Rewards</option>
              <option value="experience">Experience</option>
              <option value="extra">Extra</option>
            </select>
          </div>

          {category === "points" && (
            <div style={{ border: "1px solid #eee", borderRadius: 12, padding: 10 }}>
              <div style={{ fontWeight: 800 }}>Link to streaks (optional)</div>
              <div className="muted" style={{ marginTop: 4 }}>Add one or more streaks by dropdown, emoji, or number order.</div>

              <div style={{ display: "flex", gap: 8, marginTop: 8, alignItems: "center" }}>
                <select
                  className="select"
                  value={streakPick}
                  onChange={(e) => setStreakPick(e.target.value)}
                >
                  <option value="">Choose streak...</option>
                  {streakConfigs.map((cfg, idx) => (
                    <option key={cfg.id} value={cfg.id}>
                      {idx + 1} — {cfg.emoji} (max {cfg.max})
                    </option>
                  ))}
                </select>
                <button className="btn" type="button" onClick={() => addStreakId(streakPick)} disabled={!streakPick}>
                  Add
                </button>
              </div>

              <div style={{ display: "flex", gap: 8, marginTop: 8 }}>
                <input
                  className="input"
                  value={streakLookup}
                  onChange={(e) => setStreakLookup(e.target.value)}
                  placeholder="Type emoji (🔥) or number (1)"
                />
                <button
                  className="btn"
                  type="button"
                  onClick={() => {
                    const id = resolveStreakIdFromText(streakLookup);
                    if (!id) return alert("No match. Try emoji (🔥) or number (1).");
                    addStreakId(id);
                    setStreakLookup("");
                  }}
                >
                  Add from text
                </button>
              </div>

              <div style={{ display: "flex", gap: 8, flexWrap: "wrap", marginTop: 10 }}>
                {linkedStreakIds.length === 0 ? (
                  <span className="muted">No streaks linked.</span>
                ) : (
                  linkedStreakIds.map((id) => (
                    <span key={id} className="chip">
                      {streakLabel(id)}
                      <button className="btn" style={{ padding: "2px 8px" }} type="button" onClick={() => removeStreakId(id)}>
                        ✕
                      </button>
                    </span>
                  ))
                )}
              </div>
            </div>
          )}

          <div className="muted" style={{ marginTop: 2 }}>Replace LOCKED image (optional)</div>
          <input type="file" onChange={(e) => setLockedFile(e.target.files?.[0] || null)} />

          <div className="muted" style={{ marginTop: 2 }}>Replace UNLOCKED image (optional)</div>
          <input type="file" onChange={(e) => setUnlockedFile(e.target.files?.[0] || null)} />

          <div style={{ display: "flex", gap: 10, marginTop: 10, flexWrap: "wrap" }}>
            <button
              className="btn primary"
              onClick={() =>
                onSave({
                  title,
                  description,
                  points,
                  category,
                  linkedStreakIds: category === "points" ? linkedStreakIds : [],
                  lockedFile,
                  unlockedFile,
                })
              }
            >
              Save changes
            </button>
            <button className="btn" onClick={onClose}>Cancel</button>
          </div>
        </div>
      </div>
    </div>
  );
}
