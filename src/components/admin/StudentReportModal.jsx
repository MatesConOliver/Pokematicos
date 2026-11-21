import React, { useEffect, useMemo, useState } from "react";
import { collection, getDocs } from "firebase/firestore";
import {
  REPORT_PERIODS,
  buildStudentActivityReport,
  filterReportTimelineByCard,
  formatDDMMYYYY,
} from "../../services/reportService";

export default function StudentReportModal({
  db,
  classesList = [],
  activeClassId = null,
  activeStudents = [],
  activeCards = [],
  onClose,
}) {
  const defaultClassId = activeClassId || classesList[0]?.id || "";
  const [selectedClassId, setSelectedClassId] = useState(defaultClassId);
  const [selectedStudentId, setSelectedStudentId] = useState("");
  const [period, setPeriod] = useState("week");
  const [cardFilter, setCardFilter] = useState("all");

  const todayStr = useMemo(() => formatDDMMYYYY(Date.now()), []);
  const weekAgoStr = useMemo(() => {
    const now = new Date();
    const start = new Date(now.getFullYear(), now.getMonth(), now.getDate() - 6);
    return formatDDMMYYYY(start.getTime());
  }, []);

  const [manualStart, setManualStart] = useState(weekAgoStr);
  const [manualEnd, setManualEnd] = useState(todayStr);

  // Cache class students & cards when switching to classes other than activeClassId
  const [classDataCache, setClassDataCache] = useState({});
  const [loadingClass, setLoadingClass] = useState(false);

  // Read-only cache of student achievements subcollection (retrocompatibility)
  const [achievementsByStudent, setAchievementsByStudent] = useState({});
  const [loadingAchievements, setLoadingAchievements] = useState(false);

  useEffect(() => {
    if (!selectedClassId || selectedClassId === activeClassId) return;
    if (classDataCache[selectedClassId]) return;

    let cancelled = false;
    setLoadingClass(true);

    Promise.all([
      getDocs(collection(db, `classes/${selectedClassId}/students`)),
      getDocs(collection(db, `classes/${selectedClassId}/cards`)),
    ])
      .then(([stuSnap, cardSnap]) => {
        if (cancelled) return;
        const studentsList = stuSnap.docs
          .map((d) => ({ id: d.id, ...d.data() }))
          .sort((a, b) => (a.name || "").localeCompare(b.name || ""));
        const cardsList = cardSnap.docs.map((d) => ({ id: d.id, ...d.data() }));
        setClassDataCache((prev) => ({
          ...prev,
          [selectedClassId]: { students: studentsList, cards: cardsList },
        }));
      })
      .catch((err) => {
        console.error("Failed loading class data for report:", err);
      })
      .finally(() => {
        if (!cancelled) setLoadingClass(false);
      });

    return () => {
      cancelled = true;
    };
  }, [db, selectedClassId, activeClassId, classDataCache]);

  const selectedClassObj = useMemo(
    () => classesList.find((c) => c.id === selectedClassId) || null,
    [classesList, selectedClassId]
  );

  const classStudents = useMemo(() => {
    if (!selectedClassId) return [];
    const list =
      selectedClassId === activeClassId
        ? activeStudents
        : classDataCache[selectedClassId]?.students || [];
    return [...list].sort((a, b) => (a.name || "").localeCompare(b.name || ""));
  }, [selectedClassId, activeClassId, activeStudents, classDataCache]);

  const classCards = useMemo(() => {
    if (!selectedClassId) return [];
    return selectedClassId === activeClassId
      ? activeCards
      : classDataCache[selectedClassId]?.cards || [];
  }, [selectedClassId, activeClassId, activeCards, classDataCache]);

  const selectedStudent = useMemo(
    () => classStudents.find((s) => s.id === selectedStudentId) || null,
    [classStudents, selectedStudentId]
  );

  useEffect(() => {
    if (!db || !selectedClassId || !selectedStudentId) return;
    const key = `${selectedClassId}:${selectedStudentId}`;
    if (achievementsByStudent[key]) return;

    let cancelled = false;
    setLoadingAchievements(true);

    getDocs(
      collection(db, `classes/${selectedClassId}/students/${selectedStudentId}/achievements`)
    )
      .then((snap) => {
        if (cancelled) return;
        const list = snap.docs.map((d) => ({ id: d.id, ...d.data() }));
        setAchievementsByStudent((prev) => ({ ...prev, [key]: list }));
      })
      .catch((err) => {
        console.error("Failed loading achievements for report:", err);
      })
      .finally(() => {
        if (!cancelled) setLoadingAchievements(false);
      });

    return () => {
      cancelled = true;
    };
  }, [db, selectedClassId, selectedStudentId, achievementsByStudent]);

  const studentAchievements = useMemo(() => {
    if (!selectedClassId || !selectedStudentId) return [];
    return achievementsByStudent[`${selectedClassId}:${selectedStudentId}`] || [];
  }, [achievementsByStudent, selectedClassId, selectedStudentId]);

  const report = useMemo(() => {
    if (!selectedStudent) return null;
    const flagValue =
      selectedClassObj?.flagConfig && selectedStudent.flagValue === "B" ? "B" : "A";
    return buildStudentActivityReport({
      student: selectedStudent,
      cards: classCards,
      achievements: studentAchievements,
      flagValue,
      period,
      manualStart,
      manualEnd,
    });
  }, [
    selectedStudent,
    selectedClassObj,
    classCards,
    studentAchievements,
    period,
    manualStart,
    manualEnd,
  ]);

  const effectiveCardFilter = useMemo(() => {
    if (cardFilter === "all") return "all";
    const exists = (report?.cardTotals || []).some((c) => c.key === cardFilter);
    return exists ? cardFilter : "all";
  }, [cardFilter, report]);

  const filteredTimeline = useMemo(
    () => filterReportTimelineByCard(report?.timeline || [], effectiveCardFilter),
    [report, effectiveCardFilter]
  );

  useEffect(() => {
    setCardFilter("all");
  }, [selectedClassId, selectedStudentId, period]);

  return (
    <div className="modal-backdrop" onClick={onClose}>
      <div
        className="modal"
        onClick={(e) => e.stopPropagation()}
        style={{
          maxWidth: 700,
          width: "95%",
          maxHeight: "90vh",
          display: "flex",
          flexDirection: "column",
          padding: 0,
          overflow: "hidden",
        }}
      >
        {/* Header */}
        <div
          style={{
            padding: "16px 20px",
            borderBottom: "1px solid #e2e8f0",
            background: "rgba(248, 250, 252, 0.9)",
            display: "flex",
            justifyContent: "space-between",
            alignItems: "center",
            gap: 12,
            flexShrink: 0,
          }}
        >
          <div>
            <h3 style={{ margin: 0, fontSize: 18, fontWeight: 800 }}>📊 Student Activity Report</h3>
            <div className="muted" style={{ fontSize: 12, marginTop: 2 }}>
              Cards received &amp; redeemed codes by period
            </div>
          </div>
          <button type="button" className="btn" onClick={onClose}>
            Close
          </button>
        </div>

        {/* Controls */}
        <div
          style={{
            padding: "14px 20px",
            borderBottom: "1px solid #e2e8f0",
            background: "#ffffff",
            display: "flex",
            flexDirection: "column",
            gap: 12,
            flexShrink: 0,
          }}
        >
          <div style={{ display: "grid", gridTemplateColumns: "repeat(auto-fit, minmax(210px, 1fr))", gap: 10 }}>
            <div>
              <label style={{ display: "block", fontSize: 12, fontWeight: 700, color: "#475569", marginBottom: 4 }}>
                1. Class
              </label>
              <select
                className="select"
                value={selectedClassId}
                onChange={(e) => {
                  setSelectedClassId(e.target.value);
                  setSelectedStudentId("");
                }}
              >
                {classesList.length === 0 && <option value="">No classes available</option>}
                {classesList.map((c) => (
                  <option key={c.id} value={c.id}>
                    {c.name}
                  </option>
                ))}
              </select>
            </div>

            <div>
              <label style={{ display: "block", fontSize: 12, fontWeight: 700, color: "#475569", marginBottom: 4 }}>
                2. Student
              </label>
              <select
                className="select"
                value={selectedStudentId}
                disabled={!selectedClassId || loadingClass}
                onChange={(e) => setSelectedStudentId(e.target.value)}
              >
                <option value="">
                  {loadingClass ? "Loading students..." : "-- Choose a student --"}
                </option>
                {classStudents.map((s) => (
                  <option key={s.id} value={s.id}>
                    {s.name}
                  </option>
                ))}
              </select>
            </div>
          </div>

          {selectedStudent && (
            <div>
              <label style={{ display: "block", fontSize: 12, fontWeight: 700, color: "#475569", marginBottom: 6 }}>
                3. Period
              </label>
              <div style={{ display: "flex", gap: 8, flexWrap: "wrap" }}>
                {REPORT_PERIODS.map((p) => {
                  const active = period === p.id;
                  return (
                    <button
                      key={p.id}
                      type="button"
                      className="btn"
                      onClick={() => setPeriod(p.id)}
                      style={{
                        background: active ? "#eff6ff" : "#ffffff",
                        border: active ? "1px solid #3b82f6" : "1px solid #cbd5e1",
                        color: active ? "#1d4ed8" : "#1e293b",
                        fontWeight: active ? 700 : 600,
                        fontSize: 13,
                        padding: "6px 12px",
                      }}
                    >
                      {p.label}
                    </button>
                  );
                })}
              </div>

              {period === "manual" && (
                <div
                  style={{
                    marginTop: 10,
                    display: "grid",
                    gridTemplateColumns: "repeat(auto-fit, minmax(170px, 1fr))",
                    gap: 10,
                  }}
                >
                  <div>
                    <label style={{ display: "block", fontSize: 11, fontWeight: 600, color: "#64748b", marginBottom: 3 }}>
                      Start date (dd/mm/yyyy)
                    </label>
                    <input
                      className="input"
                      type="text"
                      placeholder="dd/mm/yyyy"
                      value={manualStart}
                      onChange={(e) => setManualStart(e.target.value)}
                    />
                  </div>
                  <div>
                    <label style={{ display: "block", fontSize: 11, fontWeight: 600, color: "#64748b", marginBottom: 3 }}>
                      End date (dd/mm/yyyy)
                    </label>
                    <input
                      className="input"
                      type="text"
                      placeholder="dd/mm/yyyy"
                      value={manualEnd}
                      onChange={(e) => setManualEnd(e.target.value)}
                    />
                  </div>
                </div>
              )}
            </div>
          )}
        </div>

        {/* Report Body */}
        <div style={{ padding: 20, overflowY: "auto", flex: 1, background: "#f8fafc" }}>
          {!selectedStudent ? (
            <div style={{ textAlign: "center", padding: "36px 16px", color: "#64748b" }}>
              Select a class and a student above to view their activity report.
            </div>
          ) : !report || !report.valid ? (
            <div
              style={{
                padding: 14,
                borderRadius: 12,
                background: "#fef2f2",
                border: "1px solid #fecaca",
                color: "#b91c1c",
                fontWeight: 600,
                fontSize: 13,
              }}
            >
              {report?.error || "Enter a valid date range."}
            </div>
          ) : (
            <div style={{ display: "flex", flexDirection: "column", gap: 18 }}>
              {/* Summary banner */}
              <div
                style={{
                  background: "#ffffff",
                  border: "1px solid #e2e8f0",
                  borderRadius: 12,
                  padding: "12px 14px",
                  display: "flex",
                  justifyContent: "space-between",
                  alignItems: "center",
                  flexWrap: "wrap",
                  gap: 10,
                }}
              >
                <div>
                  <div style={{ fontWeight: 800, fontSize: 16, color: "#0f172a" }}>
                    {selectedStudent.name}
                  </div>
                  <div className="muted" style={{ fontSize: 12 }}>
                    {selectedClassObj?.name || ""} • {report.range.startLabel} – {report.range.endLabel}
                    {loadingAchievements ? " • Syncing codes..." : ""}
                  </div>
                </div>
                <div style={{ display: "flex", gap: 8, flexWrap: "wrap" }}>
                  <span
                    className="pill"
                    style={{ background: "#eff6ff", color: "#1d4ed8", fontWeight: 700 }}
                  >
                    🃏 {report.totalCardsReceived} {report.totalCardsReceived === 1 ? "card" : "cards"}
                  </span>
                  <span
                    className="pill"
                    style={{ background: "#dcfce7", color: "#15803d", fontWeight: 700 }}
                  >
                    🎟️ {report.totalCodesRedeemed} {report.totalCodesRedeemed === 1 ? "code" : "codes"}
                  </span>
                </div>
              </div>

              {/* 1. Total cards received of each kind (by individual card name) */}
              <div>
                <div
                  style={{
                    fontSize: 12,
                    textTransform: "uppercase",
                    letterSpacing: "0.5px",
                    color: "#475569",
                    fontWeight: 800,
                    marginBottom: 8,
                  }}
                >
                  Total cards received
                </div>
                {report.cardTotals.length === 0 ? (
                  <div
                    style={{
                      background: "#ffffff",
                      border: "1px solid #e2e8f0",
                      borderRadius: 12,
                      padding: 14,
                      color: "#64748b",
                      fontSize: 13,
                      fontStyle: "italic",
                    }}
                  >
                    No cards received in this period.
                  </div>
                ) : (
                  <div
                    style={{
                      display: "grid",
                      gridTemplateColumns: "repeat(auto-fill, minmax(200px, 1fr))",
                      gap: 8,
                    }}
                  >
                    {report.cardTotals.map((c) => (
                      <div
                        key={c.key}
                        style={{
                          background: "#ffffff",
                          border: "1px solid #e2e8f0",
                          borderRadius: 10,
                          padding: "8px 10px",
                          display: "flex",
                          alignItems: "center",
                          justifyContent: "space-between",
                          gap: 8,
                        }}
                      >
                        <div style={{ display: "flex", alignItems: "center", gap: 8, minWidth: 0 }}>
                          {c.imageURL ? (
                            <img
                              src={c.imageURL}
                              alt=""
                              style={{
                                width: 28,
                                height: 38,
                                objectFit: "cover",
                                borderRadius: 4,
                                border: "1px solid #e2e8f0",
                                flexShrink: 0,
                              }}
                            />
                          ) : (
                            <span style={{ fontSize: 18, flexShrink: 0 }}>🃏</span>
                          )}
                          <span
                            style={{
                              fontWeight: 700,
                              fontSize: 13,
                              color: "#0f172a",
                              overflow: "hidden",
                              textOverflow: "ellipsis",
                              whiteSpace: "nowrap",
                            }}
                            title={c.title}
                          >
                            {c.title}
                          </span>
                        </div>
                        <span
                          className="pill"
                          style={{
                            background: "#f1f5f9",
                            color: "#0f172a",
                            fontWeight: 800,
                            flexShrink: 0,
                          }}
                        >
                          ×{c.count}
                        </span>
                      </div>
                    ))}
                  </div>
                )}
              </div>

              {/* 2. Chronological timeline (newest -> oldest) with dd/mm */}
              <div>
                <div
                  style={{
                    display: "flex",
                    alignItems: "center",
                    justifyContent: "space-between",
                    gap: 10,
                    flexWrap: "wrap",
                    marginBottom: 8,
                  }}
                >
                  <div
                    style={{
                      fontSize: 12,
                      textTransform: "uppercase",
                      letterSpacing: "0.5px",
                      color: "#475569",
                      fontWeight: 800,
                    }}
                  >
                    Activity timeline (newest first)
                  </div>

                  {report.cardTotals.length > 0 && (
                    <label
                      style={{
                        display: "inline-flex",
                        alignItems: "center",
                        gap: 6,
                        fontSize: 12,
                        fontWeight: 700,
                        color: "#475569",
                      }}
                    >
                      <span>By card:</span>
                      <select
                        className="select"
                        aria-label="Filter activity timeline by card"
                        value={effectiveCardFilter}
                        onChange={(e) => setCardFilter(e.target.value)}
                        style={{
                          width: "auto",
                          maxWidth: 220,
                          padding: "4px 8px",
                          fontSize: 12,
                        }}
                      >
                        <option value="all">All cards</option>
                        {report.cardTotals.map((c) => (
                          <option key={c.key} value={c.key}>
                            {c.title} (×{c.count})
                          </option>
                        ))}
                      </select>
                    </label>
                  )}
                </div>
                {filteredTimeline.length === 0 ? (
                  <div
                    style={{
                      background: "#ffffff",
                      border: "1px solid #e2e8f0",
                      borderRadius: 12,
                      padding: 14,
                      color: "#64748b",
                      fontSize: 13,
                      fontStyle: "italic",
                    }}
                  >
                    {report.timeline.length === 0
                      ? "No cards received or codes redeemed in this period."
                      : "No timeline entries match the selected card."}
                  </div>
                ) : (
                  <div style={{ display: "flex", flexDirection: "column", gap: 8 }}>
                    {filteredTimeline.map((item) => (
                      <div
                        key={item.id}
                        style={{
                          background: "#ffffff",
                          border: "1px solid #e2e8f0",
                          borderRadius: 10,
                          padding: "10px 12px",
                          display: "flex",
                          alignItems: "center",
                          justifyContent: "space-between",
                          gap: 10,
                        }}
                      >
                        <div style={{ display: "flex", alignItems: "center", gap: 10, minWidth: 0, flex: 1 }}>
                          <span
                            className="pill"
                            style={{
                              background: "#f1f5f9",
                              color: "#334155",
                              fontWeight: 800,
                              fontSize: 12,
                              flexShrink: 0,
                            }}
                          >
                            {item.dayLabel}
                          </span>

                          {item.imageURL ? (
                            <img
                              src={item.imageURL}
                              alt=""
                              style={{
                                width: 30,
                                height: 40,
                                objectFit: "cover",
                                borderRadius: 5,
                                border: "1px solid #e2e8f0",
                                flexShrink: 0,
                              }}
                            />
                          ) : (
                            <span style={{ fontSize: 18, flexShrink: 0 }}>
                              {item.kind === "code" ? "🎟️" : "🃏"}
                            </span>
                          )}

                          <div style={{ minWidth: 0, flex: 1 }}>
                            <div style={{ fontWeight: 700, fontSize: 14, color: "#0f172a", wordBreak: "break-word" }}>
                              {item.title}
                            </div>
                            <div style={{ display: "flex", alignItems: "center", gap: 6, flexWrap: "wrap", fontSize: 11, color: "#64748b", marginTop: 2 }}>
                              {item.kind === "code" ? (
                                <>
                                  <span
                                    style={{
                                      background: "#eef2ff",
                                      color: "#3730a3",
                                      padding: "1px 6px",
                                      borderRadius: 4,
                                      fontWeight: 700,
                                    }}
                                  >
                                    Code · {item.sourceLabel}
                                  </span>
                                  {item.hasCard && item.cardTitle && (
                                    <span style={{ color: "#0284c7", fontWeight: 600 }}>
                                      • 🃏 {item.cardTitle}
                                    </span>
                                  )}
                                </>
                              ) : (
                                <span>{item.sourceLabel}</span>
                              )}
                            </div>
                          </div>
                        </div>

                        {item.kind === "code" ? (
                          Number(item.pointsAwarded || 0) !== 0 && (
                            <span
                              className="pill"
                              style={{
                                background: "#dcfce7",
                                color: "#15803d",
                                border: "1px solid #bbf7d0",
                                fontWeight: 800,
                                fontSize: 12,
                                flexShrink: 0,
                              }}
                            >
                              {item.pointsAwarded > 0 ? `+${item.pointsAwarded}` : item.pointsAwarded} pts
                            </span>
                          )
                        ) : (
                          Number(item.pointsGranted || 0) !== 0 && (
                            <span
                              className="pill"
                              style={{
                                background: item.pointsGranted > 0 ? "#dcfce7" : "#fee2e2",
                                color: item.pointsGranted > 0 ? "#15803d" : "#991b1b",
                                fontWeight: 800,
                                fontSize: 12,
                                flexShrink: 0,
                              }}
                            >
                              {item.pointsGranted > 0 ? `+${item.pointsGranted}` : item.pointsGranted} pts
                            </span>
                          )
                        )}
                      </div>
                    ))}
                  </div>
                )}
              </div>
            </div>
          )}
        </div>
      </div>
    </div>
  );
}
