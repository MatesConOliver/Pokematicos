import React, { useState } from "react";
import CardCreateForm from "./CardCreateForm";
import LibraryCardRow from "./LibraryCardRow";
import RewardCreateForm from "../rewards/RewardCreateForm";

export default function CardLibrary({
  mode,
  cards,
  rewards,
  loadingCards,
  loadingRewards,
  streakConfigs,
  lockedInputRef,
  unlockedInputRef,
  lockedInputBRef,
  unlockedInputBRef,
  flagConfig,
  viewFlag = "A",
  onChangeViewFlag,
  onCreateCard,
  onPreviewCard,
  onOpenBulkGive,
  onEditCard,
  onDeleteCard,
  onCreateReward,
  onDeleteReward,
  onValidationError,
}) {
  const [libraryTab, setLibraryTab] = useState("points");
  const effectivePreviewFlag = flagConfig ? viewFlag : "A";

  return (
    <aside style={{ border: "none", background: "transparent", padding: 0 }}>
      <div
        style={{
          display: "flex",
          alignItems: "center",
          gap: 10,
          margin: "0 0 10px",
          flexWrap: "wrap",
        }}
      >
        <h3 style={{ margin: 0, display: "inline-flex", alignItems: "center" }}>
          <span className="column-title-pill">Library</span>
        </h3>
        {flagConfig && (
          <div
            role="group"
            aria-label="Library and background option"
            style={{ display: "inline-flex", gap: 6, alignItems: "center" }}
          >
            {[["A", flagConfig.optionA], ["B", flagConfig.optionB]].map(([value, label]) => (
              <button
                key={value}
                type="button"
                className="btn"
                aria-pressed={viewFlag === value}
                onClick={() => onChangeViewFlag?.(value)}
                style={{
                  background: viewFlag === value ? "#dbeafe" : "#ffffff",
                  border: viewFlag === value ? "1px solid #93c5fd" : "1px solid #e2e8f0",
                  fontWeight: viewFlag === value ? 700 : 500,
                  fontSize: 13,
                  padding: "4px 10px",
                  boxShadow: "0 1px 3px rgba(15, 23, 42, 0.05)",
                }}
              >
                {label}
              </button>
            ))}
          </div>
        )}
      </div>

      <div
        style={{
          display: "grid",
          gridTemplateColumns: "repeat(auto-fit, minmax(110px, 1fr))",
          gap: 6,
          margin: "8px 0 12px",
        }}
      >
        {["points", "rewards", "experience", "extra"].map((tab) => {
          const isActive = libraryTab === tab;
          const label = tab.charAt(0).toUpperCase() + tab.slice(1);
          return (
            <button
              key={tab}
              className="btn"
              onClick={() => setLibraryTab(tab)}
              style={{
                width: "100%",
                background: isActive ? "#eff6ff" : "#ffffff",
                border: isActive ? "1px solid #93c5fd" : "1px solid #e2e8f0",
                color: isActive ? "#1d4ed8" : "#1e293b",
                fontWeight: isActive ? 700 : 600,
                boxShadow: "0 2px 6px rgba(15, 23, 42, 0.05)",
              }}
            >
              {label}
            </button>
          );
        })}
      </div>

      {mode === "admin" && (
        <div
          style={{
            border: "1px dashed #cbd5e1",
            background: "#ffffff",
            padding: 12,
            borderRadius: 12,
            marginBottom: 12,
            boxShadow: "0 2px 8px rgba(15, 23, 42, 0.05)",
          }}
        >
          <h4 style={{ marginTop: 0 }}>Create new card</h4>
          <CardCreateForm
            onCreate={onCreateCard}
            lockedInputRef={lockedInputRef}
            unlockedInputRef={unlockedInputRef}
            lockedInputBRef={lockedInputBRef}
            unlockedInputBRef={unlockedInputBRef}
            flagConfig={flagConfig}
            streakConfigs={streakConfigs}
            onValidationError={onValidationError}
          />
        </div>
      )}

      <div style={{ maxHeight: 560, overflow: "auto" }}>
        {libraryTab !== "rewards" ? (
          <div style={{ display: "grid" }}>
            {loadingCards ? (
              <div className="muted">Loading cards...</div>
            ) : (
              cards
                .filter((card) => (card.category || "points") === libraryTab)
                .map((card) => (
                  <LibraryCardRow
                    key={card.id}
                    c={card}
                    mode={mode}
                    flagValue={effectivePreviewFlag}
                    onPreview={() => onPreviewCard(card, effectivePreviewFlag)}
                    onGive={() => onOpenBulkGive(card)}
                    onEdit={() => onEditCard(card)}
                    onDelete={() => onDeleteCard(card.id)}
                  />
                ))
            )}
          </div>
        ) : (
          <div style={{ display: "grid", gap: 10 }}>
            <div>
              {loadingCards ? (
                <div className="muted">Loading cards...</div>
              ) : (
                cards
                  .filter((card) => (card.category || "points") === "rewards")
                  .map((card) => (
                    <LibraryCardRow
                      key={card.id}
                      c={card}
                      mode={mode}
                      flagValue={effectivePreviewFlag}
                      onPreview={() => onPreviewCard(card, effectivePreviewFlag)}
                      onGive={() => onOpenBulkGive(card)}
                      onEdit={() => onEditCard(card)}
                      onDelete={() => onDeleteCard(card.id)}
                    />
                  ))
              )}
            </div>

            <div style={{ borderTop: "2px solid #e2e8f0", paddingTop: 12 }}>
              {loadingRewards ? (
                <div className="muted">Loading rewards...</div>
              ) : (
                rewards.map((reward) => {
                  const cardMeta = cards.find((card) => card.id === reward.cardId) || null;
                  return (
                    <div
                      key={reward.id}
                      style={{
                        border: "1px solid #e2e8f0",
                        padding: 12,
                        borderRadius: 14,
                        background: "#ffffff",
                        boxShadow: "0 2px 8px rgba(15, 23, 42, 0.05)",
                        marginBottom: 10,
                        color: "#0f172a",
                      }}
                    >
                      <div style={{ fontWeight: 900, fontSize: 15, color: "#0f172a" }}>{reward.title}</div>
                      <div className="muted" style={{ color: "#64748b", marginTop: 4 }}>
                        Cost: <span className="pill">{reward.cost} pts</span>{" "}
                        • Linked card: <span className="pill">{cardMeta ? cardMeta.title : "—"}</span>
                      </div>
                      {mode === "admin" && (
                        <div style={{ marginTop: 8 }}>
                          <button
                            className="btn"
                            style={{
                              background: "#ffffff",
                              border: "1px solid #fecaca",
                              color: "#dc2626",
                            }}
                            onClick={() => onDeleteReward(reward.id)}
                          >
                            Delete reward
                          </button>
                        </div>
                      )}
                    </div>
                  );
                })
              )}

              {mode === "admin" && (
                <div style={{ borderTop: "1px dashed #eee", paddingTop: 10, marginTop: 10 }}>
                  <RewardCreateForm
                    cards={cards}
                    onCreate={onCreateReward}
                    onValidationError={onValidationError}
                  />
                </div>
              )}
            </div>
          </div>
        )}
      </div>
    </aside>
  );
}