/**
 * PKM Reward Code Service - Backend redemption and validation
 *
 * Handles code redemption, activity catalogue management, and achievement recording
 */

import {
  doc,
  getDoc,
  setDoc,
  updateDoc,
  deleteDoc,
  collection,
  getDocs,
  writeBatch,
  increment,
  serverTimestamp,
} from "firebase/firestore";

import { decodeRewardCode, getStudentHash } from "../utils/rewardCodeUtils.js";
import { computeEffectiveMultiplier } from "../utils/floatWindowUtils";
import { todayISODate } from "../utils/dateUtils";
import { uid } from "../utils/helpers";

/**
 * Redeem a reward code for the current student
 *
 * Validates code format, student match, activity existence, and prevents duplicates.
 *
 * @param {Object} params
 * @param {*} params.db - Firestore instance
 * @param {string} params.classId - Class ID
 * @param {string} params.studentId - Student's Firestore UID
 * @param {string} params.codeString - Code to redeem (user input)
 * @param {Function} params.alertFn - Alert callback
 * @returns {Promise<{success: boolean, message: string, achievement?: Object}>}
 */
export async function redeemRewardCode({
  db,
  classId,
  studentId,
  codeString,
  alertFn = null,
}) {
  if (!db || !classId || !studentId || !codeString) {
    return {
      success: false,
      message: "Missing required parameters",
    };
  }

  try {
    // Step 1: Decode and validate code format
    const decoded = decodeRewardCode(codeString);
    if (!decoded.success) {
      return {
        success: false,
        message: "This code is invalid or incomplete.",
        error: decoded.error,
      };
    }

    // Step 2: Verify student hash matches current student
    const currentStudentHash = getStudentHash(studentId);
    if (decoded.studentHash !== currentStudentHash) {
      return {
        success: false,
        message: "This code belongs to another student.",
      };
    }

    // Step 3: Check if activity exists in catalogue
    const activity = await getActivityFromCatalogue({
      db,
      classId,
      sourceId: decoded.sourceId,
      activityId: decoded.activityId,
    });

    if (!activity) {
      return {
        success: false,
        message: "This activity is not registered.",
      };
    }

    // Step 4: Check if activity is active
    if (!activity.isActive) {
      return {
        success: false,
        message: "This activity is no longer available.",
      };
    }

    // Step 5: Check if student already redeemed this activity
    const alreadyRedeemed = await hasStudentRedeemedActivity({
      db,
      classId,
      studentId,
      sourceId: decoded.sourceId,
      activityId: decoded.activityId,
    });

    if (alreadyRedeemed) {
      // Check if this activity awards a card that wasn't delivered to the student's cards album
      const cardIdToGive = activity.cardId || activity.linkedCardId || activity.rewardCardId;
      const givesCard = Boolean(
        cardIdToGive &&
        (activity.rewardType === "card" || activity.rewardType === "both" || activity.rewardType !== "points")
      );

      if (givesCard) {
        const studentRef = doc(db, `classes/${classId}/students/${studentId}`);
        const studentSnap = await getDoc(studentRef);
        if (studentSnap.exists()) {
          const studentData = studentSnap.data();
          const currentCards = Array.isArray(studentData.cards) ? [...studentData.cards] : [];
          const hasCard = currentCards.some(
            (c) => c.cardId === cardIdToGive
          );

          if (!hasCard) {
            // Recover and deliver the missing card!
            const cardRef = doc(db, `classes/${classId}/cards/${cardIdToGive}`);
            const cardSnap = await getDoc(cardRef);
            if (cardSnap.exists()) {
              const cardData = cardSnap.data() || {};
              const cardTitle = cardData.title || cardData.name || cardIdToGive;

              currentCards.push({
                id: uid("owned"),
                cardId: cardIdToGive,
                title: cardTitle,
                imageURL: cardData.imageURL || "",
                imageURL2: cardData.imageURL2 || "",
                grantedAt: new Date().toISOString(),
                pointsGranted: 0,
                obtainedFrom: `activity_${decoded.sourceId}_${decoded.activityId}`,
              });

              await updateDoc(studentRef, { cards: currentCards });

              return {
                success: true,
                message: `Reward card "${cardTitle}" added to your collection!`,
                achievement: {
                  cardId: cardIdToGive,
                  cardName: cardTitle,
                  activityName: activity.name,
                  effectivePointsAwarded: 0,
                },
              };
            }
          }
        }
      }

      return {
        success: false,
        message: "You have already completed this activity and claimed its reward.",
      };
    }

    // Step 6: Record achievement and award points
    const achievement = await recordAndAwardAchievement({
      db,
      classId,
      studentId,
      sourceId: decoded.sourceId,
      activityId: decoded.activityId,
      activity,
    });

    return {
      success: true,
      message: achievement.cardName
        ? `Achievement redeemed! Card "${achievement.cardName}" added to your collection.`
        : "Achievement successfully redeemed!",
      achievement,
    };
  } catch (err) {
    console.error("redeemRewardCode error:", err);
    return {
      success: false,
      message: "An error occurred while redeeming the code.",
      error: err.message,
    };
  }
}

