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
export async function createClass(db, name, onClassCreated) {
  if (!name?.trim()) return;
  try {
    const payload = { name: name.trim(), createdAt: Date.now() };
    const ref = await addDoc(collection(db, "classes"), payload);
    if (onClassCreated) onClassCreated(ref.id);
  } catch (err) {
    console.error("createClass err:", err);
    alert("Failed to create class.");
  }
}

/**
 * Edit an existing class name
 * @param {Object} db - Firestore database instance
 * @param {string} classId - ID of the class to edit
 * @param {Array} classesList - Array of all classes (to find the class being edited)
 */
export async function editClassName(db, classId, classesList) {
  const cls = classesList.find((c) => c.id === classId);
  if (!cls) return;
  const newName = prompt("New class name:", cls.name || "");
  if (!newName?.trim()) return;
  try {
    await updateDoc(doc(db, `classes/${classId}`), { name: newName.trim() });
  } catch (err) {
    console.error(err);
    alert("Could not rename class.");
  }
}

/**
 * Delete a class
 * @param {Object} db - Firestore database instance
 * @param {string} classId - ID of the class to delete
 * @param {string} activeClassId - Currently selected class ID
 * @param {Function} onClassDeleted - Callback with null if the deleted class was active
 */
export async function removeClass(db, classId, activeClassId, onClassDeleted) {
  if (
    !window.confirm(
      "Delete this class? (Subcollections won't be deleted automatically)"
    )
  )
    return;
  try {
    await deleteDoc(doc(db, `classes/${classId}`));
    if (activeClassId === classId && onClassDeleted) onClassDeleted(null);
  } catch (err) {
    console.error(err);
    alert("Failed to delete class.");
  }
}
