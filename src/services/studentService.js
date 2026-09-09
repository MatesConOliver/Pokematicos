import { collection, doc, addDoc, updateDoc, deleteDoc } from "firebase/firestore";

export async function addStudent(
  db,
  activeClassId,
  name,
  ensureClassSelected,
  newStudentRef,
  alertFn = null
) {
  if (!ensureClassSelected()) return;
  if (!name?.trim()) return;

  try {
    const payload = {
      name: name.trim(),
      // profile cosmetics
      nameEmojis: "",
      profileColor: "",
      // points / xp
      currentPoints: 0,
      xp: 0,
      multiplier: 1,
      streaks: {},
      // inventory / history
      cards: [],
      rewardsHistory: [],
      createdAt: Date.now(),
    };
    await addDoc(collection(db, `classes/${activeClassId}/students`), payload);
    if (newStudentRef.current) newStudentRef.current.value = "";
  } catch (err) {
    console.error(err);
    if (alertFn) alertFn("Failed to add student.");
  }
}

export async function editStudent(db, classId, studentId, updates, alertFn = null) {
  try {
    await updateDoc(
      doc(db, `classes/${classId}/students/${studentId}`),
      updates
    );
  } catch (err) {
    console.error(err);
    if (alertFn) alertFn("Failed saving student changes.");
  }
}

export async function deleteStudent(
  db,
  classId,
  studentId,
  setSelectedStudentId,
  setProfileStudentId,
  confirmFn = typeof window !== "undefined" ? window.confirm.bind(window) : null,
  alertFn = typeof window !== "undefined" ? window.alert.bind(window) : null
) {
  if (confirmFn && !(await confirmFn("Delete this student?"))) return;
  try {
    await deleteDoc(doc(db, `classes/${classId}/students/${studentId}`));
    setSelectedStudentId(null);
    setProfileStudentId(null);
  } catch (err) {
    console.error(err);
    if (alertFn) alertFn("Failed to delete student.");
  }
}
