// src/App.js
import React, { useEffect, useState, useRef } from "react";
import {
  initializeApp
} from "firebase/app";
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
  orderBy
} from "firebase/firestore";
import {
  getStorage,
  ref as storageRef,
  uploadBytes,
  getDownloadURL
} from "firebase/storage";

/*
  IMPORTANT:
  - Replace this firebaseConfig with your project's config, or export it from a separate file and import.
  - This code expects Firestore and Storage to be enabled.
*/
const firebaseConfig = {
  // <-- replace with your own or keep if already correct
  apiKey: "AIzaSyAi9YLbUydV4yDZe64hfUo-btSdo_uYunc",
  authDomain: "pokematicos.firebaseapp.com",
  databaseURL: "https://pokematicos-default-rtdb.europe-west1.firebasedatabase.app",
  projectId: "pokematicos",
  storageBucket: "pokematicos.appspot.com", // make sure correct format
  messagingSenderId: "101415606738",
  appId: "1:101415606738:web:c009f17005904490e9d00b"
};

const app = initializeApp(firebaseConfig);
const db = getFirestore(app);
const storage = getStorage(app);

function uid(prefix = "id") {
  return `${prefix}_${Math.random().toString(36).slice(2, 9)}`;
}

// Simple local fallback sample (used only if no Firestore data)
const SAMPLE = {
  classes: [
    {
      id: "sample_class",
      name: "Mates 2º IB (sample)",
      createdAt: Date.now(),
    },
  ],
};

