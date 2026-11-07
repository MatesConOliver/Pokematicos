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

              const history = Array.isArray(studentData.rewardsHistory) ? [...studentData.rewardsHistory] : [];
              const histIdx = history.findIndex(
                (h) => (h.activityId === decoded.activityId && h.sourceId === decoded.sourceId) ||
                       (h.name === activity.name) ||
                       (h.activityName === activity.name)
              );
              if (histIdx >= 0) {
                history[histIdx] = {
                  ...history[histIdx],
                  cardId: cardIdToGive,
                  cardTitle: cardTitle,
                  source: decoded.sourceId,
                  sourceId: decoded.sourceId,
                  activityId: decoded.activityId,
                  activityName: activity.name,
                  isCodeRedemption: true,
                };
              }

              await updateDoc(studentRef, { cards: currentCards, rewardsHistory: history });

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
    const nowIso = new Date().toISOString();
    const nowMs = Date.now();

    const rewardEntry = {
      id: `${nowMs}-${Math.random().toString(16).slice(2)}`,
      type: "achievement",
      name: activity.name || "Activity",
      title: activity.name || "Activity",
      activityName: activity.name || "Activity",
      activityDescription: activity.description || "",
      source: sourceId,
      sourceId: sourceId,
      activityId: activityId,
      pointsAwarded: effectivePoints,
      date: nowIso,
      redeemedAt: nowMs,
      isCodeRedemption: true,
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
        grantedAt: nowIso,
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
      rewardEntry.cardTitle = cardTitle;
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

/**
 * Reconcile and enrich a student's rewards history with activity name, source, and points.
 * Ensures retrocompatibility for already-redeemed codes as well as future codes, even if
 * activities are deactivated or deleted from the catalogue later.
 *
 * @param {Object} params
 * @param {*} params.db - Firestore instance
 * @param {string} params.classId - Class ID
 * @param {Object} params.student - Student document object
 * @returns {Promise<Array>} Enriched rewards history array
 */
export async function reconcileAndEnrichStudentHistory({ db, classId, student }) {
  if (!db || !classId || !student || !student.id) {
    return Array.isArray(student?.rewardsHistory) ? student.rewardsHistory : [];
  }

  try {
    // 1. Fetch the student's subcollection of achievements
    const achRef = collection(db, `classes/${classId}/students/${student.id}/achievements`);
    const achSnap = await getDocs(achRef);
    const achievements = achSnap.docs.map((d) => ({
      id: d.id,
      ...d.data(),
    }));

    // 2. Fetch the class's activity catalogue
    const catalogue = await getActivityCatalogue({ db, classId });

    // 3. Build lookup maps
    const achByComposite = new Map();
    const achByCardId = new Map();
    const achByName = new Map();

    achievements.forEach((ach) => {
      const compId = `${ach.sourceId}_${ach.activityId}`;
      achByComposite.set(compId, ach);
      if (ach.cardId) achByCardId.set(ach.cardId, ach);
      const nameKey = (ach.activityName || ach.name || "").trim().toLowerCase();
      if (nameKey) achByName.set(nameKey, ach);
    });

    const catByComposite = new Map();
    const catByCardId = new Map();
    const catByName = new Map();

    catalogue.forEach((act) => {
      const compId = `${act.sourceId}_${act.activityId}`;
      catByComposite.set(compId, act);
      if (act.cardId) catByCardId.set(act.cardId, act);
      const nameKey = (act.name || "").trim().toLowerCase();
      if (nameKey) catByName.set(nameKey, act);
    });

    const studentCards = Array.isArray(student.cards) ? student.cards : [];
    const cardByCardId = new Map();
    studentCards.forEach((c) => {
      if (c.cardId) cardByCardId.set(c.cardId, c);
    });

    const currentHistory = Array.isArray(student.rewardsHistory) ? [...student.rewardsHistory] : [];
    const matchedAchievementIds = new Set();
    let hasChanges = false;

    // 4. Enrich existing entries in rewardsHistory
    const enrichedHistory = currentHistory.map((h) => {
      // Check if this entry represents a code redemption / activity achievement
      const isAchievementType = h.type === "achievement" || h.type === "achievement_card";
      const isCardFromActivity = h.type === "card" && (h.obtainedFrom || h.pointsAwarded !== undefined || !h.cost);
      const isCode = Boolean(
        h.isCodeRedemption ||
        isAchievementType ||
        isCardFromActivity ||
        (!h.cost && (h.pointsAwarded !== undefined || h.name || h.activityName))
      );

      if (!isCode) {
        // It's a regular store reward
        return h;
      }

      // Try matching with an achievement or catalogue activity
      let match = null;
      let matchedCompId = null;

      // Try 1: By sourceId + activityId if already on entry
      if (h.sourceId && h.activityId) {
        matchedCompId = `${h.sourceId}_${h.activityId}`;
        match = achByComposite.get(matchedCompId) || catByComposite.get(matchedCompId);
      }

      // Try 2: By obtainedFrom string (e.g. "activity_math_quiz1")
      if (!match && h.obtainedFrom && h.obtainedFrom.startsWith("activity_")) {
        const parts = h.obtainedFrom.replace("activity_", "").split("_");
        matchedCompId = `${parts[0]}_${parts.slice(1).join("_")}`;
        match = achByComposite.get(matchedCompId) || catByComposite.get(matchedCompId);
      }

      // Try 3: By cardId
      if (!match && h.cardId) {
        match = achByCardId.get(h.cardId) || catByCardId.get(h.cardId);
        if (match) matchedCompId = `${match.sourceId}_${match.activityId}`;
      }

      // Try 4: Check student's owned cards by cardId for obtainedFrom
      if (!match && h.cardId && cardByCardId.has(h.cardId)) {
        const c = cardByCardId.get(h.cardId);
        if (c.obtainedFrom && c.obtainedFrom.startsWith("activity_")) {
          const parts = c.obtainedFrom.replace("activity_", "").split("_");
          matchedCompId = `${parts[0]}_${parts.slice(1).join("_")}`;
          match = achByComposite.get(matchedCompId) || catByComposite.get(matchedCompId);
        }
      }

      // Try 5: By name match
      if (!match) {
        const searchName = (h.activityName || h.name || h.title || "").trim().toLowerCase();
        if (searchName) {
          match = achByName.get(searchName) || catByName.get(searchName);
          if (match) matchedCompId = `${match.sourceId}_${match.activityId}`;
        }
      }

      if (matchedCompId) {
        matchedAchievementIds.add(matchedCompId);
      }

      const resolvedActivityName = h.activityName || match?.activityName || match?.name || h.name || h.title || "Activity";
      const resolvedSource = h.source || match?.sourceId || h.sourceId || "Code";
      const resolvedSourceId = h.sourceId || match?.sourceId || "";
      const resolvedActivityId = h.activityId || match?.activityId || "";
      const resolvedPoints = Number(
        h.pointsAwarded !== undefined
          ? h.pointsAwarded
          : match?.effectivePointsAwarded !== undefined
          ? match.effectivePointsAwarded
          : match?.pointsAwarded !== undefined
          ? match.pointsAwarded
          : 0
      );
      const resolvedCardId = h.cardId || match?.cardId || null;
      const resolvedCardTitle = h.cardTitle || match?.cardName || (resolvedCardId && cardByCardId.get(resolvedCardId)?.title) || null;

      const dateVal =
        h.date ||
        (h.redeemedAt ? new Date(h.redeemedAt).toISOString() : null) ||
        (match?.redeemedAt?.toDate ? match.redeemedAt.toDate().toISOString() : null) ||
        new Date().toISOString();

      const updated = {
        ...h,
        id: h.id || `${Date.now()}-${Math.random().toString(16).slice(2)}`,
        isCodeRedemption: true,
        type: resolvedCardId ? "achievement_card" : "achievement",
        activityName: resolvedActivityName,
        title: resolvedActivityName,
        name: resolvedActivityName,
        source: resolvedSource,
        sourceId: resolvedSourceId,
        activityId: resolvedActivityId,
        pointsAwarded: resolvedPoints,
        cardId: resolvedCardId,
        cardTitle: resolvedCardTitle,
        date: dateVal,
      };

      if (
        h.source !== updated.source ||
        h.activityName !== updated.activityName ||
        h.pointsAwarded !== updated.pointsAwarded ||
        !h.isCodeRedemption ||
        h.cardId !== updated.cardId
      ) {
        hasChanges = true;
      }

      return updated;
    });

    // 5. Retrocompatibility: if student has achievements in subcollection not in rewardsHistory
    achievements.forEach((ach) => {
      const compId = `${ach.sourceId}_${ach.activityId}`;
      if (!matchedAchievementIds.has(compId)) {
        const achDate = ach.redeemedAt?.toDate
          ? ach.redeemedAt.toDate().toISOString()
          : ach.redeemedAt
          ? new Date(ach.redeemedAt).toISOString()
          : new Date().toISOString();

        enrichedHistory.push({
          id: `ach_${compId}`,
          isCodeRedemption: true,
          type: ach.cardId ? "achievement_card" : "achievement",
          activityName: ach.activityName || ach.name || ach.activityId || "Activity",
          title: ach.activityName || ach.name || ach.activityId || "Activity",
          name: ach.activityName || ach.name || ach.activityId || "Activity",
          source: ach.sourceId || "Code",
          sourceId: ach.sourceId || "",
          activityId: ach.activityId || "",
          pointsAwarded: Number(ach.effectivePointsAwarded ?? ach.pointsAwarded ?? 0),
          cardId: ach.cardId || null,
          cardTitle: ach.cardName || null,
          date: achDate,
          redeemedAt: ach.redeemedAt?.toMillis ? ach.redeemedAt.toMillis() : Date.now(),
        });
        matchedAchievementIds.add(compId);
        hasChanges = true;
      }
    });

    // 6. Retrocompatibility: check student's cards for activity cards not in rewardsHistory
    studentCards.forEach((card) => {
      if (card.obtainedFrom && card.obtainedFrom.startsWith("activity_")) {
        const parts = card.obtainedFrom.replace("activity_", "").split("_");
        const sId = parts[0];
        const aId = parts.slice(1).join("_");
        const compId = `${sId}_${aId}`;
        if (!matchedAchievementIds.has(compId)) {
          const catItem = catByComposite.get(compId) || catByCardId.get(card.cardId);
          enrichedHistory.push({
            id: `card_${card.id || card.cardId}`,
            isCodeRedemption: true,
            type: "achievement_card",
            activityName: catItem?.name || card.title || "Activity",
            title: catItem?.name || card.title || "Activity",
            name: catItem?.name || card.title || "Activity",
            source: sId || "Code",
            sourceId: sId || "",
            activityId: aId || "",
            pointsAwarded: Number(card.pointsGranted ?? catItem?.pointsAwarded ?? 0),
            cardId: card.cardId,
            cardTitle: card.title,
            date: card.grantedAt || new Date().toISOString(),
          });
          matchedAchievementIds.add(compId);
          hasChanges = true;
        }
      }
    });

    // 7. If anything was enriched or added, persist back to Firestore so it's permanent
    if (hasChanges) {
      try {
        const studentRef = doc(db, `classes/${classId}/students/${student.id}`);
        await updateDoc(studentRef, { rewardsHistory: enrichedHistory });
      } catch (saveErr) {
        console.warn("Could not backfill enriched rewardsHistory to Firestore:", saveErr);
      }
    }

    return enrichedHistory;
  } catch (err) {
    console.error("reconcileAndEnrichStudentHistory error:", err);
    return Array.isArray(student?.rewardsHistory) ? student.rewardsHistory : [];
  }
}

