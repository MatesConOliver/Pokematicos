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
  const [multiplierBonus, setMultiplierBonus] = useState(card.multiplierBonus ?? 0);

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

  // Temporal combo configuration
  const [isCombo, setIsCombo] = useState(() =>
    Boolean(
      (card.category || "points") === "points" &&
        card.combo?.isCombo &&
        Array.isArray(card.combo?.requirements) &&
        card.combo.requirements.length > 0
    )
  );
  const [comboPeriod, setComboPeriod] = useState(() => card.combo?.period || "week");
  const [comboRepeatMode, setComboRepeatMode] = useState(() => card.combo?.repeatMode || "per_period");
  const [comboRequirements, setComboRequirements] = useState(() =>
    Array.isArray(card.combo?.requirements) && card.combo.requirements.length > 0
      ? card.combo.requirements.map((r) => ({
          cardId: r.cardId || "",
          count: Math.max(1, parseInt(r.count, 10) || 1),
        }))
      : [{ cardId: "", count: 1 }]
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
            <select
              className="select"
              value={category}
              onChange={(e) => {
                const next = e.target.value;
                setCategory(next);
                if (next === "extra") {
                  setPoints(0);
                  setLockedFile(null);
                  setLockedFileB(null);
                }
                if (next !== "experience") {
                  setMultiplierBonus(0);
                }
                if (next !== "points") {
                  setLinkedStreakIds([]);
                  setStreakPick("");
                  setStreakLookup("");
                  setIsCombo(false);
                }
              }}
              style={{ width: 220 }}
            >
              <option value="points">Points</option>
              <option value="rewards">Rewards</option>
              <option value="experience">Experience</option>
              <option value="extra">Extra</option>
            </select>

            {category !== "extra" && (
              <input
                className="input"
                type="number"
                value={points}
                onChange={(e) => setPoints(e.target.value)}
                style={{ width: 140 }}
                placeholder={
                  category === "experience"
                    ? "XP"
                    : category === "rewards"
                    ? "Cost (pts)"
                    : "Points"
                }
              />
            )}

            {category === "experience" && (
              <label style={{ display: "inline-flex", alignItems: "center", gap: 6, fontSize: 12, fontWeight: 700, color: "#475569" }}>
                <span>Multiplier (+x)</span>
                <input
                  className="input"
                  type="number"
                  step="0.01"
                  value={multiplierBonus}
                  onChange={(e) => setMultiplierBonus(e.target.value)}
                  style={{ width: 110 }}
                  placeholder="0"
                  title="Added to the student's multiplier when unlocked or owned (e.g. 0.25)"
                />
              </label>
            )}
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
              Option A ({flagConfig.optionA}) {category === "extra" ? "image" : "images"}
            </div>
          )}
          {category !== "extra" && (
            <>
              <div className="muted" style={{ marginTop: 2 }}>Replace LOCKED image (optional)</div>
              <input type="file" onChange={(e) => setLockedFile(e.target.files?.[0] || null)} />
            </>
          )}

          <div className="muted" style={{ marginTop: 2 }}>
            {category === "extra" ? "Replace card image (optional)" : "Replace UNLOCKED image (optional)"}
          </div>
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
              🧬 Is this an evolution of another card?
            </label>

            {isEvolution && (
              <div style={{ marginTop: 10, display: "grid", gap: 10 }}>
                <div>
                  <div style={{ fontSize: 12, fontWeight: 700, color: "#374151", marginBottom: 4 }}>
                    Pre-evolution base card:
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
                    <option value="">Select base card...</option>
                    {cards
                      .filter((c) => c.id !== card.id)
                      .map((c) => {
                        const cat = c.category || "points";
                        const metric =
                          cat === "extra"
                            ? "extra"
                            : `${c.points || 0} ${cat === "experience" ? "XP" : "pts"} - ${cat}`;
                        return (
                          <option key={c.id} value={c.id}>
                            {c.title} ({metric})
                          </option>
                        );
                      })}
                  </select>
                </div>

                <div style={{ display: "flex", gap: 10, alignItems: "center", flexWrap: "wrap" }}>
                  <div style={{ flex: 1, minWidth: 140 }}>
                    <div style={{ fontSize: 12, fontWeight: 700, color: "#374151", marginBottom: 4 }}>
                      Required base copies:
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
                      Catalyst item:
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
                      <option value="">(Universal catalyst)</option>
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
                  💡 When evolving, 1 Catalyst from the student's inventory will be consumed and the base cards will be kept.
                </div>
              </div>
            )}
          </div>

          {/* Temporal combo configuration */}
          {category === "points" && (
            <div
              style={{
                border: "1px solid #99f6e4",
                borderRadius: 12,
                padding: 12,
                background: isCombo ? "#f0fdfa" : "#f8fafc",
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
                  color: "#0f766e",
                }}
              >
                <input
                  type="checkbox"
                  checked={isCombo}
                  onChange={(e) => setIsCombo(e.target.checked)}
                  style={{ width: 16, height: 16, accentColor: "#0d9488" }}
                />
                ⏱️ Is this a temporal combo card? (auto-awarded)
              </label>

              {isCombo && (
                <div style={{ marginTop: 10, display: "grid", gap: 10 }}>
                  <div style={{ display: "flex", gap: 10, flexWrap: "wrap" }}>
                    <div style={{ flex: 1, minWidth: 150 }}>
                      <div style={{ fontSize: 12, fontWeight: 700, color: "#374151", marginBottom: 4 }}>
                        Natural period:
                      </div>
                      <select
                        value={comboPeriod}
                        onChange={(e) => setComboPeriod(e.target.value)}
                        style={{
                          width: "100%",
                          padding: 8,
                          borderRadius: 8,
                          border: "1px solid #cbd5e1",
                          background: "#ffffff",
                        }}
                      >
                        <option value="day">Same day</option>
                        <option value="week">Same week (Mon–Sun)</option>
                        <option value="month">Same month</option>
                      </select>
                    </div>

                    <div style={{ flex: 1, minWidth: 170 }}>
                      <div style={{ fontSize: 12, fontWeight: 700, color: "#374151", marginBottom: 4 }}>
                        Frequency:
                      </div>
                      <select
                        value={comboRepeatMode}
                        onChange={(e) => setComboRepeatMode(e.target.value)}
                        style={{
                          width: "100%",
                          padding: 8,
                          borderRadius: 8,
                          border: "1px solid #cbd5e1",
                          background: "#ffffff",
                        }}
                      >
                        <option value="per_period">Repeatable (once per period)</option>
                        <option value="once">One time only</option>
                      </select>
                    </div>
                  </div>

                  <div>
                    <div style={{ fontSize: 12, fontWeight: 700, color: "#374151", marginBottom: 4 }}>
                      Required cards within the period:
                    </div>
                    <div style={{ display: "grid", gap: 6 }}>
                      {comboRequirements.map((req, idx) => (
                        <div key={idx} style={{ display: "flex", gap: 6, alignItems: "center" }}>
                          <select
                            value={req.cardId}
                            onChange={(e) => {
                              const val = e.target.value;
                              setComboRequirements((prev) =>
                                prev.map((row, i) => (i === idx ? { ...row, cardId: val } : row))
                              );
                            }}
                            style={{
                              flex: 1,
                              minWidth: 0,
                              padding: 8,
                              borderRadius: 8,
                              border: "1px solid #cbd5e1",
                              background: "#ffffff",
                            }}
                          >
                            <option value="">Select required card...</option>
                            {cards
                              .filter((c) => c.id !== card.id && (c.category || "points") !== "rewards")
                              .map((c) => {
                                const cat = c.category || "points";
                                const suffix = cat === "points" ? `${c.points || 0} pts` : cat;
                                return (
                                  <option key={c.id} value={c.id}>
                                    {c.title} ({suffix})
                                  </option>
                                );
                              })}
                          </select>

                          <input
                            type="number"
                            min="1"
                            value={req.count}
                            onChange={(e) => {
                              const val = e.target.value;
                              setComboRequirements((prev) =>
                                prev.map((row, i) => (i === idx ? { ...row, count: val } : row))
                              );
                            }}
                            title="Required quantity in period"
                            style={{
                              width: 68,
                              padding: 8,
                              borderRadius: 8,
                              border: "1px solid #cbd5e1",
                              background: "#ffffff",
                            }}
                          />

                          {comboRequirements.length > 1 && (
                            <button
                              type="button"
                              className="btn"
                              onClick={() =>
                                setComboRequirements((prev) => prev.filter((_, i) => i !== idx))
                              }
                              style={{ padding: "6px 10px", color: "#dc2626", borderColor: "#fecaca" }}
                              title="Remove requirement"
                            >
                              ✕
                            </button>
                          )}
                        </div>
                      ))}
                    </div>

                    <button
                      type="button"
                      className="btn"
                      onClick={() =>
                        setComboRequirements((prev) => [...prev, { cardId: "", count: 1 }])
                      }
                      style={{ marginTop: 8, fontSize: 12 }}
                    >
                      + Add required card
                    </button>
                  </div>

                  <div style={{ fontSize: 11, color: "#0f766e" }}>
                    💡 Awarded automatically (with student multiplier applied to points) when the requirements are met in the same natural period. Students cannot request combo cards manually.
                  </div>
                </div>
              )}
            </div>
          )}

          {flagConfig && (
            <div style={{ borderTop: "1px solid #eee", paddingTop: 10 }}>
              <div style={{ fontWeight: 800, marginBottom: 8 }}>
                Option B ({flagConfig.optionB}) {category === "extra" ? "image" : "images"} (optional)
              </div>
              {category !== "extra" && (
                <>
                  <div className="muted" style={{ marginTop: 2 }}>Replace LOCKED image (optional)</div>
                  <input type="file" accept="image/*" onChange={(e) => setLockedFileB(e.target.files?.[0] || null)} />
                </>
              )}
              <div className="muted" style={{ marginTop: 8 }}>
                {category === "extra" ? "Replace card image (optional)" : "Replace UNLOCKED image (optional)"}
              </div>
              <input type="file" accept="image/*" onChange={(e) => setUnlockedFileB(e.target.files?.[0] || null)} />
            </div>
          )}

          <div style={{ display: "flex", gap: 10, marginTop: 10, flexWrap: "wrap" }}>
            <button
              className="btn primary"
              onClick={() => {
                if (isEvolution && !baseCardId) {
                  if (onValidationError) onValidationError("Select the base card for the evolution");
                  return;
                }

                if (category === "points" && isCombo) {
                  const validReqs = comboRequirements.filter((r) => Boolean(r.cardId));
                  const hasEmptyRow = comboRequirements.some((r) => !r.cardId);
                  if (validReqs.length === 0 || hasEmptyRow) {
                    if (onValidationError) onValidationError("Select a card for each combo requirement row");
                    return;
                  }
                }

                const evolution = isEvolution && baseCardId ? {
                  isEvolution: true,
                  baseCardId,
                  requiredCopies: Math.max(1, parseInt(requiredCopies, 10) || 1),
                  catalystCardId: catalystCardId || "",
                } : null;

                const combo = category === "points" && isCombo ? {
                  isCombo: true,
                  period: comboPeriod,
                  repeatMode: comboRepeatMode,
                  requirements: comboRequirements
                    .filter((r) => Boolean(r.cardId))
                    .map((r) => ({
                      cardId: r.cardId,
                      count: Math.max(1, parseInt(r.count, 10) || 1),
                    })),
                } : null;

                const parsedMultBonus = parseFloat(multiplierBonus);
                const isExtra = category === "extra";
                onSave({
                  title,
                  description,
                  points: isExtra ? 0 : points,
                  category,
                  multiplierBonus:
                    category === "experience" && Number.isFinite(parsedMultBonus) ? parsedMultBonus : 0,
                  linkedStreakIds: category === "points" ? linkedStreakIds : [],
                  lockedFile: isExtra ? null : lockedFile,
                  unlockedFile,
                  lockedFile_B: isExtra ? null : lockedFile_B,
                  unlockedFile_B,
                  evolution,
                  combo,
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
