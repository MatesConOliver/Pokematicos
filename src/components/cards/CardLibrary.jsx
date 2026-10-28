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
  const [previewFlag, setPreviewFlag] = useState("A");
  const effectivePreviewFlag = flagConfig ? previewFlag : "A";

  return (
    <aside style={{ border: "1px solid #eee", padding: 12, borderRadius: 10 }}>
      <h3 style={{ marginTop: 0 }}><span className="column-title-pill">Library</span></h3>
      {mode === "admin" && flagConfig && (
        <div
          role="group"
          aria-label="Preview card artwork for"
          style={{ display: "flex", gap: 6, alignItems: "center", margin: "8px 0 12px" }}
        >
          <span className="muted" style={{ fontSize: 12 }}>Preview:</span>
          {[["A", flagConfig.optionA], ["B", flagConfig.optionB]].map(([value, label]) => (
            <button
              key={value}
              type="button"
              className="btn"
              aria-pressed={previewFlag === value}
              onClick={() => setPreviewFlag(value)}
              style={{ background: previewFlag === value ? "#def" : "white" }}
            >
              {label}
            </button>
          ))}
        </div>
      )}
      <div
        style={{
          display: "grid",
          gridTemplateColumns: "repeat(auto-fit, minmax(110px, 1fr))",
          gap: 6,
          margin: "8px 0 12px",
        }}
      >
        <button className="btn" onClick={() => setLibraryTab("points")} style={{ width: "100%", background: libraryTab === "points" ? "#def" : "white" }}>
          Points
        </button>
        <button className="btn" onClick={() => setLibraryTab("rewards")} style={{ width: "100%", background: libraryTab === "rewards" ? "#def" : "white" }}>
          Rewards
        </button>
        <button className="btn" onClick={() => setLibraryTab("experience")} style={{ width: "100%", background: libraryTab === "experience" ? "#def" : "white" }}>
          Experience
        </button>
        <button className="btn" onClick={() => setLibraryTab("extra")} style={{ width: "100%", background: libraryTab === "extra" ? "#def" : "white" }}>
          Extra
        </button>
      </div>

      {mode === "admin" && (
        <div style={{ border: "1px dashed #ddd", padding: 10, borderRadius: 10, marginBottom: 12 }}>
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

            <div style={{ borderTop: "2px solid #ddd", paddingTop: 12 }}>
              {loadingRewards ? (
                <div className="muted">Loading rewards...</div>
              ) : (
                rewards.map((reward) => {
                  const cardMeta = cards.find((card) => card.id === reward.cardId) || null;
                  return (
                    <div key={reward.id} style={{ border: "1px solid #eee", padding: 10, borderRadius: 10, background: "#fafafa", marginBottom: 10 }}>
                      <div style={{ fontWeight: 900 }}>{reward.title}</div>
                      <div className="muted">
                        Cost: <span className="pill">{reward.cost} pts</span>{" "}
                        • Linked card: <span className="pill">{cardMeta ? cardMeta.title : "—"}</span>
                      </div>
                      {mode === "admin" && (
                        <div style={{ marginTop: 8 }}>
                          <button className="btn" onClick={() => onDeleteReward(reward.id)}>
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