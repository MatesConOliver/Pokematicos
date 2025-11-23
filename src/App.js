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
  onSnapshot,
  getDoc,
  getDocs,
  serverTimestamp,
  query,
  orderBy
} from "firebase/firestore";
import {
  getStorage,
  ref as storageRef,
  uploadBytesResumable,
  getDownloadURL
} from "firebase/storage";

/*
  Firebase initialization -- use your config
  (you provided earlier; keep it here)
*/
const firebaseConfig = {
  apiKey: "AIzaSyAi9YLbUydV4yDZe64hfUo-btSdo_uYunc",
  authDomain: "pokematicos.firebaseapp.com",
  databaseURL: "https://pokematicos-default-rtdb.europe-west1.firebasedatabase.app",
  projectId: "pokematicos",
  storageBucket: "pokematicos.firebasestorage.app",
  messagingSenderId: "101415606738",
  appId: "1:101415606738:web:c009f17005904490e9d00b"
};

const app = initializeApp(firebaseConfig);
const db = getFirestore(app);
const storage = getStorage(app);

/*
  App overview:
  - Firestore structure:
    /classes/{classId} (doc: { name, createdAt })
      /students/{studentId} (doc: student fields)
      /library/cards/{cardId} (doc: card fields)
      /library/rewards/{rewardId} (doc: reward fields)

  - student-owned cards stored as subcollection:
      /classes/{classId}/students/{studentId}/owned/{ownedId}
*/

function uid(prefix = "id") {
  return `${prefix}_${Math.random().toString(36).slice(2, 9)}`;
}

/* Minimal loading skeleton */
function Loader({ text = "Loading..." }) {
  return <div style={{ padding: 12, color: "#666" }}>{text}</div>;
}

