import CardLibrary from "./CardLibrary";
import { getCardDisplayImage } from "../../utils/cardImageUtils";

export default function LibrarySection({
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
  viewFlag,
  onChangeViewFlag,
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
      lockedInputBRef={lockedInputBRef}
      unlockedInputBRef={unlockedInputBRef}
      flagConfig={flagConfig}
      viewFlag={viewFlag}
      onChangeViewFlag={onChangeViewFlag}
      onCreateCard={onCreateCard}
      onPreviewCard={(card, flagValue = "A") => onPreviewCard({
        ...card,
        imageURL: getCardDisplayImage(card, flagValue, true),
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