export default function App() {
  // app modes
  const [mode, setMode] = useState(null); // null | "admin" | "reader"
  // don't display password in UI; use prompt
  function enterAdmin() {
    const p = prompt("Enter admin password:");
    if (p === "cartas") setMode("admin");
    else if (p !== null) alert("Wrong password");
  }
  function enterReader() { setMode("reader"); }

  // Loading & data
  const [classesList, setClassesList] = useState([]);
  const [loadingClasses, setLoadingClasses] = useState(true);
  const [activeClassId, setActiveClassId] = useState(null);

  const [students, setStudents] = useState([]);
  const [cards, setCards] = useState([]);
  const [rewards, setRewards] = useState([]);

  const [loadingStudents, setLoadingStudents] = useState(false);
  const [loadingCards, setLoadingCards] = useState(false);
  const [loadingRewards, setLoadingRewards] = useState(false);

  // UI state
  const [selectedStudent, setSelectedStudent] = useState(null); // object with id, name, classId
  const [cardPreview, setCardPreview] = useState(null); // card doc
  const [errorMsg, setErrorMsg] = useState("");

  // form state
  const newClassNameRef = useRef();
  const newStudentRef = useRef();
  const cardFileRef = useRef();

  // subscribe to classes on mount
  useEffect(() => {
    setLoadingClasses(true);
    // list classes collection
    const q = query(collection(db, "classes"), orderBy("createdAt", "desc"));
    const unsub = onSnapshot(q, (snap) => {
      const arr = [];
      snap.forEach(docSnap => {
        arr.push({ id: docSnap.id, ...docSnap.data() });
      });
      setClassesList(arr);
      setLoadingClasses(false);
      // if no activeClassId, pick first
      if (!activeClassId && arr.length) {
        setActiveClassId(prev => prev || arr[0].id);
      }
    }, (err) => {
      console.error("Failed loading classes:", err);
      setErrorMsg("Failed to load classes from Firestore. Check console.");
      setLoadingClasses(false);
    });
    return () => unsub();
    // eslint-disable-next-line react-hooks/exhaustive-deps
  }, []);

  // subscribe to subcollections when activeClassId changes
  useEffect(() => {
    if (!activeClassId) {
      setStudents([]); setCards([]); setRewards([]);
      return;
    }

    // Students
    setLoadingStudents(true);
    const studentsCol = collection(db, `classes/${activeClassId}/students`);
    const unsubStudents = onSnapshot(query(studentsCol, orderBy("name")), (snap) => {
      const arr = []; snap.forEach(s => arr.push({ id: s.id, ...s.data() }));
      setStudents(arr);
      setLoadingStudents(false);
    }, (err) => {
      console.error("students snapshot err", err);
      setErrorMsg("Error loading students.");
      setLoadingStudents(false);
    });

    // Cards
    setLoadingCards(true);
    const cardsCol = collection(db, `classes/${activeClassId}/cards`);
    const unsubCards = onSnapshot(query(cardsCol, orderBy("title")), (snap) => {
      const arr = []; snap.forEach(s => arr.push({ id: s.id, ...s.data() }));
      setCards(arr);
      setLoadingCards(false);
    }, (err) => {
      console.error("cards snapshot err", err);
      setErrorMsg("Error loading cards.");
      setLoadingCards(false);
    });

    // Rewards
    setLoadingRewards(true);
    const rewardsCol = collection(db, `classes/${activeClassId}/rewards`);
    const unsubRewards = onSnapshot(query(rewardsCol, orderBy("title")), (snap) => {
      const arr = []; snap.forEach(s => arr.push({ id: s.id, ...s.data() }));
      setRewards(arr);
      setLoadingRewards(false);
    }, (err) => {
      console.error("rewards snapshot err", err);
      setErrorMsg("Error loading rewards.");
      setLoadingRewards(false);
    });

    return () => {
      unsubStudents(); unsubCards(); unsubRewards();
    };
  }, [activeClassId]);

  // Basic guards
  function ensureClassSelected() {
    if (!activeClassId) {
      alert("Please select or create a class first.");
      return false;
    }
    return true;
  }

  // Create class
  async function createClass(name) {
    if (!name) return;
    try {
      const payload = { name, createdAt: Date.now() };
      const ref = await addDoc(collection(db, "classes"), payload);
      // set as active
      setActiveClassId(ref.id);
      // create empty subcollections are implicit (no need to create)
    } catch (err) {
      console.error(err); alert("Failed to create class: " + (err.message || err));
    }
  }

  // Edit class name
  async function editClassName(classId, newName) {
    if (!newName) return;
    try {
      await updateDoc(doc(db, `classes/${classId}`), { name: newName });
    } catch (err) {
      console.error(err); alert("Could not rename class.");
    }
  }

  // Delete class
  async function removeClass(classId) {
    if (!window.confirm("Delete this class and all its students/cards? This is irreversible.")) return;
    try {
      // NOTE: Firestore requires you to delete subcollection docs individually.
      // For simplicity we only delete the top-level class doc (subcollections remain orphaned).
      // If you want full deletion: implement recursive deletion via Cloud Functions or batched manual deletes.
      await deleteDoc(doc(db, `classes/${classId}`));
      if (activeClassId === classId) setActiveClassId(null);
    } catch (err) {
      console.error(err); alert("Failed to remove class. See console.");
    }
  }

  // Add student to active class
  async function addStudent(name) {
    if (!ensureClassSelected()) return;
    if (!name) return;
    try {
      const payload = {
        name,
        avatar: "",
        currentPoints: 0,
        cumulativePoints: 0,
        streak: 0,
        lastActive: null,
        cards: [] // optional local metadata
      };
      await addDoc(collection(db, `classes/${activeClassId}/students`), payload);
      if (newStudentRef.current) newStudentRef.current.value = "";
    } catch (err) {
      console.error(err);
      alert("Failed to add student.");
    }
  }

  // Edit student fields (name or total points)
  async function editStudent(classId, studentId, updates) {
    try {
      await updateDoc(doc(db, `classes/${classId}/students/${studentId}`), updates);
    } catch (err) {
      console.error(err); alert("Failed saving student changes.");
    }
  }

  // Delete student
  async function deleteStudent(classId, studentId) {
    if (!window.confirm("Delete this student?")) return;
    try {
      await deleteDoc(doc(db, `classes/${classId}/students/${studentId}`));
      if (selectedStudent?.id === studentId) setSelectedStudent(null);
    } catch (err) {
      console.error(err); alert("Failed to delete student.");
    }
  }

  // Create card in class library (optionally upload image)
  async function createCard({ title, description, points = 0, category = "points", file }) {
    if (!ensureClassSelected()) return;
    if (!title) { alert("Card title required"); return; }
    try {
      let imageURL = "";
      if (file) {
        // Upload to storage: path classes/{classId}/cards/{uid}_{filename}
        const key = `${uid("card")}_${file.name.replaceAll(/\s+/g, "_")}`;
        const ref = storageRef(storage, `classes/${activeClassId}/cards/${key}`);
        const snapshot = await uploadBytes(ref, file);
        imageURL = await getDownloadURL(snapshot.ref);
      }
      const payload = { title, description, points: Number(points) || 0, category: category || "points", imageURL, createdAt: Date.now() };
      await addDoc(collection(db, `classes/${activeClassId}/cards`), payload);
      // clear file input if exists
      if (cardFileRef.current) cardFileRef.current.value = "";
    } catch (err) {
      console.error("createCard err:", err);
      alert("Failed to add card. Check Storage permissions or console.");
    }
  }

  // Delete a card from the library
  async function deleteCard(cardId) {
    if (!window.confirm("Delete this library card? This will not remove copies already owned by students.")) return;
    try {
      await deleteDoc(doc(db, `classes/${activeClassId}/cards/${cardId}`));
    } catch (err) {
      console.error(err); alert("Failed to delete card.");
    }
  }

  // Give a card to a student: create an owned card inside student's document or as an array entry inside student doc
  // We'll add to the student's 'cards' array by updating the student doc (arrayUnion isn't imported, so we read-modify-write).
  async function giveCardToStudent(classId, studentId, cardId) {
    try {
      // fetch card
      const cardDoc = await getDoc(doc(db, `classes/${classId}/cards/${cardId}`));
      if (!cardDoc.exists()) return alert("Card not found");
      const cardData = cardDoc.data();

      const studentRef = doc(db, `classes/${classId}/students/${studentId}`);
      const studentSnap = await getDoc(studentRef);
      if (!studentSnap.exists()) return alert("Student not found");
      const sdata = studentSnap.data();
      const cardsArr = Array.isArray(sdata.cards) ? [...sdata.cards] : [];
      const owned = {
        id: uid("owned"),
        cardId,
        title: cardData.title,
        imageURL: cardData.imageURL || "",
        grantedAt: new Date().toISOString(),
        pointsGranted: cardData.points || 0,
      };
      cardsArr.push(owned);
      // update student's current & cumulative points
      const currentPoints = (sdata.currentPoints || 0) + (cardData.points || 0);
      const cumulativePoints = (sdata.cumulativePoints || 0) + (cardData.points || 0);
      await updateDoc(studentRef, { cards: cardsArr, currentPoints, cumulativePoints });
      alert(`Gave ${cardData.title} to student.`);
    } catch (err) {
      console.error(err); alert("Failed to give card.");
    }
  }

  // Remove an owned card from a student
  async function removeOwnedCard(classId, studentId, ownedId) {
    if (!window.confirm("Remove this card from the student?")) return;
    try {
      const studentRef = doc(db, `classes/${classId}/students/${studentId}`);
      const studentSnap = await getDoc(studentRef);
      if (!studentSnap.exists()) return;
      const sdata = studentSnap.data();
      const cardsArr = (sdata.cards || []).filter(c => c.id !== ownedId);
      await updateDoc(studentRef, { cards: cardsArr });
    } catch (err) {
      console.error(err); alert("Failed to remove card");
    }
  }

  // Redeem reward (individual)
  async function redeemRewardIndividual(classId, studentId, rewardId) {
    try {
      const rewardDoc = await getDoc(doc(db, `classes/${classId}/rewards/${rewardId}`));
      if (!rewardDoc.exists()) return alert("Reward not found");
      const r = rewardDoc.data();
      const studentRef = doc(db, `classes/${classId}/students/${studentId}`);
      const sSnap = await getDoc(studentRef);
      if (!sSnap.exists()) return alert("Student not found");
      const s = sSnap.data();
      if ((s.currentPoints || 0) < r.cost) return alert("Not enough points");
      const newCurrent = (s.currentPoints || 0) - r.cost;
      const newXP = (s.xp || 0) + r.cost;
      const history = [...(s.rewardsHistory || []), { id: uid("rh"), rewardId, title: r.title, cost: r.cost, date: new Date().toISOString() }];
      // optionally grant linked card
      const newCards = [...(s.cards || [])];
      if (r.cardId) {
        const cardDoc = await getDoc(doc(db, `classes/${classId}/cards/${r.cardId}`));
        if (cardDoc.exists()) {
          const cardData = cardDoc.data();
          newCards.push({ id: uid("owned"), cardId: r.cardId, title: cardData.title, imageURL: cardData.imageURL || "", grantedAt: new Date().toISOString() });
        }
      }

      await updateDoc(studentRef, { currentPoints: newCurrent, xp: newXP, rewardsHistory: history, cards: newCards });
      alert("Reward redeemed.");
    } catch (err) {
      console.error(err); alert("Failed to redeem reward.");
    }
  }

  // Create reward
  async function createReward({ title, cost, linkedCardId }) {
    if (!ensureClassSelected()) return;
    if (!title) return;
    try {
      const payload = { title, cost: Number(cost || 0), cardId: linkedCardId || null, createdAt: Date.now() };
      await addDoc(collection(db, `classes/${activeClassId}/rewards`), payload);
    } catch (err) {
      console.error(err); alert("Failed to create reward");
    }
  }

  // Edit student total points manually
  async function setStudentTotalPoints(classId, studentId, totalPoints) {
    try {
      await updateDoc(doc(db, `classes/${classId}/students/${studentId}`), { cumulativePoints: Number(totalPoints || 0) });
    } catch (err) {
      console.error(err); alert("Failed to set student total points");
    }
  }

  // Simple small UI helpers
  function formatDate(ts) {
    try { return new Date(ts).toLocaleString(); } catch (e) { return ""; }
  }

  // ---------- Render ----------
  return (
    <div style={{ fontFamily: "Inter, system-ui, sans-serif", padding: 12 }}>
      <style>{`
        .card-thumb { transition: transform 160ms ease, box-shadow 160ms ease; transform-origin: center; }
        .card-thumb:hover { transform: scale(1.18); box-shadow: 0 10px 24px rgba(0,0,0,0.25); z-index: 30; }
        .modal-backdrop { position: fixed; inset: 0; background: rgba(0,0,0,0.45); display:flex; align-items:center; justify-content:center; z-index:1000; }
        .modal { background: white; border-radius: 8px; padding: 12px; max-width: 900px; width: 92%; max-height: 90vh; overflow:auto; }
        .muted { color: #666; font-size: 13px; }
        .btn { padding: 8px 10px; border-radius: 6px; border: 1px solid #ddd; background: white; cursor:pointer; }
        .btn.primary { background: #2563eb; color: white; border: none; }
      `}</style>

      <header style={{ display: "flex", justifyContent: "space-between", alignItems: "center", marginBottom: 12 }}>
        <div>
          <h1 style={{ margin: 0 }}>Mis logros Pokemáticos — Manager (Firestore)</h1>
          <div style={{ color: "#555" }}>{mode === "admin" ? "Admin mode" : mode === "reader" ? "Reader mode" : "Choose mode"}</div>
        </div>
        <div style={{ display: "flex", gap: 8 }}>
          {!mode && <button className="btn" onClick={enterAdmin}>Admin</button>}
          {!mode && <button className="btn" onClick={enterReader}>Reader</button>}
          {mode === "admin" && <button className="btn" onClick={() => {
            if (!window.confirm("Reset local sample? This does nothing to Firestore.")) return;
            // nothing else
          }}>Create sample class</button>}
        </div>
      </header>

      {errorMsg && (<div style={{ marginBottom: 12, color: "crimson" }}>{errorMsg}</div>)}

      <div style={{ display: "grid", gridTemplateColumns: "260px 1fr 340px", gap: 14 }}>

        {/* LEFT: Classes list */}
        <aside style={{ border: "1px solid #eee", padding: 12, borderRadius: 8 }}>
          <h3 style={{ marginTop: 0 }}>Classes</h3>
          <div style={{ marginBottom: 8 }}>
            {loadingClasses ? <div className="muted">Loading classes...</div> : classesList.length === 0 ? <div className="muted">No classes yet</div> :
              classesList.map(c => (
                <div key={c.id} style={{ display: "flex", alignItems: "center", justifyContent: "space-between", marginBottom: 6 }}>
                  <button className="btn" style={{ textAlign: "left", flex: 1, background: activeClassId === c.id ? "#eef" : "transparent" }} onClick={() => setActiveClassId(c.id)}>{c.name}</button>
                  {mode === "admin" && <div style={{ display: "flex", gap: 6 }}>
                    <button className="btn" onClick={() => {
                      const newName = prompt("Rename class:", c.name);
                      if (newName && newName !== c.name) editClassName(c.id, newName);
                    }}>Edit</button>
                    <button className="btn" onClick={() => removeClass(c.id)}>Delete</button>
                  </div>}
                </div>
              ))
            }
          </div>

          {mode === "admin" && (
            <div style={{ marginTop: 8 }}>
              <h4 style={{ marginBottom: 6 }}>Add new class</h4>
              <div style={{ display: "flex", gap: 8 }}>
                <input ref={newClassNameRef} placeholder="Class name" style={{ flex: 1, padding: "6px 8px" }} />
                <button className="btn primary" onClick={() => {
                  const name = newClassNameRef.current?.value?.trim();
                  if (!name) return alert("Enter name");
                  createClass(name);
                  newClassNameRef.current.value = "";
                }}>Create</button>
              </div>
            </div>
          )}
        </aside>

        {/* MIDDLE: Students */}
        <main style={{ border: "1px solid #eee", padding: 12, borderRadius: 8 }}>
          <div style={{ display: "flex", justifyContent: "space-between", alignItems: "center" }}>
            <h3 style={{ margin: 0 }}>{classesList.find(c => c.id === activeClassId)?.name || "Select a class"}</h3>
            <div className="muted">filter students... (not implemented)</div>
          </div>

          <div style={{ marginTop: 12 }}>
            {activeClassId ? (
              <>
                <div style={{ marginBottom: 12 }}>
                  {loadingStudents ? <div className="muted">Loading students...</div> : (
                    <div style={{ display: "grid", gridTemplateColumns: "repeat(2, 1fr)", gap: 12 }}>
                      {students.map(s => (
                        <div key={s.id} style={{ border: "1px solid #ddd", padding: 10, borderRadius: 6 }}>
                          <div style={{ display: "flex", justifyContent: "space-between" }}>
                            <div>
                              <div style={{ fontWeight: 700 }}>{s.name}</div>
                              <div className="muted">Streak: {s.streak || 0} • Last: {s.lastActive ? s.lastActive : "-"}</div>
                            </div>
                            <div style={{ textAlign: "right" }}>
                              <div style={{ fontWeight: 700 }}>{s.currentPoints || 0} pts</div>
                              <div className="muted">Total: {s.cumulativePoints || 0}</div>
                            </div>
                          </div>

                          <div style={{ marginTop: 8, display: "flex", gap: 8 }}>
                            <button className="btn" onClick={() => setSelectedStudent({ ...s, classId: activeClassId })}>Manage</button>
                            {mode === "admin" && <button className="btn" onClick={() => {
                              // quick give card will open Manage with Give view
                              setSelectedStudent({ ...s, classId: activeClassId });
                            }}>Give card</button>}
                          </div>

                          <div style={{ marginTop: 8 }}>
                            <div style={{ fontSize: 13, fontWeight: 700 }}>Cards</div>
                            <div style={{ display: "flex", gap: 8, flexWrap: "wrap", marginTop: 8 }}>
                              {(s.cards || []).slice(-6).map(o => (
                                <div key={o.id} className="card-thumb" style={{ width: 80, height: 110, border: "1px solid #eee", borderRadius: 6, overflow: "hidden", cursor: "pointer" }}
                                  onClick={() => setCardPreview(o)}>
                                  {o.imageURL ? <img src={o.imageURL} alt={o.title} style={{ width: "100%", height: "100%", objectFit: "cover" }} /> : <div style={{ padding: 6 }}>{o.title}</div>}
                                </div>
                              ))}
                            </div>
                          </div>
                        </div>
                      ))}

                      {mode === "admin" && (
                        <div style={{ border: "1px dashed #ccc", padding: 12, borderRadius: 6 }}>
                          <h4 style={{ marginTop: 0 }}>Add student</h4>
                          <div style={{ display: "flex", gap: 8 }}>
                            <input ref={newStudentRef} placeholder="Student name" style={{ flex: 1, padding: 6 }} />
                            <button className="btn primary" onClick={() => {
                              const name = newStudentRef.current?.value?.trim();
                              if (!name) return alert("Enter name");
                              addStudent(name);
                              newStudentRef.current.value = "";
                            }}>Add</button>
                          </div>
                        </div>
                      )}
                    </div>
                  )}
                </div>
              </>
            ) : (
              <div className="muted">Select a class on the left to view and manage students, cards and rewards.</div>
            )}
          </div>
        </main>

        {/* RIGHT: Library */}
        <aside style={{ border: "1px solid #eee", padding: 12, borderRadius: 8 }}>
          <h3>Library (class)</h3>

          {!activeClassId && <div className="muted">Select a class first</div>}
          {activeClassId && (
            <>
              <div style={{ border: "1px dashed #ddd", padding: 8, borderRadius: 6, marginBottom: 12 }}>
                <h4 style={{ marginTop: 0 }}>Create new card</h4>
                <CardCreateForm onCreate={(payload) => createCard({ ...payload })} fileRef={cardFileRef} />
              </div>

              <div style={{ marginBottom: 8 }}>
                <div className="muted">Cards</div>
                {loadingCards ? <div className="muted">Loading cards...</div> : (
                  <div style={{ display: "grid", gap: 8 }}>
                    {cards.map(c => (
                      <div key={c.id} style={{ display: "flex", gap: 8, alignItems: "center", border: "1px solid #eee", padding: 8, borderRadius: 6 }}>
                        <div style={{ width: 64, height: 80, background: "#fafafa", cursor: "pointer" }} onClick={() => setCardPreview({ ...c, isLibraryCard: true })}>
                          {c.imageURL ? <img src={c.imageURL} alt={c.title} style={{ width: "100%", height: "100%", objectFit: "cover" }} /> : <div style={{ padding: 6 }}>{c.title}</div>}
                        </div>
                        <div style={{ flex: 1 }}>
                          <div style={{ fontWeight: 700 }}>{c.title}</div>
                          <div className="muted">{c.description}</div>
                          <div style={{ marginTop: 6, fontWeight: 700 }}>{c.points || 0} pts • {c.category || "points"}</div>
                        </div>
                        <div style={{ display: "flex", flexDirection: "column", gap: 6 }}>
                          {mode === "admin" && <button className="btn" onClick={() => {
                            const confirmGiveTo = prompt("Give this card to which student (type exact name)? Leave empty to cancel.");
                            if (confirmGiveTo) {
                              // find first student with that name in current class
                              const st = students.find(s => s.name.toLowerCase() === confirmGiveTo.toLowerCase());
                              if (st) giveCardToStudent(activeClassId, st.id, c.id);
                              else alert("Student not found (type exact name). Use Manage -> Give for picklist.");
                            }
                          }}>Quick give</button>}
                          {mode === "admin" && <button className="btn" onClick={() => deleteCard(c.id)}>Delete</button>}
                        </div>
                      </div>
                    ))}
                  </div>
                )}
              </div>

              <div style={{ marginTop: 12 }}>
                <h4 style={{ marginBottom: 6 }}>Rewards</h4>
                {loadingRewards ? <div className="muted">Loading rewards...</div> : (
                  <div style={{ display: "grid", gap: 8 }}>
                    {rewards.map(r => <div key={r.id} style={{ border: "1px solid #eee", padding: 8, borderRadius: 6 }}>
                      <div style={{ fontWeight: 700 }}>{r.title}</div>
                      <div className="muted">Cost: {r.cost} pts • linked: {r.cardId || "—"}</div>
                      {mode === "admin" && <div style={{ marginTop: 6 }}><button className="btn" onClick={() => deleteDoc(doc(db, `classes/${activeClassId}/rewards/${r.id}`))}>Delete</button></div>}
                    </div>)}
                    {mode === "admin" && <div style={{ borderTop: "1px dashed #eee", paddingTop: 8 }}>
                      <RewardCreateForm cards={cards} onCreate={(payload) => createReward(payload)} />
                    </div>}
                  </div>
                )}
              </div>
            </>
          )}
        </aside>
      </div>

      {/* Card preview modal (works both for library card and owned card) */}
      {cardPreview && (
        <div className="modal-backdrop" onClick={() => setCardPreview(null)}>
          <div className="modal" onClick={(e) => e.stopPropagation()}>
            <div style={{ display: "flex", gap: 12 }}>
              <div style={{ width: 360, height: 500, background: "#f6f6f6", borderRadius: 6, overflow: "hidden" }}>
                {cardPreview.imageURL ? <img src={cardPreview.imageURL} alt={cardPreview.title} style={{ width: "100%", height: "100%", objectFit: "contain" }} /> :
                  <div style={{ padding: 12 }}>{cardPreview.title}</div>}
              </div>
              <div style={{ flex: 1 }}>
                <h3 style={{ marginTop: 0 }}>{cardPreview.title}</h3>
                <div className="muted">{cardPreview.description}</div>
                <div style={{ marginTop: 8, fontWeight: 700 }}>{cardPreview.points || 0} pts</div>

                <div style={{ marginTop: 12, display: "flex", gap: 8 }}>
                  <button className="btn" onClick={() => setCardPreview(null)}>Close</button>
                  {cardPreview.isLibraryCard && mode === "admin" && <button className="btn primary" onClick={() => {
                    // open quick give: pick student by name
                    const studentName = prompt("Give to student (exact name):");
                    if (studentName) {
                      const st = students.find(s => s.name.toLowerCase() === studentName.toLowerCase());
                      if (st) giveCardToStudent(activeClassId, st.id, cardPreview.id);
                      else alert("Student not found. Use Manage -> Give for picklist.");
                    }
                  }}>Give to student</button>}
                </div>
              </div>
            </div>
          </div>
        </div>
      )}

      {/* Manage student modal */}
      {selectedStudent && (
        <div className="modal-backdrop" onClick={() => setSelectedStudent(null)}>
          <div className="modal" onClick={(e) => e.stopPropagation()}>
            <div style={{ display: "flex", justifyContent: "space-between", alignItems: "center" }}>
              <h3 style={{ margin: 0 }}>Manage: {selectedStudent.name}</h3>
              <div style={{ display: "flex", gap: 8 }}>
                <button className="btn" onClick={() => setSelectedStudent(null)}>Close</button>
                {mode === "admin" && <button className="btn" onClick={() => {
                  if (!window.confirm("Delete student?")) return;
                  deleteStudent(selectedStudent.classId, selectedStudent.id);
                }}>Delete</button>}
              </div>
            </div>

            <div style={{ marginTop: 12, display: "grid", gridTemplateColumns: "1fr 340px", gap: 12 }}>
              <div>
                <div>
                  <div style={{ fontSize: 13, color: "#666" }}>Name</div>
                  <div style={{ display: "flex", gap: 8, marginTop: 6 }}>
                    <input defaultValue={selectedStudent.name} onBlur={(e) => {
                      const val = e.target.value.trim();
                      if (val && val !== selectedStudent.name) editStudent(selectedStudent.classId, selectedStudent.id, { name: val });
                    }} style={{ flex: 1, padding: 6 }} />
                    <div style={{ width: 140 }}>
                      <div style={{ fontSize: 13, color: "#666" }}>Total points</div>
                      <input defaultValue={selectedStudent.cumulativePoints || 0} onBlur={(e) => {
                        const val = Number(e.target.value || 0);
                        setStudentTotalPoints(selectedStudent.classId, selectedStudent.id, val);
                      }} style={{ width: "100%", padding: 6 }} />
                    </div>
                  </div>
                </div>

                <div style={{ marginTop: 12 }}>
                  <div style={{ display: "flex", gap: 8, alignItems: "center" }}>
                    <div>
                      <div style={{ fontSize: 13, color: "#666" }}>Current points</div>
                      <div style={{ fontWeight: 700 }}>{selectedStudent.currentPoints || 0}</div>
                    </div>
                    {mode === "admin" && (<div>
                      <button className="btn" onClick={() => editStudent(selectedStudent.classId, selectedStudent.id, { currentPoints: (selectedStudent.currentPoints || 0) + 1 })}>+1</button>
                      <button className="btn" onClick={() => editStudent(selectedStudent.classId, selectedStudent.id, { currentPoints: (selectedStudent.currentPoints || 0) + 5 })}>+5</button>
                      <button className="btn" onClick={() => editStudent(selectedStudent.classId, selectedStudent.id, { currentPoints: (selectedStudent.currentPoints || 0) + 10 })}>+10</button>
                    </div>)}
                  </div>
                </div>

                <div style={{ marginTop: 12 }}>
                  <h4 style={{ marginTop: 0 }}>Owned cards</h4>
                  <div style={{ display: "grid", gap: 8 }}>
                    {(selectedStudent.cards || []).map(o => (
                      <div key={o.id} style={{ display: "flex", gap: 8, alignItems: "center", border: "1px solid #eee", padding: 8, borderRadius: 6 }}>
                        <div style={{ width: 84, height: 110, overflow: "hidden" }}>
                          {o.imageURL ? <img src={o.imageURL} alt={o.title} style={{ width: "100%", height: "100%", objectFit: "cover" }} /> : <div style={{ padding: 6 }}>{o.title}</div>}
                        </div>
                        <div style={{ flex: 1 }}>
                          <div style={{ fontWeight: 700 }}>{o.title}</div>
                          <div className="muted">{o.grantedAt?.slice(0, 10)}</div>
                        </div>
                        <div>
                          {mode === "admin" && <button className="btn" onClick={() => removeOwnedCard(selectedStudent.classId, selectedStudent.id, o.id)}>Remove</button>}
                        </div>
                      </div>
                    ))}
                  </div>
                </div>
              </div>

              <div>
                <div style={{ display: "flex", justifyContent: "space-between", alignItems: "center" }}>
                  <h4 style={{ marginTop: 0 }}>Give card</h4>
                </div>
                <div style={{ display: "grid", gap: 8 }}>
                  {cards.map(c => (
                    <div key={c.id} style={{ display: "flex", gap: 8, alignItems: "center", border: "1px solid #eee", padding: 8, borderRadius: 6 }}>
                      <div style={{ width: 64, height: 80, overflow: "hidden" }}>
                        {c.imageURL ? <img src={c.imageURL} alt={c.title} style={{ width: "100%", height: "100%", objectFit: "cover" }} /> : <div style={{ padding: 6 }}>{c.title}</div>}
                      </div>
                      <div style={{ flex: 1 }}>
                        <div style={{ fontWeight: 700 }}>{c.title}</div>
                        <div className="muted">{c.description}</div>
                      </div>
                      <div>
                        {mode === "admin" && <button className="btn" onClick={() => giveCardToStudent(selectedStudent.classId, selectedStudent.id, c.id)}>Give</button>}
                      </div>
                    </div>
                  ))}
                </div>
              </div>

            </div>
          </div>
        </div>
      )}

    </div>
  );
}

