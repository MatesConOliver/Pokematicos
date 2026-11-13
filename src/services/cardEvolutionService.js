/**
 * Service for Card Evolutions in Pokemáticos
 */

import { doc, runTransaction } from "firebase/firestore";

/**
 * Validates if a card has evolution configuration
 */
export function isEvolutionCard(card) {
  return Boolean(
    card &&
      card.evolution &&
      (card.evolution.isEvolution || card.evolution.baseCardId)
  );
}

/**
 * Checks whether a given student meets the prerequisites to evolve a card
 *
 * @param {Object} params
 * @param {Object} params.student - The student object
 * @param {Object} params.evolutionCard - The target evolved card
 * @param {string} [params.catalystCardId] - The designated catalyst card ID
 * @returns {Object} eligibility details
 */
export function checkEvolutionEligibility({
  student,
  evolutionCard,
  catalystCardId,
}) {
  if (!student || !isEvolutionCard(evolutionCard)) {
    return {
      canEvolve: false,
      isAlreadyUnlocked: false,
      currentCopies: 0,
      requiredCopies: 1,
      hasCopies: false,
      hasCatalyst: false,
      missingCatalystConfig: false,
      catalystCount: 0,
      baseCardId: null,
      catalystCardId: "",
    };
  }

  const evoConfig = evolutionCard.evolution;
  const baseCardId = evoConfig.baseCardId;
  const requiredCopies = Math.max(1, Number(evoConfig.requiredCopies) || 1);
  const effectiveCatalystId = evoConfig.catalystCardId || catalystCardId || "";

  const cards = Array.isArray(student.cards) ? student.cards : [];

  // Count copies of base card in student's collection
  const currentCopies = cards.filter(
    (c) => (c.cardId || c.id) === baseCardId
  ).length;

  // Count available catalyst items in student's collection
  const catalystCount = effectiveCatalystId
    ? cards.filter((c) => (c.cardId || c.id) === effectiveCatalystId).length
    : 0;

  const unlockedEvolutionIds = Array.isArray(student.unlockedEvolutionIds)
    ? student.unlockedEvolutionIds
    : [];

  const isAlreadyUnlocked = unlockedEvolutionIds.includes(evolutionCard.id);
  const hasCopies = currentCopies >= requiredCopies;
  const missingCatalystConfig = !effectiveCatalystId;
  const hasCatalyst = Boolean(effectiveCatalystId) && catalystCount > 0;

  const canEvolve = !isAlreadyUnlocked && hasCopies && hasCatalyst;

  return {
    canEvolve,
    isAlreadyUnlocked,
    currentCopies,
    requiredCopies,
    hasCopies,
    hasCatalyst,
    missingCatalystConfig,
    catalystCount,
    baseCardId,
    catalystCardId: effectiveCatalystId,
  };
}

/**
 * Returns true if the card is NOT an evolution card, OR if it IS an evolution card
 * and the student has already unlocked it.
 */
export function isCardUnlockedForStudent(student, card) {
  if (!isEvolutionCard(card)) return true;
  if (!student) return false;
  const unlockedIds = Array.isArray(student.unlockedEvolutionIds)
    ? student.unlockedEvolutionIds
    : [];
  return unlockedIds.includes(card.id);
}

/**
 * Executes a card evolution inside a Firestore transaction.
 * Consumes 1 catalyst card, preserves base cards,
 * and marks the evolution as unlocked so the student can request or earn it
 * (does NOT automatically grant a copy of the evolved card).
 *
 * @param {Object} params
 * @param {*} params.db - Firestore instance
 * @param {string} params.classId - Current class ID
 * @param {string} params.studentId - Student ID
 * @param {string} params.evolutionCardId - Evolved card ID
 * @param {string} [params.classCatalystCardId] - Fallback catalyst card ID for the class
 * @returns {Promise<{success: boolean, evolvedCard: Object, baseCardId: string}>}
 */
export async function executeEvolution({
  db,
  classId,
  studentId,
  evolutionCardId,
  classCatalystCardId,
}) {
  if (!classId || !studentId || !evolutionCardId) {
    throw new Error("Missing required parameters for evolution");
  }

  const studentRef = doc(db, `classes/${classId}/students/${studentId}`);
  const cardRef = doc(db, `classes/${classId}/cards/${evolutionCardId}`);

  return await runTransaction(db, async (tx) => {
    const [studentSnap, cardSnap] = await Promise.all([
      tx.get(studentRef),
      tx.get(cardRef),
    ]);

    if (!studentSnap.exists()) {
      throw new Error("Student not found");
    }
    if (!cardSnap.exists()) {
      throw new Error("Evolution card not found");
    }

    const studentData = studentSnap.data();
    const evolutionCard = { id: cardSnap.id, ...cardSnap.data() };

    const eligibility = checkEvolutionEligibility({
      student: studentData,
      evolutionCard,
      catalystCardId: classCatalystCardId,
    });

    if (eligibility.isAlreadyUnlocked) {
      throw new Error("This evolution has already been unlocked by the student.");
    }
    if (!eligibility.hasCopies) {
      throw new Error(
        `Insufficient base cards: student has ${eligibility.currentCopies}/${eligibility.requiredCopies}`
      );
    }
    if (!eligibility.hasCatalyst) {
      throw new Error("Student does not have the required catalyst item.");
    }

    const currentCards = Array.isArray(studentData.cards)
      ? [...studentData.cards]
      : [];

    // Consume exactly 1 catalyst item
    const targetCatalystId = eligibility.catalystCardId;
    if (targetCatalystId) {
      const catalystIndex = currentCards.findIndex(
        (c) => (c.cardId || c.id) === targetCatalystId
      );
      if (catalystIndex === -1) {
        throw new Error("Catalyst item not found in student inventory.");
      }
      currentCards.splice(catalystIndex, 1);
    }

    // Note: Do NOT automatically grant a copy of the evolved card here.
    // Evolution only unlocks the card so the student can request/redeem/receive it.

    // Update unlocked evolution set
    const unlockedEvolutionIds = Array.isArray(studentData.unlockedEvolutionIds)
      ? [...studentData.unlockedEvolutionIds]
      : [];
    if (!unlockedEvolutionIds.includes(evolutionCard.id)) {
      unlockedEvolutionIds.push(evolutionCard.id);
    }

    // Add record to history
    const history = Array.isArray(studentData.rewardsHistory)
      ? [...studentData.rewardsHistory]
      : [];
    history.push({
      id: `${Date.now()}-${Math.random().toString(16).slice(2)}`,
      type: "evolution",
      title: `Evolución desbloqueada: ${evolutionCard.title}`,
      evolutionCardId: evolutionCard.id,
      baseCardId: eligibility.baseCardId,
      catalystCardId: targetCatalystId || null,
      date: new Date().toISOString(),
    });

    tx.update(studentRef, {
      cards: currentCards,
      unlockedEvolutionIds,
      rewardsHistory: history,
    });

    return {
      success: true,
      evolvedCard: evolutionCard,
      baseCardId: eligibility.baseCardId,
    };
  });
}
