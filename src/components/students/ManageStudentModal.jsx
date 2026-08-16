import React, { useEffect, useMemo, useState } from "react";

function todayISODate() {
  const d = new Date();
  const y = d.getFullYear();
  const m = String(d.getMonth() + 1).padStart(2, "0");
  const day = String(d.getDate()).padStart(2, "0");
  return `${y}-${m}-${day}`;
}

function round2(x) {
  return Math.round((Number(x) || 0) * 100) / 100;
}

export default function ManageStudentModal({
  student,
  classId,
  students,
  cards,
  rewards,
  streakConfigs,
  changeStudentStreakValue,
  resetStudentStreak,
  deleteStreakTypeForClass,
  setStickyCelebrateForClass,
  setStreakRewardCardsForClass,
  mode,
  onEditStudent,
  onClose,
  onDeleteStudent,
  onGiveCard,
  onRemoveOne,
  onRemoveAll,
  onRedeemIndividual,
  onRedeemGroup,
  setCardPreview,
}) {
  const [redeemRewardId, setRedeemRewardId] = useState("");
  const [redeemMode, setRedeemMode] = useState("individual");
  const [shares, setShares] = useState({});

  useEffect(() => {
    setShares({});
  }, [redeemRewardId, redeemMode]);

  const reward = rewards.find((r) => r.id === redeemRewardId) || null;
  const requiredCost = Number(reward?.cost || 0);

  const selectedSharesTotal = useMemo(() => {
    return Object.values(shares).reduce((acc, v) => acc + Number(v || 0), 0);
  }, [shares]);

  const groupedOwned = useMemo(() => {
    const map = new Map();
    (student.cards || []).forEach((o) => {
      const key = o.cardId || "unknown";
      if (!map.has(key)) {
        map.set(key, {
          cardId: key,
          title: o.title || "—",
          imageURL: o.imageURL || "",
          ownedIds: [],
        });
      }
      map.get(key).ownedIds.push(o.id);
    });
    return Array.from(map.values());
  }, [student.cards]);

  const giveableCards = useMemo(() => {
    return (cards || []).filter((c) => (c.category || "points") !== "rewards");
  }, [cards]);

  const [editName, setEditName] = useState(student.name || "");
  const [editCurrentPoints, setEditCurrentPoints] = useState(student.currentPoints || 0);
  const [editXP, setEditXP] = useState(student.xp || 0);
  const [editMultiplier, setEditMultiplier] = useState(
    typeof student.multiplier === "number" ? student.multiplier : 1
  );

  useEffect(() => {
    setEditName(student.name || "");
    setEditCurrentPoints(student.currentPoints || 0);
    setEditXP(student.xp || 0);
    setEditMultiplier(typeof student.multiplier === "number" ? student.multiplier : 1);
  }, [student.id, student.name, student.currentPoints, student.xp]);

  function addQuickPoints(amount) {
    const m = typeof student.multiplier === "number" ? student.multiplier : 1;
    const effective = round2(Number(amount || 0) * m);
    const next = round2(Number(student.currentPoints || 0) + effective);
    setEditCurrentPoints(next);
    onEditStudent({ currentPoints: next });
  }

  function saveEdits() {
    onEditStudent({
      name: editName.trim(),
      currentPoints: Number(editCurrentPoints || 0),
      xp: Number(editXP || 0),
      multiplier: Number(parseFloat(editMultiplier) || 1),
    });
  }

  return (
    <div className="modal-backdrop" onClick={onClose}>
      <div className="modal" onClick={(e) => e.stopPropagation()}>
        <div style={{ display: "flex", justifyContent: "space-between", alignItems: "center", gap: 12 }}>
          <div>
            <h3 style={{ margin: 0 }}>Manage: {student.name}</h3>
            <div className="muted">
              Current: <span className="pill">{student.currentPoints || 0} pts</span>{" "}
              • XP: <span className="pill">{student.xp || 0}</span>
            </div>
          </div>
          <div style={{ display: "flex", gap: 8 }}>
            <button className="btn" onClick={onClose}>Close</button>
            <button className="btn" onClick={onDeleteStudent}>Delete student</button>
          </div>
        </div>

        <div style={{ marginTop: 12, display: "grid", gridTemplateColumns: "1fr 380px", gap: 12 }}>
          <div>
            <div style={{ marginTop: 12, border: "1px solid #eee", borderRadius: 12, padding: 12 }}>
              <h4 style={{ marginTop: 0 }}>Editar alumno</h4>

              <div style={{ display: "grid", gap: 10 }}>
                <div>
                  <div className="muted" style={{ marginBottom: 6 }}>Nombre</div>
                  <input
                    value={editName}
                    onChange={(e) => setEditName(e.target.value)}
                    style={{ width: "100%", padding: 10, borderRadius: 10, border: "1px solid #ddd" }}
                  />
                </div>

                <div style={{ display: "grid", gridTemplateColumns: "1fr 1fr", gap: 10 }}>
                  <div>
                    <div className="muted" style={{ marginBottom: 6 }}>Puntos actuales</div>
                    <input
                      type="number"
                      value={editCurrentPoints}
                      onChange={(e) => setEditCurrentPoints(e.target.value)}
                      style={{ width: "100%", padding: 10, borderRadius: 10, border: "1px solid #ddd" }}
                    />
                    <div style={{ marginTop: 8, display: "flex", gap: 8, flexWrap: "wrap" }}>
                      <button className="btn" onClick={() => addQuickPoints(1)}>+1</button>
                      <button className="btn" onClick={() => addQuickPoints(5)}>+5</button>
                      <button className="btn" onClick={() => addQuickPoints(10)}>+10</button>
                    </div>
                  </div>

                  <div>
                    <div className="muted" style={{ marginBottom: 6 }}>XP</div>
                    <input
                      type="number"
                      value={editXP}
                      onChange={(e) => setEditXP(e.target.value)}
                      style={{ width: "100%", padding: 10, borderRadius: 10, border: "1px solid #ddd" }}
                    />
                  </div>
                </div>

                <div>
                  <div className="muted" style={{ marginBottom: 6 }}>Multiplier (x)</div>
                  <input
                    type="number"
                    step="0.01"
                    value={editMultiplier}
                    onChange={(e) => setEditMultiplier(e.target.value)}
                    className="input"
                  />
                  <div className="muted">Default is 1. Example: 1.25, 2, etc.</div>
                </div>

                <div style={{ display: "flex", gap: 8, flexWrap: "wrap" }}>
                  <button className="btn primary" onClick={saveEdits}>Guardar</button>
                  <button
                    className="btn"
                    onClick={() => {
                      setEditName(student.name || "");
                      setEditCurrentPoints(student.currentPoints || 0);
                      setEditXP(student.xp || 0);
                    }}
                  >
                    Deshacer
                  </button>
                </div>
              </div>
            </div>

            {streakConfigs && streakConfigs.length > 0 && (
              <div style={{ marginTop: 16 }}>
                <h4 style={{ marginTop: 0 }}>Streaks</h4>
                <div style={{ display: "flex", flexDirection: "column", gap: 10 }}>
                  {streakConfigs.map((cfg) => {
                    const stObj =
                      (student.streaks && student.streaks[cfg.id]) || {
                        value: 0,
                        lastUpdated: "",
                      };
                    const emojiLine =
                      (cfg.emoji || "").repeat(stObj.value || 0) || cfg.emoji;
                    const date = stObj.lastUpdated || "";
                    const isToday = date && date === todayISODate();

                    return (
                      <div
                        key={cfg.id}
                        style={{
                          border: "1px solid #e5e7eb",
                          borderRadius: 8,
                          padding: 8,
                          display: "flex",
                          justifyContent: "space-between",
                          alignItems: "center",
                          gap: 8,
                          background: "#ffffff",
                        }}
                      >
                        <div>
                          <div style={{ fontSize: 14, fontWeight: 700 }}>
                            {cfg.emoji} streak (max {cfg.max})
                          </div>
                          <div style={{ fontSize: 13 }}>{emojiLine}</div>
                          {date && (
                            <div
                              style={{
                                fontSize: 11,
                                marginTop: 2,
                                color: isToday ? "#16a34a" : "#dc2626",
                                fontWeight: 600,
                              }}
                            >
                              Last: {date}
                            </div>
                          )}
                        </div>

                        {mode === "admin" && (
                          <div
                            style={{
                              display: "flex",
                              flexDirection: "column",
                              gap: 4,
                              alignItems: "flex-end",
                            }}
                          >
                            <div>
                              <button
                                className="btn"
                                onClick={() =>
                                  changeStudentStreakValue(classId, student.id, cfg.id, -1, cfg)
                                }
                              >
                                -1
                              </button>
                              <button
                                className="btn"
                                style={{ marginLeft: 4 }}
                                onClick={() =>
                                  changeStudentStreakValue(classId, student.id, cfg.id, +1, cfg)
                                }
                              >
                                +1
                              </button>
                            </div>
                            <button
                              className="btn"
                              style={{ fontSize: 11 }}
                              onClick={() => resetStudentStreak(classId, student.id, cfg.id)}
                            >
                              Reset
                            </button>

                            <button
                              className="btn"
                              style={{ fontSize: 11, marginTop: 4 }}
                              onClick={() => setStickyCelebrateForClass(classId, cfg.id, !cfg.stickyCelebrate)}
                            >
                              Sticky celebration: {cfg.stickyCelebrate ? "ON" : "OFF"}
                            </button>

                            <div className="muted" style={{ fontSize: 11, marginTop: 4 }}>
                              Reward on MAX:{" "}
                              {(cfg.rewardCardIds || [])
                                .map((id) => (cards.find((c) => c.id === id)?.title || id))
                                .join(", ") || "None"}
                            </div>

                            <button
                              className="btn"
                              style={{ fontSize: 11, marginTop: 4 }}
                              onClick={() => setStreakRewardCardsForClass?.(classId, cfg.id, cfg)}
                            >
                              Set reward cards
                            </button>

                            <button
                              className="btn"
                              style={{ fontSize: 11, marginTop: 4, color: "#b91c1c", borderColor: "#fecaca" }}
                              onClick={() => deleteStreakTypeForClass(classId, cfg.id)}
                            >
                              Delete streak type
                            </button>
                          </div>
                        )}
                      </div>
                    );
                  })}
                </div>
              </div>
            )}

            <div style={{ marginTop: 12, border: "1px solid #eee", borderRadius: 12, padding: 12 }}>
              <h4 style={{ marginTop: 0 }}>Owned cards (grouped)</h4>
              {!groupedOwned.length ? (
                <div className="muted">No cards yet</div>
              ) : (
                <div style={{ display: "grid", gridTemplateColumns: "repeat(2, 1fr)", gap: 10 }}>
                  {groupedOwned.map((g) => (
                    <div key={g.cardId} style={{ border: "1px solid #eee", borderRadius: 12, padding: 10 }}>
                      <div style={{ display: "flex", gap: 10, alignItems: "center" }}>
                        <div
                          className="card-thumb"
                          style={{ width: 70, height: 92, borderRadius: 10, overflow: "hidden", background: "#fafafa", cursor: "pointer" }}
                          onClick={() => setCardPreview({ title: g.title, imageURL: g.imageURL, description: "" })}
                        >
                          {g.imageURL ? (
                            <img src={g.imageURL} alt={g.title} style={{ width: "100%", height: "100%", objectFit: "cover" }} />
                          ) : (
                            <div style={{ padding: 6 }}>{g.title}</div>
                          )}
                        </div>
                        <div style={{ flex: 1 }}>
                          <div style={{ fontWeight: 900 }}>{g.title}</div>
                          <div className="muted">
                            Copies: <span className="pill">×{g.ownedIds.length}</span>
                          </div>
                        </div>
                      </div>

                      <div style={{ display: "flex", gap: 8, marginTop: 10, flexWrap: "wrap" }}>
                        <button className="btn" onClick={() => onRemoveOne(g.ownedIds[0])}>
                          Remove 1
                        </button>
                        <button
                          className="btn"
                          onClick={() => {
                            if (!window.confirm(`Remove ALL ${g.ownedIds.length} copies of "${g.title}"?`)) return;
                            onRemoveAll(g.ownedIds);
                          }}
                        >
                          Remove all
                        </button>
                      </div>
                    </div>
                  ))}
                </div>
              )}
            </div>

            <div style={{ marginTop: 12, border: "1px solid #eee", borderRadius: 12, padding: 12 }}>
              <h4 style={{ marginTop: 0 }}>Redeem reward</h4>

              <div style={{ display: "flex", gap: 8, flexWrap: "wrap", alignItems: "center" }}>
                <select
                  value={redeemRewardId}
                  onChange={(e) => setRedeemRewardId(e.target.value)}
                  style={{ padding: 8, borderRadius: 8, border: "1px solid #ddd", minWidth: 240 }}
                >
                  <option value="">-- choose reward --</option>
                  {rewards.map((r) => (
                    <option key={r.id} value={r.id}>
                      {r.title} (cost {r.cost})
                    </option>
                  ))}
                </select>

                <label style={{ display: "flex", gap: 6, alignItems: "center" }}>
                  <input
                    type="radio"
                    name="redeemMode"
                    checked={redeemMode === "individual"}
                    onChange={() => setRedeemMode("individual")}
                  />
                  Individual
                </label>
                <label style={{ display: "flex", gap: 6, alignItems: "center" }}>
                  <input
                    type="radio"
                    name="redeemMode"
                    checked={redeemMode === "group"}
                    onChange={() => setRedeemMode("group")}
                  />
                  Group
                </label>
              </div>

              {redeemMode === "individual" && (
                <div style={{ marginTop: 10 }}>
                  <button
                    className="btn primary"
                    onClick={() => {
                      if (!redeemRewardId) return alert("Choose a reward first.");
                      onRedeemIndividual(redeemRewardId);
                    }}
                  >
                    Redeem (individual)
                  </button>
                </div>
              )}

              {redeemMode === "group" && (
                <div style={{ marginTop: 12 }}>
                  <div className="muted">
                    Assign shares so the total equals <span className="pill">{requiredCost} pts</span>. Current total:{" "}
                    <span
                      className="pill"
                      style={{ background: selectedSharesTotal === requiredCost ? "#dcfce7" : "#fee2e2" }}
                    >
                      {selectedSharesTotal}
                    </span>
                  </div>

                  <div style={{ marginTop: 10, display: "grid", gap: 8 }}>
                    {students.map((s) => (
                      <div key={s.id} style={{ display: "flex", gap: 10, alignItems: "center", background: s.cosmetics?.color || "white", position: "relative", overflow: "hidden" }}>
                        <div style={{ flex: 1, fontWeight: 700 }}>
                          {s.name} <span className="muted">(has {s.currentPoints || 0} pts)</span>
                        </div>
                        <input
                          type="number"
                          min="0"
                          value={shares[s.id] ?? ""}
                          onChange={(e) => {
                            const raw = e.target.value;
                            setShares((prev) => ({
                              ...prev,
                              [s.id]: raw === "" ? "" : Number(raw),
                            }));
                          }}
                          style={{ width: 90, padding: 8, borderRadius: 8, border: "1px solid #ddd" }}
                          placeholder="0"
                        />
                      </div>
                    ))}
                  </div>

                  <div style={{ marginTop: 12 }}>
                    <button
                      className="btn primary"
                      onClick={() => {
                        if (!redeemRewardId) return alert("Choose a reward first.");
                        onRedeemGroup(redeemRewardId, shares);
                      }}
                    >
                      Redeem (group)
                    </button>
                  </div>
                </div>
              )}
            </div>
          </div>

          <div style={{ border: "1px solid #eee", borderRadius: 12, padding: 12 }}>
            <h4 style={{ marginTop: 0 }}>Give card (not rewards)</h4>
            <div className="muted" style={{ marginBottom: 8 }}>
              Reward cards do not appear here. They are only obtained by redeeming rewards.
            </div>
            <div style={{ display: "grid", gap: 10 }}>
              {giveableCards.map((c) => (
                <div
                  key={c.id}
                  style={{
                    border: "1px solid #eee",
                    borderRadius: 12,
                    padding: 10,
                    display: "flex",
                    gap: 10,
                    alignItems: "center",
                  }}
                >
                  <div
                    style={{
                      width: 68,
                      height: 86,
                      borderRadius: 10,
                      overflow: "hidden",
                      background: "#fafafa",
                      cursor: "pointer",
                    }}
                  >
                    {(c.lockedImageURL || c.imageURL) ? (
                      <img
                        src={(c.lockedImageURL || c.imageURL)}
                        alt={c.title}
                        style={{ width: "100%", height: "100%", objectFit: "cover" }}
                      />
                    ) : (
                      <div style={{ padding: 6 }}>{c.title}</div>
                    )}
                  </div>
                  <div style={{ flex: 1 }}>
                    <div style={{ fontWeight: 900 }}>{c.title}</div>
                    <div className="muted">{c.description}</div>
                  </div>
                  <button className="btn primary" onClick={() => onGiveCard(c.id)}>
                    Give
                  </button>
                </div>
              ))}
            </div>
          </div>
        </div>
      </div>
    </div>
  );
}