/**
 * Get an activity from the activity catalogue
 *
 * @param {Object} params
 * @param {*} params.db - Firestore instance
 * @param {string} params.classId - Class ID
 * @param {string} params.sourceId - Application identifier
 * @param {string} params.activityId - Activity identifier
 * @returns {Promise<Object|null>} Activity object or null if not found
 */
export async function getActivityFromCatalogue({ db, classId, sourceId, activityId }) {
  if (!db || !classId || !sourceId || !activityId) return null;

  try {
    // The activity ID is sourceId_activityId to ensure uniqueness per class
    const activityRef = doc(
      db,
      `classes/${classId}/activityCatalogue/${sourceId}_${activityId}`
    );
    const snap = await getDoc(activityRef);
    return snap.exists() ? snap.data() : null;
  } catch (err) {
    console.error("getActivityFromCatalogue error:", err);
    return null;
  }
}

/**
 * Check if student has already redeemed an activity
 *
 * @param {Object} params
 * @param {*} params.db - Firestore instance
 * @param {string} params.classId - Class ID
 * @param {string} params.studentId - Student's Firestore UID
 * @param {string} params.sourceId - Application identifier
 * @param {string} params.activityId - Activity identifier
 * @returns {Promise<boolean>} True if already redeemed
 */
export async function hasStudentRedeemedActivity({
  db,
  classId,
  studentId,
  sourceId,
  activityId,
}) {
  if (!db || !classId || !studentId || !sourceId || !activityId) return false;

  try {
    // Check if achievement record exists
    const achievementRef = doc(
      db,
      `classes/${classId}/students/${studentId}/achievements/${sourceId}_${activityId}`
    );
    const snap = await getDoc(achievementRef);
    return snap.exists();
  } catch (err) {
    console.error("hasStudentRedeemedActivity error:", err);
    return false;
  }
}

/**
 * Record achievement and award points to student
 *
 * Uses batch write for atomicity.
 *
 * @param {Object} params
 * @param {*} params.db - Firestore instance
 * @param {string} params.classId - Class ID
 * @param {string} params.studentId - Student's Firestore UID
 * @param {string} params.sourceId - Application identifier
 * @param {string} params.activityId - Activity identifier
 * @param {Object} params.activity - Activity object from catalogue
 * @returns {Promise<Object>} Achievement record
 */
