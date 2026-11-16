import React, { useEffect, useMemo, useState } from "react";
import { getCardDisplayImage } from "../../utils/cardImageUtils";
import { todayISODate } from "../../utils/dateUtils";
import { computeEffectiveMultiplier } from "../../utils/floatWindowUtils";
import { formatPoints } from "../../utils/helpers";
import { reconcileAndEnrichStudentHistory } from "../../services/rewardCodeService.js";

export default function StudentHistoryModal({
  student,
  onClose,
  db,
  classId,
  allCards = [],
  rewards = [],
  flagConfig,
}) {
  const [enrichedHistory, setEnrichedHistory] = useState(student?.rewardsHistory || []);

  useEffect(() => {
    setEnrichedHistory(student?.rewardsHistory || []);
    let isCancelled = false;
    if (!db || !classId || !student?.id) return () => {};

    reconcileAndEnrichStudentHistory({ db, classId, student })
      .then((history) => {
        if (!isCancelled && Array.isArray(history)) {
          setEnrichedHistory(history);
        }
      })
      .catch((err) => {
        console.error("Failed to reconcile history:", err);
      });

    return () => {
      isCancelled = true;
    };
  }, [db, classId, student]);

  const { cardsMap, cardByObtainedFrom, cardByTitle, rewardCardByRewardId, rewardCardByTitle } = useMemo(() => {
    const cMap = new Map();
    const byObtained = new Map();
    const byAnyTitle = new Map();
    const byTitle = new Map();

    (allCards || []).forEach((c) => {
      if (!c?.id) return;
      cMap.set(c.id, c);
      if (c.title) {
        const anyKey = String(c.title).trim().toLowerCase();
        if (anyKey && !byAnyTitle.has(anyKey)) byAnyTitle.set(anyKey, c);
        if ((c.category || "points") === "rewards" && !byTitle.has(anyKey)) {
          byTitle.set(anyKey, c);
        }
      }
    });

    (student?.cards || []).forEach((c) => {
      const id = c.cardId || c.id;
      if (id && !cMap.has(id)) {
        cMap.set(id, c);
      }
      if (c.obtainedFrom && !byObtained.has(c.obtainedFrom)) {
        byObtained.set(c.obtainedFrom, (c.cardId && cMap.get(c.cardId)) || c);
      }
    });

    const byRewardId = new Map();
    (rewards || []).forEach((r) => {
      if (!r?.cardId) return;
      const linked = cMap.get(r.cardId);
      if (!linked) return;
      if (r.id) byRewardId.set(r.id, linked);
      if (r.legacyRewardId) byRewardId.set(r.legacyRewardId, linked);
      if (r.title) {
        const key = String(r.title).trim().toLowerCase();
        if (key && !byTitle.has(key)) byTitle.set(key, linked);
      }
    });

    return {
      cardsMap: cMap,
      cardByObtainedFrom: byObtained,
      cardByTitle: byAnyTitle,
      rewardCardByRewardId: byRewardId,
      rewardCardByTitle: byTitle,
    };
  }, [allCards, rewards, student]);

  if (!student) return null;

  const displayName = `${student.name}${student.nameEmojis ? " " + student.nameEmojis : ""}`;
  const displayFlagValue = flagConfig ? (student.flagValue === "B" ? "B" : "A") : "A";
  const currentPoints = formatPoints(student.currentPoints);
  const effectiveMultiplier = computeEffectiveMultiplier(student, todayISODate());
  const color = student.profileColor || "";
  const historyList =
    enrichedHistory && enrichedHistory.length > 0
      ? enrichedHistory
      : student.rewardsHistory || [];

  return (
    <div className="modal-backdrop" onClick={onClose}>
      <div
        className="modal"
        onClick={(e) => e.stopPropagation()}
        style={{
          maxWidth: 640,
          width: "95%",
          height: 620,
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
            borderBottom: "1px solid rgba(255, 255, 255, 0.6)",
            background: color
              ? color.startsWith("#") && color.length === 7
                ? `${color}cc`
                : `color-mix(in srgb, ${color} 75%, rgba(255, 255, 255, 0.7))`
              : "rgba(248, 250, 252, 0.8)",
            display: "flex",
            justifyContent: "space-between",
            alignItems: "center",
            gap: 12,
            flexShrink: 0,
          }}
        >
          <div>
            <div style={{ display: "flex", alignItems: "center", gap: 8, flexWrap: "wrap" }}>
              <h3 style={{ margin: 0, fontSize: 18, fontWeight: 800 }}>{displayName}</h3>
              <span
                className="pill"
                style={{ background: "rgba(224, 242, 254, 0.85)", color: "#0369a1", fontWeight: 700 }}
              >
                ⭐ {currentPoints} pts
              </span>
              <span
                className="pill"
                style={{ background: "rgba(254, 243, 199, 0.85)", color: "#92400e", fontWeight: 700 }}
              >
                ✨ {student.xp || 0} XP
              </span>
              {effectiveMultiplier !== 1 && (
                <span
                  className="pill"
                  style={{ background: "rgba(237, 233, 254, 0.85)", color: "#6d28d9", fontWeight: 700 }}
                >
                  ⚡ x{effectiveMultiplier}
                </span>
              )}
            </div>
            <div className="muted" style={{ fontSize: 12, marginTop: 2 }}>
              📜 Reward &amp; Code History
            </div>
          </div>
          <button className="btn" onClick={onClose} style={{ padding: "6px 12px", fontSize: 13 }}>
            Close
          </button>
        </div>

        {/* Body */}
        <div style={{ padding: 20, overflowY: "auto", flex: 1 }}>
          <div
            style={{
              fontSize: 12,
              textTransform: "uppercase",
              letterSpacing: "0.5px",
              color: "#6b7280",
              fontWeight: 700,
              marginBottom: 12,
            }}
          >
            Reward &amp; Code History
          </div>

          {historyList.length === 0 ? (
            <div style={{ textAlign: "center", padding: "30px", color: "#9ca3af", fontStyle: "italic" }}>
              No rewards or codes redeemed yet.
            </div>
          ) : (
            <div style={{ display: "flex", flexDirection: "column", gap: 10 }}>
              {[...historyList]
                .sort((a, b) => {
                  const timeA = a.redeemedAt || (a.date ? new Date(a.date).getTime() : 0);
                  const timeB = b.redeemedAt || (b.date ? new Date(b.date).getTime() : 0);
                  return timeB - timeA;
                })
                .map((h, idx) => {
                  const isEvolution = h.type === "evolution";
                  const isGroup = h.type === "group" || h.mode === "group";
                  const isCode =
                    !isEvolution &&
                    Boolean(
                      h.isCodeRedemption ||
                        h.type === "achievement" ||
                        h.type === "achievement_card" ||
                        (h.obtainedFrom && String(h.obtainedFrom).startsWith("activity_")) ||
                        (!h.cost && (h.pointsAwarded !== undefined || h.source || h.sourceId))
                    );

                  const entryTitleKey = String(h.title || h.name || "").trim().toLowerCase();
                  const codeObtainedKey =
                    h.obtainedFrom ||
                    ((h.sourceId || h.source) && h.activityId
                      ? `activity_${h.sourceId || h.source}_${h.activityId}`
                      : "");
                  const codeCardTitleKey = String(h.cardTitle || "").trim().toLowerCase();

                  const linkedCard =
                    (h.evolutionCardId && cardsMap.get(h.evolutionCardId)) ||
                    (h.cardId && cardsMap.get(h.cardId)) ||
                    (isCode && codeObtainedKey && cardByObtainedFrom.get(codeObtainedKey)) ||
                    (isCode && codeCardTitleKey && cardByTitle.get(codeCardTitleKey)) ||
                    (!isEvolution &&
                      !isCode &&
                      h.rewardId &&
                      (cardsMap.get(h.rewardId) || rewardCardByRewardId.get(h.rewardId))) ||
                    (!isEvolution && !isCode && entryTitleKey && rewardCardByTitle.get(entryTitleKey)) ||
                    null;

                  const resolvedCardId =
                    h.evolutionCardId || h.cardId || linkedCard?.cardId || linkedCard?.id || null;
                  const cardImg = linkedCard
                    ? getCardDisplayImage(linkedCard, displayFlagValue, false) ||
                      linkedCard.imageURL ||
                      linkedCard.displayImageURL
                    : null;

                  return (
                    <div
                      key={h.id || `${resolvedCardId || "hist"}-${h.date || idx}`}
                      style={{
                        background: "#ffffff",
                        border: "1px solid #e5e7eb",
                        borderRadius: 12,
                        padding: "12px 14px",
                        boxShadow: "0 1px 3px rgba(0,0,0,0.03)",
                        display: "flex",
                        flexDirection: "column",
                        gap: 6,
                      }}
                    >
                      <div style={{ display: "flex", justifyContent: "space-between", alignItems: "center", gap: 10 }}>
                        <div style={{ display: "flex", alignItems: "center", gap: 10, minWidth: 0, flex: 1 }}>
                          {cardImg && (
                            <img
                              src={cardImg}
                              alt=""
                              style={{
                                width: 34,
                                height: 46,
                                objectFit: "cover",
                                borderRadius: 6,
                                flexShrink: 0,
                                border: "1px solid #e2e8f0",
                                boxShadow: "0 1px 3px rgba(0,0,0,0.08)",
                              }}
                            />
                          )}
                          <div style={{ minWidth: 0, flex: 1 }}>
                            <div style={{ fontWeight: 700, color: "#111827", fontSize: 14, wordBreak: "break-word" }}>
                              {isCode
                                ? h.activityName || h.title || h.name || "Activity"
                                : h.title || "Reward"}
                            </div>
                            <div
                              style={{
                                display: "flex",
                                alignItems: "center",
                                gap: 6,
                                fontSize: 11,
                                color: "#6b7280",
                                marginTop: 3,
                                flexWrap: "wrap",
                              }}
                            >
                              {isEvolution ? (
                                <span>{h.date ? new Date(h.date).toLocaleDateString() : "Unknown date"}</span>
                              ) : isCode ? (
                                <>
                                  <span
                                    style={{
                                      background: "#f1f5f9",
                                      color: "#334155",
                                      padding: "1px 7px",
                                      borderRadius: 4,
                                      fontWeight: 700,
                                    }}
                                  >
                                    Source: {h.source || h.sourceId || "Code"}
                                  </span>
                                  <span>•</span>
                                  <span>{h.date ? new Date(h.date).toLocaleDateString() : "Unknown date"}</span>
                                  {resolvedCardId && (
                                    <span style={{ color: "#0284c7", fontWeight: 600 }}>
                                      • 🃏 Card: {linkedCard?.title || h.cardTitle || resolvedCardId}
                                    </span>
                                  )}
                                </>
                              ) : (
                                <>
                                  <span>{h.date ? new Date(h.date).toLocaleDateString() : "Unknown date"}</span>
                                  {isGroup && (
                                    <span
                                      style={{
                                        background: "#e0f2fe",
                                        color: "#0369a1",
                                        padding: "1px 6px",
                                        borderRadius: 4,
                                        fontWeight: 600,
                                        fontSize: 10,
                                      }}
                                    >
                                      👥 GROUP
                                    </span>
                                  )}
                                  {resolvedCardId && (
                                    <span style={{ color: "#0284c7", fontWeight: 600 }}>
                                      • 🃏 Linked Card
                                    </span>
                                  )}
                                </>
                              )}
                            </div>
                          </div>
                        </div>

                        {isEvolution ? (
                          <div
                            style={{
                              background: "#f5f3ff",
                              color: "#6d28d9",
                              border: "1px solid #ddd6fe",
                              fontWeight: 800,
                              fontSize: 12,
                              padding: "3px 10px",
                              borderRadius: 999,
                              whiteSpace: "nowrap",
                              flexShrink: 0,
                            }}
                          >
                            🧬 Evolution
                          </div>
                        ) : isCode ? (
                          <div
                            style={{
                              background: "#dcfce7",
                              color: "#15803d",
                              border: "1px solid #bbf7d0",
                              fontWeight: 800,
                              fontSize: 12,
                              padding: "3px 10px",
                              borderRadius: 999,
                              whiteSpace: "nowrap",
                              flexShrink: 0,
                            }}
                          >
                            +{h.pointsAwarded ?? 0} pts
                          </div>
                        ) : (
                          <div
                            style={{
                              background: "#fee2e2",
                              color: "#991b1b",
                              border: "1px solid #fecaca",
                              fontWeight: 800,
                              fontSize: 12,
                              padding: "3px 10px",
                              borderRadius: 999,
                              whiteSpace: "nowrap",
                              flexShrink: 0,
                            }}
                          >
                            -{h.cost ?? 0} pts
                          </div>
                        )}
                      </div>

                      {!isEvolution && !isCode && isGroup && h.contributors && (
                        <div
                          style={{
                            marginTop: 4,
                            paddingTop: 6,
                            borderTop: "1px dashed #e5e7eb",
                            fontSize: 11,
                            color: "#4b5563",
                            lineHeight: "1.4em",
                          }}
                        >
                          <span style={{ fontWeight: 600 }}>Splitting with: </span>
                          {h.contributors
                            .filter((c) => c.name !== student.name)
                            .map((c) => `${c.name} (${c.cost})`)
                            .join(", ")}
                        </div>
                      )}
                    </div>
                  );
                })}
            </div>
          )}
        </div>
      </div>
    </div>
  );
}
