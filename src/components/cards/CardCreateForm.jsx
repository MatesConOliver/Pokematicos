import React, { useState } from "react";

export default function CardCreateForm({
  cards = [],
  defaultCatalystCardId = "",
  onCreate,
  lockedInputRef,
  unlockedInputRef,
  lockedInputBRef,
  unlockedInputBRef,
  flagConfig,
  streakConfigs = [],
  onValidationError,
}) {
  const [title, setTitle] = useState("");
  const [description, setDescription] = useState("");
  const [points, setPoints] = useState(1);
  const [category, setCategory] = useState("points");
  const [lockedFile, setLockedFile] = useState(null);
  const [unlockedFile, setUnlockedFile] = useState(null);
  const [lockedFile_B, setLockedFileB] = useState(null);
  const [unlockedFile_B, setUnlockedFileB] = useState(null);
  const [linkedStreakIds, setLinkedStreakIds] = useState([]);
  const [streakPick, setStreakPick] = useState("");
  const [streakLookup, setStreakLookup] = useState("");

  // Evolution configuration
  const [isEvolution, setIsEvolution] = useState(false);
  const [baseCardId, setBaseCardId] = useState("");
  const [requiredCopies, setRequiredCopies] = useState(3);
  const [catalystCardId, setCatalystCardId] = useState("");

  async function handleCreate() {
    if (!title.trim()) {
      if (onValidationError) onValidationError("Title required");
      return;
    }

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

    const result = await onCreate({
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
    if (result === false) return;
    setTitle("");
    setDescription("");
    setPoints(1);
    setCategory("points");
    setIsEvolution(false);
    setBaseCardId("");
    setRequiredCopies(3);
    setCatalystCardId("");
    setLinkedStreakIds([]);
    setStreakPick("");
    setStreakLookup("");
    setLockedFile(null);
    setUnlockedFile(null);
    setLockedFileB(null);
    setUnlockedFileB(null);
    if (lockedInputRef?.current) lockedInputRef.current.value = "";
    if (unlockedInputRef?.current) unlockedInputRef.current.value = "";
    if (lockedInputBRef?.current) lockedInputBRef.current.value = "";
    if (unlockedInputBRef?.current) unlockedInputBRef.current.value = "";
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

      {/* Evolution configuration */}
      <div
        style={{
          border: "1px solid #c7d2fe",
          borderRadius: 12,
          padding: 12,
          marginTop: 12,
          background: isEvolution ? "#eef2ff" : "#f8fafc",
          transition: "background 0.2s",
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
                {cards.map((c) => (
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
                  <option value="">
                    {defaultCatalystCardId
                      ? `(Catalizador universal: ${cards.find((c) => c.id === defaultCatalystCardId)?.title || "Configurado"})`
                      : "(Catalizador universal — selecciona uno en Biblioteca)"}
                  </option>
                  {cards
                    .filter((c) => (c.category || "points") === "rewards" || c.category === "extra")
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
        <div style={{ fontWeight: 800, marginTop: 12 }}>
          Option A ({flagConfig.optionA}) images
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

      {flagConfig && (
        <div style={{ borderTop: "1px solid #eee", marginTop: 12, paddingTop: 10 }}>
          <div style={{ fontWeight: 800, marginBottom: 8 }}>
            Option B ({flagConfig.optionB}) images (optional)
          </div>
          <div style={{ marginTop: 8, fontSize: 13 }}>
            <div style={{ marginBottom: 4 }}>Locked card</div>
            <input
              ref={lockedInputBRef}
              type="file"
              accept="image/*"
              onChange={(e) => setLockedFileB(e.target.files?.[0] || null)}
            />
          </div>
          <div style={{ marginTop: 10, fontSize: 13 }}>
            <div style={{ marginBottom: 4 }}>Unlocked card</div>
            <input
              ref={unlockedInputBRef}
              type="file"
              accept="image/*"
              onChange={(e) => setUnlockedFileB(e.target.files?.[0] || null)}
            />
          </div>
        </div>
      )}

      <div style={{ marginTop: 10 }}>
        <button className="btn primary" onClick={handleCreate}>
          Add card
        </button>
      </div>
    </div>
  );
}
