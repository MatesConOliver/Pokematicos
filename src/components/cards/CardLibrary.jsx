import React, { useMemo, useState } from "react";
import CardCreateForm from "./CardCreateForm";
import LibraryCardRow from "./LibraryCardRow";
import NoticeBoardPanel from "./NoticeBoardPanel";
import { isEvolutionCard } from "../../services/cardEvolutionService";

export default function CardLibrary({
  mode,
  cards,
  students = [],
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
  onDeleteReward,
  onValidationError,
  cardsById,
  activeStudent,
  defaultCatalystCardId,
  onSetDefaultCatalyst,
  onDropCatalyst,
  onEvolve,
}) {
  const [libraryTab, setLibraryTab] = useState("points");
  const [showCreateCard, setShowCreateCard] = useState(false);
  const effectivePreviewFlag = flagConfig ? viewFlag : "A";

  const cardsByIdMap = useMemo(
    () => cardsById || new Map((cards || []).map((c) => [c.id, c])),
    [cards, cardsById]
  );

  const catalystCandidates = useMemo(
    () => (cards || []).filter((c) => (c.category || "points") === "rewards" || c.category === "extra"),
    [cards]
  );

  const hasEvolutionCards = useMemo(
    () => (cards || []).some((c) => isEvolutionCard(c)),
    [cards]
  );

  const unmatchedLegacyRewards = useMemo(() => {
    const rewardCardIds = new Set(
      (cards || [])
        .filter((c) => (c?.category || "points") === "rewards")
        .map((c) => c.id)
    );
    return (rewards || []).filter((r) => !r.cardId || !rewardCardIds.has(r.cardId));
  }, [cards, rewards]);

  const evolutionsByBaseCardId = useMemo(() => {
    const map = new Map();
    (cards || []).forEach((card) => {
      if (isEvolutionCard(card) && card.evolution?.baseCardId) {
        const baseId = card.evolution.baseCardId;
        if (!map.has(baseId)) map.set(baseId, []);
        map.get(baseId).push(card);
      }
    });
    return map;
  }, [cards]);

  return (
    <aside style={{ border: "none", background: "transparent", padding: 0, height: "100%", display: "flex", flexDirection: "column", minHeight: 0, overflow: "hidden" }}>
      <div
        style={{
          display: "flex",
          alignItems: "center",
          gap: 10,
          margin: "0 0 10px",
          flexWrap: "wrap",
          flexShrink: 0,
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
          gridTemplateColumns: "repeat(auto-fit, minmax(100px, 1fr))",
          gap: 6,
          margin: "8px 0 12px",
          flexShrink: 0,
        }}
      >
        {["points", "rewards", "experience", "extra", "notices"].map((tab) => {
          const isActive = libraryTab === tab;
          const label =
            tab === "notices"
              ? "Noticeboard"
              : tab.charAt(0).toUpperCase() + tab.slice(1);
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
                whiteSpace: "nowrap",
              }}
            >
              {label}
            </button>
          );
        })}
        {mode === "admin" && (
          <button
            type="button"
            className="btn"
            onClick={() => setShowCreateCard((prev) => !prev)}
            aria-expanded={showCreateCard}
            style={{
              width: "100%",
              background: showCreateCard ? "#dbeafe" : "#ffffff",
              border: showCreateCard ? "1px solid #3b82f6" : "1px dashed #93c5fd",
              color: showCreateCard ? "#1d4ed8" : "#2563eb",
              fontWeight: 700,
              boxShadow: "0 2px 6px rgba(37, 99, 235, 0.08)",
            }}
          >
            {showCreateCard ? "✕ Create" : "+ Create"}
          </button>
        )}
      </div>

      {mode === "admin" && (libraryTab === "rewards" || (hasEvolutionCards && !defaultCatalystCardId)) && (
        <div
          style={{
            display: "flex",
            alignItems: "center",
            gap: 8,
            flexWrap: "wrap",
            padding: "8px 12px",
            marginBottom: 10,
            borderRadius: 12,
            background: !defaultCatalystCardId && hasEvolutionCards ? "#fef3c7" : "#eef2ff",
            border: !defaultCatalystCardId && hasEvolutionCards ? "1px solid #fcd34d" : "1px solid #c7d2fe",
            flexShrink: 0,
            fontSize: 12,
          }}
        >
          <span style={{ fontWeight: 800, color: "#312e81" }}>
            🔮 Catalizador universal:
          </span>
          <select
            value={defaultCatalystCardId || ""}
            onChange={(e) => onSetDefaultCatalyst?.(e.target.value)}
            style={{
              flex: 1,
              minWidth: 160,
              padding: "4px 8px",
              borderRadius: 8,
              border: "1px solid #cbd5e1",
              background: "#ffffff",
              fontSize: 12,
            }}
          >
            <option value="">Selecciona objeto catalizador (Rewards/Extra)...</option>
            {catalystCandidates.map((c) => (
              <option key={c.id} value={c.id}>
                {c.title} ({c.category || "points"})
              </option>
            ))}
          </select>
        </div>
      )}

      {mode === "admin" && showCreateCard && (
        <div
          style={{
            border: "1px dashed #93c5fd",
            background: "#ffffff",
            padding: 12,
            borderRadius: 12,
            marginBottom: 12,
            boxShadow: "0 2px 8px rgba(15, 23, 42, 0.05)",
            flexShrink: 0,
            maxHeight: 320,
            overflowY: "auto",
          }}
        >
          <div style={{ display: "flex", justifyContent: "space-between", alignItems: "center", marginBottom: 8 }}>
            <h4 style={{ margin: 0 }}>Create new card</h4>
            <button
              type="button"
              className="btn"
              onClick={() => setShowCreateCard(false)}
              style={{ padding: "2px 8px", fontSize: 12 }}
              title="Close form"
            >
              ✕
            </button>
          </div>
          <CardCreateForm
            cards={cards}
            defaultCatalystCardId={defaultCatalystCardId}
            onCreate={async (cardData) => {
              const res = await onCreateCard(cardData);
              if (res !== false) {
                setShowCreateCard(false);
              }
              return res;
            }}
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

      <div style={{ flex: "1 1 0", overflowY: "auto", minHeight: 0, paddingRight: 4, paddingBottom: 16, overscrollBehavior: "contain" }}>
        {libraryTab === "notices" ? (
          <NoticeBoardPanel
            students={students}
            cards={cards}
            rewards={rewards}
            streakConfigs={streakConfigs}
            flagValue={effectivePreviewFlag}
          />
        ) : libraryTab !== "rewards" ? (
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
                    cardsById={cardsByIdMap}
                    activeStudent={activeStudent}
                    defaultCatalystCardId={defaultCatalystCardId}
                    childEvolutions={evolutionsByBaseCardId.get(card.id) || []}
                    onPreview={() => onPreviewCard(card, effectivePreviewFlag)}
                    onGive={() => onOpenBulkGive(card)}
                    onEdit={() => onEditCard(card)}
                    onDelete={() => onDeleteCard(card.id)}
                    onDropCatalyst={onDropCatalyst}
                    onEvolve={onEvolve}
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
                      cardsById={cardsByIdMap}
                      activeStudent={activeStudent}
                      defaultCatalystCardId={defaultCatalystCardId}
                      childEvolutions={evolutionsByBaseCardId.get(card.id) || []}
                      onPreview={() => onPreviewCard(card, effectivePreviewFlag)}
                      onGive={() => onOpenBulkGive(card)}
                      onEdit={() => onEditCard(card)}
                      onDelete={() => onDeleteCard(card.id)}
                      onDropCatalyst={onDropCatalyst}
                      onEvolve={onEvolve}
                    />
                  ))
              )}
            </div>

            {!loadingRewards && unmatchedLegacyRewards.length > 0 && (
              <div style={{ borderTop: "2px solid #e2e8f0", paddingTop: 12 }}>
                <div className="muted" style={{ fontSize: 12, marginBottom: 8 }}>
                  Legacy shop rewards
                </div>
                {unmatchedLegacyRewards.map((reward) => {
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
                })}
              </div>
            )}
          </div>
        )}
      </div>
    </aside>
  );
}