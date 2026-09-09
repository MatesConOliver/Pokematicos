import {
  collection,
  doc,
  addDoc,
  updateDoc,
  deleteDoc,
} from "firebase/firestore";

/**
 * Create a new class
 * @param {Object} db - Firestore database instance
 * @param {string} name - Name of the class to create
 * @param {Function} onClassCreated - Callback receiving the new classId
 */
export async function createClass(db, name, onClassCreated, alertFn = null) {
  if (!name?.trim()) return;
  try {
    const payload = { name: name.trim(), createdAt: Date.now() };
    const ref = await addDoc(collection(db, "classes"), payload);
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
