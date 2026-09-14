import React, { useMemo, useState } from "react";

export default function ProfileModal({
  mode,
  student,
  onClose,
  onSave,
  onChangePin,
  onValidationError,
  pastelColors = [],
  giveableCards = [],
  allCards = [],
  rewards = [],
  onRedeemReward,
  myPendingRequests = [],
  onCreateRequest,
  onCancelRequest,
}) {
  const [activeTab, setActiveTab] = useState("requests"); // "requests" | "rewards" | "history" | "settings"

  // Profile customization state
  const [emojis, setEmojis] = useState(student.nameEmojis || "");
  const [color, setColor] = useState(student.profileColor || "");

  // PIN change state
  const [currentPin, setCurrentPin] = useState("");
  const [newPin, setNewPin] = useState("");
  const [newPinConfirm, setNewPinConfirm] = useState("");

  // Request creation state
  const [requestType, setRequestType] = useState("card"); // "card" | "points"
  const [requestCardId, setRequestCardId] = useState("");
  const [requestAmount, setRequestAmount] = useState("");
  const [requestNote, setRequestNote] = useState("");

  const displayName = `${student.name}${emojis ? " " + emojis : ""}`;
  const currentPoints = Number(student.currentPoints || 0);

  // Cards indexed for quick reward thumbnail/description lookup
  const cardsMap = useMemo(() => {
    const map = new Map();
    (allCards || []).forEach((c) => map.set(c.id, c));
    return map;
  }, [allCards]);

  const selectedCard = useMemo(
    () => giveableCards.find((c) => c.id === requestCardId) || null,
    [giveableCards, requestCardId]
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
            borderBottom: "1px solid #e5e7eb",
            background: color || "#f8fafc",
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
              <span className="pill" style={{ background: "#e0f2fe", color: "#0369a1", fontWeight: 700 }}>
                ⭐ {currentPoints} pts
              </span>
              <span className="pill" style={{ background: "#fef3c7", color: "#92400e", fontWeight: 700 }}>
                ✨ {student.xp || 0} XP
              </span>
              {typeof student.multiplier === "number" && student.multiplier !== 1 && (
                <span className="pill" style={{ background: "#ede9fe", color: "#6d28d9", fontWeight: 700 }}>
                  ⚡ x{student.multiplier}
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
            borderBottom: "1px solid #e5e7eb",
            background: "#ffffff",
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
            onClick={() => setActiveTab("history")}
            style={{
              borderBottomLeftRadius: 0,
              borderBottomRightRadius: 0,
              borderBottom: activeTab === "history" ? "3px solid #2563eb" : "3px solid transparent",
              background: activeTab === "history" ? "#eff6ff" : "transparent",
              color: activeTab === "history" ? "#1d4ed8" : "#4b5563",
              fontWeight: activeTab === "history" ? 700 : 500,
              padding: "8px 14px",
              fontSize: 13,
            }}
          >
            📜 History
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
                    {myPendingRequests.map((r) => (
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
                          <div style={{ display: "flex", alignItems: "center", gap: 8 }}>
                            <span style={{ fontWeight: 700, fontSize: 14 }}>
                              {r.type === "card" ? `🃏 ${r.cardTitle || r.cardId}` : `⭐ ${r.amount} pts`}
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
                    ))}
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
                    Request a Card or Points
                  </div>

                  {/* Type Selector Pills */}
                  <div style={{ display: "flex", gap: 8, marginBottom: 14 }}>
                    <button
                      type="button"
                      className="btn"
                      onClick={() => setRequestType("card")}
                      style={{
                        flex: 1,
                        padding: "10px",
                        fontWeight: 700,
                        background: requestType === "card" ? "#2563eb" : "#f3f4f6",
                        color: requestType === "card" ? "#ffffff" : "#374151",
                        border: "none",
                      }}
                    >
                      🃏 Request Card
                    </button>
                    <button
                      type="button"
                      className="btn"
                      onClick={() => setRequestType("points")}
                      style={{
                        flex: 1,
                        padding: "10px",
                        fontWeight: 700,
                        background: requestType === "points" ? "#2563eb" : "#f3f4f6",
                        color: requestType === "points" ? "#ffffff" : "#374151",
                        border: "none",
                      }}
                    >
                      ⭐ Request Points
                    </button>
                  </div>

                  {/* Card Selection Grid */}
                  {requestType === "card" && (
                    <div style={{ marginBottom: 14 }}>
                      <div className="muted" style={{ fontSize: 12, marginBottom: 8 }}>
                        Choose a card from the points category:
                      </div>

                      {giveableCards.length === 0 ? (
                        <div className="muted" style={{ padding: 12, textAlign: "center" }}>
                          No point cards available to request.
                        </div>
                      ) : (
                        <div
                          style={{
                            display: "grid",
                            gridTemplateColumns: "repeat(auto-fill, minmax(170px, 1fr))",
                            gap: 10,
                            maxHeight: 250,
                            overflowY: "auto",
                            padding: 4,
                            border: "1px solid #e5e7eb",
                            borderRadius: 10,
                            background: "#fafafa",
                          }}
                        >
                          {giveableCards.map((c) => {
                            const isSelected = requestCardId === c.id;
                            const img = c.lockedImageURL || c.imageURL || "";
                            return (
                              <div
                                key={c.id}
                                onClick={() => setRequestCardId(c.id)}
                                style={{
                                  border: isSelected ? "2px solid #2563eb" : "1px solid #e5e7eb",
                                  background: isSelected ? "#eff6ff" : "#ffffff",
                                  borderRadius: 10,
                                  padding: 8,
                                  cursor: "pointer",
                                  display: "flex",
                                  flexDirection: "column",
                                  gap: 6,
                                  transition: "all 0.15s ease",
                                }}
                              >
                                <div
                                  style={{
                                    width: "100%",
                                    height: 90,
                                    borderRadius: 6,
                                    background: "#f3f4f6",
                                    overflow: "hidden",
                                    display: "flex",
                                    alignItems: "center",
                                    justifyContent: "center",
                                  }}
                                >
                                  {img ? (
                                    <img
                                      src={img}
                                      alt={c.title}
                                      style={{ width: "100%", height: "100%", objectFit: "cover" }}
                                    />
                                  ) : (
                                    <span style={{ fontSize: 28 }}>🃏</span>
                                  )}
                                </div>
                                <div style={{ flex: 1 }}>
                                  <div style={{ fontWeight: 700, fontSize: 13, lineHeight: "1.2em" }}>
                                    {c.title}
                                  </div>
                                  <div style={{ display: "flex", alignItems: "center", gap: 4, marginTop: 4 }}>
                                    <span
                                      className="pill"
                                      style={{
                                        fontSize: 11,
                                        background: "#dbeafe",
                                        color: "#1e40af",
                                        fontWeight: 700,
                                        padding: "1px 6px",
                                      }}
                                    >
                                      +{c.points || 0} pts
                                    </span>
                                  </div>
                                  {c.description && (
                                    <div
                                      style={{
                                        fontSize: 11,
                                        color: "#6b7280",
                                        marginTop: 4,
                                        lineHeight: "1.3em",
                                        overflow: "hidden",
                                        textOverflow: "ellipsis",
                                        display: "-webkit-box",
                                        WebkitLineClamp: 2,
                                        WebkitBoxOrient: "vertical",
                                      }}
                                    >
                                      {c.description}
                                    </div>
                                  )}
                                </div>
                              </div>
                            );
                          })}
                        </div>
                      )}

                      {selectedCard && (
                        <div
                          style={{
                            marginTop: 10,
                            padding: 10,
                            borderRadius: 8,
                            background: "#f0fdf4",
                            border: "1px solid #bbf7d0",
                            fontSize: 12,
                            display: "flex",
                            alignItems: "center",
                            gap: 8,
                          }}
                        >
                          <span>Selected:</span>
                          <strong>{selectedCard.title}</strong>
                          <span className="pill">+{selectedCard.points || 0} pts</span>
                        </div>
                      )}
                    </div>
                  )}

                  {/* Points Input */}
                  {requestType === "points" && (
                    <div style={{ marginBottom: 14 }}>
                      <div className="muted" style={{ fontSize: 12, marginBottom: 6 }}>
                        Points amount:
                      </div>
                      <div style={{ display: "flex", gap: 8, alignItems: "center" }}>
                        <input
                          type="number"
                          min="1"
                          max="1000"
                          placeholder="e.g. 5"
                          value={requestAmount}
                          onChange={(e) => setRequestAmount(e.target.value)}
                          style={{
                            flex: 1,
                            padding: 10,
                            borderRadius: 10,
                            border: "1px solid #ddd",
                            fontSize: 15,
                          }}
                        />
                        <button type="button" className="btn" onClick={() => setRequestAmount("1")}>+1</button>
                        <button type="button" className="btn" onClick={() => setRequestAmount("5")}>+5</button>
                        <button type="button" className="btn" onClick={() => setRequestAmount("10")}>+10</button>
                      </div>
                    </div>
                  )}

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

                  <button
                    type="button"
                    className="btn primary"
                    style={{ width: "100%", padding: 12, fontSize: 14 }}
                    onClick={async () => {
                      if (requestType === "points") {
                        const amt = Number(requestAmount);
                        if (!amt || amt <= 0) {
                          if (onValidationError) onValidationError("Please enter a valid amount of points.");
                          return;
                        }
                      }
                      if (requestType === "card" && !requestCardId) {
                        if (onValidationError) onValidationError("Please select a card to request.");
                        return;
                      }

                      const ok = await onCreateRequest({
                        type: requestType,
                        amount: requestType === "points" ? Number(requestAmount) : undefined,
                        cardId: requestType === "card" ? requestCardId : undefined,
                        cardTitle: requestType === "card" ? selectedCard?.title : undefined,
                        note: requestNote,
                      });

                      if (ok) {
                        setRequestAmount("");
                        setRequestCardId("");
                        setRequestNote("");
                      }
                    }}
                  >
                    Send Request to Teacher
                  </button>
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
                    background: "#ecfdf5",
                    color: "#065f46",
                    padding: "4px 12px",
                    borderRadius: 999,
                    fontWeight: 700,
                    fontSize: 13,
                    border: "1px solid #a7f3d0",
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
                    const canAfford = currentPoints >= cost;
                    const linkedCard = r.cardId ? cardsMap.get(r.cardId) : null;
                    const cardImg = linkedCard?.imageURL || linkedCard?.lockedImageURL || "";
                    const desc = linkedCard?.description || r.description || "";

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
                            }}
                          >
                            {cardImg ? (
                              <img
                                src={cardImg}
                                alt={r.title}
                                style={{ width: "100%", height: "100%", objectFit: "cover" }}
                              />
                            ) : (
                              <span style={{ fontSize: 28 }}>🎁</span>
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
                                  background: canAfford ? "#fee2e2" : "#f3f4f6",
                                  color: canAfford ? "#991b1b" : "#6b7280",
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
                          {canAfford ? (
                            <button
                              type="button"
                              className="btn primary"
                              style={{ width: "100%", padding: "8px 12px", fontSize: 13, fontWeight: 700 }}
                              onClick={() => onRedeemReward && onRedeemReward(r.id)}
                            >
                              Redeem for {cost} pts
                            </button>
                          ) : (
                            <button
                              type="button"
                              className="btn"
                              disabled
                              style={{
                                width: "100%",
                                padding: "8px 12px",
                                fontSize: 12,
                                fontWeight: 600,
                                background: "#fef2f2",
                                color: "#b91c1c",
                                borderColor: "#fecaca",
                                cursor: "not-allowed",
                                opacity: 0.9,
                              }}
                            >
                              Need {cost - currentPoints} more pts
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

          {/* ================= TAB 3: HISTORY ================= */}
          {activeTab === "history" && (
            <div>
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
                Reward History
              </div>

              {(!student.rewardsHistory || student.rewardsHistory.length === 0) ? (
                <div style={{ textAlign: "center", padding: "30px", color: "#9ca3af", fontStyle: "italic" }}>
                  No rewards redeemed yet.
                </div>
              ) : (
                <div style={{ display: "flex", flexDirection: "column", gap: 8 }}>
                  {[...(student.rewardsHistory || [])]
                    .sort((a, b) => (b.date || "").localeCompare(a.date || ""))
                    .map((h) => {
                      const isGroup = h.type === "group" || h.mode === "group";
                      return (
                        <div
                          key={h.id || Math.random()}
                          style={{
                            background: "#ffffff",
                            border: "1px solid #e5e7eb",
                            borderRadius: 10,
                            padding: "10px 14px",
                            boxShadow: "0 1px 3px rgba(0,0,0,0.02)",
                            display: "flex",
                            flexDirection: "column",
                            gap: 4,
                          }}
                        >
                          <div style={{ display: "flex", justifyContent: "space-between", alignItems: "center" }}>
                            <div style={{ fontWeight: 700, color: "#111827", fontSize: 14 }}>
                              {h.title}
                            </div>
                            <div
                              style={{
                                background: "#fee2e2",
                                color: "#991b1b",
                                fontWeight: 800,
                                fontSize: 12,
                                padding: "2px 8px",
                                borderRadius: 999,
                              }}
                            >
                              -{h.cost}
                            </div>
                          </div>

                          <div style={{ display: "flex", alignItems: "center", gap: 8, fontSize: 11, color: "#6b7280" }}>
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
                          </div>

                          {isGroup && h.contributors && (
                            <div
                              style={{
                                marginTop: 6,
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
          )}

          {/* ================= TAB 4: SETTINGS & PIN ================= */}
          {activeTab === "settings" && (
            <div style={{ display: "flex", flexDirection: "column", gap: 20 }}>
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
        </div>
      </div>
    </div>
  );
}
