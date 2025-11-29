// src/App.js
import React, { useEffect, useMemo, useRef, useState } from "react";
import { initializeApp } from "firebase/app";
import {
  getFirestore,
  collection,
  doc,
  addDoc,
  setDoc,
  updateDoc,
  deleteDoc,
  getDoc,
  onSnapshot,
  query,
  orderBy,
  writeBatch,
} from "firebase/firestore";
import {
  getStorage,
  ref as storageRef,
  uploadBytes,
  getDownloadURL,
} from "firebase/storage";

/**
 * Pokemáticos — Firestore + Storage (single-file App.js)
 *
 * What this version adds back (from your old localStorage version) + fixes:
 * - Guest vs Admin mode (guests cannot Manage; they can only view cards and open a Profile modal)
 * - Student filter
 * - Rewards redeem: choose Individual or Group BEFORE redeeming
 *   - Group redeem lets you assign shares across students that MUST sum exactly to reward cost
 * - Owned cards are grouped (×N). Remove all uses ONE confirm and ONE database update (no spam)
 * - Library shows LOCKED card image; when you give a card to a student they receive UNLOCKED image
 * - Giving a card is silent (no success alert)
 *
 * IMPORTANT SECURITY NOTE (guest profile customisation):
 * Guests can edit profile emojis/background color without login in this UI.
 * That requires Firestore rules to allow updating ONLY those fields,
 * otherwise saving will fail. See rule note at the bottom.
 */

const firebaseConfig = {
  apiKey: "AIzaSyAi9YLbUydV4yDZe64hfUo-btSdo_uYunc",
  authDomain: "pokematicos.firebaseapp.com",
  databaseURL:
    "https://pokematicos-default-rtdb.europe-west1.firebasedatabase.app",
  projectId: "pokematicos",
  storageBucket: "pokematicos.firebasestorage.app",
  messagingSenderId: "101415606738",
  appId: "1:101415606738:web:c009f17005904490e9d00b",
};

const app = initializeApp(firebaseConfig);
const db = getFirestore(app);
const storage = getStorage(app);

function uid(prefix = "id") {
  return `${prefix}_${Math.random().toString(36).slice(2, 10)}`;
}

function todayISODate() {
  return new Date().toISOString().slice(0, 10); // YYYY-MM-DD
}

function safeLower(s) {
  return (s || "").toString().toLowerCase();
}

function round2(x) {
  return Math.round((Number(x) || 0) * 100) / 100;
}

const PASTEL_COLORS = [
  { name: "Mint", value: "#D1FAE5" },
  { name: "Sky", value: "#DBEAFE" },
  { name: "Lavender", value: "#EDE9FE" },
  { name: "Peach", value: "#FFEDD5" },
  { name: "Rose", value: "#FFE4E6" },
  { name: "Lemon", value: "#FEF9C3" },
  { name: "Aqua", value: "#CFFAFE" },
  { name: "Sand", value: "#F5F5DC" },
];