export default function App() {
  // admin gating
  const [mode, setMode] = useState(null); // null | 'admin' | 'reader'
  const adminPassword = "cartas";

  function enterAdmin(password) {
    if (password === adminPassword) setMode("admin");
    else alert("Wrong password");
  }
  function enterReader() { setMode("reader"); }

  // global UI state
  const [classesList, setClassesList] = useState(null);
  const [activeClassId, setActiveClassId] = useState(null);
  const [activeClassDoc, setActiveClassDoc] = useState(null); // class doc data
  const [students, setStudents] = useState(null);
  const [cards, setCards] = useState(null);
  const [rewards, setRewards] = useState(null);
  const [selectedStudent, setSelectedStudent] = useState(null);
  const [showCardPreview, setShowCardPreview] = useState(null);
  const [loading, setLoading] = useState(true);

  // refs to store listeners' unsubscribe functions so we can cleanup
  const listenersRef = useRef({ classes: null, students: null, cards: null, rewards: null });

  /* ---------- Firestore listeners ---------- */

  // listen to classes collection
  useEffect(() => {
    const classesCol = collection(db, "classes");
    const q = query(classesCol, orderBy("createdAt", "asc"));
    const unsub = onSnapshot(q, (snap) => {
      const arr = [];
      snap.forEach(docSnap => {
        arr.push({ id: docSnap.id, ...docSnap.data() });
      });
      setClassesList(arr);
      // set default active class if none
      if (!activeClassId && arr.length) setActiveClassId(arr[0].id);
      setLoading(false);
    }, (err) => {
      console.error("classes listener error", err);
      alert("Error loading classes: " + err.message);
      setLoading(false);
    });
    listenersRef.current.classes = unsub;
    return () => unsub();
    // eslint-disable-next-line react-hooks/exhaustive-deps
  }, []);

  // when activeClassId changes, attach listeners to students, library/cards, library/rewards
  useEffect(() => {
    // cleanup previous
    if (listenersRef.current.students) listenersRef.current.students();
    if (listenersRef.current.cards) listenersRef.current.cards();
    if (listenersRef.current.rewards) listenersRef.current.rewards();
    setStudents(null);
    setCards(null);
    setRewards(null);
    setActiveClassDoc(null);

    if (!activeClassId) return;

    // load class doc
    const classDocRef = doc(db, "classes", activeClassId);
    getDoc(classDocRef).then(d => {
      if (d.exists()) setActiveClassDoc({ id: d.id, ...d.data() });
    }).catch(err => console.error("getClassDoc", err));

    // students listener
    const studentsCol = collection(db, "classes", activeClassId, "students");
    const studentsQ = query(studentsCol, orderBy("name", "asc"));
    const unsubStudents = onSnapshot(studentsQ, (snap) => {
      const arr = [];
      snap.forEach(ds => arr.push({ id: ds.id, ...ds.data() }));
      setStudents(arr);
    }, err => console.error("students listener", err));
    listenersRef.current.students = unsubStudents;

    // cards in class library
    const cardsCol = collection(db, "classes", activeClassId, "library", "cards");
    const cardsQ = query(cardsCol, orderBy("title", "asc"));
    const unsubCards = onSnapshot(cardsQ, (snap) => {
      const arr = [];
      snap.forEach(cs => arr.push({ id: cs.id, ...cs.data() }));
      setCards(arr);
    }, err => console.error("cards listener", err));
    listenersRef.current.cards = unsubCards;

    // rewards
    const rewardsCol = collection(db, "classes", activeClassId, "library", "rewards");
    const rewardsQ = query(rewardsCol, orderBy("title", "asc"));
    const unsubRewards = onSnapshot(rewardsQ, (snap) => {
      const arr = [];
      snap.forEach(rs => arr.push({ id: rs.id, ...rs.data() }));
      setRewards(arr);
    }, err => console.error("rewards listener", err));
    listenersRef.current.rewards = unsubRewards;

    return () => {
      if (unsubStudents) unsubStudents();
      if (unsubCards) unsubCards();
      if (unsubRewards) unsubRewards();
    };
  }, [activeClassId]);

  /* ---------- CRUD helpers ---------- */

  async function createClass(name) {
    if (!name) return;
    const classesCol = collection(db, "classes");
    const newDocRef = await addDoc(classesCol, { name, createdAt: serverTimestamp() });
    setActiveClassId(newDocRef.id);
  }

  async function deleteClass(classId) {
    if (!confirm("Delete class and all its data? This cannot be undone.")) return;
    // WARNING: Firestore does not delete subcollections automatically.
    // For safety we will only delete the class doc and leave subcollections for manual cleanup if needed.
    await deleteDoc(doc(db, "classes", classId));
  }

  async function editClassName(classId) {
    const c = classesList.find(x => x.id === classId);
    if (!c) return;
    const n = prompt("New class name", c.name);
    if (!n) return;
    await updateDoc(doc(db, "classes", classId), { name: n });
  }

  async function addStudent(name) {
    if (!name || !activeClassId) return;
    const studentsCol = collection(db, "classes", activeClassId, "students");
    await addDoc(studentsCol, {
      name,
      avatar: "",
      currentPoints: 0,
      xp: 0,
      streak: 0,
      ghost: 0,
      createdAt: serverTimestamp()
    });
  }

  async function deleteStudent(studentId) {
    if (!confirm("Delete this student?")) return;
    await deleteDoc(doc(db, "classes", activeClassId, "students", studentId));
  }

  async function updateStudentFields(studentId, updates) {
    await updateDoc(doc(db, "classes", activeClassId, "students", studentId), updates);
  }

  // upload image to Firebase Storage and return download URL
  async function uploadImageFileAndGetURL(file, pathPrefix = "cards") {
    if (!file) return "";
    const id = uid("img");
    const storagePath = `${pathPrefix}/${id}_${file.name}`;
    const sRef = storageRef(storage, storagePath);
    const uploadTask = await new Promise((res, rej) => {
      const task = uploadBytesResumable(sRef, file);
      task.on('state_changed', null, (err) => rej(err), () => res(task.snapshot));
    });
    const url = await getDownloadURL(uploadTask.ref);
    return url;
  }

  async function createCard({ title, description, points, category, imageFile }) {
    if (!activeClassId) return alert("Select a class first");
    let imageUrl = "";
    try {
      if (imageFile) imageUrl = await uploadImageFileAndGetURL(imageFile, `classes/${activeClassId}/cards`);
    } catch (err) {
      console.error("upload image failed", err);
      alert("Image upload failed: " + err.message);
    }
    const cardsCol = collection(db, "classes", activeClassId, "library", "cards");
    await addDoc(cardsCol, {
      title,
      description,
      points: Number(points || 0),
      category: category || "points",
      image: imageUrl,
      createdAt: serverTimestamp()
    });
  }

  async function deleteCard(cardId) {
    if (!confirm("Delete this card from the class library?")) return;
    await deleteDoc(doc(db, "classes", activeClassId, "library", "cards", cardId));
  }

  async function createReward({ title, cost, linkedCardId }) {
    if (!activeClassId) return alert("Select a class first");
    if (!linkedCardId) return alert("Rewards must be linked to a library card");
    const rewardsCol = collection(db, "classes", activeClassId, "library", "rewards");
    await addDoc(rewardsCol, {
      title,
      cost: Number(cost || 0),
      cardId: linkedCardId,
      createdAt: serverTimestamp()
    });
  }

  async function deleteReward(rewardId) {
    if (!confirm("Delete this reward?")) return;
    await deleteDoc(doc(db, "classes", activeClassId, "library", "rewards", rewardId));
  }

  // Give a card to a student: create an owned document in student subcollection & award points
  async function giveCardToStudent(studentId, cardId) {
    if (!activeClassId) return;
    const cardRef = doc(db, "classes", activeClassId, "library", "cards", cardId);
    const cardSnap = await getDoc(cardRef);
    if (!cardSnap.exists()) return alert("Card not found");
    const card = { id: cardSnap.id, ...cardSnap.data() };

    // create owned entry under student
    const ownedCol = collection(db, "classes", activeClassId, "students", studentId, "owned");
    await addDoc(ownedCol, {
      cardId: card.id,
      grantedAt: serverTimestamp()
    });

    // increase student's currentPoints
    const studentRef = doc(db, "classes", activeClassId, "students", studentId);
    const sSnap = await getDoc(studentRef);
    if (!sSnap.exists()) return;
    const current = sSnap.data().currentPoints || 0;
    await updateDoc(studentRef, { currentPoints: current + (card.points || 0) });
  }

  // Remove a student's owned card (owned doc id)
  async function removeOwnedCard(studentId, ownedId) {
    if (!confirm("Remove this owned card?")) return;
    await deleteDoc(doc(db, "classes", activeClassId, "students", studentId, "owned", ownedId));
  }

  // redeem reward individual
  async function redeemRewardIndividual(studentId, rewardId) {
    const rewardRef = doc(db, "classes", activeClassId, "library", "rewards", rewardId);
    const rewardSnap = await getDoc(rewardRef);
    if (!rewardSnap.exists()) return alert("Reward invalid");
    const reward = rewardSnap.data();
    const studentRef = doc(db, "classes", activeClassId, "students", studentId);
    const sSnap = await getDoc(studentRef);
    const st = sSnap.data();
    if ((st.currentPoints || 0) < reward.cost) return alert("Student does not have enough points");
    await updateDoc(studentRef, {
      currentPoints: (st.currentPoints || 0) - reward.cost,
      xp: (st.xp || 0) + reward.cost
    });
    // add history entry inside student's rewardsHistory subcollection (or array)
    const rhCol = collection(db, "classes", activeClassId, "students", studentId, "rewardsHistory");
    await addDoc(rhCol, {
      rewardId,
      title: reward.title,
      cost: reward.cost,
      date: serverTimestamp()
    });

    // if reward.cardId exists, grant card
    if (reward.cardId) {
      await giveCardToStudent(studentId, reward.cardId);
    }
  }

  // group redeem - shares object map { studentId: number }
  async function redeemRewardGroup(rewardId, shares) {
    const rewardRef = doc(db, "classes", activeClassId, "library", "rewards", rewardId);
    const rewardSnap = await getDoc(rewardRef);
    if (!rewardSnap.exists()) return alert("Reward invalid");
    const reward = rewardSnap.data();
    const sum = Object.values(shares).reduce((a, b) => a + Number(b || 0), 0);
    if (sum !== reward.cost) return alert(`Sum is ${sum} but required ${reward.cost}`);
    // ensure each student has enough
    const lacking = [];
    for (const sid of Object.keys(shares)) {
      const sSnap = await getDoc(doc(db, "classes", activeClassId, "students", sid));
      const st = sSnap.data();
      if ((st.currentPoints || 0) < Number(shares[sid] || 0)) lacking.push(st.name);
    }
    if (lacking.length) return alert(`These students lack enough points: ${lacking.join(", ")}`);
    // perform updates
    for (const [sid, val] of Object.entries(shares)) {
      const share = Number(val || 0);
      if (share <= 0) continue;
      const studentRef = doc(db, "classes", activeClassId, "students", sid);
      const sSnap = await getDoc(studentRef);
      const st = sSnap.data();
      await updateDoc(studentRef, {
        currentPoints: (st.currentPoints || 0) - share,
        xp: (st.xp || 0) + share
      });
      const rhCol = collection(db, "classes", activeClassId, "students", sid, "rewardsHistory");
      await addDoc(rhCol, {
        rewardId,
        title: reward.title,
        cost: share,
        date: serverTimestamp()
      });
      if (reward.cardId) {
        await giveCardToStudent(sid, reward.cardId);
      }
    }
  }

  // change meter (streak / ghost)
  async function changeMeter(studentId, meter, delta) {
    const studentRef = doc(db, "classes", activeClassId, "students", studentId);
    const sSnap = await getDoc(studentRef);
    const st = sSnap.data();
    const before = st[meter] || 0;
    let after = before + delta;
    if (after < 0) after = 0;
    if (after > 5) after = 5;
    await updateDoc(studentRef, { [meter]: after });
  }

  // quick points add
  async function addQuickPoints(studentId, amount) {
    const studentRef = doc(db, "classes", activeClassId, "students", studentId);
    const sSnap = await getDoc(studentRef);
    const st = sSnap.data();
    await updateDoc(studentRef, { currentPoints: (st.currentPoints || 0) + Number(amount || 0) });
  }

  /* ---------- simple local helpers for creating sample data if empty ---------- */
  // (Optional) create sample class if no classes exist
  useEffect(() => {
    if (!loading && classesList && classesList.length === 0) {
      // create a sample class
      createClass("3º ESO Pokemáticos");
    }
    // eslint-disable-next-line react-hooks/exhaustive-deps
  }, [loading, classesList]);

  /* ---------- small UI components and event wiring ---------- */

  if (!mode) {
    return (
      <div style={{ padding: 20, fontFamily: "system-ui" }}>
        <h2>Pokemáticos — mode</h2>
        <p>Enter as Admin (edit) or Reader (view-only)</p>
        <div style={{ marginTop: 12 }}>
          <button onClick={() => { const p = prompt("Admin password"); enterAdmin(p); }} style={{ marginRight: 8 }}>Admin</button>
          <button onClick={() => enterReader()}>Reader</button>
        </div>
        <div style={{ marginTop: 12, color: "#666" }}>Admin password kept private</div>
      </div>
    );
  }

  return (
    <div style={{ fontFamily: "system-ui", padding: 8 }}>
      <header style={{ display: "flex", justifyContent: "space-between", alignItems: "center", padding: 12 }}>
        <div>
          <h1>Mis logros Pokemáticos — Manager (Firestore)</h1>
          <div style={{ color: "#666" }}>{mode === "admin" ? "Admin mode" : "Reader mode"}</div>
        </div>
        <div style={{ display: "flex", gap: 8 }}>
          {mode === "admin" && <button onClick={() => {
            if (!confirm("Reset local sample data? This will create a sample class only and won't delete Firestore data.")) return;
            createClass("3º ESO Pokemáticos");
            alert("Created sample class");
          }}>Create sample class</button>}
        </div>
      </header>

      <div style={{ display: "grid", gridTemplateColumns: "260px 1fr 360px", gap: 12, padding: 12 }}>
        {/* Left: Classes */}
        <aside style={{ border: "1px solid #eee", padding: 12, borderRadius: 8 }}>
          <h3>Classes</h3>
          <div style={{ display: "flex", flexDirection: "column", gap: 6 }}>
            {!classesList && <Loader text="Loading classes..." />}
            {classesList && classesList.map(c => (
              <div key={c.id} style={{ display: "flex", justifyContent: "space-between", alignItems: "center" }}>
                <button style={{ textAlign: "left", flex: 1, background: c.id === activeClassId ? "#eef" : "transparent" }} onClick={() => setActiveClassId(c.id)}>
                  {c.name} <span style={{ color: "#888", fontSize: 12 }}> { /* show students count if available */ }</span>
                </button>
                {mode === "admin" && <div style={{ display: "flex", gap: 6 }}>
                  <button onClick={() => editClassName(c.id)}>Edit</button>
                  <button onClick={() => deleteClass(c.id)}>Delete</button>
                </div>}
              </div>
            ))}
          </div>

          {mode === "admin" && (
            <div style={{ marginTop: 12 }}>
              <h4>Add new class</h4>
              <AddClassForm onAdd={(name) => createClass(name)} />
            </div>
          )}
        </aside>

        {/* Middle: Active class students */}
        <main style={{ border: "1px solid #eee", padding: 12, borderRadius: 8 }}>
          <div style={{ display: "flex", justifyContent: "space-between", alignItems: "center" }}>
            <h3>{activeClassDoc?.name || "Select a class"}</h3>
            <div style={{ display: "flex", gap: 8 }}>
              <input placeholder="filter students..." style={{ padding: 6 }} onChange={() => {}} />
            </div>
          </div>

          <div style={{ marginTop: 12, display: "grid", gridTemplateColumns: "repeat(2, 1fr)", gap: 12 }}>
            {!students && <Loader text="Loading students..." />}

            {students && students.map(s => (
              <StudentCard
                key={s.id}
                student={s}
                onManage={() => setSelectedStudent({ ...s, classId: activeClassId })}
                onGive={() => setSelectedStudent({ ...s, classId: activeClassId })}
                activeClassId={activeClassId}
                cards={cards}
                setShowCardPreview={setShowCardPreview}
              />
            ))}

            {mode === "admin" && (
              <div style={{ border: "1px dashed #ccc", padding: 12, borderRadius: 6 }}>
                <h4>Add student</h4>
                <AddStudentForm onAdd={(name) => addStudent(name)} />
              </div>
            )}
          </div>
        </main>

        {/* Right: Library & rewards */}
        <aside style={{ border: "1px solid #eee", padding: 12, borderRadius: 8 }}>
          <h3>Library (class)</h3>

          {mode === "admin" && <div style={{ marginBottom: 10 }}><CreateCardForm onCreate={createCard} /></div>}

          <div style={{ maxHeight: 420, overflow: "auto" }}>
            {!cards && <Loader text="Loading cards..." />}
            {cards && cards.length === 0 && <div style={{ color: "#666" }}>No cards yet</div>}
            {cards && cards.map(c => (
              <div key={c.id} style={{ display: "flex", gap: 8, border: "1px solid #eee", padding: 8, borderRadius: 6, alignItems: "center" }}>
                <div style={{ width: 64, height: 80, background: "#fafafa", cursor: "pointer" }} onClick={() => setShowCardPreview(c)}>
                  {c.image ? <img src={c.image} alt={c.title} style={{ width: "100%", height: "100%", objectFit: "cover" }} /> : <div style={{ padding: 6 }}>{c.title}</div>}
                </div>
                <div style={{ flex: 1 }}>
                  <div style={{ fontWeight: 600 }}>{c.title}</div>
                  <div style={{ fontSize: 12, color: "#666" }}>{c.description}</div>
                  <div style={{ marginTop: 6, fontWeight: 700 }}>{c.points} pts</div>
                </div>
                {mode === "admin" && <div style={{ display: "flex", gap: 6 }}><button onClick={() => deleteCard(c.id)}>Delete</button></div>}
              </div>
            ))}

            <div style={{ marginTop: 12 }}>
              <h4>Rewards</h4>
              {!rewards && <Loader text="Loading rewards..." />}
              {rewards && rewards.map(r => (
                <div key={r.id} style={{ border: "1px solid #eee", padding: 8, borderRadius: 6 }}>
                  <div style={{ fontWeight: 700 }}>{r.title}</div>
                  <div style={{ fontSize: 12, color: "#555" }}>Cost: {r.cost} pts • Linked card: {(cards || []).find(cc => cc.id === r.cardId)?.title || "—"}</div>
                  {mode === "admin" && <div style={{ marginTop: 6 }}><button onClick={() => deleteReward(r.id)}>Delete reward</button></div>}
                </div>
              ))}
            </div>
          </div>

        </aside>
      </div>

      {/* Card preview modal */}
      {showCardPreview && (
        <div style={{ position: "fixed", inset: 0, background: "rgba(0,0,0,0.4)", display: "flex", alignItems: "center", justifyContent: "center" }} onClick={() => setShowCardPreview(null)}>
          <div style={{ background: "white", padding: 12, borderRadius: 8, maxWidth: "80%", maxHeight: "80%", overflow: "auto" }} onClick={(e) => e.stopPropagation()}>
            <div style={{ display: "flex", gap: 12 }}>
              <div style={{ width: 320, height: 440, background: "#f6f6f6" }}>
                {showCardPreview.image ? <img src={showCardPreview.image} alt={showCardPreview.title} style={{ width: "100%", height: "100%", objectFit: "contain" }} /> : <div style={{ padding: 12 }}>{showCardPreview.title}</div>}
              </div>
              <div style={{ flex: 1 }}>
                <h3>{showCardPreview.title}</h3>
                <div style={{ color: "#666" }}>{showCardPreview.description}</div>
                <div style={{ marginTop: 8, fontWeight: 700 }}>{showCardPreview.points} pts</div>
                <div style={{ marginTop: 12 }}>
                  <button onClick={() => setShowCardPreview(null)}>Close</button>
                </div>
              </div>
            </div>
          </div>
        </div>
      )}

      {/* Manage student modal */}
      {selectedStudent && (
        <ManageStudentModal
          key={selectedStudent.id}
          student={selectedStudent}
          classId={activeClassId}
          onClose={() => setSelectedStudent(null)}
          onUpdate={(updates) => updateStudentFields(selectedStudent.id, updates)}
          onGiveCard={(cardId) => giveCardToStudent(selectedStudent.id, cardId)}
          onRemoveOwned={removeOwnedCard}
          onRedeemIndividual={(rewardId) => redeemRewardIndividual(selectedStudent.id, rewardId)}
          onRedeemGroup={(rewardId, shares) => redeemRewardGroup(rewardId, shares)}
          onChangeMeter={(meter, delta) => changeMeter(selectedStudent.id, meter, delta)}
          onAddQuickPoints={(amt) => addQuickPoints(selectedStudent.id, amt)}
          cards={cards || []}
          rewards={rewards || []}
          setShowCardPreview={setShowCardPreview}
        />
      )}
    </div>
  );
}