export async function recordAndAwardAchievement({
  db,
  classId,
  studentId,
  sourceId,
  activityId,
  activity,
}) {
  const batch = writeBatch(db);

  try {
    // Get current student data for multiplier
    const studentRef = doc(db, `classes/${classId}/students/${studentId}`);
    const studentSnap = await getDoc(studentRef);
    if (!studentSnap.exists()) {
      throw new Error("Student not found");
    }

    const studentData = studentSnap.data();
    const mult = computeEffectiveMultiplier(studentData, todayISODate());
    const effectivePoints = Number((activity.pointsAwarded * mult).toFixed(2));

    // Create achievement record
    const achievement = {
      sourceId,
      activityId,
      redeemedAt: serverTimestamp(),
      pointsAwarded: Number(activity.pointsAwarded || 0),
      effectivePointsAwarded: effectivePoints,
      rewardType: activity.rewardType || "points",
      activityName: String(activity.name || ""),
      activityDescription: String(activity.description || ""),
    };

    // Update/create achievement document
    const achievementRef = doc(
      db,
      `classes/${classId}/students/${studentId}/achievements/${sourceId}_${activityId}`
    );
    batch.set(achievementRef, achievement);

    // Prepare student document updates
    const currentCards = Array.isArray(studentData.cards) ? [...studentData.cards] : [];
    const history = Array.isArray(studentData.rewardsHistory) ? [...studentData.rewardsHistory] : [];

    const rewardEntry = {
      type: "achievement",
      name: activity.name || "Activity",
      pointsAwarded: effectivePoints,
      redeemedAt: Date.now(),
    };

    // Handle card reward if applicable (for 'card', 'both', or any activity configured with a card)
    const cardIdToGive = activity.cardId || activity.linkedCardId || activity.rewardCardId;
    const shouldAwardCard = Boolean(
      cardIdToGive &&
      (activity.rewardType === "card" || activity.rewardType === "both" || activity.rewardType !== "points")
    );

    if (shouldAwardCard && cardIdToGive) {
      // Get the card to ensure it exists
      const cardRef = doc(db, `classes/${classId}/cards/${cardIdToGive}`);
      const cardSnap = await getDoc(cardRef);
      if (!cardSnap.exists()) {
        throw new Error(`Card not found: ${cardIdToGive}`);
      }

      const cardData = cardSnap.data() || {};
      const cardTitle = cardData.title || cardData.name || cardIdToGive;

      // Add to student's native cards array so it shows in the UI deck
      currentCards.push({
        id: uid("owned"),
        cardId: cardIdToGive,
        title: cardTitle,
        imageURL: cardData.imageURL || "",
        imageURL2: cardData.imageURL2 || "",
        grantedAt: new Date().toISOString(),
        pointsGranted: effectivePoints,
        obtainedFrom: `activity_${sourceId}_${activityId}`,
      });

      // Also set the subcollection for backward-compatibility
      const studentCardsRef = doc(
        db,
        `classes/${classId}/students/${studentId}/cards/${cardIdToGive}`
      );
      batch.set(
        studentCardsRef,
        {
          cardId: cardIdToGive,
          obtainedAt: serverTimestamp(),
          obtainedFrom: `activity_${sourceId}_${activityId}`,
          ...cardData,
        },
        { merge: true }
      );

      // Update achievement record and reward entry to include card details
      achievement.cardId = cardIdToGive;
      achievement.cardName = cardTitle;
      rewardEntry.cardId = cardIdToGive;
      rewardEntry.type = activity.rewardType === "card" ? "card" : "achievement_card";
    }

    history.push(rewardEntry);

    // Update student document in one single batch operation
    const studentUpdates = {
      currentPoints: increment(effectivePoints),
      rewardsHistory: history,
    };
    if (shouldAwardCard && cardIdToGive) {
      studentUpdates.cards = currentCards;
    }

    batch.update(studentRef, studentUpdates);

    await batch.commit();

    return achievement;
  } catch (err) {
    console.error("recordAndAwardAchievement error:", err);
    throw err;
  }
}

/**
 * Add a new activity to the catalogue
 *
 * @param {Object} params
 * @param {*} params.db - Firestore instance
 * @param {string} params.classId - Class ID
 * @param {Object} params.activity - Activity object
 * @returns {Promise<void>}
 */
