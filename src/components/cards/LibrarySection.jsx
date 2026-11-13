import CardLibrary from "./CardLibrary";
import { getCardDisplayImage } from "../../utils/cardImageUtils";
import { isEvolutionCard, isCardUnlockedForStudent } from "../../services/cardEvolutionService";

export default function LibrarySection({
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
  viewFlag,
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
  return (
    <CardLibrary
      mode={mode}
      cards={cards}
      students={students}
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
      onPreviewCard={(card, flagValue = "A") => {
        const isEvo = isEvolutionCard(card);
        const unlocked = isEvo ? isCardUnlockedForStudent(activeStudent, card) : false;
        onPreviewCard({
          ...card,
          imageURL: getCardDisplayImage(card, flagValue, isEvo ? !unlocked : true),
          isLibraryCard: true,
        });
      }}
      onOpenBulkGive={onOpenBulkGive}
      onEditCard={onEditCard}
      onDeleteCard={onDeleteCard}
      onDeleteReward={onDeleteReward}
      onValidationError={onValidationError}
      cardsById={cardsById}
      activeStudent={activeStudent}
      defaultCatalystCardId={defaultCatalystCardId}
      onSetDefaultCatalyst={onSetDefaultCatalyst}
      onDropCatalyst={onDropCatalyst}
      onEvolve={onEvolve}
    />
  );
}