export default function App() {
  // ----- Mode -----
  const [mode, setMode] = useState(null); // null | "admin" | "reader"
  function enterAdmin() {
    const p = prompt("Enter admin password:");
    if (p === "cartas") setMode("admin");
    else if (p !== null) alert("Wrong password");
  }
  function enterReader() {
    setMode("reader");
  }

  // ----- Data -----
  const [classesList, setClassesList] = useState([]);
  const [activeClassId, setActiveClassId] = useState(null);

  const [students, setStudents] = useState([]);
  const [cards, setCards] = useState([]);
  const [rewards, setRewards] = useState([]);

  const [loadingClasses, setLoadingClasses] = useState(true);
  const [loadingStudents, setLoadingStudents] = useState(false);
  const [loadingCards, setLoadingCards] = useState(false);
  const [loadingRewards, setLoadingRewards] = useState(false);

  // ----- UI -----
  const [errorMsg, setErrorMsg] = useState("");
  const [studentFilter, setStudentFilter] = useState("");
  const [libraryTab, setLibraryTab] = useState("points"); // points | rewards | experience
  const [cardPreview, setCardPreview] = useState(null);

  // Admin manage modal selection (admin-only)
  const [selectedStudentId, setSelectedStudentId] = useState(null);

  // Profile modal selection (guest + admin)
  const [profileStudentId, setProfileStudentId] = useState(null);

  const newClassNameRef = useRef(null);
  const newStudentRef = useRef(null);

  // two file inputs for cards
  const lockedFileInputRef = useRef(null);
  const unlockedFileInputRef = useRef(null);

  const [backgroundUrl, setBackgroundUrl] = useState("");
  const bgInputRef = useRef(null);

  const activeClass = useMemo(
    () => classesList.find((c) => c.id === activeClassId) || null,
    [classesList, activeClassId]
  );

  const selectedStudent = useMemo(
    () => students.find((s) => s.id === selectedStudentId) || null,
    [students, selectedStudentId]
  );

  const profileStudent = useMemo(
    () => students.find((s) => s.id === profileStudentId) || null,
    [students, profileStudentId]
  );

  // ----- Subscribe: classes -----
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
    // eslint-disable-next-line react-hooks/exhaustive-deps
  }, []);

    // Load background image (global config)
  useEffect(() => {
    const bgDocRef = doc(db, "config", "background");
    const unsub = onSnapshot(
      bgDocRef,
      (snap) => {
        if (snap.exists()) {
          setBackgroundUrl(snap.data().url || "");
        } else {
          setBackgroundUrl("");
        }
      },
      (err) => {
        console.error("Error loading background:", err);
      }
    );
    return () => unsub();
  }, []);

  // ----- Subscribe: class subcollections -----
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
      // Oldest -> newest (as you asked): top to bottom = old to new
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

  // ----- Guards -----
  function ensureClassSelected() {
    if (!activeClassId) {
      alert("Please select or create a class first.");
      return false;
    }
    return true;
  }

  // ----- Class actions -----
  async function createClass(name) {
    if (!name?.trim()) return;
    try {
      const payload = { name: name.trim(), createdAt: Date.now() };
      const ref = await addDoc(collection(db, "classes"), payload);
      setActiveClassId(ref.id);
    } catch (err) {
      console.error("createClass err:", err);
      alert("Failed to create class.");
    }
  }

  async function editClassName(classId) {
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

  async function removeClass(classId) {
    if (
      !window.confirm(
        "Delete this class? (Subcollections won't be deleted automatically)"
      )
    )
      return;
    try {
      await deleteDoc(doc(db, `classes/${classId}`));
      if (activeClassId === classId) setActiveClassId(null);
    } catch (err) {
      console.error(err);
      alert("Failed to delete class.");
    }
  }

  // --- CLASS STREAK TYPES (per class) ---

  async function addStreakTypeForClass(classId) {
    if (!classId) {
      alert("Select a class first");
      return;
    }

    // 1) Emoji
    const emoji = prompt("Emoji for this streak (for example 🔥, 👻, ⭐):");
    if (!emoji || !emoji.trim()) return;

    // 2) Maximum value
    const maxStr = prompt("Maximum value for this streak (for example 5):");
    const max = Number(maxStr || "0");
    if (!Number.isFinite(max) || max <= 0) {
      alert("Maximum must be a number greater than 0.");
      return;
    }

    // 3) Floating emoji?
    const floatAns = prompt(
      "When a student reaches this maximum streak, should this emoji float faintly in their card background? (yes/no)"
    );
    let float = false;
    let floatStart = "";
    let floatEnd = "";

    if (floatAns && floatAns.toLowerCase().startsWith("y")) {
      float = true;

      const start = prompt(
        "Floating start date (YYYY-MM-DD, leave empty for today):"
      );
      floatStart = (start && start.trim()) || todayISODate();

      const end = prompt(
        "Floating end date (YYYY-MM-DD, leave empty for no end date):"
      );
      floatEnd = (end && end.trim()) || "";
    }

    const id = uid("streak");
    const newCfg = {
      id,
      emoji,
      max,
      float,
      floatStart,
      floatEnd,
    };

    try {
      const clsRef = doc(db, `classes/${classId}`);

      // take current streakConfigs from the in-memory classesList
      const current =
        classesList.find((c) => c.id === classId)?.streakConfigs || [];

      await updateDoc(clsRef, {
        streakConfigs: [...current, newCfg],
      });

      alert("New streak type created for this class.");
    } catch (err) {
      console.error(err);
      alert("Could not create streak type. See console for details.");
    }
  }

  // --- STUDENT STREAKS edit (generic) ---

  async function changeStudentStreakValue(classId, studentId, streakId, delta, maxValue) {
    try {
    const studentRef = doc(db, `classes/${classId}/students/${studentId}`);
    const snap = await getDoc(studentRef);
    if (!snap.exists()) return;
    const data = snap.data();
    const streaks = data.streaks || {};
    const current = streaks[streakId]?.value || 0;

    let next = current + delta;
    if (next < 0) next = 0;
    if (typeof maxValue === "number" && maxValue > 0 && next > maxValue) {
      next = maxValue;
    }

    const updatedEntry = {
      value: next,
      lastUpdated: delta > 0 ? todayISODate() : (streaks[streakId]?.lastUpdated || ""),
    };

    const updatedStreaks = {
      ...streaks,
      [streakId]: updatedEntry,
    };

    await updateDoc(studentRef, { streaks: updatedStreaks });
      // No setSelectedStudent here – Firestore snapshot will refresh students list
    } catch (err) {
      console.error("changeStudentStreakValue error", err);
      alert("Could not update streak. See console.");
    }
  }

  async function resetStudentStreak(classId, studentId, streakId) {
    try {
      const studentRef = doc(db, `classes/${classId}/students/${studentId}`);
      const snap = await getDoc(studentRef);
      if (!snap.exists()) return;
      const data = snap.data();
      const streaks = data.streaks || {};

      const updatedEntry = {
        value: 0,
        lastUpdated: "",
      };

      const updatedStreaks = {
        ...streaks,
        [streakId]: updatedEntry,
      };

      await updateDoc(studentRef, { streaks: updatedStreaks });
      // Again, no setSelectedStudent – snapshot will handle UI refresh
    } catch (err) {
      console.error("resetStudentStreak error", err);
      alert("Could not reset streak.");
    }
  }

    async function deleteStreakTypeForClass(classId, streakId) {
    if (!window.confirm("Delete this streak type for the whole class? This cannot be undone.")) {
      return;
    }
    try {
      const classRef = doc(db, `classes/${classId}`);
      const snap = await getDoc(classRef);
      if (!snap.exists()) return;
      const data = snap.data();
      const list = data.streakConfigs || [];
      const updated = list.filter((cfg) => cfg.id !== streakId);
      await updateDoc(classRef, { streakConfigs: updated });
    } catch (err) {
      console.error("deleteStreakTypeForClass error", err);
      alert("Could not delete streak. See console.");
    }
  }


  // Upload and set background image
  async function uploadBackgroundImage(file) {
    if (!file) return;
    try {
      const safeName = file.name.replace(/\s+/g, "_");
      const key = `bg_${Date.now()}_${safeName}`;
      const ref = storageRef(storage, `backgrounds/${key}`);
      const snapshot = await uploadBytes(ref, file);
      const url = await getDownloadURL(snapshot.ref);

      // Save to Firestore config/background
      await setDoc(doc(db, "config", "background"), { url });

      alert("Background updated!");
      // onSnapshot will update backgroundUrl automatically
    } catch (err) {
      console.error("uploadBackgroundImage error:", err);
      alert("Failed to upload background image.");
    }
  }

  // Remove background image (set to none)
  async function clearBackgroundImage() {
    try {
      await setDoc(doc(db, "config", "background"), { url: "" });
      alert("Background removed!");
      // onSnapshot will set backgroundUrl to "" automatically
    } catch (err) {
      console.error("clearBackgroundImage error:", err);
      alert("Failed to remove background.");
    }
  }


  // ----- Student actions -----
  async function addStudent(name) {
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

  async function editStudent(classId, studentId, updates) {
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

  async function deleteStudent(classId, studentId) {
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

  // Profile cosmetics (guest allowed if rules permit)
  async function saveStudentProfileCosmetics(
    classId,
    studentId,
    { nameEmojis, profileColor }
  ) {
    const safeEmojis = (nameEmojis || "").toString().slice(0, 12);
    const safeColor = (profileColor || "").toString();
    try {
      await updateDoc(doc(db, `classes/${classId}/students/${studentId}`), {
        nameEmojis: safeEmojis,
        profileColor: safeColor,
      });
    } catch (err) {
      console.error(err);
      alert("Could not save profile. (Check Firestore rules)");
    }
  }

  // ----- Cards: locked + unlocked -----
  async function createCard({
    title,
    description,
    points = 0,
    category = "points",
    lockedFile,
    unlockedFile,
  }) {
    if (!ensureClassSelected()) return;
    if (!title?.trim()) {
      alert("Card title required");
      return;
    }

    try {
      const baseKey = uid("card");
      let lockedImageURL = "";
      let unlockedImageURL = "";

      if (lockedFile) {
        const keyLocked = `${baseKey}_locked_${lockedFile.name.replace(
          /\s+/g,
          "_"
        )}`;
        const refLocked = storageRef(
          storage,
          `classes/${activeClassId}/cards/${keyLocked}`
        );
        const snapLocked = await uploadBytes(refLocked, lockedFile);
        lockedImageURL = await getDownloadURL(snapLocked.ref);
      }

      if (unlockedFile) {
        const keyUnlocked = `${baseKey}_unlocked_${unlockedFile.name.replace(
          /\s+/g,
          "_"
        )}`;
        const refUnlocked = storageRef(
          storage,
          `classes/${activeClassId}/cards/${keyUnlocked}`
        );
        const snapUnlocked = await uploadBytes(refUnlocked, unlockedFile);
        unlockedImageURL = await getDownloadURL(snapUnlocked.ref);
      }

      // fallback: if only one image provided
      if (!unlockedImageURL && lockedImageURL) unlockedImageURL = lockedImageURL;
      if (!lockedImageURL && unlockedImageURL) lockedImageURL = unlockedImageURL;

      const payload = {
        title: title.trim(),
        description: description || "",
        points: Number(points) || 0,
        category: category || "points",
        // unlocked in imageURL, locked in lockedImageURL
        imageURL: unlockedImageURL,
        lockedImageURL,
        createdAt: Date.now(),
      };

      await addDoc(collection(db, `classes/${activeClassId}/cards`), payload);

      // clear file inputs
      if (lockedFileInputRef.current) lockedFileInputRef.current.value = "";
      if (unlockedFileInputRef.current) unlockedFileInputRef.current.value = "";
    } catch (err) {
      console.error("createCard err:", err);
      alert("Failed to add card. Check Storage permissions or console.");
    }
  }

  async function deleteCard(cardId) {
    if (!window.confirm("Delete this library card?")) return;
    try {
      await deleteDoc(doc(db, `classes/${activeClassId}/cards/${cardId}`));
    } catch (err) {
      console.error(err);
      alert("Failed to delete card.");
    }
  }

  // Give card (silent success, no alert). Hard rule: don't give rewards-category cards here.
  async function giveCardToStudent(classId, studentId, cardId) {
    try {
      const cardSnap = await getDoc(doc(db, `classes/${classId}/cards/${cardId}`));
      if (!cardSnap.exists()) return alert("Card not found");
      const cardData = cardSnap.data();

      const category = cardData.category || "points";
      if (category === "rewards") return; // not eligible to give directly

      const studentRef = doc(db, `classes/${classId}/students/${studentId}`);
      const studentSnap = await getDoc(studentRef);
      if (!studentSnap.exists()) return alert("Student not found");
      const sdata = studentSnap.data();

      const multiplier = typeof sdata.multiplier === "number" ? sdata.multiplier : 1;

      // Only points-cards give base points. Experience cards are purely cosmetic.
      let basePoints = 0;
      if (category === "points") {
        basePoints = Number(cardData.points || 0);
      }

      const effectivePoints = round2(basePoints * multiplier);

      const cardsArr = Array.isArray(sdata.cards) ? [...sdata.cards] : [];
      cardsArr.push({
        id: uid("owned"),
        cardId,
        title: cardData.title,
        imageURL: cardData.imageURL || "",
        grantedAt: new Date().toISOString(),
        pointsGranted: effectivePoints,
      });

      const currentPoints = round2((sdata.currentPoints || 0) + effectivePoints);

      await updateDoc(studentRef, {
        cards: cardsArr,
        currentPoints,
      });
      // no success alert on purpose
    } catch (err) {
      console.error(err);
      alert("Failed to give card.");
    }
  }

  // Owned cards removal (bulk) - ONE updateDoc
  async function removeOwnedCardsBulk(classId, studentId, ownedIds) {
    if (!ownedIds?.length) return;
    try {
      const studentRef = doc(db, `classes/${classId}/students/${studentId}`);
      const snap = await getDoc(studentRef);
      if (!snap.exists()) return;
      const sdata = snap.data();
      const nextCards = (sdata.cards || []).filter((c) => !ownedIds.includes(c.id));
      await updateDoc(studentRef, { cards: nextCards });
    } catch (err) {
      console.error(err);
      alert("Failed to remove cards.");
    }
  }

  // ----- Rewards -----
  async function createReward({ title, cost, linkedCardId }) {
    if (!ensureClassSelected()) return;
    if (!title?.trim()) return;
    try {
      const payload = {
        title: title.trim(),
        cost: Number(cost || 0),
        cardId: linkedCardId || null,
        createdAt: Date.now(),
      };
      await addDoc(collection(db, `classes/${activeClassId}/rewards`), payload);
    } catch (err) {
      console.error(err);
      alert("Failed to create reward.");
    }
  }

  async function deleteReward(rewardId) {
    if (!window.confirm("Delete this reward?")) return;
    try {
      await deleteDoc(doc(db, `classes/${activeClassId}/rewards/${rewardId}`));
    } catch (err) {
      console.error(err);
      alert("Failed to delete reward.");
    }
  }

  // Redeem: individual
  async function redeemRewardIndividual(classId, studentId, rewardId) {
    try {
      const rewardSnap = await getDoc(doc(db, `classes/${classId}/rewards/${rewardId}`));
      if (!rewardSnap.exists()) return alert("Reward not found");
      const r = rewardSnap.data();

      const studentRef = doc(db, `classes/${classId}/students/${studentId}`);
      const sSnap = await getDoc(studentRef);
      if (!sSnap.exists()) return alert("Student not found");
      const s = sSnap.data();

      if ((s.currentPoints || 0) < r.cost) return alert("Not enough points");

      // optional linked card grant (unlocked image used)
      let linkedCard = null;
      if (r.cardId) {
        const cardSnap = await getDoc(doc(db, `classes/${classId}/cards/${r.cardId}`));
        if (cardSnap.exists()) linkedCard = { id: r.cardId, ...cardSnap.data() };
      }

      const newCurrent = (s.currentPoints || 0) - r.cost;
      const newXP = (s.xp || 0) + r.cost;
      const now = new Date().toISOString();

      const newHistory = [
        ...(s.rewardsHistory || []),
        {
          id: uid("rh"),
          rewardId,
          title: r.title,
          cost: r.cost,
          date: now,
          students: [studentId],
          mode: "individual",
        },
      ];

      const newCards = [...(s.cards || [])];
      if (linkedCard) {
        newCards.push({
          id: uid("owned"),
          cardId: r.cardId,
          title: linkedCard.title,
          imageURL: linkedCard.imageURL || "",
          grantedAt: now,
        });
      }

      await updateDoc(studentRef, {
        currentPoints: newCurrent,
        xp: newXP,
        rewardsHistory: newHistory,
        cards: newCards,
      });
    } catch (err) {
      console.error(err);
      alert("Failed to redeem reward.");
    }
  }

  // Redeem: group (shares sum must equal cost). Applies to all participants: subtract share, add XP share, add history entry, grant linked card.
  async function redeemRewardGroup(classId, rewardId, sharesMap) {
    try {
      const rewardSnap = await getDoc(doc(db, `classes/${classId}/rewards/${rewardId}`));
      if (!rewardSnap.exists()) return alert("Reward not found");
      const r = rewardSnap.data();

      const entries = Object.entries(sharesMap || {}).map(([sid, val]) => [sid, Number(val || 0)]);
      const participants = entries.filter(([, val]) => val > 0);

      const sum = participants.reduce((acc, [, val]) => acc + val, 0);
      if (sum !== Number(r.cost || 0)) {
        alert(`The total is ${sum} but must be exactly ${r.cost}.`);
        return;
      }
      if (!participants.length) {
        alert("Add at least one student with a share > 0.");
        return;
      }

      // validate points (using current local snapshot values)
      const lacking = [];
      for (const [sid, share] of participants) {
        const st = students.find((s) => s.id === sid);
        if (!st) continue;
        if ((st.currentPoints || 0) < share) lacking.push(st.name);
      }
      if (lacking.length) {
        alert(`These students do not have enough points: ${lacking.join(", ")}`);
        return;
      }

      // optional linked card grant
      let linkedCard = null;
      if (r.cardId) {
        const cardSnap = await getDoc(doc(db, `classes/${classId}/cards/${r.cardId}`));
        if (cardSnap.exists()) linkedCard = { id: r.cardId, ...cardSnap.data() };
      }

      const batch = writeBatch(db);
      const now = new Date().toISOString();
      const participantIds = participants.map(([sid]) => sid);

      for (const [sid, share] of participants) {
        const st = students.find((s) => s.id === sid);
        if (!st) continue;

        const studentRef = doc(db, `classes/${classId}/students/${sid}`);

        const newCurrent = (st.currentPoints || 0) - share;
        const newXP = (st.xp || 0) + share;

        const newHistory = [
          ...(st.rewardsHistory || []),
          {
            id: uid("rh"),
            rewardId,
            title: r.title,
            cost: share,
            date: now,
            students: participantIds,
            mode: "group",
          },
        ];

        const newCards = [...(st.cards || [])];
        if (linkedCard) {
          newCards.push({
            id: uid("owned"),
            cardId: r.cardId,
            title: linkedCard.title,
            imageURL: linkedCard.imageURL || "",
            grantedAt: now,
          });
        }

        batch.update(studentRef, {
          currentPoints: newCurrent,
          xp: newXP,
          rewardsHistory: newHistory,
          cards: newCards,
        });
      }

      await batch.commit();
    } catch (err) {
      console.error(err);
      alert("Failed group redeem.");
    }
  }

  // ----- Mode chooser -----
  if (!mode) {
    return (
      <div style={{ fontFamily: "Inter, system-ui, sans-serif", padding: 24 }}>
        <h1 style={{ marginTop: 0 }}>Mis logros Pokemáticos</h1>
        <p style={{ marginTop: 8 }}>¿Cómo entras a la app?</p>
        <div style={{ display: "flex", gap: 12, marginTop: 16 }}>
          <button className="btn primary" onClick={enterAdmin}>
            Soy profe (admin)
          </button>
          <button className="btn" onClick={enterReader}>
            Soy estudiante / invitado
          </button>
        </div>
      </div>
    );
  }

  const filteredStudents = (() => {
    const q = safeLower(studentFilter).trim();
    if (!q) return students;
    return students.filter((s) => safeLower(s.name).includes(q));
  })();

  const classTotalPoints = students.reduce(
    (sum, s) => sum + Number(s.currentPoints || 0),
    0
  );

  return (
    <div
      style={{
        fontFamily: "Inter, system-ui, sans-serif",
        minHeight: "100vh",
        padding: 12,
        backgroundImage: backgroundUrl ? `url(${backgroundUrl})` : "none",
        backgroundSize: "cover",
        backgroundAttachment: "fixed",
        backgroundPosition: "center",
        backgroundRepeat: "no-repeat",
      }}
    >
      <style>{`
        .card-thumb { transition: transform 160ms ease, box-shadow 160ms ease; transform-origin: center; }
        .card-thumb:hover { transform: scale(1.14); box-shadow: 0 10px 24px rgba(0,0,0,0.25); z-index: 30; }

        /* Contenedor que se mueve por toda la tarjeta */
        .floating-emoji {
          position: absolute;
          top: 0;               /* punto de partida */
          left: 0;
          pointer-events: none;
          animation: drift 16s linear infinite;
        }

        /* Círculo brillante + emoji dentro */
        .floating-emoji-glow {
          width: 110px;
          height: 110px;
          border-radius: 999px;
          display: flex;
          align-items: center;
          justify-content: center;

          /* círculo de luz */
          background: radial-gradient(
            circle,
            rgba(255, 255, 255, 0.98) 0%,
            rgba(255, 255, 255, 0.6) 35%,
            rgba(255, 255, 255, 0.0) 75%
          );

          box-shadow:
            0 0 25px rgba(255, 255, 255, 0.95),
            0 0 55px rgba(255, 255, 255, 0.9),
            0 0 95px rgba(255, 255, 255, 0.8);

          font-size: 60px;     /* tamaño del emoji */
          animation: glowPulse 2.6s ease-in-out infinite;
        }

        /* Movimiento bien grande por toda la tarjeta */
        @keyframes drift {
          0% { transform: translate(-30%, -30%) rotate(0deg); }
          25% { transform: translate(200%, -10%) rotate(8deg); }
          50% { transform: translate(250%, 80%) rotate(16deg); }
          75% { transform: translate(-10%, 70%) rotate(8deg); }
          100% { transform: translate(-30%, -30%) rotate(0deg); }
        }

        /* Soft breathing glow */
        @keyframes glowPulse {
          0% { transform: scale(0.95); opacity: 0.55; }
          50% { transform: scale(1.05); opacity: 1; }
          100% { transform: scale(0.95); opacity: 0.55; }
        }

        .modal-backdrop { position: fixed; inset: 0; background: rgba(0,0,0,0.45); display:flex; align-items:center; justify-content:center; z-index:1000; }
        .modal { background: white; border-radius: 10px; padding: 12px; max-width: 980px; width: 92%; max-height: 90vh; overflow:auto; }

        .muted { color:#6b7280; font-size:13px; }

        .btn{
          padding: 9px 12px;
          border-radius: 10px;
          border: 1px solid #e5e7eb;
          background: white;
          cursor: pointer;
          font-weight: 600;
        }
        .btn:hover{ background:#f9fafb; }
        .btn.primary{
          background:#2563eb;
          color:white;
          border:none;
          box-shadow: 0 6px 16px rgba(37,99,235,.22);
        }
        .btn.primary:hover{ filter: brightness(0.98); }

        .pill { font-size: 12px; padding: 2px 8px; border-radius: 999px; background: #f3f4f6; border: 1px solid #e5e7eb; }
        .column-title-pill {
          display: inline-block;
          padding: 4px 10px;
          border-radius: 999px;
          background: rgba(255, 255, 255, 0.96);
          box-shadow: 0 2px 6px rgba(15, 23, 42, 0.25);
          font-size: 14px;
        }

        .input, .select, textarea{
          width: 100%;
          padding: 10px 12px;
          border-radius: 12px;
          border: 1px solid #e5e7eb;
          background: #fff;
          outline: none;
        }
        .input:focus, .select:focus, textarea:focus{
          border-color: #93c5fd;
          box-shadow: 0 0 0 4px rgba(147,197,253,.35);
        }

        .panel{
          border: 1px solid #eee;
          background: white;
          border-radius: 14px;
          padding: 12px;
        }

        .chip{
          display:inline-flex;
          align-items:center;
          gap:6px;
          padding: 4px 10px;
          border-radius: 999px;
          background:#f3f4f6;
          font-size: 12px;
          font-weight: 700;
          color:#111827;
        }

        input, textarea, select { font-family: inherit; }
      `}</style>

      <header
        style={{
          display: "flex",
          justifyContent: "space-between",
          alignItems: "center",
          marginBottom: 12,
          gap: 12,
        }}
      >
        <div>
          <h1 style={{ margin: 0 }}>Mis logros Pokemáticos — Manager</h1>
          <div style={{ color: "#555" }}>
            {mode === "admin" ? "Admin mode" : "Guest mode"}
          </div>
        </div>

        {mode === "admin" && (
          <>
            <input
              type="file"
              accept="image/*"
              ref={bgInputRef}
              style={{ display: "none" }}
              onChange={(e) => {
                const file = e.target.files?.[0];
                if (file) {
                  uploadBackgroundImage(file);
                  // reset so picking the same file again still triggers change
                  e.target.value = "";
                }
              }}
            />
            <button
              className="btn"
              onClick={() => bgInputRef.current?.click()}
            >
              Background
            </button>

            {backgroundUrl && (
              <button
                className="btn"
                onClick={clearBackgroundImage}
              >
                Remove bg
              </button>
            )}
          </>
        )}

        <div style={{ display: "flex", gap: 8, alignItems: "center" }}>
          <button className="btn" onClick={() => setMode(null)}>
            Cambiar rol
          </button>
        </div>
      </header>

      {errorMsg && (
        <div style={{ marginBottom: 12, color: "crimson" }}>{errorMsg}</div>
      )}

      <div style={{ display: "grid", gridTemplateColumns: "260px 1fr 360px", gap: 14 }}>
        {/* LEFT: Classes */}
        <aside style={{ border: "1px solid #eee", padding: 12, borderRadius: 10 }}>
          <h3 style={{ marginTop: 0 }}><span className="column-title-pill">Classes</span></h3>

          {loadingClasses ? (
            <div className="muted">Loading classes...</div>
          ) : classesList.length ? (
            <div style={{ display: "flex", flexDirection: "column", gap: 8 }}>
              {classesList.map((c) => (
                <div key={c.id} style={{ display: "flex", gap: 8, alignItems: "center" }}>
                  <button
                    className="btn"
                    style={{
                      flex: 1,
                      textAlign: "left",
                      background: c.id === activeClassId ? "#eef" : "white",
                    }}
                    onClick={() => setActiveClassId((prev) => (prev === c.id ? null : c.id))}
                  >
                    {c.name}
                  </button>

                  {mode === "admin" && (
                    <>
                      <button className="btn" onClick={() => editClassName(c.id)}>
                        Edit
                      </button>
                      <button className="btn" onClick={() => removeClass(c.id)}>
                        Delete
                      </button>
                    </>
                  )}
                </div>
              ))}
            </div>
          ) : (
            <div className="muted">No classes yet</div>
          )}

          {mode === "admin" && (
            <div style={{ marginTop: 16 }}>
              <h4 style={{ margin: "10px 0" }}>Add class</h4>
              <div style={{ display: "flex", gap: 8 }}>
                <input className="input"
                  ref={newClassNameRef}
                  placeholder="Class name"
                  style={{ flex: 1, padding: 8, borderRadius: 8, border: "1px solid #ddd" }}
                />
                <button
                  className="btn primary"
                  onClick={() => {
                    const name = newClassNameRef.current?.value?.trim();
                    if (!name) return alert("Enter class name");
                    createClass(name);
                    if (newClassNameRef.current) newClassNameRef.current.value = "";
                  }}
                >
                  Create
                </button>
              </div>
            </div>
          )}
        </aside>

        {/* Only show these if a class is selected */}
        {activeClassId && (
          <>
            {/* MIDDLE: Students */}
            <main style={{ border: "1px solid #eee", padding: 12, borderRadius: 10 }}>
              <div style={{ display: "flex", justifyContent: "space-between", alignItems: "center", gap: 10 }}>
                <div style={{ display: "flex", alignItems: "center", gap: 10 }}>
                  <h3 style={{ margin: 0 }}><span className="column-title-pill"> {activeClass?.name || "Select a class"} </span></h3>
                  {activeClassId && <span className="chip">Total class pts: {classTotalPoints}</span>}
                </div>

                <div style={{ display: "flex", alignItems: "center", gap: 8 }}>
                  {mode === "admin" && activeClassId && (
                    <button className="btn" onClick={() => addStreakTypeForClass(activeClassId)}>New streak</button>
                  )}

                  <input
                    placeholder="Filter students..."
                    value={studentFilter}
                    onChange={(e) => setStudentFilter(e.target.value)}
                    style={{
                      padding: 8,
                      fontSize: 13,
                      borderRadius: 8,
                      border: "1px solid #ddd",
                      minWidth: 170,
                    }}
                  />
                </div>
              </div>

              <div style={{ marginTop: 12 }}>
                {!activeClassId ? (
                  <div className="muted">Select a class first.</div>
                ) : loadingStudents ? (
                  <div className="muted">Loading students...</div>
                ) : (
                  <div style={{ display: "grid", gridTemplateColumns: "repeat(2, 1fr)", gap: 12 }}>
                    {filteredStudents.map((s) => {
                      const bg = s.profileColor || "white";
                      const displayName = `${s.name}${s.nameEmojis ? " " + s.nameEmojis : ""}`;

                      // --- FLOATING EMOJI LOGIC ---
                      const cfgs = activeClass?.streakConfigs || [];

                      const floatingEmojis = cfgs.filter((cfg) => {
                        if (!cfg.float) return false;

                        const stObj = (s.streaks && s.streaks[cfg.id]) || { value: 0 };
                        if (stObj.value < cfg.max) return false;

                        const today = todayISODate();
                        if (cfg.floatStart && today < cfg.floatStart) return false;
                        if (cfg.floatEnd && cfg.floatEnd !== "" && today > cfg.floatEnd) return false;

                        return true;
                      });

                      // --- END FLOATING EMOJI LOGIC ---

                      return (
                        <div
                          key={s.id}
                          style={{
                            border: "1px solid #ddd",
                            padding: 10,
                            borderRadius: 10,
                            background: bg,
                            position: "relative",   
                            overflow: "hidden",
                          }}
                        >

                          {/* FLOATING EMOJIS */}
                          {floatingEmojis.map((cfg) => (
                            <div key={cfg.id} className="floating-emoji">
                              <div className="floating-emoji-glow">
                                {cfg.emoji}
                              </div>
                            </div>
                          ))}

                          <div style={{ display: "flex", justifyContent: "space-between", gap: 8 }}>
                            <div>
                              <div style={{ fontWeight: 800 }}>{displayName}</div>

                              {/* Visible for guests too */}
                              <div className="muted" style={{ lineHeight: 1.35 }}>
                                <div style={{ fontSize: 12, color: "#555", marginTop: 2 }}>
                                  {activeClass?.streakConfigs && activeClass.streakConfigs.length > 0 ? (
                                    activeClass.streakConfigs.map((cfg) => {
                                      const stObj =
                                        (s.streaks && s.streaks[cfg.id]) || { value: 0, lastUpdated: "" };
                                      let emojiLine = "";
                                      if (stObj.value > 0) {
                                        // active streak
                                        emojiLine = (cfg.emoji || "").repeat(stObj.value);
                                      } else {
                                        // zero streak → crossed out emoji
                                        emojiLine = (
                                          <span style={{ textDecoration: "line-through", opacity: 0.5 }}>
                                            {cfg.emoji}
                                          </span>
                                        );
                                      }
                                      const date = stObj.lastUpdated || "";
                                      const isToday = date && date === todayISODate();
                                      return (
                                        <div key={cfg.id}>
                                          {emojiLine}
                                          {date && (
                                            <span
                                              style={{
                                                marginLeft: 4,
                                                color: isToday ? "#16a34a" : "#dc2626",
                                                fontWeight: 600,
                                              }}
                                            >
                                              {date}
                                            </span>
                                          )}
                                        </div>
                                      );
                                    })
                                  ) : (
                                    <span className="muted">No streaks defined for this class.</span>
                                  )}
                                </div>

                                {s.multiplier && s.multiplier !== 1 && (
                                  <div>
                                    <span className="muted">Multiplier:</span>
                                    <strong> x{s.multiplier}</strong>
                                  </div>
                                )}
                              </div>
                            </div>

                            <div style={{ textAlign: "right" }}>
                              <div style={{ fontWeight: 800 }}>{s.currentPoints || 0} pts</div>
                              <div className="muted">XP: {s.xp || 0}</div>
                            </div>
                          </div>

                          <div style={{ marginTop: 8, display: "flex", gap: 8, flexWrap: "wrap" }}>
                            {mode === "admin" && (
                              <button className="btn" onClick={() => setSelectedStudentId(s.id)}>
                                Manage
                              </button>
                            )}
                            <button className="btn" onClick={() => setProfileStudentId(s.id)}>
                              Perfil
                            </button>
                          </div>

                          <div style={{ marginTop: 10 }}>
                            <div style={{ fontSize: 13, fontWeight: 800 }}>Cards</div>

                            {/* Scroll container so you can see all cards */}
                            <div
                              style={{
                                marginTop: 8,
                                maxHeight: 260,
                                overflowY: "auto",
                                paddingRight: 6,
                                display: "flex",
                                gap: 8,
                                flexWrap: "wrap",
                                alignContent: "flex-start",
                              }}
                            >
                              {(() => {
                                const groups = new Map();
                                (s.cards || []).forEach((o) => {
                                  const key = o.cardId || "unknown";
                                  if (!groups.has(key)) {
                                    groups.set(key, {
                                      title: o.title || "—",
                                      imageURL: o.imageURL || "",
                                      count: 0,
                                    });
                                  }
                                  groups.get(key).count += 1;
                                });

                                const arr = Array.from(groups.entries()).map(([cardId, g]) => ({
                                  cardId,
                                  ...g,
                                }));

                                return arr.map((g) => (
                                  <div
                                    key={g.cardId}
                                    className="card-thumb"
                                    style={{
                                      width: 80,
                                      height: 110,
                                      border: "1px solid #eee",
                                      borderRadius: 10,
                                      overflow: "hidden",
                                      cursor: "pointer",
                                      position: "relative",
                                      background: "white",
                                    }}
                                    onClick={() =>
                                      setCardPreview({
                                        title: g.title,
                                        imageURL: g.imageURL,
                                        description: "",
                                      })
                                    }
                                  >
                                    {g.imageURL ? (
                                      <img
                                        src={g.imageURL}
                                        alt={g.title}
                                        style={{
                                          width: "100%",
                                          height: "100%",
                                          objectFit: "cover",
                                        }}
                                      />
                                    ) : (
                                      <div style={{ padding: 6, fontSize: 11 }}>{g.title}</div>
                                    )}

                                    {g.count > 1 && (
                                      <div
                                        style={{
                                          position: "absolute",
                                          top: 6,
                                          right: 6,
                                          background: "rgba(0,0,0,0.75)",
                                          color: "white",
                                          borderRadius: 999,
                                          padding: "2px 7px",
                                          fontSize: 11,
                                          fontWeight: 900,
                                        }}
                                      >
                                        ×{g.count}
                                      </div>
                                    )}
                                  </div>
                                ));
                              })()}
                            </div>
                          </div>
                        </div>
                      );
                    })}

                    {mode === "admin" && (
                      <div style={{ border: "1px dashed #ccc", padding: 12, borderRadius: 10 }}>
                        <h4 style={{ marginTop: 0 }}>Add student</h4>
                        <div style={{ display: "flex", gap: 8 }}>
                          <input
                            ref={newStudentRef}
                            placeholder="Student name"
                            style={{
                              flex: 1,
                              padding: 8,
                              borderRadius: 8,
                              border: "1px solid #ddd",
                            }}
                          />
                          <button
                            className="btn primary"
                            onClick={() => {
                              const name = newStudentRef.current?.value?.trim();
                              if (!name) return alert("Enter name");
                              addStudent(name);
                              if (newStudentRef.current) newStudentRef.current.value = "";
                            }}
                          >
                            Add
                          </button>
                        </div>
                      </div>
                    )}
                  </div>
                )}
              </div>
            </main>

            {/* RIGHT: Library */}
            <aside style={{ border: "1px solid #eee", padding: 12, borderRadius: 10 }}>
              <h3 style={{ marginTop: 0 }}><span className="column-title-pill">Library</span></h3>
              {!activeClassId ? (
                <div className="muted">Select a class first</div>
              ) : (
                <>
                  <div style={{ display: "flex", gap: 6, margin: "8px 0 12px" }}>
                    <button className="btn" onClick={() => setLibraryTab("points")} style={{ background: libraryTab === "points" ? "#def" : "white" }}>
                      Points
                    </button>
                    <button className="btn" onClick={() => setLibraryTab("rewards")} style={{ background: libraryTab === "rewards" ? "#def" : "white" }}>
                      Rewards
                    </button>
                    <button className="btn" onClick={() => setLibraryTab("experience")} style={{ background: libraryTab === "experience" ? "#def" : "white" }}>
                      Experience
                    </button>
                  </div>

                  {mode === "admin" && (
                    <div style={{ border: "1px dashed #ddd", padding: 10, borderRadius: 10, marginBottom: 12 }}>
                      <h4 style={{ marginTop: 0 }}>Create new card</h4>
                      <CardCreateForm
                        onCreate={createCard}
                        lockedInputRef={lockedFileInputRef}
                        unlockedInputRef={unlockedFileInputRef}
                      />
                    </div>
                  )}

                  <div style={{ maxHeight: 560, overflow: "auto" }}>
                    {libraryTab !== "rewards" ? (
                      <div style={{ display: "grid" }}>
                        {loadingCards ? (
                          <div className="muted">Loading cards...</div>
                        ) : (
                          cards
                            .filter((c) => (c.category || "points") === libraryTab)
                            .map((c) => (
                              <LibraryCardRow
                                key={c.id}
                                c={c}
                                mode={mode}
                                onPreview={() => setCardPreview({ ...c, imageURL: c.lockedImageURL || c.imageURL, isLibraryCard: true })}
                                onDelete={() => deleteCard(c.id)}
                              />
                            ))
                        )}
                      </div>
                    ) : (
                      <div style={{ display: "grid", gap: 10 }}>
                        {/* Reward cards (library) */}
                        <div>
                          {loadingCards ? (
                            <div className="muted">Loading cards...</div>
                          ) : (
                            cards
                              .filter((c) => (c.category || "points") === "rewards")
                              .map((c) => (
                                <LibraryCardRow
                                  key={c.id}
                                  c={c}
                                  mode={mode}
                                  onPreview={() => setCardPreview({ ...c, imageURL: c.lockedImageURL || c.imageURL, isLibraryCard: true })}
                                  onDelete={() => deleteCard(c.id)}
                                />
                              ))
                          )}
                        </div>

                        {/* Shop items */}
                        <div style={{ borderTop: "2px solid #ddd", paddingTop: 12 }}>
                          {loadingRewards ? (
                            <div className="muted">Loading rewards...</div>
                          ) : (
                            rewards.map((r) => {
                              const cardMeta = cards.find((c) => c.id === r.cardId) || null;
                              return (
                                <div key={r.id} style={{ border: "1px solid #eee", padding: 10, borderRadius: 10, background: "#fafafa", marginBottom: 10 }}>
                                  <div style={{ fontWeight: 900 }}>{r.title}</div>
                                  <div className="muted">
                                    Cost: <span className="pill">{r.cost} pts</span>{" "}
                                    • Linked card: <span className="pill">{cardMeta ? cardMeta.title : "—"}</span>
                                  </div>
                                  {mode === "admin" && (
                                    <div style={{ marginTop: 8 }}>
                                      <button className="btn" onClick={() => deleteReward(r.id)}>
                                        Delete reward
                                      </button>
                                    </div>
                                  )}
                                </div>
                              );
                            })
                          )}

                          {mode === "admin" && (
                            <div style={{ borderTop: "1px dashed #eee", paddingTop: 10, marginTop: 10 }}>
                              <RewardCreateForm cards={cards} onCreate={createReward} />
                            </div>
                          )}
                        </div>
                      </div>
                    )}
                  </div>
                </>
              )}
            </aside>
          </>
        )}
      </div>

      {/* Card preview modal */}
      {cardPreview && (
        <div
          className="modal-backdrop"
          onClick={() => setCardPreview(null)}
        >
          {/* If it comes from the library (locked card) -> show full info modal */}
          {cardPreview.isLibraryCard ? (
            <div className="modal" onClick={(e) => e.stopPropagation()}>
              <div style={{ display: "flex", gap: 12, flexWrap: "wrap" }}>
                <div
                  style={{
                    width: 360,
                    maxWidth: "100%",
                    height: 500,
                    maxHeight: "70vh",
                    background: "#f6f6f6",
                    borderRadius: 8,
                    overflow: "hidden",
                  }}
                >
                  {cardPreview.imageURL ? (
                    <img
                      src={cardPreview.imageURL}
                      alt={cardPreview.title}
                      style={{ width: "100%", height: "100%", objectFit: "contain" }}
                    />
                  ) : (
                    <div style={{ padding: 12 }}>{cardPreview.title}</div>
                  )}
                </div>

                <div style={{ flex: 1, minWidth: 220 }}>
                  <h3 style={{ marginTop: 0 }}>{cardPreview.title}</h3>
                  <div className="muted">{cardPreview.description}</div>
                  <div style={{ marginTop: 8, fontWeight: 700 }}>
                    {cardPreview.points || 0} pts
                  </div>

                  <div style={{ marginTop: 12, display: "flex", gap: 8, flexWrap: "wrap" }}>
                    <button className="btn" onClick={() => setCardPreview(null)}>
                      Close
                    </button>
                    {mode === "admin" && (
                      <button
                        className="btn primary"
                        onClick={() => {
                          const studentName = prompt("Give to student (exact name):");
                          if (!studentName) return;
                          const st = students.find(
                            (s) => safeLower(s.name) === safeLower(studentName)
                          );
                          if (!st) {
                            alert("Student not found. Use Manage → Give for picklist.");
                            return;
                          }
                          giveCardToStudent(activeClassId, st.id, cardPreview.id);
                          setCardPreview(null);
                        }}
                      >
                        Give to student
                      </button>
                    )}
                  </div>
                </div>
              </div>
            </div>
          ) : (
            /* Owned card (unlocked) -> image only */
            <div
              onClick={(e) => e.stopPropagation()}
              style={{
                maxWidth: "min(85vw, 720px)",
                width: "85vw",
                height: "min(70vh, 520px)",
                maxHeight: "70vh",
                borderRadius: 16,
                overflow: "hidden",
                background: "#transparent",
                position: "relative",
                boxShadow: "0 12px 30px rgba(0,0,0,0.5)",
                display: "flex",
                alignItems: "center",
                justifyContent: "center",
              }}
            >
              {cardPreview.imageURL ? (
                <img
                  src={cardPreview.imageURL}
                  alt=""
                  style={{
                    width: "100%",
                    height: "100%",
                    objectFit: "contain",
                    display: "block",
                  }}
                />
              ) : (
                <div style={{ padding: 16, color: "white", textAlign: "center" }}>
                  {cardPreview.title || "Card"}
                </div>
              )}

              <button
                onClick={() => setCardPreview(null)}
                style={{
                  position: "absolute",
                  top: 8,
                  right: 8,
                  borderRadius: "999px",
                  border: "none",
                  padding: "4px 8px",
                  fontSize: 14,
                  cursor: "pointer",
                  background: "rgba(0,0,0,0.6)",
                  color: "white",
                }}
              >
                ✕
              </button>
            </div>
          )}
        </div>
      )}

      {/* Profile modal */}
      {profileStudent && (
        <ProfileModal
          mode={mode}
          student={profileStudent}
          onClose={() => setProfileStudentId(null)}
          onSave={(cosmetics) =>
            saveStudentProfileCosmetics(activeClassId, profileStudent.id, cosmetics)
          }
        />
      )}

      {/* Manage student modal (admin only) */}
      {mode === "admin" && selectedStudent && (
        <ManageStudentModal
          student={selectedStudent}
          classId={activeClassId}
          students={students}
          cards={cards}
          rewards={rewards}
          streakConfigs={activeClass?.streakConfigs || []}
          changeStudentStreakValue={changeStudentStreakValue}
          resetStudentStreak={resetStudentStreak}
          deleteStreakTypeForClass={deleteStreakTypeForClass}
          mode={mode}
          onEditStudent={(updates) => editStudent(activeClassId, selectedStudent.id, updates)}
          onClose={() => setSelectedStudentId(null)}
          onDeleteStudent={() => deleteStudent(activeClassId, selectedStudent.id)}
          onGiveCard={(cardId) => giveCardToStudent(activeClassId, selectedStudent.id, cardId)}
          onRemoveOne={(ownedId) => removeOwnedCardsBulk(activeClassId, selectedStudent.id, [ownedId])}
          onRemoveAll={(ownedIds) => removeOwnedCardsBulk(activeClassId, selectedStudent.id, ownedIds)}
          onRedeemIndividual={(rewardId) => redeemRewardIndividual(activeClassId, selectedStudent.id, rewardId)}
          onRedeemGroup={(rewardId, shares) => redeemRewardGroup(activeClassId, rewardId, shares)}
          setCardPreview={setCardPreview}
        />
      )}
    </div>
  );
}

/* ---------------- Components ---------------- */

function LibraryCardRow({ c, mode, onPreview, onDelete }) {
  const showURL = c.lockedImageURL || c.imageURL; // library shows locked
  return (
    <div
      style={{
        display: "flex",
        gap: 10,
        alignItems: "center",
        border: "1px solid #eee",
        padding: 10,
        borderRadius: 10,
        background: "#ffffff",
        marginBottom: 10,          // 👈 this creates the separation
      }}
    >
      <div
        style={{
          width: 68,
          height: 86,
          background: "#fafafa",
          cursor: "pointer",
          borderRadius: 8,
          overflow: "hidden",
        }}
        onClick={onPreview}
      >
        {showURL ? (
          <img
            src={showURL}
            alt={c.title}
            style={{ width: "100%", height: "100%", objectFit: "cover" }}
          />
        ) : (
          <div style={{ padding: 6 }}>{c.title}</div>
        )}
      </div>
      <div style={{ flex: 1 }}>
        <div style={{ fontWeight: 900 }}>{c.title}</div>
        <div className="muted">{c.description}</div>
        <div style={{ marginTop: 6, fontWeight: 900 }}>{c.points || 0} pts</div>
      </div>
      {mode === "admin" && (
        <div style={{ display: "flex", flexDirection: "column", gap: 8 }}>
          <button className="btn" onClick={onDelete}>
            Delete
          </button>
        </div>
      )}
    </div>
  );
}

function CardCreateForm({ onCreate, lockedInputRef, unlockedInputRef }) {
  const [title, setTitle] = useState("");
  const [description, setDescription] = useState("");
  const [points, setPoints] = useState(1);
  const [category, setCategory] = useState("points");
  const [lockedFile, setLockedFile] = useState(null);
  const [unlockedFile, setUnlockedFile] = useState(null);

  function handleCreate() {
    if (!title.trim()) return alert("Title required");
    onCreate({ title, description, points, category, lockedFile, unlockedFile });
    setTitle("");
    setDescription("");
    setPoints(1);
    setCategory("points");
    setLockedFile(null);
    setUnlockedFile(null);
    if (lockedInputRef?.current) lockedInputRef.current.value = "";
    if (unlockedInputRef?.current) unlockedInputRef.current.value = "";
  }

  return (
    <div>
      <input
        placeholder="Title"
        value={title}
        onChange={(e) => setTitle(e.target.value)}
        style={{ width: "100%", padding: 8, marginBottom: 8, borderRadius: 8, border: "1px solid #ddd" }}
      />
      <textarea
        placeholder="Description"
        value={description}
        onChange={(e) => setDescription(e.target.value)}
        style={{ width: "100%", padding: 8, height: 70, borderRadius: 8, border: "1px solid #ddd" }}
      />
      <div style={{ display: "flex", gap: 8, marginTop: 8, alignItems: "center", flexWrap: "wrap" }}>
        <input
          type="number"
          value={points}
          onChange={(e) => setPoints(e.target.value)}
          style={{ width: 90, padding: 8, borderRadius: 8, border: "1px solid #ddd" }}
        />
        <select
          value={category}
          onChange={(e) => setCategory(e.target.value)}
          style={{ padding: 8, borderRadius: 8, border: "1px solid #ddd" }}
        >
          <option value="points">Points</option>
          <option value="rewards">Rewards</option>
          <option value="experience">Experience</option>
        </select>
      </div>

      <div style={{ marginTop: 10, fontSize: 13 }}>
        <div style={{ marginBottom: 4 }}>Locked card (grey with lock)</div>
        <input
          ref={lockedInputRef}
          type="file"
          accept="image/*"
          onChange={(e) => setLockedFile(e.target.files?.[0] || null)}
        />
      </div>

      <div style={{ marginTop: 10, fontSize: 13 }}>
        <div style={{ marginBottom: 4 }}>Unlocked card (original/full colour)</div>
        <input
          ref={unlockedInputRef}
          type="file"
          accept="image/*"
          onChange={(e) => setUnlockedFile(e.target.files?.[0] || null)}
        />
      </div>

      <div style={{ marginTop: 10 }}>
        <button className="btn primary" onClick={handleCreate}>
          Add card
        </button>
      </div>
    </div>
  );
}

function RewardCreateForm({ cards, onCreate }) {
  const [title, setTitle] = useState("");
  const [cost, setCost] = useState(5);
  const [cardId, setCardId] = useState(cards?.[0]?.id || "");

  return (
    <div>
      <h4 style={{ marginTop: 0 }}>Create shop item</h4>
      <input
        placeholder="Reward title"
        value={title}
        onChange={(e) => setTitle(e.target.value)}
        style={{ width: "100%", padding: 8, marginBottom: 8, borderRadius: 8, border: "1px solid #ddd" }}
      />
      <div style={{ display: "flex", gap: 8 }}>
        <input
          type="number"
          value={cost}
          onChange={(e) => setCost(e.target.value)}
          style={{ padding: 8, width: 90, borderRadius: 8, border: "1px solid #ddd" }}
        />
        <select
          value={cardId}
          onChange={(e) => setCardId(e.target.value)}
          style={{ flex: 1, padding: 8, borderRadius: 8, border: "1px solid #ddd" }}
        >
          <option value="">-- link card (optional) --</option>
          {cards.map((c) => (
            <option key={c.id} value={c.id}>
              {c.title}
            </option>
          ))}
        </select>
      </div>
      <div style={{ marginTop: 10 }}>
        <button
          className="btn"
          onClick={() => {
            if (!title.trim()) return alert("Title required");
            onCreate({ title, cost, linkedCardId: cardId });
            setTitle("");
            setCost(5);
            setCardId(cards?.[0]?.id || "");
          }}
        >
          Add reward
        </button>
      </div>
    </div>
  );
}

function ProfileModal({ mode, student, onClose, onSave }) {
  const [emojis, setEmojis] = useState(student.nameEmojis || "");
  const [color, setColor] = useState(student.profileColor || "");

  const displayName = `${student.name}${emojis ? " " + emojis : ""}`;

  return (
    <div className="modal-backdrop" onClick={onClose}>
      <div className="modal" onClick={(e) => e.stopPropagation()}>
        <div style={{ display: "flex", justifyContent: "space-between", alignItems: "center", gap: 12 }}>
          <div>
            <h3 style={{ margin: 0 }}>Perfil</h3>
            <div className="muted">{displayName}</div>
          </div>
          <button className="btn" onClick={onClose}>Close</button>
        </div>

        <div style={{ marginTop: 14 }}>
          <h4 style={{ marginTop: 0 }}>Personalización</h4>

          <div style={{ marginBottom: 10 }}>
            <div className="muted" style={{ marginBottom: 6 }}>Emojis para tu nombre (no cambia el nombre)</div>
            <input
              value={emojis}
              onChange={(e) => setEmojis(e.target.value)}
              placeholder="Ej: ✨😺🔥"
              style={{ width: "100%", padding: 10, borderRadius: 10, border: "1px solid #ddd" }}
            />
          </div>

          <div style={{ marginBottom: 10 }}>
            <div className="muted" style={{ marginBottom: 6 }}>Color de fondo (pastel)</div>
            <div style={{ display: "flex", gap: 10, flexWrap: "wrap" }}>
              {PASTEL_COLORS.map((c) => (
                <button
                  key={c.value}
                  className="btn"
                  onClick={() => setColor(c.value)}
                  style={{
                    width: 44,
                    height: 44,
                    borderRadius: 12,
                    background: c.value,
                    border: color === c.value ? "2px solid #111" : "1px solid #ddd",
                  }}
                  title={c.name}
                />
              ))}
              <button className="btn" onClick={() => setColor("")}>Clear</button>
            </div>
          </div>

          <div style={{ marginTop: 14, display: "flex", gap: 8, flexWrap: "wrap" }}>
            <button className="btn" onClick={onClose}>Cancel</button>
            <button
              className="btn primary"
              onClick={() => onSave({ nameEmojis: emojis, profileColor: color })}
            >
              Save
            </button>
          </div>

          {mode === "reader" && (
            <div className="muted" style={{ marginTop: 10 }}>
              Nota: Sin login, cualquiera con acceso podría cambiar perfiles. Si quieres evitarlo, hay que activar Auth.
            </div>
          )}
        </div>
      </div>
    </div>
  );
}

function ManageStudentModal({
  student,
  classId,
  students,
  cards,
  rewards,
  streakConfigs,
  changeStudentStreakValue,
  resetStudentStreak,
  deleteStreakTypeForClass,
  mode,
  onEditStudent,
  onClose,
  onDeleteStudent,
  onGiveCard,
  onRemoveOne,
  onRemoveAll,
  onRedeemIndividual,
  onRedeemGroup,
  setCardPreview,
}) {
  const [redeemRewardId, setRedeemRewardId] = useState("");
  const [redeemMode, setRedeemMode] = useState("individual"); // individual | group
  const [shares, setShares] = useState({});

  useEffect(() => {
    setShares({});
  }, [redeemRewardId, redeemMode]);

  const reward = rewards.find((r) => r.id === redeemRewardId) || null;
  const requiredCost = Number(reward?.cost || 0);

  const selectedSharesTotal = useMemo(() => {
    return Object.values(shares).reduce((acc, v) => acc + Number(v || 0), 0);
  }, [shares]);

  // Group owned cards by cardId
  const groupedOwned = useMemo(() => {
    const map = new Map(); // cardId -> { cardId, title, imageURL, ownedIds[] }
    (student.cards || []).forEach((o) => {
      const key = o.cardId || "unknown";
      if (!map.has(key)) {
        map.set(key, {
          cardId: key,
          title: o.title || "—",
          imageURL: o.imageURL || "",
          ownedIds: [],
        });
      }
      map.get(key).ownedIds.push(o.id);
    });
    return Array.from(map.values());
  }, [student.cards]);

  // Give card list: exclude reward-category cards
  const giveableCards = useMemo(() => {
    return (cards || []).filter((c) => (c.category || "points") !== "rewards");
  }, [cards]);

  const [editName, setEditName] = useState(student.name || "");
  const [editCurrentPoints, setEditCurrentPoints] = useState(student.currentPoints || 0);
  const [editXP, setEditXP] = useState(student.xp || 0);
  const [editMultiplier, setEditMultiplier] = useState(
    typeof student.multiplier === "number" ? student.multiplier : 1
  );

  useEffect(() => {
    setEditName(student.name || "");
    setEditCurrentPoints(student.currentPoints || 0);
    setEditXP(student.xp || 0);
    setEditMultiplier(typeof student.multiplier === "number" ? student.multiplier : 1);
  }, [
    student.id, student.name, student.currentPoints, student.xp
  ]);

  function addQuickPoints(amount) {
    const m = typeof student.multiplier === "number" ? student.multiplier : 1;
    const effective = round2(Number(amount || 0) * m);
    const next = round2(Number(student.currentPoints || 0) + effective);
    setEditCurrentPoints(next);
    onEditStudent({ currentPoints: next });
  }


  function saveEdits() {
    onEditStudent({
      name: editName.trim(),
      currentPoints: Number(editCurrentPoints || 0),
      xp: Number(editXP || 0),
      multiplier: Number(parseFloat(editMultiplier) || 1),
    });
  }

  const classTotalPoints = students.reduce((sum, s) => sum + Number(s.currentPoints || 0), 0);

  return (
    <div className="modal-backdrop" onClick={onClose}>
      <div className="modal" onClick={(e) => e.stopPropagation()}>
        <div style={{ display: "flex", justifyContent: "space-between", alignItems: "center", gap: 12 }}>
          <div>
            <h3 style={{ margin: 0 }}>Manage: {student.name}</h3>
            <div className="muted">
              Current: <span className="pill">{student.currentPoints || 0} pts</span>{" "}
              • XP: <span className="pill">{student.xp || 0}</span>
            </div>
          </div>
          <div style={{ display: "flex", gap: 8 }}>
            <button className="btn" onClick={onClose}>Close</button>
            <button className="btn" onClick={onDeleteStudent}>Delete student</button>
          </div>
        </div>

        <div style={{ marginTop: 12, display: "grid", gridTemplateColumns: "1fr 380px", gap: 12 }}>
          {/* LEFT side */}
          <div>
            <div style={{ marginTop: 12, border: "1px solid #eee", borderRadius: 12, padding: 12 }}>
              <h4 style={{ marginTop: 0 }}>Editar alumno</h4>

              <div style={{ display: "grid", gap: 10 }}>
                <div>
                  <div className="muted" style={{ marginBottom: 6 }}>Nombre</div>
                  <input
                    value={editName}
                    onChange={(e) => setEditName(e.target.value)}
                    style={{ width: "100%", padding: 10, borderRadius: 10, border: "1px solid #ddd" }}
                  />
                </div>

                <div style={{ display: "grid", gridTemplateColumns: "1fr 1fr", gap: 10 }}>
                  <div>
                    <div className="muted" style={{ marginBottom: 6 }}>Puntos actuales</div>
                    <input
                      type="number"
                      value={editCurrentPoints}
                      onChange={(e) => setEditCurrentPoints(e.target.value)}
                      style={{ width: "100%", padding: 10, borderRadius: 10, border: "1px solid #ddd" }}
                    />
                    <div style={{ marginTop: 8, display: "flex", gap: 8, flexWrap: "wrap" }}>
                      <button className="btn" onClick={() => addQuickPoints(1)}>+1</button>
                      <button className="btn" onClick={() => addQuickPoints(5)}>+5</button>
                      <button className="btn" onClick={() => addQuickPoints(10)}>+10</button>
                    </div>
                  </div>

                  <div>
                    <div className="muted" style={{ marginBottom: 6 }}>XP</div>
                    <input
                      type="number"
                      value={editXP}
                      onChange={(e) => setEditXP(e.target.value)}
                      style={{ width: "100%", padding: 10, borderRadius: 10, border: "1px solid #ddd" }}
                    />
                  </div>
                </div>

                <div>
                  <div className="muted" style={{ marginBottom: 6 }}>Multiplier (x)</div>
                  <input
                    type="number"
                    step="0.01"
                    value={editMultiplier}
                    onChange={(e) => setEditMultiplier(e.target.value)}
                    className="input"
                  />
                  <div className="muted">Default is 1. Example: 1.25, 2, etc.</div>
                </div>

                <div style={{ display: "flex", gap: 8, flexWrap: "wrap" }}>
                  <button className="btn primary" onClick={saveEdits}>Guardar</button>
                  <button
                    className="btn"
                    onClick={() => {
                      setEditName(student.name || "");
                      setEditCurrentPoints(student.currentPoints || 0);
                      setEditXP(student.xp || 0);
                    }}
                  >
                    Deshacer
                  </button>
                </div>
              </div>
            </div>

            {/* NEW: generic streaks for this class */}
            {streakConfigs && streakConfigs.length > 0 && (
              <div style={{ marginTop: 16 }}>
                <h4 style={{ marginTop: 0 }}>Streaks</h4>
                <div style={{ display: "flex", flexDirection: "column", gap: 10 }}>
                  {streakConfigs.map((cfg) => {
                    const stObj =
                      (student.streaks && student.streaks[cfg.id]) || {
                        value: 0,
                        lastUpdated: "",
                      };
                    const emojiLine =
                      (cfg.emoji || "").repeat(stObj.value || 0) || cfg.emoji;
                    const date = stObj.lastUpdated || "";
                    const isToday = date && date === todayISODate();

                    return (
                      <div
                        key={cfg.id}
                        style={{
                          border: "1px solid #e5e7eb",
                          borderRadius: 8,
                          padding: 8,
                          display: "flex",
                          justifyContent: "space-between",
                          alignItems: "center",
                          gap: 8,
                          background: "#ffffff",
                        }}
                      >
                        <div>
                          <div style={{ fontSize: 14, fontWeight: 700 }}>
                            {cfg.emoji} streak (max {cfg.max})
                          </div>
                          <div style={{ fontSize: 13 }}>{emojiLine}</div>
                          {date && (
                            <div
                              style={{
                                fontSize: 11,
                                marginTop: 2,
                                color: isToday ? "#16a34a" : "#dc2626",
                                fontWeight: 600,
                              }}
                            >
                              Last: {date}
                            </div>
                          )}
                        </div>

                        {mode === "admin" && (
                          <div
                            style={{
                              display: "flex",
                              flexDirection: "column",
                              gap: 4,
                              alignItems: "flex-end",
                            }}
                          >
                            <div>
                              <button
                                className="btn"
                                onClick={() =>
                                  changeStudentStreakValue(
                                    classId,
                                    student.id,
                                    cfg.id,
                                    -1,
                                    cfg.max
                                  )
                                }
                              >
                                -1
                              </button>
                              <button
                                className="btn"
                                style={{ marginLeft: 4 }}
                                onClick={() =>
                                  changeStudentStreakValue(
                                    classId,
                                    student.id,
                                    cfg.id,
                                    +1,
                                    cfg.max
                                  )
                                }
                              >
                                +1
                              </button>
                            </div>
                            <button
                              className="btn"
                              style={{ fontSize: 11 }}
                              onClick={() =>
                                resetStudentStreak(classId, student.id, cfg.id)
                              }
                            >
                              Reset
                            </button>

                            <button
                              className="btn"
                              style={{ fontSize: 11, marginTop: 4, color: "#b91c1c", borderColor: "#fecaca" }}
                              onClick={() => deleteStreakTypeForClass(classId, cfg.id)}
                            >
                              Delete streak type
                            </button>
                          </div>
                        )}
                      </div>
                    );
                  })}
                </div>
              </div>
            )}

            {/* Owned cards (grouped) */}
            <div style={{ marginTop: 12, border: "1px solid #eee", borderRadius: 12, padding: 12 }}>
              <h4 style={{ marginTop: 0 }}>Owned cards (grouped)</h4>
              {!groupedOwned.length ? (
                <div className="muted">No cards yet</div>
              ) : (
                <div style={{ display: "grid", gridTemplateColumns: "repeat(2, 1fr)", gap: 10 }}>
                  {groupedOwned.map((g) => (
                    <div key={g.cardId} style={{ border: "1px solid #eee", borderRadius: 12, padding: 10 }}>
                      <div style={{ display: "flex", gap: 10, alignItems: "center" }}>
                        <div
                          className="card-thumb"
                          style={{ width: 70, height: 92, borderRadius: 10, overflow: "hidden", background: "#fafafa", cursor: "pointer" }}
                          onClick={() => setCardPreview({ title: g.title, imageURL: g.imageURL, description: "" })}
                        >
                          {g.imageURL ? (
                            <img src={g.imageURL} alt={g.title} style={{ width: "100%", height: "100%", objectFit: "cover" }} />
                          ) : (
                            <div style={{ padding: 6 }}>{g.title}</div>
                          )}
                        </div>
                        <div style={{ flex: 1 }}>
                          <div style={{ fontWeight: 900 }}>{g.title}</div>
                          <div className="muted">
                            Copies: <span className="pill">×{g.ownedIds.length}</span>
                          </div>
                        </div>
                      </div>

                      <div style={{ display: "flex", gap: 8, marginTop: 10, flexWrap: "wrap" }}>
                        <button className="btn" onClick={() => onRemoveOne(g.ownedIds[0])}>
                          Remove 1
                        </button>
                        <button
                          className="btn"
                          onClick={() => {
                            if (!window.confirm(`Remove ALL ${g.ownedIds.length} copies of "${g.title}"?`)) return;
                            onRemoveAll(g.ownedIds);
                          }}
                        >
                          Remove all
                        </button>
                      </div>
                    </div>
                  ))}
                </div>
              )}
            </div>

            {/* Redeem reward */}
            <div style={{ marginTop: 12, border: "1px solid #eee", borderRadius: 12, padding: 12 }}>
              <h4 style={{ marginTop: 0 }}>Redeem reward</h4>

              <div style={{ display: "flex", gap: 8, flexWrap: "wrap", alignItems: "center" }}>
                <select
                  value={redeemRewardId}
                  onChange={(e) => setRedeemRewardId(e.target.value)}
                  style={{ padding: 8, borderRadius: 8, border: "1px solid #ddd", minWidth: 240 }}
                >
                  <option value="">-- choose reward --</option>
                  {rewards.map((r) => (
                    <option key={r.id} value={r.id}>
                      {r.title} (cost {r.cost})
                    </option>
                  ))}
                </select>

                <label style={{ display: "flex", gap: 6, alignItems: "center" }}>
                  <input
                    type="radio"
                    name="redeemMode"
                    checked={redeemMode === "individual"}
                    onChange={() => setRedeemMode("individual")}
                  />
                  Individual
                </label>
                <label style={{ display: "flex", gap: 6, alignItems: "center" }}>
                  <input
                    type="radio"
                    name="redeemMode"
                    checked={redeemMode === "group"}
                    onChange={() => setRedeemMode("group")}
                  />
                  Group
                </label>
              </div>

              {redeemMode === "individual" && (
                <div style={{ marginTop: 10 }}>
                  <button
                    className="btn primary"
                    onClick={() => {
                      if (!redeemRewardId) return alert("Choose a reward first.");
                      onRedeemIndividual(redeemRewardId);
                    }}
                  >
                    Redeem (individual)
                  </button>
                </div>
              )}

              {redeemMode === "group" && (
                <div style={{ marginTop: 12 }}>
                  <div className="muted">
                    Assign shares so the total equals <span className="pill">{requiredCost} pts</span>.{" "}
                    Current total:{" "}
                    <span
                      className="pill"
                      style={{ background: selectedSharesTotal === requiredCost ? "#dcfce7" : "#fee2e2" }}
                    >
                      {selectedSharesTotal}
                    </span>
                  </div>

                  <div style={{ marginTop: 10, display: "grid", gap: 8 }}>
                    {students.map((s) => (
                      <div key={s.id} style={{ display: "flex", gap: 10, alignItems: "center", background: s.cosmetics?.color || "white", position: "relative", overflow: "hidden", }}>
                        <div style={{ flex: 1, fontWeight: 700 }}>
                          {s.name} <span className="muted">(has {s.currentPoints || 0} pts)</span>
                        </div>
                        <input
                          type="number"
                          min="0"
                          value={shares[s.id] ?? ""}
                          onChange={(e) => {
                            const raw = e.target.value;
                            setShares((prev) => ({
                              ...prev,
                              [s.id]: raw === "" ? "" : Number(raw),
                            }));
                          }}
                          style={{ width: 90, padding: 8, borderRadius: 8, border: "1px solid #ddd" }}
                          placeholder="0"
                        />
                      </div>
                    ))}
                  </div>

                  <div style={{ marginTop: 12 }}>
                    <button
                      className="btn primary"
                      onClick={() => {
                        if (!redeemRewardId) return alert("Choose a reward first.");
                        onRedeemGroup(redeemRewardId, shares);
                      }}
                    >
                      Redeem (group)
                    </button>
                  </div>
                </div>
              )}
            </div>

            {/* Rewards history */}
            <div style={{ marginTop: 12, border: "1px solid #eee", borderRadius: 12, padding: 12 }}>
              <h4 style={{ marginTop: 0 }}>Rewards history</h4>
              {!student.rewardsHistory?.length ? (
                <div className="muted">No rewards yet</div>
              ) : (
                <div style={{ display: "grid", gap: 6 }}>
                  {student.rewardsHistory
                    .slice()
                    .sort((a, b) => new Date(b.date || 0) - new Date(a.date || 0))
                    .map((rh) => (
                      <div
                        key={rh.id}
                        style={{ border: "1px solid #eee", borderRadius: 10, padding: 8 }}
                      >
                        <div style={{ fontWeight: 700 }}>{rh.title}</div>
                        <div className="muted">
                          {rh.cost} pts • {rh.mode === "group" ? "Group" : "Individual"} •{" "}
                          {rh.date ? new Date(rh.date).toLocaleString() : ""}
                        </div>
                      </div>
                    ))}
                </div>
              )}
            </div>
          </div>

          {/* RIGHT side: Give card */}
          <div style={{ border: "1px solid #eee", borderRadius: 12, padding: 12 }}>
            <h4 style={{ marginTop: 0 }}>Give card (not rewards)</h4>
            <div className="muted" style={{ marginBottom: 8 }}>
              Reward cards do not appear here. They are only obtained by redeeming rewards.
            </div>
            <div style={{ display: "grid", gap: 10 }}>
              {giveableCards.map((c) => (
                <div
                  key={c.id}
                  style={{
                    border: "1px solid #eee",
                    borderRadius: 12,
                    padding: 10,
                    display: "flex",
                    gap: 10,
                    alignItems: "center",
                  }}
                >
                  <div
                    style={{
                      width: 68,
                      height: 86,
                      borderRadius: 10,
                      overflow: "hidden",
                      background: "#fafafa",
                      cursor: "pointer",
                    }}
                  >
                    {(c.lockedImageURL || c.imageURL) ? (
                      <img
                        src={(c.lockedImageURL || c.imageURL)}
                        alt={c.title}
                        style={{ width: "100%", height: "100%", objectFit: "cover" }}
                      />
                    ) : (
                      <div style={{ padding: 6 }}>{c.title}</div>
                    )}
                  </div>
                  <div style={{ flex: 1 }}>
                    <div style={{ fontWeight: 900 }}>{c.title}</div>
                    <div className="muted">{c.description}</div>
                  </div>
                  <button className="btn primary" onClick={() => onGiveCard(c.id)}>
                    Give
                  </button>
                </div>
              ))}
            </div>
          </div>
        </div>
      </div>
    </div>
  );

}

/**
 * Firestore rules note (optional but recommended if you allow guest editing):
 *
 * match /classes/{classId}/students/{studentId} {
 *   allow read: if true;
 *   // only allow updating profile cosmetics for guests
 *   allow update: if request.resource.data.diff(resource.data).changedKeys().hasOnly(['nameEmojis','profileColor']);
 * }
 *
 * With Auth later, you can lock this down properly per-student.
 */