export async function addActivityToCatalogue({ db, classId, activity }) {
  if (!db || !classId || !activity) throw new Error("Missing required parameters");

  const { sourceId, activityId, name, description, pointsAwarded, rewardType, isActive, cardId } =
    activity;

  if (!sourceId || !activityId) {
    throw new Error("sourceId and activityId are required");
  }

  // Validate that card activities have a cardId
  const givesCard = rewardType === "card" || rewardType === "both";
  if (givesCard && !cardId) {
    throw new Error("A card must be selected when reward type gives a card");
  }

  try {
    const activityRef = doc(
      db,
      `classes/${classId}/activityCatalogue/${sourceId}_${activityId}`
    );

    const activityData = {
      sourceId,
      activityId,
      name: name || `${sourceId}/${activityId}`,
      description: description || "",
      pointsAwarded: Number(pointsAwarded) || 0,
      rewardType: rewardType || "points",
      isActive: isActive !== false,
      createdAt: serverTimestamp(),
      updatedAt: serverTimestamp(),
    };

    // Include cardId if reward type includes a card or cardId is present
    if (cardId && rewardType !== "points") {
      activityData.cardId = cardId;
    }

    await setDoc(activityRef, activityData, { merge: false });
  } catch (err) {
    console.error("addActivityToCatalogue error:", err);
    throw err;
  }
}

/**
 * Update an activity in the catalogue
 *
 * @param {Object} params
 * @param {*} params.db - Firestore instance
 * @param {string} params.classId - Class ID
 * @param {string} params.sourceId - Application identifier
 * @param {string} params.activityId - Activity identifier
 * @param {Object} params.updates - Fields to update
 * @returns {Promise<void>}
 */
export async function updateActivityInCatalogue({
  db,
  classId,
  sourceId,
  activityId,
  updates,
}) {
  if (!db || !classId || !sourceId || !activityId || !updates) {
    throw new Error("Missing required parameters");
  }

  try {
    const activityRef = doc(
      db,
      `classes/${classId}/activityCatalogue/${sourceId}_${activityId}`
    );

    const payload = {
      ...updates,
      updatedAt: serverTimestamp(),
    };

    // If changing to points-only reward, clear cardId
    if (updates.rewardType === "points") {
      payload.cardId = null;
    }

    await updateDoc(activityRef, payload);
  } catch (err) {
    console.error("updateActivityInCatalogue error:", err);
    throw err;
  }
}

/**
 * Get all activities in a class's catalogue
 *
 * @param {Object} params
 * @param {*} params.db - Firestore instance
 * @param {string} params.classId - Class ID
 * @returns {Promise<Array>} Array of activities
 */
export async function getActivityCatalogue({ db, classId }) {
  if (!db || !classId) return [];

  try {
    const catalogueRef = collection(db, `classes/${classId}/activityCatalogue`);
    const snap = await getDocs(catalogueRef);

    return snap.docs.map((doc) => ({
      id: doc.id,
      ...doc.data(),
    }));
  } catch (err) {
    console.error("getActivityCatalogue error:", err);
    return [];
  }
}

/**
 * Delete an activity from the catalogue permanently
 *
 * @param {Object} params
 * @param {*} params.db - Firestore instance
 * @param {string} params.classId - Class ID
 * @param {string} params.sourceId - Application identifier
 * @param {string} params.activityId - Activity identifier
 * @returns {Promise<void>}
 */
export async function deleteActivityFromCatalogue({
  db,
  classId,
  sourceId,
  activityId,
}) {
  if (!db || !classId || !sourceId || !activityId) {
    throw new Error("Missing required parameters");
  }

  try {
    const activityRef = doc(
      db,
      `classes/${classId}/activityCatalogue/${sourceId}_${activityId}`
    );
    await deleteDoc(activityRef);
  } catch (err) {
    console.error("deleteActivityFromCatalogue error:", err);
    throw err;
  }
}
