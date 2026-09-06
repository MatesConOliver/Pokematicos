import { collection, doc, addDoc, updateDoc, deleteDoc } from "firebase/firestore";

export async function addStudent(
  db,
  activeClassId,
  name,
  ensureClassSelected,
  newStudentRef
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
    alert("Failed to add student.");
  }
}

export async function editStudent(db, classId, studentId, updates) {
  try {
    await updateDoc(
      doc(db, `classes/${classId}/students/${studentId}`),
      updates
    );
  } catch (err) {
    console.error(err);
    alert("Failed saving student changes.");
  }
}

export async function deleteStudent(
  db,
  classId,
  studentId,
  setSelectedStudentId,
  setProfileStudentId
) {
  if (!window.confirm("Delete this student?")) return;
  try {
    await deleteDoc(doc(db, `classes/${classId}/students/${studentId}`));
    setSelectedStudentId(null);
    setProfileStudentId(null);
  } catch (err) {
    console.error(err);
    alert("Failed to delete student.");
  }
}
