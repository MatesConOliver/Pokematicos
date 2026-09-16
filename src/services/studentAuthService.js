import { doc, updateDoc } from "firebase/firestore";

const DEFAULT_PIN = "0000";

export function verifyPin(student, pin) {
  const current = student?.pin || DEFAULT_PIN;
  return String(pin || "") === String(current);
}

export async function changePin(
  db,
  classId,
  studentId,
  student,
  currentPin,
  newPin,
  alertFn = null
) {
  if (!verifyPin(student, currentPin)) {
    if (alertFn) alertFn("El PIN actual no es correcto.");
    return false;
  }
  if (!/^\d{4}$/.test(String(newPin || ""))) {
    if (alertFn) alertFn("El nuevo PIN debe tener 4 dígitos.");
    return false;
  }
  try {
    await updateDoc(doc(db, `classes/${classId}/students/${studentId}`), {
      pin: String(newPin),
    });
    return true;
  } catch (err) {
    console.error(err);
    if (alertFn) alertFn("No se pudo cambiar el PIN.");
    return false;
  }
}

export async function resetPin(db, classId, studentId, alertFn = null) {
  try {
    await updateDoc(doc(db, `classes/${classId}/students/${studentId}`), {
      pin: DEFAULT_PIN,
    });
    return true;
  } catch (err) {
    console.error(err);
    if (alertFn) alertFn("No se pudo resetear el PIN.");
    return false;
  }
}
