import { useEffect, useState } from "react";
import {
  collection,
  onSnapshot,
  orderBy,
  query,
} from "firebase/firestore";

export default function useClassData({ db, activeClassId }) {
  const [classesList, setClassesList] = useState([]);
  const [students, setStudents] = useState([]);
  const [cards, setCards] = useState([]);
  const [rewards, setRewards] = useState([]);

  const [loadingClasses, setLoadingClasses] = useState(true);
  const [loadingStudents, setLoadingStudents] = useState(false);
  const [loadingCards, setLoadingCards] = useState(false);
  const [loadingRewards, setLoadingRewards] = useState(false);

  const [errorMsg, setErrorMsg] = useState("");

  useEffect(() => {
    setLoadingClasses(true);
    const q = query(collection(db, "classes"), orderBy("createdAt", "desc"));
    const unsub = onSnapshot(
      q,
      (snap) => {
        const arr = [];
        snap.forEach((d) => arr.push({ id: d.id, ...d.data() }));
        setClassesList(arr);
        setLoadingClasses(false);
      },
      (err) => {
        console.error("Failed loading classes:", err);
        setErrorMsg("Failed to load classes. Check console.");
        setLoadingClasses(false);
      }
    );
    return () => unsub();
  }, []);

  useEffect(() => {
    if (!activeClassId) {
      setStudents([]);
      setCards([]);
      setRewards([]);
      return;
    }

    setErrorMsg("");

    setLoadingStudents(true);
    const unsubStudents = onSnapshot(
      query(collection(db, `classes/${activeClassId}/students`), orderBy("name")),
      (snap) => {
        const arr = [];
        snap.forEach((d) => arr.push({ id: d.id, ...d.data() }));
        setStudents(arr);
        setLoadingStudents(false);
      },
      (err) => {
        console.error("students snapshot err", err);
        setErrorMsg("Error loading students.");
        setLoadingStudents(false);
      }
    );

    setLoadingCards(true);
    const unsubCards = onSnapshot(
      query(collection(db, `classes/${activeClassId}/cards`), orderBy("createdAt", "asc")),
      (snap) => {
        const arr = [];
        snap.forEach((d) => arr.push({ id: d.id, ...d.data() }));
        setCards(arr);
        setLoadingCards(false);
      },
      (err) => {
        console.error("cards snapshot err", err);
        setErrorMsg("Error loading cards.");
        setLoadingCards(false);
      }
    );

    setLoadingRewards(true);
    const unsubRewards = onSnapshot(
      query(collection(db, `classes/${activeClassId}/rewards`), orderBy("title")),
      (snap) => {
        const arr = [];
        snap.forEach((d) => arr.push({ id: d.id, ...d.data() }));
        setRewards(arr);
        setLoadingRewards(false);
      },
      (err) => {
        console.error("rewards snapshot err", err);
        setErrorMsg("Error loading rewards.");
        setLoadingRewards(false);
      }
    );

    return () => {
      unsubStudents();
      unsubCards();
      unsubRewards();
    };
  }, [activeClassId]);

  return {
    classesList,
    students,
    cards,
    rewards,
    loadingClasses,
    loadingStudents,
    loadingCards,
    loadingRewards,
    errorMsg,
  };
}