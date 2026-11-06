import {
  addDoc,
  collection,
  deleteDoc,
  doc,
  getDocs,
  query,
  where,
} from "firebase/firestore";

export const MAX_PENDING_REQUESTS_PER_STUDENT = 3;

export async function createRequest(
  db,
  classId,
  { studentId, studentName, className, type, amount, cardId, cardTitle, note },
  alertFn = null
) {
  try {
    const pendingQ = query(
      collection(db, `classes/${classId}/requests`),
      where("studentId", "==", studentId),
      where("status", "==", "pending")
    );
    const pendingSnap = await getDocs(pendingQ);
    if (pendingSnap.size >= MAX_PENDING_REQUESTS_PER_STUDENT) {
      if (alertFn) alertFn(`Ya tienes ${MAX_PENDING_REQUESTS_PER_STUDENT} peticiones pendientes. Espera a que se resuelvan.`);
      return false;
    }

    // Determine Firestore-compatible type:
    // If a card is requested (whether card-only or combined with points), use "card"
    // as the primary document type so it complies with live Firestore security rules
    // that require d.type in ['points', 'card'].
    const docType = cardId ? "card" : "points";

    const payload = {
      studentId,
      studentName: studentName || "",
      className: className || "",
      type: docType,
      note: (note || "").toString().slice(0, 200),
      status: "pending",
      createdAt: Date.now(),
    };
    if (amount) payload.amount = Number(amount || 0);
    if (cardId) {
      payload.cardId = cardId;
      payload.cardTitle = cardTitle || "";
    }

    await addDoc(collection(db, `classes/${classId}/requests`), payload);
    return true;
  } catch (err) {
    console.error("createRequest error", err);
    if (alertFn) alertFn("No se pudo enviar la petición.");
    return false;
  }
}

export async function cancelRequest(db, classId, requestId, alertFn = null) {
  try {
    await deleteDoc(doc(db, `classes/${classId}/requests/${requestId}`));
    return true;
  } catch (err) {
    console.error("cancelRequest error", err);
    if (alertFn) alertFn("No se pudo cancelar la petición.");
    return false;
  }
}

export async function rejectRequest(db, classId, requestId, alertFn = null) {
  try {
    await deleteDoc(doc(db, `classes/${classId}/requests/${requestId}`));
    return true;
  } catch (err) {
    console.error("rejectRequest error", err);
    if (alertFn) alertFn("No se pudo rechazar la petición.");
    return false;
  }
}

export async function resolveRequestApproved(db, classId, requestId, alertFn = null) {
  try {
    await deleteDoc(doc(db, `classes/${classId}/requests/${requestId}`));
    return true;
  } catch (err) {
    console.error("resolveRequestApproved error", err);
    if (alertFn) alertFn("La petición se concedió pero no se pudo limpiar de la lista.");
    return false;
  }
}
