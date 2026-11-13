import React, { useEffect, useMemo, useState } from "react";
import { computeEffectiveMultiplier } from "../../utils/floatWindowUtils";
import { pickEditableFloatWindow } from "../../services/streakService";
import { getCardDisplayImage } from "../../utils/cardImageUtils";
import { round2, formatPoints } from "../../utils/helpers";
import { isCardUnlockedForStudent } from "../../services/cardEvolutionService";

function todayISODate() {
  const d = new Date();
  const y = d.getFullYear();
  const m = String(d.getMonth() + 1).padStart(2, "0");
  const day = String(d.getDate()).padStart(2, "0");
  return `${y}-${m}-${day}`;
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
  confirmFn,
  onRedeemIndividual,
  onRedeemGroup,
  setCardPreview,
  onValidationError,
  onResetPin,
  onEditFloatWindow,
}) {
  const [redeemRewardId, setRedeemRewardId] = useState("");
  const [redeemMode, setRedeemMode] = useState("individual");
  const [shares, setShares] = useState({});
  const [giveSearch, setGiveSearch] = useState("");

  useEffect(() => {
    setShares({});
  }, [redeemRewardId, redeemMode]);

  const reward = rewards.find((r) => r.id === redeemRewardId) || null;
  const requiredCost = Number(reward?.cost || 0);

  const selectedSharesTotal = useMemo(() => {
    return Object.values(shares).reduce((acc, v) => acc + Number(v || 0), 0);
  }, [shares]);

  const cardsMap = useMemo(() => {
    const map = new Map();
    (cards || []).forEach((c) => map.set(c.id, c));
    return map;
  }, [cards]);

  const groupedOwned = useMemo(() => {
    const map = new Map();
    const studentFlag = student.flagValue || "A";
    (student.cards || []).forEach((o) => {
      const key = o.cardId || "unknown";
      if (!map.has(key)) {
        const fullCard = cardsMap.get(key);
        const displayImageURL = fullCard ? getCardDisplayImage(fullCard, studentFlag) : (o.imageURL || "");
        map.set(key, {
          cardId: key,
          title: o.title || fullCard?.title || "—",
          imageURL: displayImageURL || o.imageURL || "",
          ownedIds: [],
        });
      }
      map.get(key).ownedIds.push(o.id);
    });
    return Array.from(map.values());
  }, [student.cards, cardsMap, student.flagValue]);

  const giveableCards = useMemo(() => {
    return (cards || []).filter((c) => (c.category || "points") !== "rewards");
  }, [cards]);

  const filteredGiveableCards = useMemo(() => {
    if (!giveSearch.trim()) return giveableCards;
    const q = giveSearch.toLowerCase();
    return giveableCards.filter(
      (c) =>
        (c.title && c.title.toLowerCase().includes(q)) ||
        (c.description && c.description.toLowerCase().includes(q))
    );
  }, [giveableCards, giveSearch]);

  const [editName, setEditName] = useState(student.name || "");
  const [editCurrentPoints, setEditCurrentPoints] = useState(round2(student.currentPoints || 0));
  const [editXP, setEditXP] = useState(student.xp || 0);
  const [editMultiplier, setEditMultiplier] = useState(
    typeof student.multiplier === "number" ? student.multiplier : 1
  );

  useEffect(() => {
    setEditName(student.name || "");
    setEditCurrentPoints(round2(student.currentPoints || 0));
    setEditXP(student.xp || 0);
    setEditMultiplier(typeof student.multiplier === "number" ? student.multiplier : 1);
  }, [student.id, student.name, student.currentPoints, student.xp, student.multiplier]);

  function addQuickPoints(amount) {
    const m = computeEffectiveMultiplier(student, todayISODate());
    const effective = round2(Number(amount || 0) * m);
    const next = round2(Number(student.currentPoints || 0) + effective);
    setEditCurrentPoints(next);
    onEditStudent({ currentPoints: next });
  }

  function saveEdits() {
    onEditStudent({
      name: editName.trim(),
      currentPoints: round2(editCurrentPoints || 0),
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
              Current: <span className="pill">{formatPoints(student.currentPoints)} pts</span>{" "}
              • XP: <span className="pill">{student.xp || 0}</span>
            </div>
          </div>
          <div style={{ display: "flex", gap: 8 }}>
            <button className="btn" onClick={onClose}>Close</button>
            {onResetPin && (
              <button className="btn" onClick={onResetPin}>Reset PIN</button>
            )}
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
                      setEditCurrentPoints(round2(student.currentPoints || 0));
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
                    const editableWindow = cfg.float
                      ? pickEditableFloatWindow(stObj.floatWindows, todayISODate())
                      : null;

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

                            {editableWindow && (
                              <div className="muted" style={{ fontSize: 11, marginTop: 4, textAlign: "right" }}>
                                Floating bonus: +{editableWindow.multiplierBonus || 0} (until {editableWindow.end})
                                {onEditFloatWindow && (
                                  <div>
                                    <button
                                      className="btn"
                                      style={{ fontSize: 11, marginTop: 2 }}
                                      onClick={() => onEditFloatWindow(cfg, student, editableWindow)}
                                    >
                                      Edit floating window
                                    </button>
                                  </div>
                                )}
                              </div>
                            )}
                          </div>
                        )}
                      </div>
                    );
                  })}
                </div>
              </div>
            )}

            <div style={{ marginTop: 12, border: "1px solid #eee", borderRadius: 12, padding: 12 }}>
              <div style={{ display: "flex", justifyContent: "space-between", alignItems: "center", marginBottom: 6 }}>
                <h4 style={{ margin: 0 }}>
                  Owned cards ({groupedOwned.reduce((sum, g) => sum + g.ownedIds.length, 0)} total, {groupedOwned.length} unique)
                </h4>
              </div>
              {!groupedOwned.length ? (
                <div className="muted">No cards yet</div>
              ) : (
                <div
                  style={{
                    display: "grid",
                    gridTemplateColumns: "repeat(auto-fill, minmax(220px, 1fr))",
                    gap: 10,
                    maxHeight: 320,
                    overflowY: "auto",
                    paddingRight: 6,
                  }}
                >
                  {groupedOwned.map((g) => (
                    <div
                      key={g.cardId}
                      style={{
                        border: "1px solid #e2e8f0",
                        borderRadius: 12,
                        padding: 10,
                        background: "#ffffff",
                        boxShadow: "0 1px 3px rgba(15, 23, 42, 0.04)",
                        contentVisibility: "auto",
                        containIntrinsicSize: "0 120px",
                      }}
                    >
                      <div style={{ display: "flex", gap: 10, alignItems: "center" }}>
                        <div
                          className="card-thumb"
                          style={{
                            width: 60,
                            height: 80,
                            borderRadius: 8,
                            overflow: "hidden",
                            background: "#f8fafc",
                            cursor: "pointer",
                            flexShrink: 0,
                            border: "1px solid #e2e8f0",
                          }}
                          onClick={() => setCardPreview({ title: g.title, imageURL: g.imageURL, description: "" })}
                        >
                          {g.imageURL ? (
                            <img
                              src={g.imageURL}
                              alt={g.title}
                              loading="lazy"
                              decoding="async"
                              style={{ width: "100%", height: "100%", objectFit: "cover" }}
                            />
                          ) : (
                            <div style={{ padding: 6, fontSize: 11 }}>{g.title}</div>
                          )}
                        </div>
                        <div style={{ flex: 1, minWidth: 0 }}>
                          <div style={{ fontWeight: 800, fontSize: 14, overflow: "hidden", textOverflow: "ellipsis", whiteSpace: "nowrap" }}>
                            {g.title}
                          </div>
                          <div className="muted" style={{ marginTop: 2 }}>
                            Copies: <span className="pill">×{g.ownedIds.length}</span>
                          </div>
                        </div>
                      </div>

                      <div style={{ display: "flex", gap: 6, marginTop: 8, flexWrap: "wrap" }}>
                        <button
                          className="btn"
                          style={{ padding: "3px 8px", fontSize: 11 }}
                          onClick={() => onRemoveOne(g.ownedIds[0])}
                        >
                          Remove 1
                        </button>
                        <button
                          className="btn"
                          style={{ padding: "3px 8px", fontSize: 11, color: "#dc2626", borderColor: "#fecaca" }}
                          onClick={async () => {
                            if (confirmFn && !(await confirmFn(`Remove ALL ${g.ownedIds.length} copies of "${g.title}"?`))) return;
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
                      if (!redeemRewardId) {
                        if (onValidationError) onValidationError("Choose a reward first.");
                        return;
                      }
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
                          {s.name} <span className="muted">(has {formatPoints(s.currentPoints)} pts)</span>
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
                        if (!redeemRewardId) {
                          if (onValidationError) onValidationError("Choose a reward first.");
                          return;
                        }
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

          <div style={{ border: "1px solid #eee", borderRadius: 12, padding: 12, display: "flex", flexDirection: "column" }}>
            <h4 style={{ marginTop: 0, marginBottom: 4 }}>Give card (not rewards)</h4>
            <div className="muted" style={{ marginBottom: 8, fontSize: 12 }}>
              Reward cards do not appear here. They are only obtained by redeeming rewards.
            </div>
            {giveableCards.length > 5 && (
              <input
                placeholder="Search cards to give..."
                value={giveSearch}
                onChange={(e) => setGiveSearch(e.target.value)}
                style={{
                  width: "100%",
                  padding: "6px 10px",
                  fontSize: 12,
                  borderRadius: 8,
                  border: "1px solid #cbd5e1",
                  marginBottom: 8,
                  boxSizing: "border-box",
                }}
              />
            )}
            <div style={{ display: "grid", gap: 8, maxHeight: 460, overflowY: "auto", paddingRight: 6 }}>
              {!filteredGiveableCards.length ? (
                <div className="muted" style={{ padding: 8 }}>No matching cards</div>
              ) : (
                filteredGiveableCards.map((c) => {
                  const unlocked = isCardUnlockedForStudent(student, c);
                  return (
                    <div
                      key={c.id}
                      style={{
                        border: "1px solid #e2e8f0",
                        borderRadius: 10,
                        padding: 8,
                        display: "flex",
                        gap: 10,
                        alignItems: "center",
                        background: "#ffffff",
                        boxShadow: "0 1px 3px rgba(15, 23, 42, 0.04)",
                        contentVisibility: "auto",
                        containIntrinsicSize: "0 86px",
                        opacity: unlocked ? 1 : 0.6,
                      }}
                    >
                      <div
                        style={{
                          width: 56,
                          height: 72,
                          borderRadius: 8,
                          overflow: "hidden",
                          background: "#f8fafc",
                          cursor: "pointer",
                          flexShrink: 0,
                          border: "1px solid #e2e8f0",
                        }}
                      >
                        {(c.lockedImageURL || c.imageURL) ? (
                          <img
                            src={(c.lockedImageURL || c.imageURL)}
                            alt={c.title}
                            loading="lazy"
                            decoding="async"
                            style={{ width: "100%", height: "100%", objectFit: "cover" }}
                          />
                        ) : (
                          <div style={{ padding: 6, fontSize: 10 }}>{c.title}</div>
                        )}
                      </div>
                      <div style={{ flex: 1, minWidth: 0 }}>
                        <div style={{ fontWeight: 800, fontSize: 13, overflow: "hidden", textOverflow: "ellipsis", whiteSpace: "nowrap" }}>
                          {c.title}
                        </div>
                        <div className="muted" style={{ fontSize: 11, overflow: "hidden", textOverflow: "ellipsis", whiteSpace: "nowrap" }}>
                          {unlocked ? (c.description || "—") : "🔒 Evolución sin desbloquear"}
                        </div>
                      </div>
                      <button
                        className="btn primary"
                        disabled={!unlocked}
                        title={unlocked ? "Dar carta" : "El alumno debe evolucionar esta carta primero"}
                        style={{
                          padding: "4px 10px",
                          fontSize: 12,
                          flexShrink: 0,
                          opacity: unlocked ? 1 : 0.5,
                          cursor: unlocked ? "pointer" : "not-allowed",
                        }}
                        onClick={() => unlocked && onGiveCard(c.id)}
                      >
                        {unlocked ? "Give" : "🔒"}
                      </button>
                    </div>
                  );
                })
              )}
            </div>
          </div>
        </div>
      </div>
    </div>
  );
}
