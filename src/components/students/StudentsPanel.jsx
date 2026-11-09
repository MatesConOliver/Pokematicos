import React, { useMemo, useState } from "react";
import EmojiParty from "../common/EmojiParty";
import { todayISODate } from "../../utils/dateUtils";
import { isTodayInFloatWindows, computeEffectiveMultiplier } from "../../utils/floatWindowUtils";
import { ActivityCatalogueManager } from "../admin/ActivityCatalogueManager";
import { getCardDisplayImage } from "../../utils/cardImageUtils";

export default function StudentsPanel({
  activeClass,
  activeClassId,
  cards,
  flagConfig,
  classTotalPoints,
  filteredStudents,
  loadingStudents,
  mode,
  studentFilter,
  setStudentFilter,
  onAddStreak,
  onManageFlag,
  onManageStudent,
  onProfileStudent,
  onChangeStudentStreak,
  onQuickAddPoints,
  onPreviewCard,
  onAddStudent,
  newStudentRef,
  db,
  setActiveClassId,
  alertFn,
}) {
  const [showActivityCatalogue, setShowActivityCatalogue] = useState(false);
  const today = todayISODate();
  const cardsById = useMemo(() => new Map((cards || []).map((c) => [c.id, c])), [cards]);

  return (
    <main
      style={{
        border: "none",
        background: "transparent",
        padding: 0,
        minWidth: 0,
        height: "100%",
        minHeight: 0,
        display: "flex",
        flexDirection: "column",
        overflow: "hidden",
      }}
    >
      <div
        style={{
          display: "flex",
          justifyContent: "space-between",
          alignItems: "center",
          gap: 10,
          flexWrap: "wrap",
          flexShrink: 0,
          paddingBottom: 10,
        }}
      >
        <div style={{ display: "flex", alignItems: "center", gap: 10, minWidth: 0 }}>
          <button className="btn" onClick={() => setActiveClassId(null)} style={{ padding: "4px 8px", fontSize: 12 }}>
            ← Back
          </button>
          <h3 style={{ margin: 0 }}>
            <span className="column-title-pill">{activeClass?.name || "Select a class"}</span>
          </h3>
          {activeClassId && (
            <span className="chip">
              Total class pts: {classTotalPoints}
            </span>
          )}
        </div>

        <div style={{ display: "flex", alignItems: "center", gap: 8, flexWrap: "wrap" }}>
          {mode === "admin" && activeClassId && (
            <>
              <button className="btn" onClick={() => onAddStreak(activeClassId)}>Manage streaks</button>
              <button className="btn" onClick={onManageFlag}>🚩 Flag</button>
              <button className="btn" onClick={() => setShowActivityCatalogue(!showActivityCatalogue)}>📚 Activities</button>
            </>
          )}

          <input
            className="input"
            placeholder="Filter students..."
            name="studentNameFilter"
            autoComplete="off"
            value={studentFilter}
            onChange={(e) => setStudentFilter(e.target.value)}
            style={{
              padding: "7px 12px",
              fontSize: 13,
              borderRadius: 12,
              minWidth: 170,
              width: "auto",
            }}
          />
        </div>
      </div>

      {showActivityCatalogue && (
        <div style={{ marginBottom: 10, border: "1px solid #e5e7eb", borderRadius: 8, background: "#fafbfc", padding: 12, flexShrink: 0 }}>
          <ActivityCatalogueManager db={db} classId={activeClassId} alertFn={alertFn} />
        </div>
      )}

      <div
        style={{
          flex: "1 1 0",
          overflowY: "auto",
          minHeight: 0,
          paddingRight: 8,
          paddingBottom: 24,
          overscrollBehavior: "contain",
        }}
      >
        {!activeClassId ? (
          <div className="muted">Select a class first.</div>
        ) : loadingStudents ? (
          <div className="muted">Loading students...</div>
        ) : (
          <div style={{ display: "grid", gridTemplateColumns: "repeat(2, 1fr)", gap: 12 }}>
            {filteredStudents.map((student) => {
              const solidBg = student.profileColor || "#ffffff";
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
                    border: "1px solid #e2e8f0",
                    padding: "8px 12px 12px 12px",
                    borderRadius: 14,
                    background: solidBg,
                    boxShadow: "0 3px 12px rgba(15, 23, 42, 0.06)",
                    color: "#0f172a",
                    position: "relative",
                    overflow: "hidden",
                    transition: "all 180ms ease",
                    display: "flex",
                    flexDirection: "column",
                    gap: 6,
                    contentVisibility: "auto",
                    containIntrinsicSize: "0 180px",
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

                  {/* Header Row: Student Name and Current Points */}
                  <div style={{ display: "flex", justifyContent: "space-between", alignItems: "center", gap: 8 }}>
                    <div style={{ flex: 1, minWidth: 0 }}>
                      <div style={{ fontWeight: 800, fontSize: 16, display: "flex", alignItems: "center", gap: 6, flexWrap: "wrap", color: "#0f172a" }}>
                        <span>{displayName}</span>
                        {mode === "admin" && (
                          <button
                            className="btn"
                            onClick={() => onManageStudent(student.id)}
                            style={{ padding: "2px 7px", fontSize: 11 }}
                          >
                            Manage
                          </button>
                        )}
                        <button
                          className="btn"
                          onClick={() => onProfileStudent(student.id)}
                          style={{ padding: "2px 7px", fontSize: 11 }}
                        >
                          Profile
                        </button>
                      </div>
                    </div>

                    <div style={{ fontWeight: 800, color: "#0f172a", fontSize: 14, whiteSpace: "nowrap" }}>
                      {student.currentPoints || 0} pts
                    </div>
                  </div>

                  {/* Row 2: Streaks on the left, XP on the right (same Y level!) */}
                  <div style={{ display: "flex", justifyContent: "space-between", alignItems: "flex-start", gap: 8 }}>
                    <div style={{ flex: 1, minWidth: 0, fontSize: 12 }}>
                      {streakConfigs.length > 0 ? (
                        <div style={{ display: "flex", flexDirection: "column", gap: 3 }}>
                          {streakConfigs.map((cfg) => {
                            const streak = (student.streaks && student.streaks[cfg.id]) || { value: 0, lastUpdated: "" };
                            const emojiLine = streak.value > 0 ? (cfg.emoji || "").repeat(streak.value) : (
                              <span style={{ textDecoration: "line-through", opacity: 0.5 }}>{cfg.emoji}</span>
                            );
                            const date = streak.lastUpdated || "";
                            const isToday = date && date === today;

                            return (
                              <div key={cfg.id} style={{ display: "flex", alignItems: "center", gap: 6 }}>
                                <div style={{ display: "flex", alignItems: "center", flexWrap: "wrap", gap: 4 }}>
                                  {emojiLine}
                                  {date && (
                                    <span style={{ marginLeft: 2, color: isToday ? "#16a34a" : "#dc2626", fontWeight: 700, fontSize: 11 }}>
                                      {date}
                                    </span>
                                  )}
                                </div>
                                {mode === "admin" && (
                                  <button
                                    className="btn"
                                    style={{ padding: "1px 6px", fontSize: 11, lineHeight: "14px", borderRadius: 6 }}
                                    title="Add +1 to this streak"
                                    onClick={() => onChangeStudentStreak(activeClassId, student.id, cfg.id, +1, cfg)}
                                  >
                                    +1
                                  </button>
                                )}
                              </div>
                            );
                          })}
                        </div>
                      ) : (
                        <span className="muted" style={{ fontSize: 12 }}>No streaks</span>
                      )}
                    </div>

                    <div style={{ textAlign: "right", whiteSpace: "nowrap", flexShrink: 0 }}>
                      <div className="muted" style={{ fontSize: 12, fontWeight: 700, color: "#475569" }}>
                        XP: {student.xp || 0}
                      </div>
                      {(() => {
                        const effectiveMultiplier = computeEffectiveMultiplier(student, today);
                        return effectiveMultiplier !== 1 ? (
                          <div style={{ fontSize: 11, color: "#1d4ed8", fontWeight: 700 }}>
                            x{effectiveMultiplier}
                          </div>
                        ) : null;
                      })()}
                    </div>
                  </div>

                  {/* Admin Quick Add */}
                  {mode === "admin" && (
                    <div style={{ display: "flex", gap: 6, alignItems: "center", flexWrap: "wrap" }}>
                      <span className="pill">Quick add:</span>
                      {[1, 5, 10].map((amount) => (
                        <button
                          key={amount}
                          className="btn"
                          style={{ padding: "3px 8px", fontSize: 12 }}
                          onClick={() => onQuickAddPoints(activeClassId, student.id, amount)}
                        >
                          +{amount}
                        </button>
                      ))}
                    </div>
                  )}

                  {/* Cards Gallery: header removed per requirement 4, holo foil kept per requirement 5 */}
                  <div style={{ marginTop: 2, maxHeight: 155, overflowY: "auto", paddingRight: 6, display: "flex", gap: 8, flexWrap: "wrap", alignContent: "flex-start" }}>
                    {(() => {
                      const groups = new Map();
                      const studentFlagValue = student.flagValue || "A";
                      (student.cards || []).forEach((ownedCard) => {
                        const key = ownedCard.cardId || "unknown";
                        if (!groups.has(key)) {
                          const fullCard = cardsById.get(key);
                          const displayImageURL = fullCard ? getCardDisplayImage(fullCard, studentFlagValue) : (ownedCard.imageURL || "");
                          groups.set(key, { title: ownedCard.title || fullCard?.title || "—", imageURL: ownedCard.imageURL || "", displayImageURL, count: 0 });
                        }
                        groups.get(key).count += 1;
                      });

                      const groupedCards = Array.from(groups.entries()).map(([cardId, group]) => ({ cardId, ...group }));
                      // Requirement 6: Use displayImageURL so full preview displays flag-specific image
                      const ownedUniqueList = groupedCards.map((card) => ({ title: card.title, imageURL: card.displayImageURL || card.imageURL }));

                      return groupedCards.map((group, index) => (
                        <div
                          key={group.cardId}
                          className="card-thumb holo-foil-card"
                          style={{
                            width: 80,
                            height: 110,
                            border: "1px solid #e2e8f0",
                            borderRadius: 10,
                            overflow: "hidden",
                            cursor: "pointer",
                            position: "relative",
                            background: "#ffffff",
                            boxShadow: "0 2px 6px rgba(15, 23, 42, 0.08)",
                            contentVisibility: "auto",
                            containIntrinsicSize: "80px 110px",
                          }}
                          title={`${group.title} (Click to preview)`}
                          onClick={() => onPreviewCard({ ownedList: ownedUniqueList, ownedIndex: index, isLibraryCard: false })}
                        >
                          {group.displayImageURL ? (
                            <img
                              src={group.displayImageURL}
                              alt={group.title}
                              loading="lazy"
                              decoding="async"
                              style={{ width: "100%", height: "100%", objectFit: "cover" }}
                            />
                          ) : (
                            <div style={{ padding: 6, fontSize: 11, color: "#1e293b" }}>{group.title}</div>
                          )}
                          {group.count > 1 && (
                            <div
                              style={{
                                position: "absolute",
                                top: 5,
                                right: 5,
                                background: "rgba(15, 23, 42, 0.85)",
                                color: "white",
                                borderRadius: 999,
                                padding: "2px 6px",
                                fontSize: 10,
                                fontWeight: 900,
                              }}
                            >
                              ×{group.count}
                            </div>
                          )}
                        </div>
                      ));
                    })()}
                  </div>
                </div>
              );
            })}

            {mode === "admin" && (
              <div
                style={{
                  border: "1px dashed #cbd5e1",
                  background: "#ffffff",
                  padding: 14,
                  borderRadius: 14,
                  boxShadow: "0 2px 8px rgba(15, 23, 42, 0.05)",
                }}
              >
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
