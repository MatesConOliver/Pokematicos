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
  getDocs,
  onSnapshot,
  query,
  orderBy,
  writeBatch,
  increment,
} from "firebase/firestore";
import {
  getStorage,
  ref as storageRef,
  uploadBytes,
  getDownloadURL,
} from "firebase/storage";
import {
  getAuth,
  onAuthStateChanged,
  signInWithEmailAndPassword,
  signOut,
} from "firebase/auth";


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
const auth = getAuth(app);

function uid(prefix = "id") {
  return `${prefix}_${Math.random().toString(36).slice(2, 10)}`;
}

function todayISODate() {
  const d = new Date();
  const y = d.getFullYear();
  const m = String(d.getMonth() + 1).padStart(2, "0");
  const day = String(d.getDate()).padStart(2, "0");
  return `${y}-${m}-${day}`; // local YYYY-MM-DD
}

function addDaysISO(isoDate, days) {
  const [y, m, d] = isoDate.split("-").map(Number);
  const dt = new Date(y, m - 1, d); // local date
  dt.setDate(dt.getDate() + Number(days || 0));
  const yy = dt.getFullYear();
  const mm = String(dt.getMonth() + 1).padStart(2, "0");
  const dd = String(dt.getDate()).padStart(2, "0");
  return `${yy}-${mm}-${dd}`;
}

function parseFloatScheduleInput(input, defaults = { delayDays: 7, durationDays: 7 }) {
  const fallback = {
    delayDays: Number.isFinite(defaults.delayDays) ? defaults.delayDays : 7,
    durationDays: Number.isFinite(defaults.durationDays) ? defaults.durationDays : 7,
  };

  if (input == null) return fallback;
  const s = String(input).trim();
  if (!s) return fallback;

  // 1) "a,b" format
  if (s.includes(",")) {
    const [a, b] = s.split(",").map((x) => x.trim());
    const delay = parseInt(a, 10);
    const dur = parseInt(b, 10);
    return {
      delayDays: Number.isFinite(delay) && delay >= 0 ? delay : fallback.delayDays,
      durationDays: Number.isFinite(dur) && dur > 0 ? dur : fallback.durationDays,
    };
  }

  // 2) key=value format: start=7 duration=10 (order doesn't matter)
  const mStart = s.match(/(?:start|delay)\s*=\s*(-?\d+)/i);
  const mDur = s.match(/(?:duration|days)\s*=\s*(-?\d+)/i);

  if (mStart || mDur) {
    const delay = mStart ? parseInt(mStart[1], 10) : fallback.delayDays;
    const dur = mDur ? parseInt(mDur[1], 10) : fallback.durationDays;
    return {
      delayDays: Number.isFinite(delay) && delay >= 0 ? delay : fallback.delayDays,
      durationDays: Number.isFinite(dur) && dur > 0 ? dur : fallback.durationDays,
    };
  }

  // 3) two numbers: "7 14"
  const nums = s.match(/-?\d+/g) || [];
  if (nums.length >= 2) {
    const delay = parseInt(nums[0], 10);
    const dur = parseInt(nums[1], 10);
    return {
      delayDays: Number.isFinite(delay) && delay >= 0 ? delay : fallback.delayDays,
      durationDays: Number.isFinite(dur) && dur > 0 ? dur : fallback.durationDays,
    };
  }

  // 4) single number means delay; use default duration
  const one = parseInt(nums[0], 10);
  return {
    delayDays: Number.isFinite(one) && one >= 0 ? one : fallback.delayDays,
    durationDays: fallback.durationDays,
  };
}

function normalizeFloatWindows(windows, today) {
  const list = Array.isArray(windows) ? windows : [];
  const cleaned = list
    .filter((w) => w && typeof w.start === "string" && typeof w.end === "string" && w.start && w.end)
    // prune windows fully in the past
    .filter((w) => !today || w.end >= today)
    .sort((a, b) => (a.start < b.start ? -1 : a.start > b.start ? 1 : 0));

  const merged = [];
  for (const w of cleaned) {
    if (merged.length === 0) {
      merged.push({ start: w.start, end: w.end });
      continue;
    }
    const last = merged[merged.length - 1];
    // merge if overlaps OR is adjacent (end + 1 day >= next.start)
    const lastEndPlus1 = addDaysISO(last.end, 1);
    if (w.start <= lastEndPlus1) {
      if (w.end > last.end) last.end = w.end;
    } else {
      merged.push({ start: w.start, end: w.end });
    }
  }
  return merged;
}

