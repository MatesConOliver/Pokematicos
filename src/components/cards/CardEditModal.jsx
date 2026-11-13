import React, { useState } from "react";

export default function CardEditModal({
  card,
  cards = [],
  defaultCatalystCardId = "",
  streakConfigs = [],
  flagConfig,
  onClose,
  onSave,
  onValidationError,
}) {
  const [title, setTitle] = useState(card.title || "");
  const [description, setDescription] = useState(card.description || "");
  const [points, setPoints] = useState(card.points ?? 0);
  const [category, setCategory] = useState(card.category || "points");

  // Evolution configuration
  const [isEvolution, setIsEvolution] = useState(
    () => Boolean(card.evolution?.isEvolution || card.evolution?.baseCardId)
  );
  const [baseCardId, setBaseCardId] = useState(() => card.evolution?.baseCardId || "");
  const [requiredCopies, setRequiredCopies] = useState(
    () => card.evolution?.requiredCopies ?? 3
  );
  const [catalystCardId, setCatalystCardId] = useState(
    () => card.evolution?.catalystCardId || ""
  );

  const [linkedStreakIds, setLinkedStreakIds] = useState(
    () => (Array.isArray(card.linkedStreakIds) ? card.linkedStreakIds.filter(Boolean).map(String) : [])
  );
  const [streakPick, setStreakPick] = useState("");
  const [streakLookup, setStreakLookup] = useState("");

  const [lockedFile, setLockedFile] = useState(null);
  const [unlockedFile, setUnlockedFile] = useState(null);
  const [lockedFile_B, setLockedFileB] = useState(null);
  const [unlockedFile_B, setUnlockedFileB] = useState(null);

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
                    if (!id) {
                      if (onValidationError) onValidationError("No match. Try emoji (🔥) or number (1).");
                      return;
                    }
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

          {flagConfig && (
            <div style={{ fontWeight: 800, marginTop: 4 }}>
              Option A ({flagConfig.optionA}) images
            </div>
          )}
          <div className="muted" style={{ marginTop: 2 }}>Replace LOCKED image (optional)</div>
          <input type="file" onChange={(e) => setLockedFile(e.target.files?.[0] || null)} />

          <div className="muted" style={{ marginTop: 2 }}>Replace UNLOCKED image (optional)</div>
          <input type="file" onChange={(e) => setUnlockedFile(e.target.files?.[0] || null)} />

          {/* Evolution configuration */}
          <div
            style={{
              border: "1px solid #c7d2fe",
              borderRadius: 12,
              padding: 12,
              background: isEvolution ? "#eef2ff" : "#f8fafc",
            }}
          >
            <label
              style={{
                display: "flex",
                alignItems: "center",
                gap: 8,
                cursor: "pointer",
                fontWeight: 800,
                fontSize: 14,
                color: "#4338ca",
              }}
            >
              <input
                type="checkbox"
                checked={isEvolution}
                onChange={(e) => setIsEvolution(e.target.checked)}
                style={{ width: 16, height: 16, accentColor: "#4f46e5" }}
              />
              🧬 ¿Es una evolución de otra carta?
            </label>

            {isEvolution && (
              <div style={{ marginTop: 10, display: "grid", gap: 10 }}>
                <div>
                  <div style={{ fontSize: 12, fontWeight: 700, color: "#374151", marginBottom: 4 }}>
                    Carta base pre-evolución:
                  </div>
                  <select
                    value={baseCardId}
                    onChange={(e) => setBaseCardId(e.target.value)}
                    style={{
                      width: "100%",
                      padding: 8,
                      borderRadius: 8,
                      border: "1px solid #cbd5e1",
                      background: "#ffffff",
                    }}
                  >
                    <option value="">Selecciona carta base...</option>
                    {cards
                      .filter((c) => c.id !== card.id)
                      .map((c) => (
                        <option key={c.id} value={c.id}>
                          {c.title} ({c.points || 0} pts - {c.category || "points"})
                        </option>
                      ))}
                  </select>
                </div>

                <div style={{ display: "flex", gap: 10, alignItems: "center", flexWrap: "wrap" }}>
                  <div style={{ flex: 1, minWidth: 140 }}>
                    <div style={{ fontSize: 12, fontWeight: 700, color: "#374151", marginBottom: 4 }}>
                      Copias base requeridas:
                    </div>
                    <input
                      type="number"
                      min="1"
                      value={requiredCopies}
                      onChange={(e) => setRequiredCopies(e.target.value)}
                      style={{
                        width: "100%",
                        padding: 8,
                        borderRadius: 8,
                        border: "1px solid #cbd5e1",
                        background: "#ffffff",
                      }}
                    />
                  </div>

                  <div style={{ flex: 1, minWidth: 160 }}>
                    <div style={{ fontSize: 12, fontWeight: 700, color: "#374151", marginBottom: 4 }}>
                      Objeto Catalizador:
                    </div>
                    <select
                      value={catalystCardId}
                      onChange={(e) => setCatalystCardId(e.target.value)}
                      style={{
                        width: "100%",
                        padding: 8,
                        borderRadius: 8,
                        border: "1px solid #cbd5e1",
                        background: "#ffffff",
                      }}
                    >
                      <option value="">(Catalizador universal)</option>
                      {cards
                        .filter(
                          (c) =>
                            c.id !== card.id &&
                            ((c.category || "points") === "rewards" || c.category === "extra")
                        )
                        .map((c) => (
                          <option key={c.id} value={c.id}>
                            {c.title}
                          </option>
                        ))}
                    </select>
                  </div>
                </div>
                <div style={{ fontSize: 11, color: "#6366f1" }}>
                  💡 Al evolucionar, se consumirá 1 Catalizador de la biblioteca del alumno y se conservarán las cartas base.
                </div>
              </div>
            )}
          </div>

          {flagConfig && (
            <div style={{ borderTop: "1px solid #eee", paddingTop: 10 }}>
              <div style={{ fontWeight: 800, marginBottom: 8 }}>
                Option B ({flagConfig.optionB}) images (optional)
              </div>
              <div className="muted" style={{ marginTop: 2 }}>Replace LOCKED image (optional)</div>
              <input type="file" accept="image/*" onChange={(e) => setLockedFileB(e.target.files?.[0] || null)} />
              <div className="muted" style={{ marginTop: 8 }}>Replace UNLOCKED image (optional)</div>
              <input type="file" accept="image/*" onChange={(e) => setUnlockedFileB(e.target.files?.[0] || null)} />
            </div>
          )}

          <div style={{ display: "flex", gap: 10, marginTop: 10, flexWrap: "wrap" }}>
            <button
              className="btn primary"
              onClick={() => {
                if (isEvolution && !baseCardId) {
                  if (onValidationError) onValidationError("Selecciona la carta base para la evolución");
                  return;
                }

                const evolution = isEvolution && baseCardId ? {
                  isEvolution: true,
                  baseCardId,
                  requiredCopies: Math.max(1, parseInt(requiredCopies, 10) || 1),
                  catalystCardId: catalystCardId || "",
                } : null;

                onSave({
                  title,
                  description,
                  points,
                  category,
                  linkedStreakIds: category === "points" ? linkedStreakIds : [],
                  lockedFile,
                  unlockedFile,
                  lockedFile_B,
                  unlockedFile_B,
                  evolution,
                });
              }}
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