/* ------------------- Small UI subcomponents ------------------- */

function AddClassForm({ onAdd }) {
  const [name, setName] = useState("");
  return (
    <div>
      <input placeholder="Class name" value={name} onChange={(e) => setName(e.target.value)} />
      <div style={{ marginTop: 6 }}><button onClick={() => { if (!name) return alert("Name required"); onAdd(name); setName(""); }}>Create</button></div>
    </div>
  );
}

function AddStudentForm({ onAdd }) {
  const [name, setName] = useState("");
  return (
    <div>
      <input placeholder="Student name" value={name} onChange={(e) => setName(e.target.value)} />
      <div style={{ marginTop: 6 }}><button onClick={() => { if (!name) return alert("Name required"); onAdd(name); setName(""); }}>Add</button></div>
    </div>
  );
}

function CreateCardForm({ onCreate }) {
  const [title, setTitle] = useState("");
  const [description, setDescription] = useState("");
  const [points, setPoints] = useState(1);
  const [category, setCategory] = useState("points");
  const [file, setFile] = useState(null);
  const [preview, setPreview] = useState(null);

  function handleFile(e) {
    const f = e.target.files?.[0];
    if (!f) return;
    setFile(f);
    const reader = new FileReader();
    reader.onload = (ev) => setPreview(ev.target.result);
    reader.readAsDataURL(f);
  }

  async function handleCreate() {
    if (!title) return alert("Title required");
    await onCreate({ title, description, points, category, imageFile: file });
    setTitle(""); setDescription(""); setPoints(1); setCategory("points"); setFile(null); setPreview(null);
  }

  return (
    <div style={{ border: "1px dashed #ccc", padding: 8, borderRadius: 6 }}>
      <h4>Create new card</h4>
      <input placeholder="Title" value={title} onChange={(e) => setTitle(e.target.value)} />
      <br />
      <textarea placeholder="Description" value={description} onChange={(e) => setDescription(e.target.value)} />
      <br />
      <div style={{ display: "flex", gap: 8, alignItems: "center" }}>
        <input type="number" value={points} onChange={(e) => setPoints(e.target.value)} style={{ width: 80 }} /> pts
        <select value={category} onChange={(e) => setCategory(e.target.value)}>
          <option value="points">Points</option>
          <option value="experience">Experience</option>
        </select>
        <input type="file" accept="image/*" onChange={handleFile} />
      </div>
      {preview && <div style={{ marginTop: 8 }}><img src={preview} alt="preview" style={{ maxWidth: "100%", maxHeight: 120 }} /></div>}
      <div style={{ marginTop: 6 }}><button onClick={handleCreate}>Add card</button></div>
    </div>
  );
}

