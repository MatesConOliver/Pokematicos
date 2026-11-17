import CardLibrary from "./CardLibrary";
import { getCardDisplayImage } from "../../utils/cardImageUtils";
import { isEvolutionCard, isCardUnlockedForStudent } from "../../services/cardEvolutionService";

export default function LibrarySection({
  mode,
  cards,
  students = [],
  rewards,
  newsMessages = [],
  studyPosts = [],
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
  onSaveNewsMessages,
  onSaveStudyPosts,
  confirmFn,
}) {
  return (
    <CardLibrary
      mode={mode}
      cards={cards}
      students={students}
      rewards={rewards}
      newsMessages={newsMessages}
      studyPosts={studyPosts}
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
        const isLockedPreview =
          (card.category || "points") === "extra" ? false : isEvo ? !unlocked : true;
        onPreviewCard({
          ...card,
          imageURL: getCardDisplayImage(card, flagValue, isLockedPreview),
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
      onSaveNewsMessages={onSaveNewsMessages}
      onSaveStudyPosts={onSaveStudyPosts}
      confirmFn={confirmFn}
    />
  );
}
