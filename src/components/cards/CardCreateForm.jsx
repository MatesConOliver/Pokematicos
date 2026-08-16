import React, { useState } from "react";

export default function CardCreateForm({ onCreate, lockedInputRef, unlockedInputRef, streakConfigs = [] }) {
  const [title, setTitle] = useState("");
  const [description, setDescription] = useState("");
  const [points, setPoints] = useState(1);
  const [category, setCategory] = useState("points");
  const [lockedFile, setLockedFile] = useState(null);
  const [unlockedFile, setUnlockedFile] = useState(null);
  const [linkedStreakIds, setLinkedStreakIds] = useState([]);
  const [streakPick, setStreakPick] = useState("");
  const [streakLookup, setStreakLookup] = useState("");

  function handleCreate() {
    if (!title.trim()) return alert("Title required");
    onCreate({ title, description, points, category, linkedStreakIds: category === "points" ? linkedStreakIds : [], lockedFile, unlockedFile });
    setTitle("");
    setDescription("");
    setPoints(1);
    setCategory("points");
    setLinkedStreakIds([]);
    setStreakPick("");
    setStreakLookup("");
    setLockedFile(null);
    setUnlockedFile(null);
    if (lockedInputRef?.current) lockedInputRef.current.value = "";
    if (unlockedInputRef?.current) unlockedInputRef.current.value = "";
  }

  function addStreakId(id) {
    if (!id) return;
    setLinkedStreakIds((prev) => (prev.includes(id) ? prev : [...prev, id]));
    setStreakPick("");
  }

  function removeStreakId(id) {
    setLinkedStreakIds((prev) => prev.filter((x) => x !== id));
  }

  function resolveCreateStreakIdFromText(txt) {
    const t = (txt || "").trim();
    if (!t) return "";
    const n = parseInt(t, 10);
    if (Number.isFinite(n) && n >= 1 && n <= streakConfigs.length) return streakConfigs[n - 1].id;
    const byEmoji = streakConfigs.find((cfg) => (cfg.emoji || "").trim() === t);
    return byEmoji ? byEmoji.id : "";
  }

  return (
    <div>
      <input
        placeholder="Title"
        value={title}
        onChange={(e) => setTitle(e.target.value)}
        style={{ width: "100%", padding: 8, marginBottom: 8, borderRadius: 8, border: "1px solid #ddd" }}
      />
      <textarea
        placeholder="Description"
        value={description}
        onChange={(e) => setDescription(e.target.value)}
        style={{ width: "100%", padding: 8, height: 70, borderRadius: 8, border: "1px solid #ddd" }}
      />
      <div style={{ display: "flex", gap: 8, marginTop: 8, alignItems: "center", flexWrap: "wrap" }}>
        <input
          type="number"
          value={points}
          onChange={(e) => setPoints(e.target.value)}
          style={{ width: 90, padding: 8, borderRadius: 8, border: "1px solid #ddd" }}
        />
        <select
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
          style={{ padding: 8, borderRadius: 8, border: "1px solid #ddd" }}
        >
          <option value="points">Points</option>
          <option value="rewards">Rewards</option>
          <option value="experience">Experience</option>
          <option value="extra">Extra</option>
        </select>
      </div>

      {category === "points" && (
        <div style={{ border: "1px solid #eee", borderRadius: 12, padding: 10, marginTop: 10 }}>
          <div style={{ fontWeight: 800 }}>Link to streaks (optional)</div>

          {(!streakConfigs || streakConfigs.length === 0) ? (
            <div className="muted" style={{ marginTop: 6 }}>
              No streak types yet. Click <b>New streak</b> at the top to create one.
            </div>
          ) : (
            <>
              <div className="muted" style={{ marginTop: 4 }}>
                Add one or more streaks by dropdown, emoji, or number order.
              </div>

              <div style={{ display: "flex", gap: 8, flexWrap: "wrap", marginTop: 8, alignItems: "center" }}>
                <select
                  value={streakPick}
                  onChange={(e) => setStreakPick(e.target.value)}
                  style={{ padding: 8, borderRadius: 8, border: "1px solid #ddd", minWidth: 180 }}
                >
                  <option value="">Choose streak…</option>
                  {streakConfigs.map((cfg, idx) => (
                    <option key={cfg.id} value={cfg.id}>
                      {idx + 1}) {cfg.emoji} (max {cfg.max})
                    </option>
                  ))}
                </select>

                <button className="btn" type="button" onClick={() => addStreakId(streakPick)} disabled={!streakPick}>
                  Add
                </button>
              </div>

              <div style={{ display: "flex", gap: 8, flexWrap: "wrap", marginTop: 8, alignItems: "center" }}>
                <input
                  value={streakLookup}
                  onChange={(e) => setStreakLookup(e.target.value)}
                  placeholder='Type emoji (🔥) or number (1)'
                  style={{ padding: 8, borderRadius: 8, border: "1px solid #ddd", minWidth: 220 }}
                />
                <button
                  className="btn"
                  type="button"
                  onClick={() => addStreakId(resolveCreateStreakIdFromText(streakLookup))}
                >
                  Add from text
                </button>
              </div>

              {linkedStreakIds.length > 0 && (
                <div style={{ marginTop: 10, display: "flex", gap: 6, flexWrap: "wrap" }}>
                  {linkedStreakIds.map((id) => {
                    const cfg = streakConfigs.find((s) => s.id === id);
                    return (
                      <span
                        key={id}
                        className="pill"
                        style={{ display: "inline-flex", gap: 6, alignItems: "center" }}
                      >
                        {cfg ? cfg.emoji : "?"}
                        <button className="btn" type="button" onClick={() => removeStreakId(id)} style={{ padding: "2px 8px" }}>
                          ✕
                        </button>
                      </span>
                    );
                  })}
                </div>
              )}
            </>
          )}
        </div>
      )}

      <div style={{ marginTop: 10, fontSize: 13 }}>
        <div style={{ marginBottom: 4 }}>Locked card (grey with lock)</div>
        <input
          ref={lockedInputRef}
          type="file"
          accept="image/*"
          onChange={(e) => setLockedFile(e.target.files?.[0] || null)}
        />
      </div>

      <div style={{ marginTop: 10, fontSize: 13 }}>
        <div style={{ marginBottom: 4 }}>Unlocked card (original/full colour)</div>
        <input
          ref={unlockedInputRef}
          type="file"
          accept="image/*"
          onChange={(e) => setUnlockedFile(e.target.files?.[0] || null)}
        />
      </div>

      <div style={{ marginTop: 10 }}>
        <button className="btn primary" onClick={handleCreate}>
          Add card
        </button>
      </div>
    </div>
  );
}