function StudentCard({ student, onManage, onGive, activeClassId, cards, setShowCardPreview }) {
  return (
    <div style={{ border: "1px solid #ddd", padding: 10, borderRadius: 6 }}>
      <div style={{ display: "flex", justifyContent: "space-between" }}>
        <div>
          <div style={{ fontWeight: 600 }}>{student.name}</div>
          <div style={{ fontSize: 12, color: "#666" }}>Streak: {student.streak}🔥 • Ghost: {student.ghost}👻</div>
        </div>
        <div style={{ textAlign: "right" }}>
          <div style={{ fontWeight: 700 }}>{student.currentPoints || 0} pts</div>
          <div style={{ fontSize: 12, color: "#666" }}>XP: {student.xp || 0}</div>
        </div>
      </div>

      <div style={{ marginTop: 8, display: "flex", gap: 8 }}>
        <button onClick={onManage}>Manage</button>
        <button onClick={onGive}>Give card</button>
      </div>

      <div style={{ marginTop: 8 }}>
        <div style={{ fontSize: 12, color: "#444", fontWeight: 600 }}>Cards</div>
        <div style={{ display: "flex", gap: 6, marginTop: 6, flexWrap: "wrap" }}>
          {/* Show up to 6 latest (we will try to render image by looking up card in cards[]) */}
          {(student.cards || []).slice(-6).map(o => {
            // in this rewrite student.cards is likely not used; owned cards are in subcollection.
            // To keep compatibility with older local data, try to find card in cards[] or fallback to title
            const card = cards.find(c => c.id === o.cardId) || { title: "Card", image: "" };
            return (
              <div key={o.id || o.cardId} style={{ width: 80, height: 110, border: "1px solid #eee", borderRadius: 4, overflow: "hidden" }}>
                {card.image ? (
                  <img
                    src={card.image}
                    alt={card.title}
                    style={{ width: "100%", height: "100%", objectFit: "cover", transition: "transform 0.18s ease" }}
                    onMouseEnter={e => e.currentTarget.style.transform = "scale(1.2)"}
                    onMouseLeave={e => e.currentTarget.style.transform = "scale(1)"}
                    onClick={() => setShowCardPreview(card)}
                  />
                ) : <div style={{ padding: 6 }}>{card.title}</div>}
              </div>
            );
          })}
        </div>
      </div>
    </div>
  );
}

