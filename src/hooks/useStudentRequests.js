import { useEffect, useState } from "react";
import { collectionGroup, onSnapshot, query, where } from "firebase/firestore";

export default function useStudentRequests({ db }) {
  const [pendingRequests, setPendingRequests] = useState([]);
  const [errorMsg, setErrorMsg] = useState("");

  useEffect(() => {
    const q = query(collectionGroup(db, "requests"), where("status", "==", "pending"));
    const unsub = onSnapshot(
      q,
      (snap) => {
        const arr = [];
        snap.forEach((d) => {
          const classId = d.ref.parent.parent?.id || "";
          arr.push({ id: d.id, classId, ...d.data() });
        });
        arr.sort((a, b) => (a.createdAt || 0) - (b.createdAt || 0));
        setPendingRequests(arr);
      },
      (err) => {
        console.error("useStudentRequests error", err);
        setErrorMsg("Error loading requests.");
      }
    );
    return () => unsub();
  }, [db]);

  return {
    pendingRequests,
    pendingCount: pendingRequests.length,
    errorMsg,
  };
}
