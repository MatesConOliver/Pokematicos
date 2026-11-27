import React, { useEffect, useMemo, useState } from "react";
import { todayISODate, formatWeekdayMonthDayTime } from "../../utils/dateUtils";
import { computeEffectiveMultiplier } from "../../utils/floatWindowUtils";
import { getCardDisplayImage } from "../../utils/cardImageUtils";
import { PublicStudentIdDisplay } from "./PublicStudentIdDisplay";
import { RewardCodeRedemption } from "./RewardCodeRedemption";
import { round2, formatPoints } from "../../utils/helpers";
import {
  isEvolutionCard,
  checkEvolutionEligibility,
  isCardUnlockedForStudent,
} from "../../services/cardEvolutionService";
import {
  isComboCard,
  evaluateComboProgress,
  getComboPeriodLabel,
} from "../../services/cardComboService";

export default function ProfileModal({
  mode,
  student,
  onClose,
  onSave,
  flagConfig,
  onChangeFlagValue,
  onChangePin,
  onValidationError,
  db,
  classId,
  pastelColors = [],
  giveableCards = [],
  allCards = [],
  rewards = [],
  defaultCatalystCardId = "",
  onEvolve,
  onRedeemReward,
  myPendingRequests = [],
  onCreateRequest,
  onCancelRequest,
}) {
  const [activeTab, setActiveTab] = useState("requests"); // "requests" | "rewards" | "special" | "settings" | "redeem"

  // Profile customization state
  const [emojis, setEmojis] = useState(student.nameEmojis || "");
  const [color, setColor] = useState(student.profileColor || "");
  const [flagValue, setFlagValue] = useState(student.flagValue === "B" ? "B" : "A");
  const [savingFlagValue, setSavingFlagValue] = useState(false);

  useEffect(() => {
    setFlagValue(student.flagValue === "B" ? "B" : "A");
  }, [student.flagValue]);

  // PIN change state
  const [currentPin, setCurrentPin] = useState("");
  const [newPin, setNewPin] = useState("");
  const [newPinConfirm, setNewPinConfirm] = useState("");

  // Request creation state
  const [requestCardId, setRequestCardId] = useState("");
  const [requestAmount, setRequestAmount] = useState("");
  const [requestNote, setRequestNote] = useState("");

  const displayName = `${student.name}${emojis ? " " + emojis : ""}`;
  const displayFlagValue = flagConfig ? flagValue : "A";
  const currentPoints = formatPoints(student.currentPoints);
  const effectiveMultiplier = computeEffectiveMultiplier(student, todayISODate(), allCards);

  // Cards indexed for quick reward thumbnail/description lookup
  const cardsMap = useMemo(() => {
    const map = new Map();
    (allCards || []).forEach((c) => map.set(c.id, c));
    (student.cards || []).forEach((c) => {
      const id = c.cardId || c.id;
      if (id && !map.has(id)) {
        map.set(id, c);
      }
    });
    return map;
  }, [allCards, student.cards]);

  const selectedCard = useMemo(
    () => giveableCards.find((c) => c.id === requestCardId) || null,
    [giveableCards, requestCardId]
  );

  useEffect(() => {
    if (requestCardId && !giveableCards.some((c) => c.id === requestCardId)) {
      setRequestCardId("");
    }
  }, [giveableCards, requestCardId]);

  const pointsLibraryCards = useMemo(
    () => (allCards || []).filter((c) => (c.category || "points") === "points"),
    [allCards]
  );

  const evolutionCards = useMemo(
    () => pointsLibraryCards.filter((c) => isEvolutionCard(c)),
    [pointsLibraryCards]
  );

  const comboCards = useMemo(
    () => pointsLibraryCards.filter((c) => isComboCard(c)),
    [pointsLibraryCards]
  );

  const hasSpecialCards = evolutionCards.length > 0 || comboCards.length > 0;

  const comboProgressList = useMemo(() => {
    const items = comboCards.map((comboCard) => ({
      comboCard,
      progress: evaluateComboProgress({
        student,
        comboCard,
        allCards,
      }),
    }));
    // Show active/incomplete combos (sorted by highest progress first) above already-claimed ones
    return items.sort((a, b) => {
      if (a.progress.isAlreadyClaimed !== b.progress.isAlreadyClaimed) {
        return a.progress.isAlreadyClaimed ? 1 : -1;
      }
      return b.progress.progressRatio - a.progress.progressRatio;
    });
  }, [comboCards, student, allCards]);

  const defaultCatalystCard = useMemo(
    () => (defaultCatalystCardId ? cardsMap.get(defaultCatalystCardId) || null : null),
    [defaultCatalystCardId, cardsMap]
  );

  useEffect(() => {
    if (!hasSpecialCards && activeTab === "special") {
      setActiveTab("requests");
    }
  }, [hasSpecialCards, activeTab]);

  const readyToEvolveCount = useMemo(
    () =>
      evolutionCards.filter(
        (c) =>
          checkEvolutionEligibility({
            student,
            evolutionCard: c,
            catalystCardId: defaultCatalystCardId,
          }).canEvolve
      ).length,
    [evolutionCards, student, defaultCatalystCardId]
  );

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
              ? (color.startsWith("#") && color.length === 7
                  ? `${color}cc`
                  : `color-mix(in srgb, ${color} 75%, rgba(255, 255, 255, 0.7))`)
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
                style={{
                  background: currentPoints < 0 ? "rgba(254, 226, 226, 0.9)" : "rgba(224, 242, 254, 0.85)",
                  color: currentPoints < 0 ? "#b91c1c" : "#0369a1",
                  fontWeight: 700,
                }}
              >
                ⭐ {currentPoints} pts
              </span>
              <span className="pill" style={{ background: "rgba(254, 243, 199, 0.85)", color: "#92400e", fontWeight: 700 }}>
                ✨ {student.xp || 0} XP
              </span>
              {effectiveMultiplier !== 1 && (
                <span className="pill" style={{ background: "rgba(237, 233, 254, 0.85)", color: "#6d28d9", fontWeight: 700 }}>
                  ⚡ x{effectiveMultiplier}
                </span>
              )}
            </div>
            <div className="muted" style={{ fontSize: 12, marginTop: 2 }}>Student Profile</div>
          </div>
          <button className="btn" onClick={onClose} style={{ padding: "6px 12px", fontSize: 13 }}>
            Close
          </button>
        </div>

        {/* Tab Navigation */}
        <div
          style={{
            display: "flex",
            borderBottom: "1px solid rgba(255, 255, 255, 0.6)",
            background: "rgba(255, 255, 255, 0.65)",
            padding: "8px 16px 0 16px",
            gap: 6,
            overflowX: "auto",
            flexShrink: 0,
          }}
        >
          <button
            type="button"
            className="btn"
            onClick={() => setActiveTab("requests")}
            style={{
              borderBottomLeftRadius: 0,
              borderBottomRightRadius: 0,
              borderBottom: activeTab === "requests" ? "3px solid #2563eb" : "3px solid transparent",
              background: activeTab === "requests" ? "#eff6ff" : "transparent",
              color: activeTab === "requests" ? "#1d4ed8" : "#4b5563",
              fontWeight: activeTab === "requests" ? 700 : 500,
              padding: "8px 14px",
              fontSize: 13,
              display: "flex",
              alignItems: "center",
              gap: 6,
            }}
          >
            ✉️ Requests
            {myPendingRequests.length > 0 && (
              <span
                style={{
                  background: "#2563eb",
                  color: "#fff",
                  fontSize: 10,
                  borderRadius: 999,
                  padding: "1px 6px",
                  fontWeight: 700,
                }}
              >
                {myPendingRequests.length}
              </span>
            )}
          </button>

          <button
            type="button"
            className="btn"
            onClick={() => setActiveTab("rewards")}
            style={{
              borderBottomLeftRadius: 0,
              borderBottomRightRadius: 0,
              borderBottom: activeTab === "rewards" ? "3px solid #2563eb" : "3px solid transparent",
              background: activeTab === "rewards" ? "#eff6ff" : "transparent",
              color: activeTab === "rewards" ? "#1d4ed8" : "#4b5563",
              fontWeight: activeTab === "rewards" ? 700 : 500,
              padding: "8px 14px",
              fontSize: 13,
            }}
          >
            🎁 Rewards
          </button>

          <button
            type="button"
            className="btn"
            onClick={() => setActiveTab("settings")}
            style={{
              borderBottomLeftRadius: 0,
              borderBottomRightRadius: 0,
              borderBottom: activeTab === "settings" ? "3px solid #2563eb" : "3px solid transparent",
              background: activeTab === "settings" ? "#eff6ff" : "transparent",
              color: activeTab === "settings" ? "#1d4ed8" : "#4b5563",
              fontWeight: activeTab === "settings" ? 700 : 500,
              padding: "8px 14px",
              fontSize: 13,
            }}
          >
            ⚙️ Settings & PIN
          </button>

          {hasSpecialCards && (
            <button
              type="button"
              className="btn"
              onClick={() => setActiveTab("special")}
              style={{
                borderBottomLeftRadius: 0,
                borderBottomRightRadius: 0,
                borderBottom: activeTab === "special" ? "3px solid #7c3aed" : "3px solid transparent",
                background: activeTab === "special" ? "#f5f3ff" : "transparent",
                color: activeTab === "special" ? "#6d28d9" : "#4b5563",
                fontWeight: activeTab === "special" ? 700 : 500,
                padding: "8px 14px",
                fontSize: 13,
                display: "flex",
                alignItems: "center",
                gap: 6,
                whiteSpace: "nowrap",
              }}
            >
              ✨ Cartas especiales
              {readyToEvolveCount > 0 && (
                <span
                  style={{
                    background: "#7c3aed",
                    color: "#fff",
                    fontSize: 10,
                    borderRadius: 999,
                    padding: "1px 6px",
                    fontWeight: 800,
                  }}
                >
                  {readyToEvolveCount}
                </span>
              )}
            </button>
          )}

          <button
            type="button"
            className="btn"
            onClick={() => setActiveTab("redeem")}
            style={{
              borderBottomLeftRadius: 0,
              borderBottomRightRadius: 0,
              borderBottom: activeTab === "redeem" ? "3px solid #2563eb" : "3px solid transparent",
              background: activeTab === "redeem" ? "#eff6ff" : "transparent",
              color: activeTab === "redeem" ? "#1d4ed8" : "#4b5563",
              fontWeight: activeTab === "redeem" ? 700 : 500,
              padding: "8px 14px",
              fontSize: 13,
            }}
          >
            🏆 Redeem Code
          </button>
        </div>

        {/* Tab Content Body */}
        <div style={{ padding: 20, overflowY: "auto", flex: 1 }}>
          {/* ================= TAB 1: REQUESTS ================= */}
          {activeTab === "requests" && (
            <div>
              {/* Existing Pending Requests */}
              {myPendingRequests.length > 0 && (
                <div style={{ marginBottom: 20 }}>
                  <div
                    style={{
                      fontSize: 12,
                      textTransform: "uppercase",
                      letterSpacing: "0.5px",
                      color: "#6b7280",
                      fontWeight: 700,
                      marginBottom: 8,
                    }}
                  >
                    Your Pending Requests ({myPendingRequests.length}/3)
                  </div>
                  <div style={{ display: "flex", flexDirection: "column", gap: 8 }}>
                    {myPendingRequests.map((r) => {
                      const dateLabel = formatWeekdayMonthDayTime(r.createdAt);
                      return (
                      <div
                        key={r.id}
                        style={{
                          display: "flex",
                          justifyContent: "space-between",
                          alignItems: "center",
                          gap: 12,
                          background: "#f9fafb",
                          border: "1px solid #e5e7eb",
                          borderRadius: 10,
                          padding: "10px 14px",
                        }}
                      >
                        <div style={{ flex: 1 }}>
                          <div style={{ display: "flex", alignItems: "center", gap: 8, flexWrap: "wrap" }}>
                            <span style={{ fontWeight: 700, fontSize: 14 }}>
                              {r.type === "both" || (r.cardId && r.amount)
                                ? `🃏 ${r.cardTitle || r.cardId} + ⭐ ${r.amount} pts`
                                : r.cardId || r.type === "card"
                                  ? `🃏 ${r.cardTitle || r.cardId}`
                                  : `⭐ ${r.amount} pts`}
                            </span>
                            <span
                              style={{
                                background: "#fef3c7",
                                color: "#92400e",
                                fontSize: 11,
                                padding: "2px 8px",
                                borderRadius: 999,
                                fontWeight: 600,
                              }}
                            >
                              Pending teacher approval
                            </span>
                            {dateLabel && (
                              <span style={{ fontSize: 11, color: "#64748b", fontWeight: 600 }}>
                                {dateLabel}
                              </span>
                            )}
                          </div>
                          {r.note && (
                            <div style={{ fontSize: 12, color: "#6b7280", marginTop: 4, fontStyle: "italic" }}>
                              "{r.note}"
                            </div>
                          )}
                        </div>
                        {onCancelRequest && (
                          <button
                            type="button"
                            className="btn"
                            style={{ fontSize: 12, color: "#b91c1c", borderColor: "#fecaca" }}
                            onClick={() => onCancelRequest(r)}
                          >
                            Cancel
                          </button>
                        )}
                      </div>
                      );
                    })}
                  </div>
                </div>
              )}

              {/* Request Form */}
              {myPendingRequests.length >= 3 ? (
                <div
                  style={{
                    background: "#fef2f2",
                    border: "1px solid #fecaca",
                    color: "#991b1b",
                    padding: 14,
                    borderRadius: 10,
                    fontSize: 13,
                    textAlign: "center",
                  }}
                >
                  You already have 3 pending requests. Please wait for your teacher to review them.
                </div>
              ) : onCreateRequest ? (
                <div>
                  <div
                    style={{
                      fontSize: 12,
                      textTransform: "uppercase",
                      letterSpacing: "0.5px",
                      color: "#6b7280",
                      fontWeight: 700,
                      marginBottom: 10,
                    }}
                  >
                    Request a Card, Points, or Both
                  </div>

                  {/* Section 1: Card Selection */}
                  <div style={{ marginBottom: 14, border: "1px solid #e5e7eb", borderRadius: 12, padding: 12, background: "#ffffff" }}>
                    <div style={{ display: "flex", justifyContent: "space-between", alignItems: "center", marginBottom: 8 }}>
                      <div>
                        <span style={{ fontWeight: 800, fontSize: 13, color: "#1f2937" }}>
                          🃏 Request a Card
                        </span>
                        <span className="muted" style={{ fontSize: 12, marginLeft: 6 }}>
                          (optional)
                        </span>
                      </div>
                      {requestCardId && (
                        <button
                          type="button"
                          className="btn"
                          onClick={() => setRequestCardId("")}
                          style={{ padding: "2px 8px", fontSize: 11, color: "#dc2626" }}
                        >
                          ✕ Remove card
                        </button>
                      )}
                    </div>

                    {selectedCard && (
                      <div
                        style={{
                          marginBottom: 10,
                          padding: "8px 12px",
                          borderRadius: 8,
                          background: "#eff6ff",
                          border: "1px solid #bfdbfe",
                          fontSize: 12,
                          display: "flex",
                          alignItems: "center",
                          justifyContent: "space-between",
                          gap: 8,
                        }}
                      >
                        <div style={{ display: "flex", alignItems: "center", gap: 8 }}>
                          <span>Selected card:</span>
                          <strong>{selectedCard.title}</strong>
                          <span className="pill">+{selectedCard.points || 0} pts</span>
                        </div>
                      </div>
                    )}

                    {giveableCards.length === 0 ? (
                      <div className="muted" style={{ padding: 10, textAlign: "center", fontSize: 12 }}>
                        No point cards available to request.
                      </div>
                    ) : (
                      <div
                        style={{
                          display: "grid",
                          gridTemplateColumns: "repeat(auto-fill, minmax(150px, 1fr))",
                          gap: 10,
                          maxHeight: 180,
                          overflowY: "auto",
                          padding: 4,
                          border: "1px solid #f1f5f9",
                          borderRadius: 8,
                          background: "#f8fafc",
                        }}
                      >
                        {giveableCards.map((c) => {
                          const isEvo = isEvolutionCard(c);
                          const isUnlocked = isCardUnlockedForStudent(student, c);
                          const isSelected = isUnlocked && requestCardId === c.id;
                          const img = getCardDisplayImage(c, displayFlagValue, isEvo ? !isUnlocked : true);
                          return (
                            <div
                              key={c.id}
                              onClick={() => {
                                if (!isUnlocked) {
                                  if (onValidationError) {
                                    onValidationError("This evolution card is locked. Evolve it first!");
                                  }
                                  return;
                                }
                                setRequestCardId((prev) => (prev === c.id ? "" : c.id));
                              }}
                              style={{
                                border: isSelected ? "2px solid #2563eb" : "1px solid #e5e7eb",
                                background: isSelected ? "#eff6ff" : "#ffffff",
                                borderRadius: 8,
                                padding: 6,
                                cursor: isUnlocked ? "pointer" : "not-allowed",
                                opacity: isUnlocked ? 1 : 0.6,
                                display: "flex",
                                flexDirection: "column",
                                gap: 4,
                                transition: "all 0.15s ease",
                                position: "relative",
                              }}
                            >
                              <div
                                style={{
                                  width: "100%",
                                  height: 70,
                                  borderRadius: 6,
                                  background: "#f3f4f6",
                                  overflow: "hidden",
                                  display: "flex",
                                  alignItems: "center",
                                  justifyContent: "center",
                                  position: "relative",
                                }}
                              >
                                {img ? (
                                  <img
                                    src={img}
                                    alt={c.title}
                                    style={{
                                      width: "100%",
                                      height: "100%",
                                      objectFit: "cover",
                                      filter: isUnlocked ? "none" : "grayscale(0.7)",
                                    }}
                                  />
                                ) : (
                                  <span style={{ fontSize: 24 }}>🃏</span>
                                )}
                                {!isUnlocked && (
                                  <div
                                    style={{
                                      position: "absolute",
                                      inset: 0,
                                      background: "rgba(15, 23, 42, 0.35)",
                                      display: "flex",
                                      alignItems: "center",
                                      justifyContent: "center",
                                      fontSize: 16,
                                    }}
                                  >
                                    🔒
                                  </div>
                                )}
                              </div>
                              <div style={{ flex: 1, minWidth: 0 }}>
                                <div style={{ fontWeight: 700, fontSize: 12, lineHeight: "1.2em", overflow: "hidden", textOverflow: "ellipsis", whiteSpace: "nowrap" }}>
                                  {c.title}
                                </div>
                                <div style={{ marginTop: 2, display: "flex", gap: 4, flexWrap: "wrap", alignItems: "center" }}>
                                  <span
                                    className="pill"
                                    style={{
                                      fontSize: 10,
                                      background: isUnlocked ? "#dbeafe" : "#fee2e2",
                                      color: isUnlocked ? "#1e40af" : "#b91c1c",
                                      fontWeight: 700,
                                      padding: "1px 5px",
                                    }}
                                  >
                                    {isUnlocked ? `+${c.points || 0} pts` : "🔒 Evolution"}
                                  </span>
                                </div>
                              </div>
                            </div>
                          );
                        })}
                      </div>
                    )}
                  </div>

                  {/* Section 2: Points Request */}
                  <div style={{ marginBottom: 14, border: "1px solid #e5e7eb", borderRadius: 12, padding: 12, background: "#ffffff" }}>
                    <div style={{ display: "flex", justifyContent: "space-between", alignItems: "center", marginBottom: 8 }}>
                      <div>
                        <span style={{ fontWeight: 800, fontSize: 13, color: "#1f2937" }}>
                          ⭐ Request Points
                        </span>
                        <span className="muted" style={{ fontSize: 12, marginLeft: 6 }}>
                          (optional)
                        </span>
                      </div>
                      {requestAmount && (
                        <button
                          type="button"
                          className="btn"
                          onClick={() => setRequestAmount("")}
                          style={{ padding: "2px 8px", fontSize: 11, color: "#dc2626" }}
                        >
                          ✕ Clear points
                        </button>
                      )}
                    </div>
                    <div style={{ display: "flex", gap: 8, alignItems: "center" }}>
                      <input
                        type="number"
                        min="1"
                        max="1000"
                        placeholder="Points amount (e.g. 5)"
                        value={requestAmount}
                        onChange={(e) => setRequestAmount(e.target.value)}
                        style={{
                          flex: 1,
                          padding: 10,
                          borderRadius: 8,
                          border: "1px solid #ddd",
                          fontSize: 14,
                        }}
                      />
                      <button
                        type="button"
                        className="btn"
                        onClick={() => setRequestAmount(String((Number(requestAmount) || 0) + 1))}
                      >
                        +1
                      </button>
                      <button
                        type="button"
                        className="btn"
                        onClick={() => setRequestAmount(String((Number(requestAmount) || 0) + 5))}
                      >
                        +5
                      </button>
                      <button
                        type="button"
                        className="btn"
                        onClick={() => setRequestAmount(String((Number(requestAmount) || 0) + 10))}
                      >
                        +10
                      </button>
                    </div>
                  </div>

                  {/* Optional Note */}
                  <div style={{ marginBottom: 14 }}>
                    <div className="muted" style={{ fontSize: 12, marginBottom: 6 }}>
                      Reason or comment (optional):
                    </div>
                    <textarea
                      placeholder="Explain why you are requesting this..."
                      value={requestNote}
                      onChange={(e) => setRequestNote(e.target.value)}
                      rows={2}
                      style={{
                        width: "100%",
                        padding: 10,
                        borderRadius: 10,
                        border: "1px solid #ddd",
                        resize: "vertical",
                        fontSize: 13,
                      }}
                    />
                  </div>

                  {/* Submit Button */}
                  {(() => {
                    const parsedAmt = Number(requestAmount);
                    const hasValidPoints = parsedAmt > 0;
                    const hasCard = Boolean(requestCardId && selectedCard);

                    let label = "Send Request to Teacher";
                    if (hasCard && hasValidPoints) {
                      label = `Send Request (🃏 ${selectedCard.title} + ⭐ ${parsedAmt} pts)`;
                    } else if (hasCard) {
                      label = `Send Request (🃏 ${selectedCard.title})`;
                    } else if (hasValidPoints) {
                      label = `Send Request (⭐ ${parsedAmt} pts)`;
                    }

                    return (
                      <button
                        type="button"
                        className="btn primary"
                        style={{ width: "100%", padding: 12, fontSize: 14, fontWeight: 700 }}
                        onClick={async () => {
                          const amt = Number(requestAmount);
                          const hasPts = amt > 0;
                          const hasCd = Boolean(requestCardId && selectedCard);

                          if (!hasCd && !hasPts) {
                            if (onValidationError) {
                              onValidationError("Please select a card, enter points, or both.");
                            }
                            return;
                          }

                          if (requestAmount && amt <= 0) {
                            if (onValidationError) {
                              onValidationError("Please enter a valid amount of points (greater than 0).");
                            }
                            return;
                          }

                          const finalType = hasCd && hasPts ? "both" : hasCd ? "card" : "points";

                          const ok = await onCreateRequest({
                            type: finalType,
                            amount: hasPts ? amt : undefined,
                            cardId: hasCd ? requestCardId : undefined,
                            cardTitle: hasCd ? selectedCard?.title : undefined,
                            note: requestNote,
                          });

                          if (ok) {
                            setRequestAmount("");
                            setRequestCardId("");
                            setRequestNote("");
                          }
                        }}
                      >
                        {label}
                      </button>
                    );
                  })()}
                </div>
              ) : null}
            </div>
          )}

          {/* ================= TAB 2: REWARDS ================= */}
          {activeTab === "rewards" && (
            <div>
              <div
                style={{
                  display: "flex",
                  justifyContent: "space-between",
                  alignItems: "center",
                  marginBottom: 14,
                }}
              >
                <div>
                  <div
                    style={{
                      fontSize: 12,
                      textTransform: "uppercase",
                      letterSpacing: "0.5px",
                      color: "#6b7280",
                      fontWeight: 700,
                    }}
                  >
                    Available Rewards
                  </div>
                  <div className="muted" style={{ fontSize: 12 }}>
                    Redeem directly using your points (instant unlock)
                  </div>
                </div>
                <div
                  style={{
                    background: currentPoints < 0 ? "#fef2f2" : "#ecfdf5",
                    color: currentPoints < 0 ? "#b91c1c" : "#065f46",
                    padding: "4px 12px",
                    borderRadius: 999,
                    fontWeight: 700,
                    fontSize: 13,
                    border: currentPoints < 0 ? "1px solid #fecaca" : "1px solid #a7f3d0",
                  }}
                >
                  Balance: {currentPoints} pts
                </div>
              </div>

              {(!rewards || rewards.length === 0) ? (
                <div style={{ textAlign: "center", padding: "30px", color: "#9ca3af", fontStyle: "italic" }}>
                  No rewards created for this class yet.
                </div>
              ) : (
                <div style={{ display: "grid", gridTemplateColumns: "repeat(auto-fill, minmax(260px, 1fr))", gap: 12 }}>
                  {rewards.map((r) => {
                    const cost = Number(r.cost || 0);
                    const projectedBalance = round2(currentPoints - cost);
                    const goesNegative = projectedBalance < 0;
                    const isAdmin = mode === "admin";
                    const insufficientPoints = goesNegative && !isAdmin;
                    const missingPoints = round2(cost - currentPoints);
                    const linkedCard = r.cardId ? cardsMap.get(r.cardId) : null;
                    const evoUnlocked = !linkedCard || isCardUnlockedForStudent(student, linkedCard);
                    const cardImg = getCardDisplayImage(linkedCard, displayFlagValue, !evoUnlocked);
                    const desc = evoUnlocked ? (linkedCard?.description || r.description || "") : "";

                    return (
                      <div
                        key={r.id}
                        style={{
                          border: "1px solid #e5e7eb",
                          borderRadius: 12,
                          padding: 12,
                          background: "#ffffff",
                          boxShadow: "0 1px 3px rgba(0,0,0,0.03)",
                          display: "flex",
                          flexDirection: "column",
                          justifyContent: "space-between",
                          gap: 10,
                          opacity: evoUnlocked ? 1 : 0.72,
                        }}
                      >
                        <div style={{ display: "flex", gap: 10, alignItems: "flex-start" }}>
                          <div
                            style={{
                              width: 60,
                              height: 76,
                              borderRadius: 8,
                              background: "#f3f4f6",
                              overflow: "hidden",
                              flexShrink: 0,
                              display: "flex",
                              alignItems: "center",
                              justifyContent: "center",
                              position: "relative",
                            }}
                          >
                            {cardImg ? (
                              <img
                                src={cardImg}
                                alt={r.title}
                                style={{
                                  width: "100%",
                                  height: "100%",
                                  objectFit: "cover",
                                  filter: evoUnlocked ? "none" : "grayscale(0.7)",
                                }}
                              />
                            ) : (
                              <span style={{ fontSize: 28 }}>🎁</span>
                            )}
                            {!evoUnlocked && (
                              <div
                                style={{
                                  position: "absolute",
                                  inset: 0,
                                  background: "rgba(15, 23, 42, 0.35)",
                                  display: "flex",
                                  alignItems: "center",
                                  justifyContent: "center",
                                  fontSize: 16,
                                }}
                              >
                                🔒
                              </div>
                            )}
                          </div>
                          <div style={{ flex: 1, minWidth: 0 }}>
                            <div style={{ fontWeight: 800, fontSize: 14, color: "#111827", lineHeight: "1.2em" }}>
                              {r.title}
                            </div>
                            <div style={{ marginTop: 4 }}>
                              <span
                                className="pill"
                                style={{
                                  background: goesNegative ? "#fef2f2" : "#fee2e2",
                                  color: goesNegative ? "#b91c1c" : "#991b1b",
                                  fontWeight: 800,
                                  fontSize: 12,
                                }}
                              >
                                {cost} pts
                              </span>
                            </div>
                            {desc && (
                              <div
                                style={{
                                  fontSize: 11,
                                  color: "#6b7280",
                                  marginTop: 6,
                                  lineHeight: "1.3em",
                                }}
                              >
                                {desc}
                              </div>
                            )}
                          </div>
                        </div>

                        <div>
                          {!evoUnlocked ? (
                            <button
                              type="button"
                              className="btn"
                              disabled
                              style={{
                                width: "100%",
                                padding: "8px 12px",
                                fontSize: 12,
                                fontWeight: 700,
                                background: "#f5f3ff",
                                color: "#6d28d9",
                                borderColor: "#ddd6fe",
                                cursor: "not-allowed",
                              }}
                            >
                              🔒 Evolution locked
                            </button>
                          ) : insufficientPoints ? (
                            <button
                              type="button"
                              className="btn"
                              disabled
                              style={{
                                width: "100%",
                                padding: "8px 12px",
                                fontSize: 12,
                                fontWeight: 700,
                                background: "#f3f4f6",
                                color: "#6b7280",
                                borderColor: "#e5e7eb",
                                cursor: "not-allowed",
                              }}
                            >
                              Not enough points (need {missingPoints} more)
                            </button>
                          ) : (
                            <button
                              type="button"
                              className={goesNegative ? "btn" : "btn primary"}
                              style={{
                                width: "100%",
                                padding: "8px 12px",
                                fontSize: 13,
                                fontWeight: 700,
                                ...(goesNegative
                                  ? {
                                      background: "#fef2f2",
                                      color: "#b91c1c",
                                      borderColor: "#fecaca",
                                    }
                                  : {}),
                              }}
                              onClick={() => onRedeemReward && onRedeemReward(r.id)}
                            >
                              {goesNegative
                                ? `Admin redeem for ${cost} pts (→ ${projectedBalance} pts)`
                                : `Redeem for ${cost} pts`}
                            </button>
                          )}
                        </div>
                      </div>
                    );
                  })}
                </div>
              )}
            </div>
          )}

          {/* ================= TAB: CARTAS ESPECIALES (COMBOS + EVOLUTIONS) ================= */}
          {activeTab === "special" && hasSpecialCards && (
            <div style={{ display: "grid", gap: 22 }}>
              {comboProgressList.length > 0 && (
                <div>
                  <div style={{ marginBottom: 12 }}>
                    <div
                      style={{
                        fontSize: 12,
                        textTransform: "uppercase",
                        letterSpacing: "0.5px",
                        color: "#0f766e",
                        fontWeight: 800,
                      }}
                    >
                      ⏱️ Temporal Combos
                    </div>
                    <div className="muted" style={{ fontSize: 12 }}>
                      Collect all required cards within the same natural period to earn the combo card automatically
                      {effectiveMultiplier !== 1
                        ? ` (your x${effectiveMultiplier} multiplier applies to the points reward).`
                        : "."}
                    </div>
                  </div>

                  <div style={{ display: "grid", gap: 12 }}>
                    {comboProgressList.map(({ comboCard, progress }) => {
                      const isLockedComboEvo = Boolean(progress.evolutionLocked);
                      const isThumbnailLocked = !progress.isAlreadyClaimed || isLockedComboEvo;
                      const comboImg = getCardDisplayImage(
                        comboCard,
                        displayFlagValue,
                        isThumbnailLocked
                      );
                      const basePts = Number(comboCard.points || 0);
                      const multipliedPts = round2(basePts * effectiveMultiplier);
                      const pct = Math.round((progress.progressRatio || 0) * 100);

                      return (
                        <div
                          key={comboCard.id}
                          style={{
                            border: progress.isAlreadyClaimed
                              ? "1px solid #86efac"
                              : "1px solid #99f6e4",
                            borderRadius: 12,
                            padding: 12,
                            background: progress.isAlreadyClaimed ? "#f0fdf4" : "#ffffff",
                            display: "flex",
                            gap: 12,
                            alignItems: "center",
                          }}
                        >
                          <div
                            style={{
                              width: 66,
                              height: 88,
                              borderRadius: 8,
                              overflow: "hidden",
                              background: "#f3f4f6",
                              flexShrink: 0,
                              position: "relative",
                              border: "1px solid #e2e8f0",
                            }}
                          >
                            {comboImg ? (
                              <img
                                src={comboImg}
                                alt={comboCard.title}
                                style={{
                                  width: "100%",
                                  height: "100%",
                                  objectFit: "cover",
                                  filter: !isThumbnailLocked ? "none" : "grayscale(0.65)",
                                }}
                              />
                            ) : (
                              <div style={{ padding: 6, fontSize: 10 }}>{comboCard.title}</div>
                            )}
                            {isThumbnailLocked && (
                              <div
                                style={{
                                  position: "absolute",
                                  inset: 0,
                                  background: "rgba(15, 23, 42, 0.35)",
                                  display: "flex",
                                  alignItems: "center",
                                  justifyContent: "center",
                                  fontSize: 18,
                                }}
                              >
                                🔒
                              </div>
                            )}
                          </div>

                          <div style={{ flex: 1, minWidth: 0 }}>
                            <div style={{ display: "flex", alignItems: "center", gap: 6, flexWrap: "wrap" }}>
                              <span style={{ fontWeight: 800, fontSize: 15, color: "#111827" }}>
                                {comboCard.title}
                              </span>
                              <span
                                style={{
                                  fontSize: 11,
                                  padding: "2px 8px",
                                  borderRadius: 999,
                                  background: "#ccfbf1",
                                  color: "#0f766e",
                                  fontWeight: 700,
                                }}
                              >
                                ⏱️ {getComboPeriodLabel(progress.period)}
                              </span>
                              <span
                                style={{
                                  fontSize: 11,
                                  padding: "2px 8px",
                                  borderRadius: 999,
                                  background: "#e0f2fe",
                                  color: "#0369a1",
                                  fontWeight: 700,
                                }}
                              >
                                +{formatPoints(multipliedPts)} pts
                                {effectiveMultiplier !== 1 && basePts > 0
                                  ? ` (${formatPoints(basePts)} × ${effectiveMultiplier})`
                                  : ""}
                              </span>
                              {isLockedComboEvo && (
                                <span
                                  style={{
                                    fontSize: 11,
                                    padding: "2px 8px",
                                    borderRadius: 999,
                                    background: "#ede9fe",
                                    color: "#6d28d9",
                                    fontWeight: 700,
                                  }}
                                >
                                  🔒 Evolution locked
                                </span>
                              )}
                              {progress.isAlreadyClaimed ? (
                                <span
                                  style={{
                                    fontSize: 11,
                                    padding: "2px 8px",
                                    borderRadius: 999,
                                    background: "#dcfce7",
                                    color: "#166534",
                                    fontWeight: 700,
                                  }}
                                >
                                  ✅ Earned
                                  {progress.repeatMode === "once" ? " (One-time)" : " this period"}
                                </span>
                              ) : (
                                <span
                                  style={{
                                    fontSize: 11,
                                    padding: "2px 8px",
                                    borderRadius: 999,
                                    background: "#f1f5f9",
                                    color: "#475569",
                                    fontWeight: 700,
                                  }}
                                >
                                  {progress.repeatMode === "once" ? "One-time" : "Repeatable"}
                                </span>
                              )}
                            </div>

                            {comboCard.description && (!isLockedComboEvo || mode === "admin") && (
                              <div className="muted" style={{ fontSize: 12, marginTop: 4 }}>
                                {comboCard.description}
                              </div>
                            )}

                            {/* Visual progress bar */}
                            <div
                              style={{
                                marginTop: 6,
                                height: 6,
                                borderRadius: 999,
                                background: "#e2e8f0",
                                overflow: "hidden",
                              }}
                            >
                              <div
                                style={{
                                  width: `${pct}%`,
                                  height: "100%",
                                  background: progress.isAlreadyClaimed ? "#16a34a" : "#0d9488",
                                  transition: "width 0.25s ease",
                                }}
                              />
                            </div>

                            {/* Requirement progress chips */}
                            <div style={{ marginTop: 6, display: "flex", gap: 6, flexWrap: "wrap", alignItems: "center" }}>
                              {progress.requirementsProgress.map((req) => (
                                <span
                                  key={req.cardId}
                                  style={{
                                    fontSize: 11,
                                    padding: "2px 7px",
                                    borderRadius: 6,
                                    background: req.met || progress.isAlreadyClaimed ? "#dcfce7" : "#f1f5f9",
                                    color: req.met || progress.isAlreadyClaimed ? "#15803d" : "#475569",
                                    fontWeight: 700,
                                  }}
                                >
                                  🃏 {req.title}: {req.currentCount}/{req.requiredCount}
                                  {req.met ? " ✓" : ""}
                                </span>
                              ))}
                            </div>
                          </div>
                        </div>
                      );
                    })}
                  </div>
                </div>
              )}

              {evolutionCards.length > 0 && (
                <div>
                  <div style={{ marginBottom: 14 }}>
                    <div
                      style={{
                        fontSize: 12,
                        textTransform: "uppercase",
                        letterSpacing: "0.5px",
                        color: "#6b7280",
                        fontWeight: 700,
                      }}
                    >
                      🧬 Available Evolutions
                    </div>
                    <div className="muted" style={{ fontSize: 12 }}>
                      Collect the required copies of the base card and 1{" "}
                      <strong>{defaultCatalystCard?.title || "catalyst"}</strong> to unlock new forms.
                    </div>
                  </div>

              <div style={{ display: "grid", gap: 12 }}>
                {evolutionCards.map((evoCard) => {
                  const baseCard = cardsMap.get(evoCard.evolution?.baseCardId);
                  const catalystId = evoCard.evolution?.catalystCardId || defaultCatalystCardId;
                  const catalystCard = catalystId ? cardsMap.get(catalystId) : null;
                  const catalystLabel = catalystCard?.title || defaultCatalystCard?.title || "Catalyst";
                  const eligibility = checkEvolutionEligibility({
                    student,
                    evolutionCard: evoCard,
                    catalystCardId: defaultCatalystCardId,
                  });
                  const evoImg = getCardDisplayImage(evoCard, displayFlagValue, !eligibility.isAlreadyUnlocked);

                  return (
                    <div
                      key={evoCard.id}
                      style={{
                        border: eligibility.canEvolve
                          ? "2px solid #8b5cf6"
                          : eligibility.isAlreadyUnlocked
                          ? "1px solid #86efac"
                          : "1px solid #e5e7eb",
                        borderRadius: 12,
                        padding: 12,
                        background: eligibility.isAlreadyUnlocked ? "#f0fdf4" : "#ffffff",
                        display: "flex",
                        gap: 12,
                        alignItems: "center",
                      }}
                    >
                      <div
                        style={{
                          width: 66,
                          height: 88,
                          borderRadius: 8,
                          overflow: "hidden",
                          background: "#f3f4f6",
                          flexShrink: 0,
                          position: "relative",
                          border: "1px solid #e2e8f0",
                        }}
                      >
                        {evoImg ? (
                          <img
                            src={evoImg}
                            alt={evoCard.title}
                            style={{
                              width: "100%",
                              height: "100%",
                              objectFit: "cover",
                              filter: eligibility.isAlreadyUnlocked ? "none" : "grayscale(0.65)",
                            }}
                          />
                        ) : (
                          <div style={{ padding: 6, fontSize: 10 }}>{evoCard.title}</div>
                        )}
                        {!eligibility.isAlreadyUnlocked && (
                          <div
                            style={{
                              position: "absolute",
                              inset: 0,
                              background: "rgba(15, 23, 42, 0.35)",
                              display: "flex",
                              alignItems: "center",
                              justifyContent: "center",
                              fontSize: 18,
                            }}
                          >
                            🔒
                          </div>
                        )}
                      </div>

                      <div style={{ flex: 1, minWidth: 0 }}>
                        <div style={{ display: "flex", alignItems: "center", gap: 6, flexWrap: "wrap" }}>
                          <span style={{ fontWeight: 800, fontSize: 15, color: "#111827" }}>
                            {evoCard.title}
                          </span>
                          {eligibility.isAlreadyUnlocked ? (
                            <span
                              style={{
                                fontSize: 11,
                                padding: "2px 8px",
                                borderRadius: 999,
                                background: "#dcfce7",
                                color: "#166534",
                                fontWeight: 700,
                              }}
                            >
                              ✅ Unlocked
                            </span>
                          ) : (
                            <span
                              style={{
                                fontSize: 11,
                                padding: "2px 8px",
                                borderRadius: 999,
                                background: "#ede9fe",
                                color: "#6d28d9",
                                fontWeight: 700,
                              }}
                            >
                              🧬 From {baseCard?.title || "Base Card"}
                            </span>
                          )}
                        </div>

                        <div style={{ marginTop: 6, display: "flex", gap: 6, flexWrap: "wrap", alignItems: "center" }}>
                          <span
                            style={{
                              fontSize: 11,
                              padding: "2px 7px",
                              borderRadius: 6,
                              background: eligibility.hasCopies ? "#dcfce7" : "#f1f5f9",
                              color: eligibility.hasCopies ? "#15803d" : "#475569",
                              fontWeight: 700,
                            }}
                          >
                            🃏 {baseCard?.title || "Base"}: {eligibility.currentCopies}/{eligibility.requiredCopies}
                          </span>

                          <span
                            style={{
                              fontSize: 11,
                              padding: "2px 7px",
                              borderRadius: 6,
                              background: eligibility.hasCatalyst ? "#e0e7ff" : "#fef2f2",
                              color: eligibility.hasCatalyst ? "#4338ca" : "#b91c1c",
                              fontWeight: 700,
                            }}
                          >
                            🔮 {catalystLabel}:{" "}
                            {eligibility.missingCatalystConfig
                              ? "Not configured"
                              : eligibility.hasCatalyst
                              ? `${eligibility.catalystCount} owned ✓`
                              : "Missing"}
                          </span>
                        </div>

                        {eligibility.canEvolve && (
                          <button
                            type="button"
                            className="btn"
                            onClick={() => onEvolve?.(evoCard)}
                            style={{
                              marginTop: 8,
                              padding: "6px 14px",
                              fontSize: 12,
                              fontWeight: 800,
                              background: "linear-gradient(135deg, #8b5cf6, #ec4899)",
                              color: "#ffffff",
                              border: "none",
                              borderRadius: 999,
                              boxShadow: "0 2px 8px rgba(139, 92, 246, 0.4)",
                              cursor: "pointer",
                            }}
                          >
                            ✨ Evolve now! (Uses 1 {catalystLabel})
                          </button>
                        )}
                      </div>
                    </div>
                  );
                })}
                  </div>
                </div>
              )}
            </div>
          )}

          {/* ================= TAB 3: SETTINGS & PIN ================= */}
          {activeTab === "settings" && (
            <div style={{ display: "flex", flexDirection: "column", gap: 20 }}>
              <PublicStudentIdDisplay studentId={student.id} />
              {flagConfig && (
                <div style={{ border: "1px solid #e5e7eb", borderRadius: 12, padding: 14, background: "#ffffff" }}>
                  <div
                    style={{
                      fontSize: 12,
                      textTransform: "uppercase",
                      letterSpacing: "0.5px",
                      color: "#6b7280",
                      fontWeight: 700,
                      marginBottom: 8,
                    }}
                  >
                    {flagConfig.label} preference
                  </div>
                  <div className="muted" style={{ fontSize: 12, marginBottom: 10 }}>
                    Choose which card artwork and class background you see.
                  </div>
                  <div role="group" aria-label={`${flagConfig.label} preference`} style={{ display: "flex", gap: 8 }}>
                    {[["A", flagConfig.optionA], ["B", flagConfig.optionB]].map(([value, label]) => (
                      <button
                        key={value}
                        type="button"
                        className="btn"
                        aria-pressed={flagValue === value}
                        disabled={savingFlagValue || !onChangeFlagValue}
                        onClick={async () => {
                          if (value === flagValue) return;
                          setFlagValue(value);
                          setSavingFlagValue(true);
                          try {
                            const result = await onChangeFlagValue(value);
                            if (result === false) setFlagValue(student.flagValue === "B" ? "B" : "A");
                          } catch (error) {
                            setFlagValue(student.flagValue === "B" ? "B" : "A");
                            throw error;
                          } finally {
                            setSavingFlagValue(false);
                          }
                        }}
                        style={{
                          flex: 1,
                          background: flagValue === value ? "#def" : "white",
                          borderColor: flagValue === value ? "#93c5fd" : undefined,
                        }}
                      >
                        {label}{value === "A" ? " (Default)" : ""}
                      </button>
                    ))}
                  </div>
                </div>
              )}

              {/* Profile Customization */}
              <div style={{ border: "1px solid #e5e7eb", borderRadius: 12, padding: 14, background: "#ffffff" }}>
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
                  Personalization
                </div>

                <div style={{ marginBottom: 12 }}>
                  <div className="muted" style={{ fontSize: 12, marginBottom: 6 }}>
                    Emojis for your name (does not change your real name)
                  </div>
                  <input
                    value={emojis}
                    onChange={(e) => setEmojis(e.target.value)}
                    placeholder="e.g. ✨😺🔥"
                    style={{ width: "100%", padding: 10, borderRadius: 10, border: "1px solid #ddd" }}
                  />
                </div>

                <div style={{ marginBottom: 14 }}>
                  <div className="muted" style={{ fontSize: 12, marginBottom: 6 }}>
                    Background pastel color
                  </div>
                  <div style={{ display: "flex", gap: 8, flexWrap: "wrap", alignItems: "center" }}>
                    {pastelColors.map((c) => (
                      <button
                        key={c.value}
                        type="button"
                        className="btn"
                        onClick={() => setColor(c.value)}
                        style={{
                          width: 38,
                          height: 38,
                          borderRadius: 10,
                          background: c.value,
                          border: color === c.value ? "2px solid #111" : "1px solid #ddd",
                        }}
                        title={c.name}
                      />
                    ))}
                    <button type="button" className="btn" onClick={() => setColor("")}>
                      Clear
                    </button>
                  </div>
                </div>

                <button
                  type="button"
                  className="btn primary"
                  onClick={() => onSave({ nameEmojis: emojis, profileColor: color })}
                >
                  Save Personalization
                </button>
              </div>

              {/* Change PIN */}
              {onChangePin && (
                <div style={{ border: "1px solid #e5e7eb", borderRadius: 12, padding: 14, background: "#ffffff" }}>
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
                    Change 4-Digit PIN
                  </div>

                  <div style={{ display: "grid", gap: 10, maxWidth: 300 }}>
                    <div>
                      <div className="muted" style={{ fontSize: 12, marginBottom: 4 }}>
                        Current PIN
                      </div>
                      <input
                        type="text"
                        name="studentPinCurrent"
                        autoComplete="off"
                        inputMode="numeric"
                        maxLength={4}
                        placeholder="••••"
                        value={currentPin}
                        onChange={(e) => setCurrentPin(e.target.value.replace(/\D/g, "").slice(0, 4))}
                        style={{
                          width: "100%",
                          padding: 10,
                          borderRadius: 10,
                          border: "1px solid #ddd",
                          WebkitTextSecurity: "disc",
                          letterSpacing: 4,
                        }}
                      />
                    </div>

                    <div>
                      <div className="muted" style={{ fontSize: 12, marginBottom: 4 }}>
                        New PIN (4 digits)
                      </div>
                      <input
                        type="text"
                        name="studentPinNew"
                        autoComplete="off"
                        inputMode="numeric"
                        maxLength={4}
                        placeholder="••••"
                        value={newPin}
                        onChange={(e) => setNewPin(e.target.value.replace(/\D/g, "").slice(0, 4))}
                        style={{
                          width: "100%",
                          padding: 10,
                          borderRadius: 10,
                          border: "1px solid #ddd",
                          WebkitTextSecurity: "disc",
                          letterSpacing: 4,
                        }}
                      />
                    </div>

                    <div>
                      <div className="muted" style={{ fontSize: 12, marginBottom: 4 }}>
                        Confirm New PIN
                      </div>
                      <input
                        type="text"
                        name="studentPinNewConfirm"
                        autoComplete="off"
                        inputMode="numeric"
                        maxLength={4}
                        placeholder="••••"
                        value={newPinConfirm}
                        onChange={(e) => setNewPinConfirm(e.target.value.replace(/\D/g, "").slice(0, 4))}
                        style={{
                          width: "100%",
                          padding: 10,
                          borderRadius: 10,
                          border: "1px solid #ddd",
                          WebkitTextSecurity: "disc",
                          letterSpacing: 4,
                        }}
                      />
                    </div>

                    <button
                      type="button"
                      className="btn"
                      onClick={async () => {
                        if (newPin.length !== 4 || newPin !== newPinConfirm) {
                          if (onValidationError) onValidationError("New PIN must have 4 digits and match.");
                          return;
                        }
                        const ok = await onChangePin(currentPin, newPin);
                        if (ok) {
                          setCurrentPin("");
                          setNewPin("");
                          setNewPinConfirm("");
                        }
                      }}
                    >
                      Update PIN
                    </button>
                  </div>
                </div>
              )}
            </div>
          )}

          {activeTab === "redeem" && (
            <div>
              <RewardCodeRedemption
                db={db}
                classId={classId}
                studentId={student.id}
                allCards={allCards}
                onSuccess={(achievement) => {
                  const comboNames = Array.isArray(achievement?.comboCards) && achievement.comboCards.length > 0
                    ? achievement.comboCards.map((c) => `"${c.title}"`).join(", ")
                    : "";
                  onValidationError(
                    comboNames
                      ? `Achievement redeemed + Combo unlocked: ${comboNames}! ✨`
                      : "Achievement redeemed successfully! ✨"
                  );
                }}
              />
            </div>
          )}
        </div>
      </div>
    </div>
  );
}
