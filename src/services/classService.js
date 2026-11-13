import {
  collection,
  doc,
  addDoc,
  updateDoc,
  deleteDoc,
  setDoc,
  serverTimestamp,
} from "firebase/firestore";

/**
 * Create a new class
 * @param {Object} db - Firestore database instance
 * @param {string} name - Name of the class to create
 * @param {Function} onClassCreated - Callback receiving the new classId
 * @param {string} userId - UID of the user creating the class (to add as admin)
 */
export async function createClass(db, name, onClassCreated, alertFn = null, userId = null) {
  if (!name?.trim()) return;
  try {
    const payload = { name: name.trim(), createdAt: Date.now() };
    const ref = await addDoc(collection(db, "classes"), payload);
    
    // Add the creator as an admin
    if (userId) {
      try {
        const adminRef = doc(db, `classes/${ref.id}/admins/${userId}`);
        await setDoc(adminRef, {
          uid: userId,
          addedAt: serverTimestamp(),
        });
      } catch (adminErr) {
        console.error("Failed to add creator as admin:", adminErr);
        // Don't fail the whole operation if admin setup fails
      }
    }
    
    if (onClassCreated) onClassCreated(ref.id);
  } catch (err) {
    console.error("createClass err:", err);
    if (alertFn) alertFn("Failed to create class.");
  }
}

/**
 * Edit an existing class name
 * @param {Object} db - Firestore database instance
 * @param {string} classId - ID of the class to edit
 * @param {string} newName - New name to apply
 */
export async function editClassName(db, classId, newName, alertFn = null) {
  const safeName = (newName || "").trim();
  if (!classId || !safeName) return;
  try {
    await updateDoc(doc(db, `classes/${classId}`), { name: safeName });
  } catch (err) {
    console.error(err);
    if (alertFn) alertFn("Could not rename class.");
  }
}

export async function endClassActivity(db, classId, archivedUrl, alertFn = null) {
  const safeUrl = (archivedUrl || "").trim();
  if (!classId || !safeUrl) return;
  try {
    await updateDoc(doc(db, `classes/${classId}`), { archivedUrl: safeUrl });
  } catch (err) {
    console.error(err);
    if (alertFn) alertFn("Could not end class activity.");
  }
}

export async function setDefaultCatalystForClass(db, classId, cardId, alertFn = null) {
  if (!classId) return;
  try {
    await updateDoc(doc(db, `classes/${classId}`), {
      defaultCatalystCardId: cardId || "",
    });
  } catch (err) {
    console.error("setDefaultCatalystForClass error:", err);
    if (alertFn) alertFn("No se pudo actualizar el catalizador universal.");
  }
}

/**
 * Delete a class
 * @param {Object} db - Firestore database instance
 * @param {string} classId - ID of the class to delete
 * @param {string} activeClassId - Currently selected class ID
 * @param {Function} onClassDeleted - Callback with null if the deleted class was active
 */
export async function removeClass(
  db,
  classId,
  activeClassId,
  onClassDeleted,
  confirmFn = null,
  alertFn = null
) {
  if (confirmFn && !(await confirmFn(
    "Delete this class? (Subcollections won't be deleted automatically)"
  ))) return;
  try {
    await deleteDoc(doc(db, `classes/${classId}`));
    if (activeClassId === classId && onClassDeleted) onClassDeleted(null);
  } catch (err) {
    console.error(err);
    if (alertFn) alertFn("Failed to delete class.");
  }
}
