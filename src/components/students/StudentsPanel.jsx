import React from "react";
import EmojiParty from "../common/EmojiParty";
import { todayISODate } from "../../utils/dateUtils";
import { isTodayInFloatWindows } from "../../utils/floatWindowUtils";

export default function StudentsPanel({
  activeClass,
  activeClassId,
  classTotalPoints,
  filteredStudents,
  loadingStudents,
  mode,
  studentFilter,
  setStudentFilter,
  onAddStreak,
  onManageStudent,
  onProfileStudent,
  onChangeStudentStreak,
  onQuickAddPoints,
  onPreviewCard,
  onAddStudent,
  newStudentRef,
}) {
  const today = todayISODate();

  return (
    <main style={{ border: "1px solid #eee", padding: 12, borderRadius: 10 }}>
      <div style={{ display: "flex", justifyContent: "space-between", alignItems: "center", gap: 10 }}>
        <div style={{ display: "flex", alignItems: "center", gap: 10 }}>
          <h3 style={{ margin: 0 }}><span className="column-title-pill"> {activeClass?.name || "Select a class"} </span></h3>
          {activeClassId && <span className="chip">Total class pts: {classTotalPoints}</span>}
        </div>

        <div style={{ display: "flex", alignItems: "center", gap: 8 }}>
          {mode === "admin" && activeClassId && (
            <button className="btn" onClick={() => onAddStreak(activeClassId)}>New streak</button>
          )}

          <input
            placeholder="Filter students..."
            value={studentFilter}
            onChange={(e) => setStudentFilter(e.target.value)}
            style={{
              padding: 8,
              fontSize: 13,
              borderRadius: 8,
              border: "1px solid #ddd",
              minWidth: 170,
            }}
          />
        </div>
      </div>

      <div style={{ marginTop: 12 }}>
        {!activeClassId ? (
          <div className="muted">Select a class first.</div>
        ) : loadingStudents ? (
          <div className="muted">Loading students...</div>
        ) : (
          <div style={{ display: "grid", gridTemplateColumns: "repeat(2, 1fr)", gap: 12 }}>
            {filteredStudents.map((student) => {
              const bg = student.profileColor || "white";
              const displayName = `${student.name}${student.nameEmojis ? " " + student.nameEmojis : ""}`;
              const streakConfigs = activeClass?.streakConfigs || [];

              const isCelebratingToday = (cfg, streak) => {
                const hitToday = (streak?.maxAchievedOn || "") === today;
                if (!hitToday) return false;
                if (cfg.stickyCelebrate) return true;
                return (streak?.value || 0) >= (cfg.max || 0);
              };

              const partyStreaks = streakConfigs.filter((cfg) => {
                const streak = (student.streaks && student.streaks[cfg.id]) || { value: 0, maxAchievedOn: "" };
                return isCelebratingToday(cfg, streak);
              });

              const floatingEmojis = streakConfigs.filter((cfg) => {
                if (!cfg.float) return false;
                const streak = (student.streaks && student.streaks[cfg.id]) || { value: 0, maxAchievedOn: "", floatWindows: [] };
                return isTodayInFloatWindows(today, streak.floatWindows);
              });

              return (
                <div
                  key={student.id}
                  style={{
                    border: "1px solid #ddd",
                    padding: 10,
                    borderRadius: 10,
                    background: bg,
                    position: "relative",
                    overflow: "hidden",
                  }}
                >
                  {floatingEmojis.map((cfg) => (
                    <div key={cfg.id} className="floating-emoji">
                      <div className="floating-emoji-glow">{cfg.emoji}</div>
                    </div>
                  ))}

                  {partyStreaks.map((cfg) => (
                    <EmojiParty
                      key={`party_${student.id}_${cfg.id}_${today}`}
                      emoji={cfg.emoji}
                      seedKey={`${student.id}_${cfg.id}_${today}`}
                      count={22}
                    />
                  ))}

                  <div style={{ display: "flex", justifyContent: "space-between", gap: 8 }}>
                    <div>
                      <div style={{ fontWeight: 800 }}>{displayName}</div>
                      <div className="muted" style={{ lineHeight: 1.35 }}>
                        <div style={{ fontSize: 12, color: "#555", marginTop: 2 }}>
                          {streakConfigs.length > 0 ? (
                            streakConfigs.map((cfg) => {
                              const streak = (student.streaks && student.streaks[cfg.id]) || { value: 0, lastUpdated: "" };
                              const emojiLine = streak.value > 0 ? (cfg.emoji || "").repeat(streak.value) : (
                                <span style={{ textDecoration: "line-through", opacity: 0.5 }}>{cfg.emoji}</span>
                              );
                              const date = streak.lastUpdated || "";
                              const isToday = date && date === today;

                              return (
                                <div key={cfg.id} style={{ display: "flex", alignItems: "center", gap: 8 }}>
                                  <div style={{ flex: 1 }}>
                                    {emojiLine}
                                    {date && (
                                      <span style={{ marginLeft: 4, color: isToday ? "#16a34a" : "#dc2626", fontWeight: 600 }}>
                                        {date}
                                      </span>
                                    )}
                                  </div>
                                  {mode === "admin" && (
                                    <button
                                      className="btn"
                                      style={{ padding: "4px 8px", fontSize: 12, lineHeight: "12px", borderRadius: 10 }}
                                      title="Add +1 to this streak"
                                      onClick={() => onChangeStudentStreak(activeClassId, student.id, cfg.id, +1, cfg)}
                                    >
                                      +1
                                    </button>
                                  )}
                                </div>
                              );
                            })
                          ) : (
                            <span className="muted">No streaks defined for this class.</span>
                          )}
                        </div>

                        {student.multiplier && student.multiplier !== 1 && (
                          <div>
                            <span className="muted">Multiplier:</span>
                            <strong> x{student.multiplier}</strong>
                          </div>
                        )}
                      </div>
                    </div>

                    <div style={{ textAlign: "right" }}>
                      <div style={{ fontWeight: 800 }}>{student.currentPoints || 0} pts</div>
                      <div className="muted">XP: {student.xp || 0}</div>
                    </div>
                  </div>

                  <div style={{ marginTop: 8, display: "flex", gap: 8, flexWrap: "wrap", alignItems: "center" }}>
                    {mode === "admin" && (
                      <button className="btn" onClick={() => onManageStudent(student.id)}>Manage</button>
                    )}
                    <button className="btn" onClick={() => onProfileStudent(student.id)}>Perfil</button>
                    {mode === "admin" && (
                      <div style={{ display: "flex", gap: 6, alignItems: "center" }}>
                        <span className="pill">Points</span>
                        {[1, 5, 10].map((amount) => (
                          <button
                            key={amount}
                            className="btn"
                            style={{ padding: "6px 10px" }}
                            onClick={() => onQuickAddPoints(activeClassId, student.id, amount)}
                          >
                            +{amount}
                          </button>
                        ))}
                      </div>
                    )}
                  </div>

                  <div style={{ marginTop: 10 }}>
                    <div style={{ fontSize: 13, fontWeight: 800 }}>Cards</div>
                    <div style={{ marginTop: 8, maxHeight: 150, overflowY: "auto", paddingRight: 6, display: "flex", gap: 8, flexWrap: "wrap", alignContent: "flex-start" }}>
                      {(() => {
                        const groups = new Map();
                        (student.cards || []).forEach((ownedCard) => {
                          const key = ownedCard.cardId || "unknown";
                          if (!groups.has(key)) {
                            groups.set(key, { title: ownedCard.title || "—", imageURL: ownedCard.imageURL || "", count: 0 });
                          }
                          groups.get(key).count += 1;
                        });

                        const groupedCards = Array.from(groups.entries()).map(([cardId, group]) => ({ cardId, ...group }));
                        const ownedUniqueList = groupedCards.map((card) => ({ title: card.title, imageURL: card.imageURL }));

                        return groupedCards.map((group, index) => (
                          <div
                            key={group.cardId}
                            className="card-thumb"
                            style={{ width: 80, height: 110, border: "1px solid #eee", borderRadius: 10, overflow: "hidden", cursor: "pointer", position: "relative", background: "white" }}
                            onClick={() => onPreviewCard({ ownedList: ownedUniqueList, ownedIndex: index, isLibraryCard: false })}
                          >
                            {group.imageURL ? (
                              <img src={group.imageURL} alt={group.title} style={{ width: "100%", height: "100%", objectFit: "cover" }} />
                            ) : (
                              <div style={{ padding: 6, fontSize: 11 }}>{group.title}</div>
                            )}
                            {group.count > 1 && (
                              <div style={{ position: "absolute", top: 6, right: 6, background: "rgba(0,0,0,0.75)", color: "white", borderRadius: 999, padding: "2px 7px", fontSize: 11, fontWeight: 900 }}>
                                ×{group.count}
                              </div>
                            )}
                          </div>
                        ));
                      })()}
                    </div>
                  </div>
                </div>
              );
            })}

            {mode === "admin" && (
              <div style={{ border: "1px dashed #ccc", padding: 12, borderRadius: 10 }}>
                <h4 style={{ marginTop: 0 }}>Add student</h4>
                <div style={{ display: "flex", gap: 8 }}>
                  <input ref={newStudentRef} placeholder="Student name" style={{ flex: 1, padding: 8, borderRadius: 8, border: "1px solid #ddd" }} />
                  <button className="btn primary" onClick={onAddStudent}>Add</button>
                </div>
              </div>
            )}
          </div>
        )}
      </div>
    </main>
  );
}
