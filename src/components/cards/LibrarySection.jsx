import CardLibrary from "./CardLibrary";

export default function LibrarySection({
  mode,
  cards,
  rewards,
  loadingCards,
  loadingRewards,
  streakConfigs,
  lockedInputRef,
  unlockedInputRef,
  onCreateCard,
  onPreviewCard,
  onOpenBulkGive,
  onEditCard,
  onDeleteCard,
  onCreateReward,
  onDeleteReward,
}) {
  return (
    <CardLibrary
      mode={mode}
      cards={cards}
      rewards={rewards}
      loadingCards={loadingCards}
      loadingRewards={loadingRewards}
      streakConfigs={streakConfigs}
      lockedInputRef={lockedInputRef}
      unlockedInputRef={unlockedInputRef}
      onCreateCard={onCreateCard}
      onPreviewCard={(card) => onPreviewCard({
        ...card,
        imageURL: card.lockedImageURL || card.imageURL,
        isLibraryCard: true,
      })}
      onOpenBulkGive={onOpenBulkGive}
      onEditCard={onEditCard}
      onDeleteCard={onDeleteCard}
      onCreateReward={onCreateReward}
      onDeleteReward={onDeleteReward}
    />
  );
}