function isTodayInFloatWindows(today, windows) {
  if (!today) return false;
  const list = Array.isArray(windows) ? windows : [];
  return list.some((w) => w && w.start <= today && today <= w.end);
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

  const [authUser, setAuthUser] = useState(null);
  const [authChecked, setAuthChecked] = useState(false);
  const [showAdminForm, setShowAdminForm] = useState(false);

  const [adminEmail, setAdminEmail] = useState("");
  const [adminPass, setAdminPass] = useState("");
  const [adminError, setAdminError] = useState("");
  const [checkingAdmin, setCheckingAdmin] = useState(false);

  function enterReader() {
    setMode("reader");
  }

  // Watch login/logout
  useEffect(() => {
    const unsub = onAuthStateChanged(auth, async (user) => {
      setAuthUser(user || null);
      setAuthChecked(true);

      if (!user) {
        // logged out: keep chooser screen until user picks guest or logs in
        setCheckingAdmin(false);
        return;
      }

      // logged in: check if this user is in /admins/{uid}
      try {
        setCheckingAdmin(true);
        const adminSnap = await getDoc(doc(db, "admins", user.uid));
        if (adminSnap.exists()) {
          setMode("admin");
        } else {
          setMode("reader"); // logged in but not admin
        }
      } finally {
        setCheckingAdmin(false);
      }
    });

    return () => unsub();
  }, []);

  // Admin login action
  async function loginAdminEmailPassword() {
    setAdminError("");
    try {
      await signInWithEmailAndPassword(auth, adminEmail.trim(), adminPass);
      // onAuthStateChanged will run and set mode to admin if UID is in /admins
    } catch (e) {
      console.error(e);
      setAdminError("Login failed. Check email/password.");
    }
  }

  async function logout() {
    await signOut(auth);
    setMode(null);
    setAdminPass("");
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
  const [libraryTab, setLibraryTab] = useState("points"); // points | rewards | experience | extra
  const [cardPreview, setCardPreview] = useState(null);

  
  const [bulkGiveCard, setBulkGiveCard] = useState(null); // card object
  const [bulkGiveSelectedIds, setBulkGiveSelectedIds] = useState([]);
  // Admin manage modal selection (admin-only)
  const [selectedStudentId, setSelectedStudentId] = useState(null);

  // Profile modal selection (guest + admin)
  const [profileStudentId, setProfileStudentId] = useState(null);

  const newClassNameRef = useRef(null);
  const newStudentRef = useRef(null);

  // two file inputs for cards
  const lockedFileInputRef = useRef(null);
  const unlockedFileInputRef = useRef(null);

  const [globalBackgroundUrl, setGlobalBackgroundUrl] = useState(""); // Renamed from backgroundUrl
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

  const [editCard, setEditCard] = useState(null);

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

  // Keep listening to the global default background
  useEffect(() => {
    const bgDocRef = doc(db, "config", "background");
    const unsub = onSnapshot(bgDocRef, (snap) => {
      if (snap.exists()) {
        setGlobalBackgroundUrl(snap.data().url || "");
      } else {
        setGlobalBackgroundUrl("");
      }
    });
    return () => unsub();
  }, []);

  // 1. State for the "Sticky" background
  const [stickyBackground, setStickyBackground] = useState("");
  
  // 2. Ref to ensure we only load the global background ONCE (on startup)
  const hasLoadedInitialGlobal = useRef(false);

  // 3. Effect: Load Global Background ONLY on first load
  useEffect(() => {
    if (!hasLoadedInitialGlobal.current && globalBackgroundUrl) {
      setStickyBackground(globalBackgroundUrl);
      hasLoadedInitialGlobal.current = true;
    }
  }, [globalBackgroundUrl]);

  // 4. Effect: When a class is selected, set the background (Image or Blank)
  useEffect(() => {
    if (activeClassId) {
      // If class has a URL, use it. If not, use "" (Blank).
      // We do NOT fall back to globalBackgroundUrl here.
      const nextBg = activeClass?.backgroundUrl || ""; 
      setStickyBackground(nextBg);
    }
    // If activeClassId is null (unselected), we do NOTHING.
    // This preserves whatever background was last shown.
  }, [activeClassId, activeClass]);

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

  // Navigate through owned cards
  function ownedNav(delta) {
    setCardPreview((prev) => {
      if (!prev?.ownedList || prev.ownedList.length === 0) return prev;

      const max = prev.ownedList.length - 1;
      const currentIndex = Number.isFinite(prev.ownedIndex) ? prev.ownedIndex : 0;
      const nextIndex = Math.min(max, Math.max(0, currentIndex + delta));

      return { ...prev, ownedIndex: nextIndex };
    });
  }

  async function updateCard(cardId, updates) {
    if (!ensureClassSelected()) return;
    try {
      const cardRef = doc(db, `classes/${activeClassId}/cards/${cardId}`);
      const snap = await getDoc(cardRef);
      if (!snap.exists()) return alert("Card not found");
      const prev = snap.data();

      const {
        title,
        description,
        points,
        category,
        linkedStreakIds,
        lockedFile,
        unlockedFile,
      } = updates || {};

      let lockedImageURL = prev.lockedImageURL || "";
      let unlockedImageURL = prev.imageURL || "";

      const baseKey = uid(`cardedit_${cardId}`);

      if (lockedFile) {
        const keyLocked = `${baseKey}_locked_${lockedFile.name.replace(/\s+/g, "_")}`;
        const refLocked = storageRef(storage, `classes/${activeClassId}/cards/${keyLocked}`);
        const up = await uploadBytes(refLocked, lockedFile);
        lockedImageURL = await getDownloadURL(up.ref);
      }

      if (unlockedFile) {
        const keyUnlocked = `${baseKey}_unlocked_${unlockedFile.name.replace(/\s+/g, "_")}`;
        const refUnlocked = storageRef(storage, `classes/${activeClassId}/cards/${keyUnlocked}`);
        const up = await uploadBytes(refUnlocked, unlockedFile);
        unlockedImageURL = await getDownloadURL(up.ref);
      }

      // fallback: if only one image exists
      if (!unlockedImageURL && lockedImageURL) unlockedImageURL = lockedImageURL;
      if (!lockedImageURL && unlockedImageURL) lockedImageURL = unlockedImageURL;

      const nextCategory = (category || prev.category || "points");

      // clean + unique
      const cleanIds =
        nextCategory === "points"
          ? Array.from(new Set((Array.isArray(linkedStreakIds) ? linkedStreakIds : []).filter(Boolean).map(String)))
          : [];

      await updateDoc(cardRef, {
        title: (title || "").trim(),
        description: description || "",
        points: Number(points) || 0,
        category: nextCategory,

        // ✅ new source of truth (multi)
        linkedStreakIds: cleanIds,

        imageURL: unlockedImageURL,
        lockedImageURL,
        updatedAt: Date.now(),
      });
    } catch (err) {
      console.error("updateCard error", err);
      alert("Failed to update card. See console.");
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
    const float = !!(floatAns && floatAns.toLowerCase().startsWith("y"));

    // 4) Sticky celebration after reset?
    const stickyAns = prompt(
      "If you Reset this streak later, should the celebration (party + floating) keep showing for the rest of the day when max was reached? (yes/no)"
    );
    const stickyCelebrate = !!(stickyAns && stickyAns.toLowerCase().startsWith("y"));

    const id = uid("streak");
    const rewardCardIds = (promptPickRewardCardIds({ defaultIds: [], label: `${emoji} streak` }) ?? []);

    const newCfg = {
      id,
      emoji,
      max,
      float,
      stickyCelebrate,
      rewardCardIds,
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

  function getNewExperienceCards(currentCards, currentXp, allCards) {
    // 1. Find all cards that are category "experience"
    const xpCards = allCards.filter(c => c.category === "experience");
    
    // 2. Filter for ones we have reached the threshold for (card.points = threshold)
    const unlocked = xpCards.filter(c => currentXp >= (c.points || 0));

    // 3. Filter out ones the student ALREADY has
    // We check if the student's owned list contains a card with this source ID
    const newUnlocks = unlocked.filter(c => 
      !currentCards.some(owned => owned.cardId === c.id)
    );

    return newUnlocks;
  }

  function pushOwnedCard({ cardsArr, cardId, cardData, pointsGranted, streakId }) {
    cardsArr.push({
      id: uid("owned"),
      cardId,
      title: cardData.title || "",
      imageURL: cardData.imageURL || "",
      imageURL2: cardData.imageURL2 || "",
      grantedAt: new Date().toISOString(),
      pointsGranted: round2(pointsGranted || 0),
      autoFrom: { type: "streakMax", streakId },
    });
  }

  async function getCardDataFast(classId, cardId) {
    const local = (Array.isArray(cards) ? cards : []).find((c) => c.id === cardId);
    if (local) return local;

    const snap = await getDoc(doc(db, `classes/${classId}/cards/${cardId}`));
    if (!snap.exists()) return null;
    return { id: cardId, ...snap.data() };
  }

  async function setStickyCelebrateForClass(classId, streakId, stickyCelebrate) {
    try {
      const classRef = doc(db, `classes/${classId}`);
      const snap = await getDoc(classRef);
      if (!snap.exists()) return;

      const data = snap.data();
      const list = data.streakConfigs || [];

      const updated = list.map((cfg) =>
        cfg.id === streakId ? { ...cfg, stickyCelebrate: !!stickyCelebrate } : cfg
      );

      await updateDoc(classRef, { streakConfigs: updated });
    } catch (err) {
      console.error("setStickyCelebrateForClass error", err);
      alert("Could not update sticky celebration.");
    }
  }

  function promptPickRewardCardIds({ defaultIds = [], label = "" } = {}) {
    // Only points cards make sense as “reward cards” because they add points.
    const opts = (Array.isArray(cards) ? cards : [])
      .filter((c) => ((c.category || "points") === "points"))
      .slice()
      .sort((a, b) => String(a.title || "").localeCompare(String(b.title || "")));

    if (opts.length === 0) {
      alert("No POINTS cards found in the library. Create a points card first.");
      return null; // signal: nothing changed / can’t pick
    }

    const idToNum = new Map(opts.map((c, i) => [c.id, i + 1]));
    const currentNums = (defaultIds || []).map((id) => idToNum.get(id)).filter(Boolean);
    const defaultText = currentNums.length ? currentNums.join(",") : "";

    const list = opts
      .map((c, i) => `${i + 1}) ${c.title || "(untitled)"} — ${Number(c.points || 0)} pts`)
      .join("\n");

    const input = prompt(
      `Reward card(s) when ${label || "this"} streak reaches MAX.\n` +
        `Choose numbers separated by commas (example: 1,3).\n` +
        `Leave empty for NONE.\n\n${list}`,
      defaultText
    );

    if (input == null) return undefined; // cancel => keep existing
    const s = String(input).trim();
    if (!s) return []; // empty => clear

    const parts = s.split(",").map((x) => x.trim()).filter(Boolean);

    const picked = [];
    for (const p of parts) {
      // allow selecting by number
      const n = parseInt(p, 10);
      if (Number.isFinite(n) && n >= 1 && n <= opts.length) {
        picked.push(opts[n - 1].id);
        continue;
      }
      // allow pasting cardId directly (optional)
      const byId = opts.find((c) => c.id === p);
      if (byId) picked.push(byId.id);
    }

    return Array.from(new Set(picked));
  }

  async function setStreakRewardCardsForClass(classId, streakId, cfg) {
    try {
      const current = classesList.find((c) => c.id === classId)?.streakConfigs || [];
      const found = current.find((c) => c.id === streakId) || cfg || null;
      const existing = Array.isArray(found?.rewardCardIds) ? found.rewardCardIds : [];

      const next = promptPickRewardCardIds({
        defaultIds: existing,
        label: found?.emoji ? `${found.emoji} streak` : "this streak",
      });

      if (next === null) return;        // no points cards exist
      if (next === undefined) return;   // user cancelled

      const nextConfigs = current.map((c) =>
        c.id === streakId ? { ...c, rewardCardIds: next } : c
      );

      await updateDoc(doc(db, `classes/${classId}`), { streakConfigs: nextConfigs });
    } catch (e) {
      console.error("setStreakRewardCardsForClass error", e);
      alert("Could not set reward cards. See console.");
    }
  }

  // --- STUDENT STREAKS edit (generic) ---
  async function changeStudentStreakValue(classId, studentId, streakId, delta, maxValueOrCfg) {
    try {
      const studentRef = doc(db, `classes/${classId}/students/${studentId}`);
      const snap = await getDoc(studentRef);
      if (!snap.exists()) return;
      const data = snap.data();

      const streaks = data.streaks || {};
      const existingEntry = streaks[streakId] || {};
      const current = existingEntry.value || 0;

      // Accept either a number maxValue OR the full cfg object
      const cfg = maxValueOrCfg && typeof maxValueOrCfg === "object" ? maxValueOrCfg : null;
      const maxValue =
        typeof maxValueOrCfg === "number"
          ? maxValueOrCfg
          : typeof cfg?.max === "number"
          ? cfg.max
          : 0;

      let next = current + delta;
      if (next < 0) next = 0;
      if (typeof maxValue === "number" && maxValue > 0 && next > maxValue) {
        next = maxValue;
      }

      const today = todayISODate();
      const prevMaxAchievedOn = existingEntry.maxAchievedOn || "";

      const reachedMaxNow = delta > 0 && typeof maxValue === "number" && maxValue > 0 && next === maxValue;
      const crossedToMax = reachedMaxNow && current < maxValue;

      // Keep existing float windows; add new one only when we CROSS into max
      let floatWindows = Array.isArray(existingEntry.floatWindows) ? existingEntry.floatWindows : [];

      if (crossedToMax && cfg?.float) {
        const defaultDelay = 7;
        const defaultDur = 7;

        const delayStr = prompt(
          `🎉 ${data.name || "Student"} reached the maximum for ${cfg.emoji || "this"} streak!
          Floating emoji: how many DAYS after today should it start?
          (Example: 0 = today, 7 = next week)`,
          String(defaultDelay)
        );
        const durationStr = prompt(
          `How many DAYS should the floating emoji last? (Example: 7 = one full week)`,
          String(defaultDur)
        );

        let delayDays = parseInt((delayStr ?? String(defaultDelay)).trim(), 10);
        if (!Number.isFinite(delayDays) || delayDays < 0) delayDays = defaultDelay;

        let durationDays = parseInt((durationStr ?? String(defaultDur)).trim(), 10);
        if (!Number.isFinite(durationDays) || durationDays <= 0) durationDays = defaultDur;

        const start = addDaysISO(today, delayDays);
        const end = addDaysISO(start, durationDays - 1);

        floatWindows = normalizeFloatWindows([...floatWindows, { start, end }], today);
      } else {
        // still prune old windows to keep data light
        floatWindows = normalizeFloatWindows(floatWindows, today);
      }

      const updatedEntry = {
        ...existingEntry,
        value: next,
        lastUpdated: delta > 0 ? today : (existingEntry.lastUpdated || ""),
        // If we hit max today (even if we were already at max and pressed +1) -> mark today.
        // Otherwise keep whatever date was recorded.
        maxAchievedOn: reachedMaxNow ? today : prevMaxAchievedOn,
        floatWindows,
      };

      const updatedStreaks = {
        ...streaks,
        [streakId]: updatedEntry,
      };

      const payload = { streaks: updatedStreaks };

      if (crossedToMax) {
        const rewardIds = Array.isArray(cfg?.rewardCardIds) ? cfg.rewardCardIds : [];
        if (rewardIds.length) {
          const multiplier = typeof data.multiplier === "number" ? data.multiplier : 1;
          const cardsArr = Array.isArray(data.cards) ? [...data.cards] : [];
          let currentPoints = Number(data.currentPoints || 0);

          const dedupe = new Set();

          for (const rewardCardId of rewardIds) {
            if (!rewardCardId || dedupe.has(rewardCardId)) continue;

            const rewardCard = await getCardDataFast(classId, rewardCardId);
            if (!rewardCard) continue;
            if ((rewardCard.category || "points") !== "points") continue;

            const pts = round2(Number(rewardCard.points || 0) * multiplier);

            pushOwnedCard({
              cardsArr,
              cardId: rewardCardId,
              cardData: rewardCard,
              pointsGranted: pts,
              streakId,
            });

            currentPoints = round2(currentPoints + pts);
            dedupe.add(rewardCardId);
          }

          payload.cards = cardsArr;
          payload.currentPoints = currentPoints;
        }
      }

      await updateDoc(studentRef, payload);
      
      // No setSelectedStudent – snapshot will refresh students list
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

      const prev = streaks[streakId] || {};
      const updatedEntry = {
        value: 0,
        lastUpdated: "",
        maxAchievedOn: prev.maxAchievedOn || "",
        floatWindows: Array.isArray(prev.floatWindows) ? prev.floatWindows : [],
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
    if (
      !window.confirm(
        "Delete this streak type for the whole class? This cannot be undone.\n\nThis will also remove it (and any floating windows) from every student."
      )
    ) {
      return;
    }

    try {
      // 1) Remove from class config
      const classRef = doc(db, `classes/${classId}`);
      const snap = await getDoc(classRef);
      if (!snap.exists()) return;
      const data = snap.data();
      const list = data.streakConfigs || [];
      const updated = list.filter((cfg) => cfg.id !== streakId);
      await updateDoc(classRef, { streakConfigs: updated });

      // 2) Remove from every student (including floatWindows)
      const studentsSnap = await getDocs(collection(db, `classes/${classId}/students`));
      let batch = writeBatch(db);
      let writes = 0;

      for (const sdoc of studentsSnap.docs) {
        const sdata = sdoc.data();
        const streaks = sdata.streaks || {};
        if (!streaks[streakId]) continue;

        const nextStreaks = { ...streaks };
        delete nextStreaks[streakId];

        batch.update(sdoc.ref, { streaks: nextStreaks });
        writes++;

        // Firestore batch limit safety
        if (writes >= 450) {
          await batch.commit();
          batch = writeBatch(db);
          writes = 0;
        }
      }
      if (writes > 0) await batch.commit();
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
      const timestamp = Date.now();
      
      // DECISION: Are we uploading for a specific class or the global default?
      let storagePath;
      let firestoreRef;
      
      if (activeClassId) {
        // 1. Class Specific
        // We store it in a subfolder so your bucket stays clean
        storagePath = `classes/${activeClassId}/backgrounds/bg_${timestamp}_${safeName}`;
        firestoreRef = doc(db, "classes", activeClassId);
      } else {
        // 2. Global Default (Your existing logic)
        storagePath = `backgrounds/bg_${timestamp}_${safeName}`;
        firestoreRef = doc(db, "config", "background");
      }
  
      // A. Upload the file to Firebase Storage
      const ref = storageRef(storage, storagePath);
      const snapshot = await uploadBytes(ref, file);
      const url = await getDownloadURL(snapshot.ref);
  
      // B. Save the URL to the correct Firestore document
      if (activeClassId) {
        // Update the CLASS document
        await updateDoc(firestoreRef, { backgroundUrl: url });
        alert(`Background updated for ${activeClass.name}!`);
      } else {
        // Update the CONFIG document
        await setDoc(firestoreRef, { url });
        alert("Global default background updated!");
      }
  
    } catch (err) {
      console.error("uploadBackgroundImage error:", err);
      alert("Failed to upload background image.");
    }
  }

  // Remove background image (for active class, and set to none)
  async function clearBackgroundImage() {
    try {
      if (activeClassId) {
        // Remove ONLY the class background (reverting it to the global default)
        await updateDoc(doc(db, "classes", activeClassId), { 
          backgroundUrl: "" 
        });
        alert(`Removed background for ${activeClass.name}. Now using default.`);
      } else {
        // Remove the global background
        await setDoc(doc(db, "config", "background"), { url: "" });
        alert("Global background removed!");
      }
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

  async function quickAddPoints(classId, studentId, amount) {
    const rawAmount = Number(amount || 0);
    if (!Number.isFinite(rawAmount) || rawAmount === 0) return;

    try {
      const studentRef = doc(db, `classes/${classId}/students/${studentId}`);
      // 1. Get current multiplier
      const snap = await getDoc(studentRef);
      if (!snap.exists()) return;
      const sdata = snap.data();
      const mult = typeof sdata.multiplier === "number" ? sdata.multiplier : 1;

      // 2. Apply multiplier
      const effective = round2(rawAmount * mult);

      // 3. Update (using increment for safety, or direct set if you prefer exact calc)
      await updateDoc(studentRef, { currentPoints: increment(effective) });
    } catch (err) {
      console.error("quickAddPoints error", err);
      alert("Could not add points.");
    }
  }

  // Profile cosmetics (guest allowed if rules permit)
  async function saveStudentProfileCosmetics(
    classId,
    studentId,
    { nameEmojis, profileColor }
  ) {
    const safeEmojis = (nameEmojis || "").toString().slice(0, 2);
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
    linkedStreakIds = [],
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

      const cleanLinked = Array.isArray(linkedStreakIds)
        ? linkedStreakIds.filter(Boolean)
        : [];
      
      const payload = {
        title: title.trim(),
        description: description || "",
        points: Number(points) || 0,
        category: category || "points",
        linkedStreakIds: category === "points" ? cleanLinked : [],
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
  

  // Cards given increment linked streak automatically (if needed)
  function incrementLinkedStreakIfNeeded(sdata, idsOrId, opts = {}) {
    const today = todayISODate();
    const ids = Array.isArray(idsOrId)
      ? idsOrId.filter(Boolean)
      : (idsOrId ? [idsOrId] : []);

    if (ids.length === 0) return null;

    const streaks = { ...(sdata.streaks || {}) };
    let changed = false;

    const allowPrompts = opts.allowPrompts !== false; // default true
    const studentName = opts.studentName || sdata.name || "Student";
    const progress = opts.progressLabel ? ` (${opts.progressLabel})` : "";

    const crossedMaxIds = [];

    const defaultDelay = Number.isFinite(opts.defaultDelayDays) ? opts.defaultDelayDays : 7;
    const defaultDur = Number.isFinite(opts.defaultDurationDays) ? opts.defaultDurationDays : 7;

    for (const id of ids) {
      const prev = streaks[id] || { value: 0, lastUpdated: "", maxAchievedOn: "", floatWindows: [] };

      // already increased today -> do nothing
      if ((prev.lastUpdated || "") === today) continue;

      const cfg = (activeClass?.streakConfigs || []).find((c) => c.id === id) || null;
      const max = typeof cfg?.max === "number" ? cfg.max : 0;

      let nextVal = (prev.value || 0) + 1;
      if (max > 0 && nextVal > max) nextVal = max;

      const crossedToMax = max > 0 && nextVal === max && (prev.value || 0) < max;
      if (crossedToMax) crossedMaxIds.push(id);

      // keep/prune existing windows
      let floatWindows = Array.isArray(prev.floatWindows) ? prev.floatWindows : [];
      floatWindows = normalizeFloatWindows(floatWindows, today);

      // If we just reached max AND this streak is configured for floating:
      if (crossedToMax && cfg?.float) {
        let delayDays = defaultDelay;
        let durationDays = defaultDur;

        if (allowPrompts) {
          const streakLabel = cfg?.emoji ? `${cfg.emoji} streak` : "this streak";

          const input = prompt(
            `🎉 Max reached for ${studentName}${progress}!\n\n` +
              `${streakLabel}: floating emoji schedule\n` +
              `Type: delay,duration\n` +
              `Examples:\n` +
              `  0,7   (start today, 7 days)\n` +
              `  7,14  (start in 7 days, 14 days)\n` +
              `  start=3 duration=10\n`,
            `${defaultDelay},${defaultDur}`
          );

          const parsed = parseFloatScheduleInput(input, {
            delayDays: defaultDelay,
            durationDays: defaultDur,
          });

          delayDays = parsed.delayDays;
          durationDays = parsed.durationDays;
        }

        const start = addDaysISO(today, delayDays);
        const end = addDaysISO(start, durationDays - 1);
        floatWindows = normalizeFloatWindows([...floatWindows, { start, end }], today);
      }

      streaks[id] = {
        ...prev,
        value: nextVal,
        lastUpdated: today,
        maxAchievedOn: crossedToMax ? today : (prev.maxAchievedOn || ""),
        floatWindows,
      };

      changed = true;
    }

    return { nextStreaks: changed ? streaks : null, crossedMaxIds };
  }

  function incrementStreaksNoFloatWindows(sdata, ids, streakConfigs) {
    const today = todayISODate();
    const streaks = { ...(sdata.streaks || {}) };
    let changed = false;

    const crossedFloatIds = [];
    const crossedMaxIds = [];

    for (const id of (Array.isArray(ids) ? ids.filter(Boolean) : [])) {
      const prev = streaks[id] || { value: 0, lastUpdated: "", maxAchievedOn: "", floatWindows: [] };

      // already increased today -> do nothing
      if ((prev.lastUpdated || "") === today) continue;

      const cfg = (streakConfigs || []).find((c) => c.id === id) || null;
      const max = typeof cfg?.max === "number" ? cfg.max : 0;

      let nextVal = (prev.value || 0) + 1;
      if (max > 0 && nextVal > max) nextVal = max;

      const crossedToMax = max > 0 && nextVal === max && (prev.value || 0) < max;

      // prune old windows but do NOT add new ones yet
      let floatWindows = Array.isArray(prev.floatWindows) ? prev.floatWindows : [];
      floatWindows = normalizeFloatWindows(floatWindows, today);

      if (crossedToMax) crossedMaxIds.push(id);
      if (crossedToMax && cfg?.float) crossedFloatIds.push(id);

      streaks[id] = {
        ...prev,
        value: nextVal,
        lastUpdated: today,
        maxAchievedOn: crossedToMax ? today : (prev.maxAchievedOn || ""),
        floatWindows,
      };

      changed = true;
    }

    return { nextStreaks: changed ? streaks : null, crossedFloatIds, crossedMaxIds };
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

      const linkedIds =
        category === "points"
          ? (Array.isArray(cardData.linkedStreakIds) ? cardData.linkedStreakIds : [])
          : [];

      const res = incrementLinkedStreakIfNeeded(sdata, linkedIds, {
        allowPrompts: true,
        studentName: sdata.name || "",
      });

      const nextStreaks = res?.nextStreaks || null;
      const crossedMaxIds = Array.isArray(res?.crossedMaxIds) ? res.crossedMaxIds : [];

      // ✅ Auto-give rewards for streaks that just hit MAX
      if (crossedMaxIds.length) {
        const streakConfigs = activeClass?.streakConfigs || [];
        const multiplier = typeof sdata.multiplier === "number" ? sdata.multiplier : 1;

        const givenRewardCardIds = new Set(); // prevent duplicates in the same click

        for (const streakId of crossedMaxIds) {
          const cfg = streakConfigs.find((c) => c.id === streakId);
          const rewardIds = Array.isArray(cfg?.rewardCardIds) ? cfg.rewardCardIds : [];
          for (const rewardCardId of rewardIds) {
            if (!rewardCardId || givenRewardCardIds.has(rewardCardId)) continue;

            const rewardCard = await getCardDataFast(classId, rewardCardId);
            if (!rewardCard) continue;

            if ((rewardCard.category || "points") !== "points") continue; // only points cards add points

            const base = Number(rewardCard.points || 0);
            const pts = round2(base * multiplier);

            pushOwnedCard({
              cardsArr,
              cardId: rewardCardId,
              cardData: rewardCard,
              pointsGranted: pts,
              streakId,
            });

            currentPoints = round2(currentPoints + pts);
            givenRewardCardIds.add(rewardCardId);
          }
        }
      }

      const payload = { cards: cardsArr, currentPoints };
      if (nextStreaks) payload.streaks = nextStreaks;

      await updateDoc(studentRef, payload);

      // no success alert on purpose
    } catch (err) {
      console.error(err);
      alert("Failed to give card.");
    }
  }


  // Bulk give: give ONE library card to MANY students (points are multiplied by each student's multiplier).
  // Uses per-student reads to keep it correct even if points/cards changed elsewhere.
  async function giveCardToStudentsBulk(classId, cardId, studentIds) {
    if (!classId) return;
    if (!Array.isArray(studentIds) || studentIds.length === 0) return;

    const floatHitsByStreak = new Map(); // for scheduling float windows
    const maxHitsByStreak = new Map();   // for rewards (reached MAX even if float disabled)

    try {
      const cardSnap = await getDoc(doc(db, `classes/${classId}/cards/${cardId}`));
      if (!cardSnap.exists()) return alert("Card not found");
      const cardData = cardSnap.data();

      const category = cardData.category || "points";
      if (category === "rewards") return alert("Rewards cards can't be given directly.");

      const basePoints = category === "points" ? Number(cardData.points || 0) : 0;
      const linkedIds =
        category === "points" ? (Array.isArray(cardData.linkedStreakIds) ? cardData.linkedStreakIds : []) : [];

      const streakConfigs = activeClass?.streakConfigs || [];
      const today = todayISODate();

      // Phase 1: read + prepare updates, collect "who hit max" per streak
      const pending = []; // { studentRef, cardsArr, currentPoints, nextStreaks }
      const maxHitsByStreak = new Map(); // streakId -> array of { idx, name }

      for (let i = 0; i < studentIds.length; i++) {
        const studentId = studentIds[i];
        const studentRef = doc(db, `classes/${classId}/students/${studentId}`);
        const studentSnap = await getDoc(studentRef);
        if (!studentSnap.exists()) continue;
        const sdata = studentSnap.data();

        const multiplier = typeof sdata.multiplier === "number" ? sdata.multiplier : 1;
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

        let nextStreaks = null;
        let crossedFloatIds = [];
        let crossedMaxIds = [];

        if (linkedIds.length > 0) {
          const res = incrementStreaksNoFloatWindows(sdata, linkedIds, streakConfigs);
          nextStreaks = res.nextStreaks;
          crossedFloatIds = res.crossedFloatIds;
          crossedMaxIds = Array.isArray(res.crossedMaxIds) ? res.crossedMaxIds : [];
        }

        const idx = pending.length;
        pending.push({
          studentRef,
          studentName: sdata.name || studentId,
          multiplier,
          cardsArr,
          currentPoints,
          nextStreaks,
        });

        for (const streakId of crossedFloatIds) {
          if (!floatHitsByStreak.has(streakId)) floatHitsByStreak.set(streakId, []);
          floatHitsByStreak.get(streakId).push({ idx, name: sdata.name || studentId });
        }

        for (const streakId of crossedMaxIds) {
          if (!maxHitsByStreak.has(streakId)) maxHitsByStreak.set(streakId, []);
          maxHitsByStreak.get(streakId).push({ idx, name: sdata.name || studentId });
        }
      }

      // Phase 2: ONE prompt per streak that had max hits, then apply to all those students
      const defaultDelay = 7;
      const defaultDur = 7;

      for (const [streakId, hits] of maxHitsByStreak.entries()) {
        const cfg = streakConfigs.find((c) => c.id === streakId) || null;
        const emoji = cfg?.emoji || "⭐";

        const names = hits.map((h) => h.name);
        const preview = names.slice(0, 12).join(", ");
        const more = names.length > 12 ? ` (+${names.length - 12} more)` : "";

        const input = prompt(
          `🎉 Bulk give: ${emoji} streak reached MAX today by ${names.length} students:\n` +
            `${preview}${more}\n\n` +
            `Floating emoji schedule (applies to ALL above students for this streak)\n` +
            `Type: delay,duration  (examples: 0,7  or  7,14  or  start=3 duration=10)`,
          `${defaultDelay},${defaultDur}`
        );

        const { delayDays, durationDays } = parseFloatScheduleInput(input, {
          delayDays: defaultDelay,
          durationDays: defaultDur,
        });

        const start = addDaysISO(today, delayDays);
        const end = addDaysISO(start, durationDays - 1);

        for (const h of hits) {
          const item = pending[h.idx];
          if (!item?.nextStreaks) continue;

          const prevEntry = item.nextStreaks[streakId] || { value: 0, lastUpdated: today, maxAchievedOn: today, floatWindows: [] };
          let floatWindows = Array.isArray(prevEntry.floatWindows) ? prevEntry.floatWindows : [];
          floatWindows = normalizeFloatWindows([...floatWindows, { start, end }], today);

          item.nextStreaks = {
            ...item.nextStreaks,
            [streakId]: { ...prevEntry, floatWindows },
          };
        }
      }

      // Phase 2B: award reward cards for everyone who reached MAX (per streak)
      const rewardCache = new Map(); // cardId -> cardData

      for (const [streakId, hits] of maxHitsByStreak.entries()) {
        const cfg = streakConfigs.find((c) => c.id === streakId) || null;
        const rewardIds = Array.isArray(cfg?.rewardCardIds) ? cfg.rewardCardIds : [];
        if (rewardIds.length === 0) continue;

        for (const rewardCardId of rewardIds) {
          if (!rewardCardId) continue;

          if (!rewardCache.has(rewardCardId)) {
            const cd = await getCardDataFast(classId, rewardCardId);
            rewardCache.set(rewardCardId, cd || null);
          }
        }

        for (const h of hits) {
          const item = pending[h.idx];
          if (!item) continue;

          item._rewardDone = item._rewardDone || new Set(); // per-student dedupe during this bulk click

          for (const rewardCardId of rewardIds) {
            if (!rewardCardId || item._rewardDone.has(rewardCardId)) continue;

            const rewardCard = rewardCache.get(rewardCardId);
            if (!rewardCard) continue;
            if ((rewardCard.category || "points") !== "points") continue;

            const base = Number(rewardCard.points || 0);
            const mult = typeof item.multiplier === "number" ? item.multiplier : 1;
            const pts = round2(base * mult);

            pushOwnedCard({
              cardsArr: item.cardsArr,
              cardId: rewardCardId,
              cardData: rewardCard,
              pointsGranted: pts,
              streakId,
            });

            item.currentPoints = round2(item.currentPoints + pts);
            item._rewardDone.add(rewardCardId);
          }
        }
      }

      // Phase 3: write updates in Firestore batches
      let batch = writeBatch(db);
      let writes = 0;
      let given = 0;

      for (const item of pending) {
        const payload = { cards: item.cardsArr, currentPoints: item.currentPoints };
        if (item.nextStreaks) payload.streaks = item.nextStreaks;

        batch.update(item.studentRef, payload);
        writes += 1;
        given += 1;

        if (writes >= 450) {
          await batch.commit();
          batch = writeBatch(db);
          writes = 0;
        }
      }

      if (writes > 0) await batch.commit();
      alert(`Card given to ${given} student${given === 1 ? "" : "s"}.`);
    } catch (err) {
      console.error("giveCardToStudentsBulk error", err);
      alert("Failed to give card to students. See console.");
    }
  }

  function openBulkGive(card) {
    setBulkGiveCard(card);
    setBulkGiveSelectedIds([]);
  }

  function toggleBulkGiveStudent(studentId) {
    setBulkGiveSelectedIds((prev) =>
      prev.includes(studentId) ? prev.filter((id) => id !== studentId) : [...prev, studentId]
    );
  }

  function toggleBulkGiveSelectAll() {
    setBulkGiveSelectedIds((prev) => (prev.length === students.length ? [] : students.map((s) => s.id)));
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

  // ✅ Auto-unlock EXPERIENCE cards when XP reaches the card's "points" threshold
  function unlockExperienceCards({ allCards, cardsArr, xpAfter, nowISO }) {
    const library = Array.isArray(allCards) ? allCards : [];
    if (library.length === 0) return cardsArr; // safety: if cards not loaded yet, do nothing

    const ownedCardIds = new Set(
      (Array.isArray(cardsArr) ? cardsArr : [])
        .map((o) => o?.cardId)
        .filter(Boolean)
    );

    // Experience cards: category === "experience"
    const eligible = library
      .filter((c) => (c.category || "points") === "experience")
      .filter((c) => Number(c.points ?? 0) >= 0) // allow 0+ thresholds
      .filter((c) => (Number(xpAfter) || 0) >= Number(c.points ?? 0))
      .filter((c) => c?.id && !ownedCardIds.has(c.id))
      .sort((a, b) => Number(a.points ?? 0) - Number(b.points ?? 0));

    if (eligible.length === 0) return cardsArr;

    const next = [...(Array.isArray(cardsArr) ? cardsArr : [])];

    for (const c of eligible) {
      next.push({
        id: uid("owned"),
        cardId: c.id,
        title: c.title || "",
        imageURL: c.imageURL || "",
        grantedAt: nowISO,
        pointsGranted: 0, // purely cosmetic
        autoFrom: { type: "xpUnlock", xpRequired: Number(c.points ?? 0), xpAt: Number(xpAfter) || 0 },
      });
    }

    return next;
  }

  // Redeem: individual
  async function redeemIndividual(classId, studentId, rewardId) {
    if (!classId || !studentId || !rewardId) return;
    const r = rewards.find((x) => x.id === rewardId);
    if (!r) return alert("Reward not found");

    const cost = Number(r.cost || 0);
    const s = students.find((x) => x.id === studentId);
    if (!s) return;

    if ((s.currentPoints || 0) < cost) {
      return alert("Not enough points!");
    }

    if (!window.confirm(`Redeem "${r.title}" for ${cost} points?`)) return;

    try {
      const studentRef = doc(db, `classes/${classId}/students/${studentId}`);
      const now = new Date().toISOString();

      // 1. Calculate new XP (Points Spent -> XP)
      const oldXp = Number(s.xp || 0);
      const newXp = oldXp + cost;

      // 2. Create history entry
      const historyEntry = {
        id: uid("rh"),
        rewardId,
        title: r.title,
        cost: cost,
        date: now,
        type: "individual",
      };

      // 3. Handle Cards (Reward Card + Potential XP Cards)
      let newCards = [...(s.cards || [])];

      // A) Reward Card (if the reward itself is a card)
      if (r.cardId) {
        const linkedCard = cards.find((c) => c.id === r.cardId);
        if (linkedCard) {
          pushOwnedCard({
            cardsArr: newCards,
            cardId: r.cardId,
            cardData: linkedCard,
            pointsGranted: 0,
            streakId: "reward",
          });
        }
      }

      // B) XP Unlock Check (The fix!)
      const unlockedXpCards = getNewExperienceCards(newCards, newXp, cards);
      unlockedXpCards.forEach(c => {
        pushOwnedCard({
          cardsArr: newCards,
          cardId: c.id,
          cardData: c,
          pointsGranted: 0, // Experience cards usually don't give points themselves, they are the prize
          streakId: "xp_unlock",
        });
      });

      // 4. Update Database
      await updateDoc(studentRef, {
        currentPoints: increment(-cost),
        xp: newXp, // Save the new XP
        rewardsHistory: [ ...(s.rewardsHistory || []), historyEntry ],
        cards: newCards,
      });

      if (unlockedXpCards.length > 0) {
        alert(`🎉 Level Up! Unlocked ${unlockedXpCards.length} new Experience Card(s)!`);
      }

    } catch (err) {
      console.error(err);
      alert("Failed to redeem.");
    }
  }

  // Redeem: group (shares sum must equal cost). Applies to all participants: subtract share, add XP share, add history entry, grant linked card.
  async function redeemGroup(classId, rewardId, participants) {
    if (!participants || participants.length === 0) return;
    const r = rewards.find((x) => x.id === rewardId);
    if (!r) return;

    if (!window.confirm(`Redeem "${r.title}" for group?`)) return;

    try {
      const batch = writeBatch(db);
      const now = new Date().toISOString();

      // Create list of names for history
      const contributors = participants.map(([sid, share]) => {
        const sName = students.find(s => s.id === sid)?.name || "Unknown";
        return { name: sName, cost: Number(share) };
      });

      let anyoneLeveledUp = false;

      for (const [sid, share] of participants) {
        const st = students.find((s) => s.id === sid);
        if (!st) continue;

        const studentRef = doc(db, `classes/${classId}/students/${sid}`);
        const costNum = Number(share);

        // 1. Calculate new XP (Points Spent -> XP)
        const oldXp = Number(st.xp || 0);
        const newXp = oldXp + costNum;

        const historyEntry = {
          id: uid("rh"), // Make sure you have the uid() helper or use Math.random
          rewardId,
          title: r.title,
          cost: costNum,
          date: now,
          type: "group",
          contributors: contributors,
        };

        let newCards = [...(st.cards || [])];

        // A) Reward Card (if exists)
        if (r.cardId) {
          const linkedCard = cards.find((c) => c.id === r.cardId);
          if (linkedCard) {
            pushOwnedCard({
              cardsArr: newCards,
              cardId: r.cardId,
              cardData: linkedCard,
              pointsGranted: 0,
              streakId: "reward_group",
            });
          }
        }

        // B) Check for Level Ups (Experience Cards)
        const unlockedXpCards = getNewExperienceCards(newCards, newXp, cards);
        if (unlockedXpCards.length > 0) anyoneLeveledUp = true;
        
        unlockedXpCards.forEach(c => {
          pushOwnedCard({
            cardsArr: newCards,
            cardId: c.id,
            cardData: c,
            pointsGranted: 0,
            streakId: "xp_unlock",
          });
        });

        // Update Arrays manually for batch
        const nextHistory = [ ...(st.rewardsHistory || []), historyEntry ];
        
        batch.update(studentRef, {
          currentPoints: increment(-costNum),
          xp: increment(costNum), // ADD XP because they spent points
          rewardsHistory: nextHistory,
          cards: newCards,
        });
      }

      await batch.commit();
      
      if (anyoneLeveledUp) {
        alert("🎉 Some students leveled up and unlocked Experience Cards!");
      }

      return true;

    } catch (err) {
      console.error(err);
      alert("Failed group redeem.");
    }
  }

  // --- NEW STYLES ---
  const loginStyles = {
    container: {
      minHeight: "100vh",
      display: "flex",
      alignItems: "center",
      justifyContent: "center",
      backgroundImage: 'linear-gradient(rgba(0, 0, 0, 0.5), rgba(0, 0, 0, 0.5)), url("https://firebasestorage.googleapis.com/v0/b/pokematicos.firebasestorage.app/o/backgrounds%2FBackground%20panoramic.jpg?alt=media&token=5a895072-4079-4db9-91f4-e010ebf4dc2a")',
      backgroundSize: "cover",     
      backgroundPosition: "center", 
      backgroundRepeat: "no-repeat",
      fontFamily: "'Inter', sans-serif",
      padding: 20,
    },
    card: {
      background: "white",
      padding: "40px",
      borderRadius: "16px",
      boxShadow: "0 10px 25px rgba(0,0,0,0.2)",
      width: "100%",
      maxWidth: "400px",
      textAlign: "center",
    },
    title: {
      margin: "0 0 10px 0",
      color: "#333",
      fontSize: "2rem",
      fontWeight: "800",
    },
    subtitle: {
      color: "#666",
      marginBottom: "30px",
      fontSize: "0.95rem",
    },
    studentBtn: {
      width: "100%",
      padding: "16px",
      fontSize: "1.1rem",
      fontWeight: "600",
      color: "white",
      background: "#10B981", // Bright Green
      border: "none",
      borderRadius: "12px",
      cursor: "pointer",
      display: "flex",
      alignItems: "center",
      justifyContent: "center",
      gap: "10px",
      marginBottom: "16px",
      boxShadow: "0 4px 6px rgba(16, 185, 129, 0.3)",
      transition: "transform 0.1s",
    },
    teacherBtn: {
      width: "100%",
      padding: "12px",
      fontSize: "0.95rem",
      color: "#555",
      background: "#f3f4f6",
      border: "1px solid #e5e7eb",
      borderRadius: "12px",
      cursor: "pointer",
      fontWeight: "500",
    },
    input: {
      width: "100%",
      padding: "12px",
      marginBottom: "12px",
      borderRadius: "8px",
      border: "1px solid #ddd",
      fontSize: "1rem",
      boxSizing: "border-box", 
    }
  };

  // ----- IMPROVED LOGIN SCREEN -----
  if (!mode) {
    return (
      <div style={loginStyles.container}>
        <div style={loginStyles.card}>
          <h1 style={loginStyles.title}>CBA Card System</h1>

          {/* 1. LOADING SPINNER (If Auth isn't ready) */}
          {(!authChecked || checkingAdmin) ? (
             <div style={{ color: "#666", padding: 20 }}>Cargando...</div>
          ) : !showAdminForm ? (
            
            // 2. CHOICE SCREEN (Student vs Teacher)
            <>
              <p style={loginStyles.subtitle}>Selecciona cómo quieres entrar</p>
              
              <button 
                style={loginStyles.studentBtn}
                onClick={enterReader}
                onMouseOver={(e) => e.currentTarget.style.transform = "scale(1.02)"}
                onMouseOut={(e) => e.currentTarget.style.transform = "scale(1)"}
              >
                🎒 Soy Alumno (Invitado)
              </button>

              <div style={{ display: "flex", alignItems: "center", gap: 10, margin: "20px 0", opacity: 0.5 }}>
                <div style={{ height: 1, background: "#ccc", flex: 1 }}></div>
                <span style={{ fontSize: 12 }}>O</span>
                <div style={{ height: 1, background: "#ccc", flex: 1 }}></div>
              </div>

              <button 
                style={loginStyles.teacherBtn}
                onClick={() => setShowAdminForm(true)}
              >
                👨‍🏫 Soy Profe (Admin)
              </button>
            </>

          ) : (
            
            // 3. ADMIN LOGIN FORM (Only visible after clicking "Soy Profe")
            <>
              <p style={loginStyles.subtitle}>Acceso para profesores</p>
              <form
                onSubmit={(e) => {
                  e.preventDefault();
                  loginAdminEmailPassword();
                }}
              >
                <input
                  style={loginStyles.input}
                  type="email"
                  placeholder="Email"
                  value={adminEmail}
                  onChange={(e) => setAdminEmail(e.target.value)}
                  autoFocus
                />
                <input
                  style={loginStyles.input}
                  type="password"
                  placeholder="Password"
                  value={adminPass}
                  onChange={(e) => setAdminPass(e.target.value)}
                />
                
                {adminError && (
                  <div style={{ color: "crimson", fontSize: "0.9rem", marginBottom: 12 }}>
                    {adminError}
                  </div>
                )}

                <button 
                  type="submit" 
                  style={{ ...loginStyles.studentBtn, background: "#4F46E5", boxShadow: "0 4px 6px rgba(79, 70, 229, 0.3)" }}
                >
                  Entrar
                </button>
              </form>

              <button
                style={{ background: "none", border: "none", color: "#666", cursor: "pointer", textDecoration: "underline", marginTop: 10 }}
                onClick={() => {
                  setShowAdminForm(false); // Go back to choice screen
                  setAdminError("");
                }}
              >
                ← Volver atrás
              </button>
            </>
          )}
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

  const onRedeemConfirm = async () => { // <--- Note the "async" keyword here
    if (!selectedClass || !rewardToRedeem) return;

    if (redeemType === "individual") {
      if (!selectedStudentId) return alert("No student selected");
      
      // Call Individual
      await redeemIndividual(selectedClass.id, selectedStudentId, rewardToRedeem.id);
      
      // Close Modal
      setRewardToRedeem(null);
      
    } else {
      // Group: Convert Map to Array
      const participantArray = Object.entries(redemptionMap).filter(([_, cost]) => Number(cost) > 0);
      
      if (participantArray.length === 0) return alert("No participants contributing!");
      
      // Call Group
      const success = await redeemGroup(selectedClass.id, rewardToRedeem.id, participantArray);
      
      // Close Modal (ONLY if success)
      if (success) {
        setRewardToRedeem(null);
        setRedeemType("individual"); // Reset type back to default
      }
    }
  };

  return (
    <div
      style={{
        fontFamily: "Inter, system-ui, sans-serif",
        minHeight: "100vh",
        padding: 12,
        backgroundImage: stickyBackground ? `url(${stickyBackground})` : "none",
        backgroundSize: "cover",
        backgroundAttachment: "fixed",
        backgroundPosition: "center",
        backgroundRepeat: "no-repeat",
        transition: "background-image 1s ease-in-out" // Optional: makes the switch smooth
      }}
    >
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
              e.target.value = "";
            }
          }}
        />
        
        {/* Visual cue for the admin */}
        <div style={{ marginBottom: 5, fontSize: "0.8rem", opacity: 0.7 }}>
          {activeClassId 
            ? `Editing Background for: ${activeClass.name}` 
            : "Editing Global Background"}
        </div>
  
        <button
          className="btn"
          onClick={() => bgInputRef.current?.click()}
        >
          {activeClassId ? "Set Class Background" : "Set Global Background"}
        </button>
  
        {/* Show "Remove" if the CURRENT context has a background set */}
        {((activeClassId && activeClass?.backgroundUrl) || (!activeClassId && globalBackgroundUrl)) && (
          <button
            className="btn"
            onClick={clearBackgroundImage}
          >
            {activeClassId ? "Revert to Global" : "Remove Global Bg"}
          </button>
        )}
      </>
    )}
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
          width: 90px;
          height: 90px;
          border-radius: 100px;
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

        /* Emoji party for reaching maximum streak */
        .emoji-party-layer{
          position:absolute;
          inset:0;
          pointer-events:none;
          z-index: 20;
        }

        .emoji-party-particle{
          position:absolute;
          bottom:-24px;
          will-change: transform, opacity;
          animation-name: partyUp;
          animation-timing-function: ease-out;
          animation-iteration-count: infinite;
        }

        @keyframes partyUp{
          0%   { transform: translate(-50%, 0) scale(0.85); opacity: 0; }
          12%  { opacity: 1; }
          70%  { opacity: 0.9; }
          100% { transform: translate(-50%, -160px) scale(1.15); opacity: 0; }
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
          <h1 style={{ margin: 0 }}>CBA card system</h1>
          <div style={{ color: "#555" }}>
            {mode === "admin" ? "Admin mode" : "Guest mode"}
          </div>
        </div>

        <div style={{ display: "flex", gap: 8, alignItems: "center" }}>
          {authUser ? (
            <button className="btn" onClick={logout}>
              Cerrar sesión
            </button>
          ) : (
            <button className="btn" onClick={() => setMode(null)}>
              Cambiar rol
            </button>
          )}
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

                      // --- FLOATING + PARTY LOGIC (CLEAN) ---
                      const cfgs = activeClass?.streakConfigs || [];
                      const today = todayISODate();

                      const isCelebratingToday = (cfg, stObj) => {
                        const hitToday = (stObj?.maxAchievedOn || "") === today;
                        if (!hitToday) return false;

                        // Sticky = keep effects even after Reset (for the rest of the day)
                        if (cfg.stickyCelebrate) return true;

                        // Not sticky = only show while value is still at max
                        return (stObj?.value || 0) >= (cfg.max || 0);
                      };

                      // Party (emoji shower)
                      const partyStreaks = cfgs.filter((cfg) => {
                        const stObj =
                          (s.streaks && s.streaks[cfg.id]) || { value: 0, maxAchievedOn: "" };
                        return isCelebratingToday(cfg, stObj);
                      });

                      // Floating (earned per-student windows)
                      const floatingEmojis = cfgs.filter((cfg) => {
                        if (!cfg.float) return false;
                        const stObj =
                          (s.streaks && s.streaks[cfg.id]) || { value: 0, maxAchievedOn: "", floatWindows: [] };
                        return isTodayInFloatWindows(today, stObj.floatWindows);
                      });

                      // --- END FLOATING + PARTY LOGIC ---

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

                          {/* ✅ EMOJI PARTY (when max is achieved today) */}
                          {partyStreaks.map((cfg) => (
                            <EmojiParty
                              key={`party_${s.id}_${cfg.id}_${today}`}
                              emoji={cfg.emoji}
                              seedKey={`${s.id}_${cfg.id}_${today}`}
                              count={22}
                            />
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
                                        <div
                                          key={cfg.id}
                                          style={{ display: "flex", alignItems: "center", gap: 8 }}
                                        >
                                          <div style={{ flex: 1 }}>
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

                                          {/* ✅ Tiny quick +1, +5, +10 (ADMIN ONLY) */}
                                          {mode === "admin" && (
                                            <button
                                              className="btn"
                                              style={{
                                                padding: "4px 8px",
                                                fontSize: 12,
                                                lineHeight: "12px",
                                                borderRadius: 10,
                                              }}
                                              title="Add +1 to this streak"
                                              onClick={() =>
                                                changeStudentStreakValue(activeClassId, s.id, cfg.id, +1, cfg)
                                              }
                                            >
                                              +1
                                            </button>

                                            
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

                          <div style={{ marginTop: 8, display: "flex", gap: 8, flexWrap: "wrap", alignItems: "center", }}>
                            {mode === "admin" && (
                              <button className="btn" onClick={() => setSelectedStudentId(s.id)}>
                                Manage
                              </button>
                            )}

                            <button className="btn" onClick={() => setProfileStudentId(s.id)}>
                              Perfil
                            </button>

                            {mode === "admin" && (
                              <div style={{ display: "flex", gap: 6, alignItems: "center" }}>
                                <span className="pill">Points</span>
                                <button className="btn" style={{ padding: "6px 10px" }} onClick={() => quickAddPoints(activeClassId, s.id, 1)}>
                                  +1
                                </button>
                                <button className="btn" style={{ padding: "6px 10px" }} onClick={() => quickAddPoints(activeClassId, s.id, 5)}>
                                  +5
                                </button>
                                <button className="btn" style={{ padding: "6px 10px" }} onClick={() => quickAddPoints(activeClassId, s.id, 10)}>
                                  +10
                                </button>
                              </div>
                            )}
                          </div>

                          <div style={{ marginTop: 10 }}>
                            <div style={{ fontSize: 13, fontWeight: 800 }}>Cards</div>

                            {/* Scroll container so you can see all cards */}
                            <div
                              style={{
                                marginTop: 8,
                                maxHeight: 150,
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

                                const ownedUniqueList = arr.map((x) => ({
                                  title: x.title,
                                  imageURL: x.imageURL,
                                }));

                                return arr.map((g, idx) => (
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
                                        ownedList: ownedUniqueList,
                                        ownedIndex: idx,
                                        isLibraryCard: false,
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
                  <div
                    style={{
                      display: "grid",
                      gridTemplateColumns: "repeat(auto-fit, minmax(110px, 1fr))",
                      gap: 6,
                      margin: "8px 0 12px",
                    }}
                  >
                    <button className="btn" onClick={() => setLibraryTab("points")} style={{ width: "100%", background: libraryTab === "points" ? "#def" : "white" }}>
                      Points
                    </button>
                    <button className="btn" onClick={() => setLibraryTab("rewards")} style={{ width: "100%", background: libraryTab === "rewards" ? "#def" : "white" }}>
                      Rewards
                    </button>
                    <button className="btn" onClick={() => setLibraryTab("experience")} style={{ width: "100%", background: libraryTab === "experience" ? "#def" : "white" }}>
                      Experience
                    </button>
                    <button className="btn" onClick={() => setLibraryTab("extra")}  style={{ width: "100%", background: libraryTab === "extra" ? "#def" : "white" }}>
                      Extra
                    </button>
                  </div>

                  {mode === "admin" && (
                    <div style={{ border: "1px dashed #ddd", padding: 10, borderRadius: 10, marginBottom: 12 }}>
                      <h4 style={{ marginTop: 0 }}>Create new card</h4>
                      <CardCreateForm
                        onCreate={createCard}
                        lockedInputRef={lockedFileInputRef}
                        unlockedInputRef={unlockedFileInputRef}
                        streakConfigs={activeClass?.streakConfigs || []}
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
                                onGive={() => openBulkGive(c)}
                                onEdit={() => setEditCard(c)}
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
                                  onGive={() => openBulkGive(c)}
                                  onEdit={() => setEditCard(c)}
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
                    
                  </div>
                </div>
              </div>
            </div>
          ) : (
            (() => {
              /* Owned card (unlocked) -> image only */
              const ownedList = cardPreview.ownedList || null;
              const ownedIndex = Number.isFinite(cardPreview.ownedIndex) ? cardPreview.ownedIndex : 0;
              const currentOwned = ownedList ? ownedList[ownedIndex] : cardPreview;

              return (
                <div
                 className="ownedCardModal"
                  onClick={(e) => e.stopPropagation()}
                  style={{
                    maxWidth: "min(85vw, 720px)",
                    width: "85vw",
                    height: "min(70vh, 520px)",
                    maxHeight: "70vh",
                    borderRadius: 16,
                    overflow: "hidden",
                    background: "transparent",
                    position: "relative",
                    boxShadow: "0 12px 30px rgba(0,0,0,0.5)",
                    display: "flex",
                    alignItems: "center",
                    justifyContent: "center",
                  }}
                >
                  {currentOwned?.imageURL ? (
                    <>
                      <img
                        src={currentOwned?.imageURL}
                        alt=""
                        style={{
                          width: "100%",
                          height: "100%",
                          objectFit: "contain",
                          display: "block",
                        }}
                      />

                      {/* Left button */}
                      <button
                        type="button"
                        className="cardNavBtn cardNavLeft"
                        disabled={!ownedList || ownedIndex <= 0}
                        onClick={(e) => {
                          e.stopPropagation();
                          ownedNav(-1);
                        }}
                        aria-label="Previous card"
                      >
                        <span className="cardNavIcon" aria-hidden="true">‹</span>
                      </button>

                      {/* Right button */}
                      <button
                        type="button"
                        className="cardNavBtn cardNavRight"
                        disabled={!ownedList || ownedIndex >= ownedList.length - 1}
                        onClick={(e) => {
                          e.stopPropagation();
                          ownedNav(+1);
                        }}
                        aria-label="Next card"
                      >
                        <span className="cardNavIcon" aria-hidden="true">›</span>
                      </button>

                      {/* Counter (1 / N) */}
                      {ownedList && ownedList.length > 0 && (
                        <div className="cardNavCounter">
                          {ownedIndex + 1} / {ownedList.length}
                        </div>
                      )}
                    </>
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
              );
            })()
          )}
        </div>
      )}

      {/* Card edit modal */}
      {mode === "admin" && editCard && (
        <CardEditModal
          card={editCard}
          streakConfigs={activeClass?.streakConfigs || []}
          onClose={() => setEditCard(null)}
          onSave={async (updates) => {
            await updateCard(editCard.id, updates);
            setEditCard(null);
          }}
        />
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
          setStickyCelebrateForClass={setStickyCelebrateForClass}
          setStreakRewardCardsForClass={setStreakRewardCardsForClass}
          mode={mode}
          onEditStudent={(updates) => editStudent(activeClassId, selectedStudent.id, updates)}
          onClose={() => setSelectedStudentId(null)}
          onDeleteStudent={() => deleteStudent(activeClassId, selectedStudent.id)}
          onGiveCard={(cardId) => giveCardToStudent(activeClassId, selectedStudent.id, cardId)}
          onRemoveOne={(ownedId) => removeOwnedCardsBulk(activeClassId, selectedStudent.id, [ownedId])}
          onRemoveAll={(ownedIds) => removeOwnedCardsBulk(activeClassId, selectedStudent.id, ownedIds)}
          onRedeemIndividual={(rewardId) => {
            // Pass classId, studentId, rewardId
            redeemIndividual(activeClassId, selectedStudentId, rewardId);
          }}
          onRedeemGroup={(rewardId, sharesMap) => {
            // 1. Convert the "Map" {id: 10} into an "Array" [[id, 10]]
            const participants = Object.entries(sharesMap)
              .filter(([_, amount]) => Number(amount) > 0); // Only include those who pay
            
            // 2. Call the main function with the correct arguments
            redeemGroup(activeClassId, rewardId, participants);
          }}
          setCardPreview={setCardPreview}
        />
      )}

      {/* Bulk give modal */}
      {bulkGiveCard && (
        <div className="modal-backdrop" onClick={() => setBulkGiveCard(null)}>
          <div className="modal" onClick={(e) => e.stopPropagation()}>
            <h3 style={{ marginTop: 0 }}>Give card</h3>
            <div style={{ fontWeight: 900, marginTop: 6 }}>{bulkGiveCard.title}</div>
            <div className="muted" style={{ marginTop: 6 }}>
              Select students to receive this card. Points will be multiplied by each student's multiplier.
            </div>

            <div style={{ marginTop: 12, display: "flex", gap: 8, flexWrap: "wrap", alignItems: "center" }}>
              <button className="btn" onClick={toggleBulkGiveSelectAll}>
                {bulkGiveSelectedIds.length === students.length ? "Deselect all" : "Select all"}
              </button>
              <div className="muted">{bulkGiveSelectedIds.length} selected</div>
            </div>

            <div
              style={{
                marginTop: 12,
                maxHeight: 320,
                overflow: "auto",
                border: "1px solid #eee",
                borderRadius: 12,
                padding: 10,
                background: "#fff",
              }}
            >
              {students.map((s) => (
                <label
                  key={s.id}
                  style={{
                    display: "flex",
                    alignItems: "center",
                    gap: 10,
                    padding: "8px 6px",
                    borderBottom: "1px solid #f2f2f2",
                  }}
                >
                  <input
                    type="checkbox"
                    checked={bulkGiveSelectedIds.includes(s.id)}
                    onChange={() => toggleBulkGiveStudent(s.id)}
                  />
                  <span style={{ fontWeight: 800 }}>{s.name}</span>
                  <span className="muted" style={{ marginLeft: "auto" }}>
                    x{typeof s.multiplier === "number" ? s.multiplier : 1}
                  </span>
                </label>
              ))}
              {students.length === 0 && <div className="muted">No students in this class yet.</div>}
            </div>

            <div style={{ marginTop: 12, display: "flex", gap: 8, flexWrap: "wrap" }}>
              <button className="btn" onClick={() => setBulkGiveCard(null)}>
                Cancel
              </button>
              <button
                className="btn primary"
                disabled={bulkGiveSelectedIds.length === 0}
                onClick={async () => {
                  await giveCardToStudentsBulk(activeClassId, bulkGiveCard.id, bulkGiveSelectedIds);
                  setBulkGiveCard(null);
                }}
              >
                Give to selected
              </button>
            </div>
          </div>
        </div>
      )}
    </div>
  );
}



/* ---------------- Components ---------------- */

function LibraryCardRow({ c, mode, onPreview, onGive = () => {}, onDelete, onEdit = () => {} }) {
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
          {(c.category || "points") !== "rewards" && (
            <button className="btn primary" onClick={onGive}>
              Give card
            </button>
          )}

          <button className="btn" onClick={onEdit}>
            Edit
          </button>

           <button className="btn" onClick={onDelete} style={{ color: "#c82424ff", borderColor: "#fecaca" }}>
            Delete
          </button>
        </div>
      )}
    </div>
  );
}

function CardCreateForm({ onCreate, lockedInputRef, unlockedInputRef, streakConfigs = [] }) {
  const [title, setTitle] = useState("");
  const [description, setDescription] = useState("");
  const [points, setPoints] = useState(1);
  const [category, setCategory] = useState("points");
  const [lockedFile, setLockedFile] = useState(null);
  const [unlockedFile, setUnlockedFile] = useState(null);
  const [linkedStreakIds, setLinkedStreakIds] = useState([]);
  const [streakPick, setStreakPick] = useState("");
  const [streakLookup, setStreakLookup] = useState("");


  function handleCreate() {
    if (!title.trim()) return alert("Title required");
    onCreate({ title, description, points, category, linkedStreakIds: category === "points" ? linkedStreakIds : [], lockedFile, unlockedFile });
    setTitle("");
    setDescription("");
    setPoints(1);
    setCategory("points");
    setLinkedStreakIds([]);
    setStreakPick("");  
    setStreakLookup("");
    setLockedFile(null);
    setUnlockedFile(null);
    if (lockedInputRef?.current) lockedInputRef.current.value = "";
    if (unlockedInputRef?.current) unlockedInputRef.current.value = "";
  }

  function addStreakId(id) {
    if (!id) return;
    setLinkedStreakIds((prev) => (prev.includes(id) ? prev : [...prev, id]));
    setStreakPick("");
  }

  function removeStreakId(id) {
    setLinkedStreakIds((prev) => prev.filter((x) => x !== id));
  }

  function resolveCreateStreakIdFromText(txt) {
    const t = (txt || "").trim();
    if (!t) return "";
    const n = parseInt(t, 10);
    if (Number.isFinite(n) && n >= 1 && n <= streakConfigs.length) return streakConfigs[n - 1].id;
    const byEmoji = streakConfigs.find((cfg) => (cfg.emoji || "").trim() === t);
    return byEmoji ? byEmoji.id : "";
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
          onChange={(e) => {
            const next = e.target.value;
            setCategory(next);
            if (next !== "points") {
              setLinkedStreakIds([]);
              setStreakPick("");
              setStreakLookup("");
            }
          }}
          style={{ padding: 8, borderRadius: 8, border: "1px solid #ddd" }}
        >
          <option value="points">Points</option>
          <option value="rewards">Rewards</option>
          <option value="experience">Experience</option>
          <option value="extra">Extra</option>
        </select>
      </div>

      {category === "points" && (
        <div style={{ border: "1px solid #eee", borderRadius: 12, padding: 10, marginTop: 10 }}>
          <div style={{ fontWeight: 800 }}>Link to streaks (optional)</div>

          {(!streakConfigs || streakConfigs.length === 0) ? (
            <div className="muted" style={{ marginTop: 6 }}>
              No streak types yet. Click <b>New streak</b> at the top to create one.
            </div>
          ) : (
            <>
              <div className="muted" style={{ marginTop: 4 }}>
                Add one or more streaks by dropdown, emoji, or number order.
              </div>

              <div style={{ display: "flex", gap: 8, flexWrap: "wrap", marginTop: 8, alignItems: "center" }}>
                <select
                  value={streakPick}
                  onChange={(e) => setStreakPick(e.target.value)}
                  style={{ padding: 8, borderRadius: 8, border: "1px solid #ddd", minWidth: 180 }}
                >
                  <option value="">Choose streak…</option>
                  {streakConfigs.map((cfg, idx) => (
                    <option key={cfg.id} value={cfg.id}>
                      {idx + 1}) {cfg.emoji} (max {cfg.max})
                    </option>
                  ))}
                </select>

                <button className="btn" type="button" onClick={() => addStreakId(streakPick)} disabled={!streakPick}>
                  Add
                </button>
              </div>

              <div style={{ display: "flex", gap: 8, flexWrap: "wrap", marginTop: 8, alignItems: "center" }}>
                <input
                  value={streakLookup}
                  onChange={(e) => setStreakLookup(e.target.value)}
                  placeholder='Type emoji (🔥) or number (1)'
                  style={{ padding: 8, borderRadius: 8, border: "1px solid #ddd", minWidth: 220 }}
                />
                <button
                  className="btn"
                  type="button"
                  onClick={() => addStreakId(resolveCreateStreakIdFromText(streakLookup))}
                >
                  Add from text
                </button>
              </div>

              {linkedStreakIds.length > 0 && (
                <div style={{ marginTop: 10, display: "flex", gap: 6, flexWrap: "wrap" }}>
                  {linkedStreakIds.map((id) => {
                    const cfg = streakConfigs.find((s) => s.id === id);
                    return (
                      <span
                        key={id}
                        className="pill"
                        style={{ display: "inline-flex", gap: 6, alignItems: "center" }}
                      >
                        {cfg ? cfg.emoji : "?"}
                        <button className="btn" type="button" onClick={() => removeStreakId(id)} style={{ padding: "2px 8px" }}>
                          ✕
                        </button>
                      </span>
                    );
                  })}
                </div>
              )}
            </>
          )}
        </div>
      )}

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

function CardEditModal({ card, streakConfigs = [], onClose, onSave }) {
  const [title, setTitle] = useState(card.title || "");
  const [description, setDescription] = useState(card.description || "");
  const [points, setPoints] = useState(card.points ?? 0);
  const [category, setCategory] = useState(card.category || "points");

  const [linkedStreakIds, setLinkedStreakIds] = useState(
    () => (Array.isArray(card.linkedStreakIds) ? card.linkedStreakIds.filter(Boolean).map(String) : [])
  );
  const [streakPick, setStreakPick] = useState("");
  const [streakLookup, setStreakLookup] = useState("");

  const [lockedFile, setLockedFile] = useState(null);
  const [unlockedFile, setUnlockedFile] = useState(null);

  function addStreakId(id) {
    if (!id) return;
    setLinkedStreakIds((prev) => (prev.includes(id) ? prev : [...prev, id]));
    setStreakPick("");
  }

  function removeStreakId(id) {
    setLinkedStreakIds((prev) => prev.filter((x) => x !== id));
  }

  function resolveStreakIdFromText(txt) {
    const t = (txt || "").trim();
    if (!t) return "";
    const n = parseInt(t, 10);
    if (Number.isFinite(n) && n >= 1 && n <= streakConfigs.length) return streakConfigs[n - 1].id;
    const byEmoji = streakConfigs.find((cfg) => (cfg.emoji || "").trim() === t);
    return byEmoji ? byEmoji.id : "";
  }

  // nice labels in chips
  function streakLabel(id) {
    const idx = streakConfigs.findIndex((c) => c.id === id);
    const cfg = idx >= 0 ? streakConfigs[idx] : null;
    if (!cfg) return id;
    return `${idx + 1} — ${cfg.emoji} (max ${cfg.max})`;
  }

  return (
    <div className="modal-backdrop" onClick={onClose}>
      <div className="modal" onClick={(e) => e.stopPropagation()} style={{ maxWidth: 720 }}>
        <div style={{ display: "flex", justifyContent: "space-between", alignItems: "center", gap: 10 }}>
          <h3 style={{ margin: 0 }}>Edit card</h3>
          <button className="btn" onClick={onClose}>Close</button>
        </div>

        <div style={{ display: "grid", gap: 10, marginTop: 12 }}>
          <input className="input" value={title} onChange={(e) => setTitle(e.target.value)} placeholder="Title" />

          <textarea
            className="input"
            style={{ height: 90 }}
            value={description}
            onChange={(e) => setDescription(e.target.value)}
            placeholder="Description"
          />

          <div style={{ display: "flex", gap: 10, flexWrap: "wrap" }}>
            <input
              className="input"
              type="number"
              value={points}
              onChange={(e) => setPoints(e.target.value)}
              style={{ width: 140 }}
              placeholder="Points"
            />

            <select
              className="select"
              value={category}
              onChange={(e) => {
                const next = e.target.value;
                setCategory(next);
                if (next !== "points") {
                  setLinkedStreakIds([]);
                  setStreakPick("");
                  setStreakLookup("");
                }
              }}
              style={{ width: 220 }}
            >
              <option value="points">Points</option>
              <option value="rewards">Rewards</option>
              <option value="experience">Experience</option>
              <option value="extra">Extra</option>
            </select>
          </div>

          {category === "points" && (
            <div style={{ border: "1px solid #eee", borderRadius: 12, padding: 10 }}>
              <div style={{ fontWeight: 800 }}>Link to streaks (optional)</div>
              <div className="muted" style={{ marginTop: 4 }}>Add one or more streaks by dropdown, emoji, or number order.</div>

              {/* dropdown + add */}
              <div style={{ display: "flex", gap: 8, marginTop: 8, alignItems: "center" }}>
                <select
                  className="select"
                  value={streakPick}
                  onChange={(e) => setStreakPick(e.target.value)}
                >
                  <option value="">Choose streak...</option>
                  {streakConfigs.map((cfg, idx) => (
                    <option key={cfg.id} value={cfg.id}>
                      {idx + 1} — {cfg.emoji} (max {cfg.max})
                    </option>
                  ))}
                </select>
                <button className="btn" type="button" onClick={() => addStreakId(streakPick)} disabled={!streakPick}>
                  Add
                </button>
              </div>

              {/* add from text */}
              <div style={{ display: "flex", gap: 8, marginTop: 8 }}>
                <input
                  className="input"
                  value={streakLookup}
                  onChange={(e) => setStreakLookup(e.target.value)}
                  placeholder="Type emoji (🔥) or number (1)"
                />
                <button
                  className="btn"
                  type="button"
                  onClick={() => {
                    const id = resolveStreakIdFromText(streakLookup);
                    if (!id) return alert("No match. Try emoji (🔥) or number (1).");
                    addStreakId(id);
                    setStreakLookup("");
                  }}
                >
                  Add from text
                </button>
              </div>

              {/* selected chips */}
              <div style={{ display: "flex", gap: 8, flexWrap: "wrap", marginTop: 10 }}>
                {linkedStreakIds.length === 0 ? (
                  <span className="muted">No streaks linked.</span>
                ) : (
                  linkedStreakIds.map((id) => (
                    <span key={id} className="chip">
                      {streakLabel(id)}
                      <button className="btn" style={{ padding: "2px 8px" }} type="button" onClick={() => removeStreakId(id)}>
                        ✕
                      </button>
                    </span>
                  ))
                )}
              </div>
            </div>
          )}

          <div className="muted" style={{ marginTop: 2 }}>Replace LOCKED image (optional)</div>
          <input type="file" onChange={(e) => setLockedFile(e.target.files?.[0] || null)} />

          <div className="muted" style={{ marginTop: 2 }}>Replace UNLOCKED image (optional)</div>
          <input type="file" onChange={(e) => setUnlockedFile(e.target.files?.[0] || null)} />

          <div style={{ display: "flex", gap: 10, marginTop: 10, flexWrap: "wrap" }}>
            <button
              className="btn primary"
              onClick={() =>
                onSave({
                  title,
                  description,
                  points,
                  category,
                  // ✅ THIS is what updateCard expects
                  linkedStreakIds: category === "points" ? linkedStreakIds : [],
                  lockedFile,
                  unlockedFile,
                })
              }
            >
              Save changes
            </button>
            <button className="btn" onClick={onClose}>Cancel</button>
          </div>
        </div>
      </div>
    </div>
  );
}

function resolveStreakIdFromText(txt) {
  const t = (txt || "").trim();
  if (!t) return "";
  const n = parseInt(t, 10);
  if (Number.isFinite(n) && n >= 1 && n <= streakConfigs.length) return streakConfigs[n - 1].id;
  const byEmoji = streakConfigs.find((cfg) => (cfg.emoji || "").trim() === t);
  return byEmoji ? byEmoji.id : "";
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

          {/* --- REWARD HISTORY (Stylish Cards) --- */}
          <div style={{ marginTop: 24, borderTop: "1px dashed #e0e0e0", paddingTop: 16 }}>
            <div style={{ 
              fontSize: 12, 
              textTransform: "uppercase", 
              letterSpacing: "1px", 
              color: "#999", 
              fontWeight: 700, 
              marginBottom: 12 
            }}>
              Reward History
            </div>

            {(!student.rewardsHistory || student.rewardsHistory.length === 0) ? (
              <div style={{ textAlign: "center", padding: "20px", color: "#ccc", fontStyle: "italic", fontSize: 13 }}>
                No rewards redeemed yet.
              </div>
            ) : (
              <div style={{ display: "flex", flexDirection: "column", gap: 8 }}>
                {[...(student.rewardsHistory || [])]
                  .sort((a, b) => (b.date || "").localeCompare(a.date || ""))
                  .map((h) => {
                    const isGroup = h.type === "group" || h.mode === "group"; // Handle new and old data
                    return (
                      <div key={h.id || Math.random()} style={{
                        background: "#fff",
                        border: "1px solid #eee",
                        borderRadius: 10,
                        padding: "10px 14px",
                        boxShadow: "0 2px 5px rgba(0,0,0,0.02)",
                        display: "flex",
                        flexDirection: "column",
                        gap: 4
                      }}>
                        {/* Title and Cost */}
                        <div style={{ display: "flex", justifyContent: "space-between", alignItems: "center" }}>
                          <div style={{ fontWeight: 700, color: "#333", fontSize: 14 }}>
                            {h.title}
                          </div>
                          <div style={{ 
                            background: "#ffebee", 
                            color: "#c62828", 
                            fontWeight: 800, 
                            fontSize: 12, 
                            padding: "2px 8px", 
                            borderRadius: 12 
                          }}>
                            -{h.cost}
                          </div>
                        </div>

                        {/* Info Row */}
                        <div style={{ display: "flex", alignItems: "center", gap: 8, fontSize: 11, color: "#888" }}>
                          <span>{h.date ? new Date(h.date).toLocaleDateString() : "Unknown date"}</span>
                          {isGroup && (
                            <span style={{ 
                              background: "#e3f2fd", 
                              color: "#1565c0", 
                              padding: "1px 6px", 
                              borderRadius: 4, 
                              fontWeight: 600,
                              fontSize: 10 
                            }}>
                              👥 GROUP
                            </span>
                          )}
                        </div>

                        {/* Group Contributors List */}
                        {isGroup && h.contributors && (
                          <div style={{ 
                            marginTop: 6, 
                            paddingTop: 6, 
                            borderTop: "1px dashed #eee", 
                            fontSize: 11, 
                            color: "#666",
                            lineHeight: "1.4em" 
                          }}>
                            <span style={{ fontWeight: 600 }}>Splitting with: </span>
                            {h.contributors
                              .filter(c => c.name !== student.name) // Hide self
                              .map(c => `${c.name} (${c.cost})`)
                              .join(", ")}
                          </div>
                        )}
                      </div>
                    );
                  })}
              </div>
            )}
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

function hashStrToInt(str) {
  let h = 2166136261;
  for (let i = 0; i < str.length; i++) {
    h ^= str.charCodeAt(i);
    h = Math.imul(h, 16777619);
  }
  return h >>> 0;
}
function mulberry32(seed) {
  return function () {
    let t = (seed += 0x6d2b79f5);
    t = Math.imul(t ^ (t >>> 15), t | 1);
    t ^= t + Math.imul(t ^ (t >>> 7), t | 61);
    return ((t ^ (t >>> 14)) >>> 0) / 4294967296;
  };
}

function EmojiParty({ emoji, seedKey, count = 18 }) {
  const particles = useMemo(() => {
    const rnd = mulberry32(hashStrToInt(seedKey));
    return Array.from({ length: count }).map((_, i) => {
      const left = rnd() * 100;
      const delay = rnd() * 1.4;
      const dur = 1.2 + rnd() * 1.2;
      const size = 18 + rnd() * 22;
      const drift = (rnd() - 0.5) * 60; // sideways wiggle
      return { i, left, delay, dur, size, drift };
    });
  }, [seedKey, count]);

  return (
    <div className="emoji-party-layer" aria-hidden="true">
      {particles.map((p) => (
        <span
          key={p.i}
          className="emoji-party-particle"
          style={{
            left: `${p.left}%`,
            fontSize: p.size,
            animationDuration: `${p.dur}s`,
            animationDelay: `${p.delay}s`,
            transform: `translate(-50%, 0) translateX(${p.drift}px)`,
          }}
        >
          {emoji}
        </span>
      ))}
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
  setStickyCelebrateForClass,
  setStreakRewardCardsForClass,
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
                                  changeStudentStreakValue(classId,
                                    student.id,
                                    cfg.id,
                                    -1, cfg)
                                }
                              >
                                -1
                              </button>
                              <button
                                className="btn"
                                style={{ marginLeft: 4 }}
                                onClick={() =>
                                  changeStudentStreakValue(classId,
                                    student.id,
                                    cfg.id,
                                    +1, cfg)
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
                              style={{ fontSize: 11, marginTop: 4 }}
                              onClick={() =>
                                setStickyCelebrateForClass(classId, cfg.id, !cfg.stickyCelebrate)
                              }
                            >
                              Sticky celebration: {cfg.stickyCelebrate ? "ON" : "OFF"}
                            </button>

                            <div className="muted" style={{ fontSize: 11, marginTop: 4 }}>
                              Reward on MAX:{" "}
                              {(cfg.rewardCardIds || [])
                                .map((id) => (cards.find((c) => c.id === id)?.title || id))
                                .join(", ") || "None"}
                            </div>

                            <button
                              className="btn"
                              style={{ fontSize: 11, marginTop: 4 }}
                              onClick={() => setStreakRewardCardsForClass?.(classId, cfg.id, cfg)}
                            >
                              Set reward cards
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