/* ------- Small helper components used above ------- */

function CardCreateForm({ onCreate, fileRef }) {
  const [title, setTitle] = useState("");
  const [description, setDescription] = useState("");
  const [points, setPoints] = useState(1);
  const [category, setCategory] = useState("points");
  const [file, setFile] = useState(null);

  function onFileChange(e) {
    const f = e.target.files?.[0];
    setFile(f || null);
    if (fileRef) fileRef.current = e.target;
  }

  return (
    <div>
      <input placeholder="Title" value={title} onChange={(e) => setTitle(e.target.value)} style={{ width: "100%", padding: 6, marginBottom: 6 }} />
      <textarea placeholder="Description" value={description} onChange={(e) => setDescription(e.target.value)} style={{ width: "100%", padding: 6, height: 70 }} />
      <div style={{ display: "flex", gap: 8, marginTop: 6, alignItems: "center" }}>
        <input type="number" value={points} onChange={(e) => setPoints(e.target.value)} style={{ width: 80, padding: 6 }} />
        <select value={category} onChange={(e) => setCategory(e.target.value)} style={{ padding: 6 }}>
          <option value="points">Points</option>
          <option value="experience">Experience</option>
        </select>
        <input ref={fileRef} type="file" accept="image/*" onChange={onFileChange} />
      </div>
      <div style={{ marginTop: 8 }}>
        <button className="btn primary" onClick={() => {
          onCreate({ title, description, points, category, file });
          setTitle(""); setDescription(""); setPoints(1); setCategory("points");
          if (fileRef?.current) fileRef.current.value = "";
        }}>Add card</button>
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
      <input placeholder="Title" value={title} onChange={(e) => setTitle(e.target.value)} style={{ width: "100%", padding: 6, marginBottom: 6 }} />
      <div style={{ display: "flex", gap: 8 }}>
        <input type="number" value={cost} onChange={(e) => setCost(e.target.value)} style={{ padding: 6, width: 80 }} />
        <select value={cardId} onChange={(e) => setCardId(e.target.value)} style={{ flex: 1, padding: 6 }}>
          <option value="">-- link card (optional) --</option>
          {cards.map(c => <option key={c.id} value={c.id}>{c.title}</option>)}
        </select>
      </div>
      <div style={{ marginTop: 6 }}>
        <button className="btn" onClick={() => {
          onCreate({ title, cost, linkedCardId: cardId });
          setTitle(""); setCost(5); setCardId("");
        }}>Add reward</button>
      </div>
    </div>
  );
}