/* ManageStudentModal shows student details and allows operations (reads owned cards in subcollection) */
function ManageStudentModal({ student, classId, onClose, onUpdate, onGiveCard, onRemoveOwned, onRedeemIndividual, onRedeemGroup, onChangeMeter, onAddQuickPoints, cards, rewards, setShowCardPreview }) {
  const [name, setName] = useState(student.name || "");
  const [currentPoints, setCurrentPoints] = useState(student.currentPoints || 0);
  const [xp, setXp] = useState(student.xp || 0);
  const [owned, setOwned] = useState(null); // owned cards subcollection
  const [loadingOwned, setLoadingOwned] = useState(true);
  const [redeemId, setRedeemId] = useState("");
  const [groupShares, setGroupShares] = useState({});

  useEffect(() => {
    setName(student.name || "");
    setCurrentPoints(student.currentPoints || 0);
    setXp(student.xp || 0);
    setGroupShares({});
    setOwned(null);
    setLoadingOwned(true);

    // listen to owned cards subcollection
    const ownedCol = collection(db, "classes", classId, "students", student.id, "owned");
    const q = query(ownedCol, orderBy("grantedAt", "asc"));
    const unsub = onSnapshot(q, (snap) => {
      const arr = [];
      snap.forEach(os => arr.push({ id: os.id, ...os.data() }));
      setOwned(arr);
      setLoadingOwned(false);
    }, (err) => {
      console.error("owned listener error", err);
      setLoadingOwned(false);
    });
    return () => unsub();
  }, [student, classId]);

  async function saveEdits() {
    await onUpdate({ name, currentPoints: Number(currentPoints || 0), xp: Number(xp || 0) });
    alert("Saved");
  }

  async function handleGiveCard(cardId) {
    await onGiveCard(cardId);
  }

  async function handleRemoveOwned(ownedId) {
    await onRemoveOwned(student.id, ownedId);
  }

  return (
    <div style={{ position: "fixed", inset: 0, background: "rgba(0,0,0,0.4)", display: "flex", alignItems: "center", justifyContent: "center" }}>
      <div style={{ width: 920, maxHeight: "90%", overflow: "auto", background: "white", borderRadius: 8, padding: 12 }}>
        <div style={{ display: "flex", justifyContent: "space-between", alignItems: "center" }}>
          <h3>Manage: {student.name}</h3>
          <div><button onClick={onClose}>Close</button></div>
        </div>

        <div style={{ display: "grid", gridTemplateColumns: "1fr 360px", gap: 12, marginTop: 12 }}>
          <div>
            <div style={{ display: "flex", gap: 8 }}>
              <div>
                <div style={{ fontSize: 12, color: "#666" }}>Points</div>
                <div style={{ fontWeight: 700, fontSize: 20 }}>{student.currentPoints || 0} pts</div>
                <div style={{ marginTop: 6 }}>
                  <button onClick={() => onAddQuickPoints(1)}>+1</button>
                  <button onClick={() => onAddQuickPoints(5)} style={{ marginLeft: 6 }}>+5</button>
                  <button onClick={() => onAddQuickPoints(10)} style={{ marginLeft: 6 }}>+10</button>
                </div>
              </div>

              <div style={{ marginLeft: 12 }}>
                <div style={{ fontSize: 12, color: "#666" }}>Experience (XP)</div>
                <div style={{ fontWeight: 700, fontSize: 20 }}>{student.xp || 0}</div>
              </div>

              <div style={{ marginLeft: 12 }}>
                <div style={{ fontSize: 12, color: "#666" }}>Streak</div>
                <div style={{ display: "flex", gap: 6, alignItems: "center" }}>
                  <button onClick={() => onChangeMeter(student.id, "streak", -1)}>-</button>
                  <div>{'🔥'.repeat(student.streak || 0)}</div>
                  <button onClick={() => onChangeMeter(student.id, "streak", +1)}>+</button>
                </div>
                <div style={{ fontSize: 12, color: "#666", marginTop: 8 }}>Ghost assistance</div>
                <div style={{ display: "flex", gap: 6, alignItems: "center" }}>
                  <button onClick={() => onChangeMeter(student.id, "ghost", -1)}>-</button>
                  <div>{'👻'.repeat(student.ghost || 0)}</div>
                  <button onClick={() => onChangeMeter(student.id, "ghost", +1)}>+</button>
                </div>
              </div>
            </div>

            <div style={{ marginTop: 12 }}>
              <h4>Edit student</h4>
              <div>
                <div style={{ marginBottom: 6 }}>
                  <div style={{ fontSize: 12 }}>Name</div>
                  <input value={name} onChange={(e) => setName(e.target.value)} />
                </div>
                <div style={{ marginBottom: 6 }}>
                  <div style={{ fontSize: 12 }}>Current points</div>
                  <input type="number" value={currentPoints} onChange={(e) => setCurrentPoints(e.target.value)} />
                </div>
                <div style={{ marginBottom: 6 }}>
                  <div style={{ fontSize: 12 }}>XP (total)</div>
                  <input type="number" value={xp} onChange={(e) => setXp(e.target.value)} />
                </div>
                <div>
                  <button onClick={saveEdits}>Save edits</button>
                </div>
              </div>
            </div>

            <div style={{ marginTop: 12 }}>
              <h4>Owned cards</h4>
              {loadingOwned && <Loader text="Loading owned cards..." />}
              <div style={{ display: "flex", gap: 8, flexWrap: "wrap" }}>
                {owned && owned.length === 0 && <div style={{ color: "#666" }}>No owned cards</div>}
                {owned && owned.map(o => {
                  const cardMeta = cards.find(c => c.id === o.cardId) || { title: "Card", image: "" };
                  return (
                    <div key={o.id} style={{ border: "1px solid #eee", padding: 6, borderRadius: 6, width: 140 }}>
                      {cardMeta.image ? (
                        <img
                          src={cardMeta.image}
                          alt={cardMeta.title}
                          style={{ width: "100%", height: 90, objectFit: "cover", borderRadius: 4, cursor: "pointer", transition: "transform 0.18s ease" }}
                          onMouseEnter={e => e.currentTarget.style.transform = "scale(1.12)"}
                          onMouseLeave={e => e.currentTarget.style.transform = "scale(1)"}
                          onClick={() => setShowCardPreview(cardMeta)}
                        />
                      ) : <div style={{ fontWeight: 600 }}>{cardMeta.title}</div>}
                      <div style={{ fontSize: 12, color: "#666" }}>{o.grantedAt?.toDate ? o.grantedAt.toDate().toISOString().slice(0, 10) : ""}</div>
                      <div style={{ marginTop: 6 }}><button onClick={() => handleRemoveOwned(o.id)}>Remove</button></div>
                    </div>
                  );
                })}
              </div>
            </div>

            <div style={{ marginTop: 12 }}>
              <h4>Redeem reward</h4>
              <div>
                <select value={redeemId} onChange={(e) => setRedeemId(e.target.value)}>
                  <option value="">-- choose reward --</option>
                  {rewards.map(r => <option key={r.id} value={r.id}>{r.title} (cost {r.cost})</option>)}
                </select>
                <div style={{ marginTop: 8 }}>
                  <button onClick={() => { if (!redeemId) return alert("Choose reward"); const choice = prompt("Individual or Group? type I or G"); if (!choice) return; if (choice.toUpperCase() === "I") { onRedeemIndividual(redeemId); } else { alert("Group redeem: use class view to open group shares."); } }}>Redeem</button>
                </div>
              </div>
            </div>

          </div>

          <div>
            <div style={{ display: "flex", justifyContent: "space-between", alignItems: "center" }}>
              <h4>Admin actions</h4>
              <div></div>
            </div>

            <div style={{ marginTop: 8 }}>
              <h4>Give card</h4>
              <div style={{ display: "grid", gap: 8 }}>
                {cards.map(c => (
                  <div key={c.id} style={{ border: "1px solid #eee", padding: 6, borderRadius: 6, display: "flex", justifyContent: "space-between", alignItems: "center" }}>
                    <div>
                      <div style={{ fontWeight: 700 }}>{c.title}</div>
                      <div style={{ fontSize: 12, color: "#666" }}>{c.description}</div>
                    </div>
                    <div><button onClick={() => handleGiveCard(c.id)}>Give</button></div>
                  </div>
                ))}
              </div>
            </div>

          </div>
        </div>

      </div>
    </div>
  );
}
