// src/App.js
import React, { useEffect, useState, useRef } from "react";
import { initializeApp } from "firebase/app";
import {
  getFirestore,
  collection,
  doc,
  addDoc,
  updateDoc,
  deleteDoc,
  getDoc,
  onSnapshot,
  query,
  orderBy,
} from "firebase/firestore";
import {
  getStorage,
  ref as storageRef,
  uploadBytes,
  getDownloadURL,
} from "firebase/storage";

// Firebase config – keep your existing values here
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

console.log("🔥 Firebase initialized");
console.log("🔥 App name:", app.name);

function uid(prefix = "id") {
  return `${prefix}_${Math.random().toString(36).slice(2, 9)}`;
}

// -------------------- Small helper components -------------------- //

function CardCreateForm({ onCreate, fileRef }) {
  const [title, setTitle] = useState("");
  const [description, setDescription] = useState("");
  const [points, setPoints] = useState(1);
  const [category, setCategory] = useState("points");
  const [lockedFile, setLockedFile] = useState(null);
  const [unlockedFile, setUnlockedFile] = useState(null);

  // extra ref just to clear the second input
  const unlockedRef = React.useRef(null);

  function onLockedChange(e) {
    const f = e.target.files?.[0] || null;
    setLockedFile(f);
    if (fileRef) fileRef.current = e.target; // keep using external ref for this one
  }

  function onUnlockedChange(e) {
    const f = e.target.files?.[0] || null;
    setUnlockedFile(f);
    unlockedRef.current = e.target;
  }

  function handleCreate() {
    if (!title.trim()) {
      alert("Title required");
      return;
    }

    onCreate({
      title,
      description,
      points,
      category,
      lockedFile,
      unlockedFile,
    });

    setTitle("");
    setDescription("");
    setPoints(1);
    setCategory("points");
    setLockedFile(null);
    setUnlockedFile(null);

    if (fileRef?.current) fileRef.current.value = "";
    if (unlockedRef.current) unlockedRef.current.value = "";
  }

  return (
    <div>
      <input
        placeholder="Title"
        value={title}
        onChange={(e) => setTitle(e.target.value)}
        style={{ width: "100%", padding: 6, marginBottom: 6 }}
      />
      <textarea
        placeholder="Description"
        value={description}
        onChange={(e) => setDescription(e.target.value)}
        style={{ width: "100%", padding: 6, height: 70 }}
      />
      <div
        style={{
          display: "flex",
          gap: 8,
          marginTop: 6,
          alignItems: "center",
          flexWrap: "wrap",
        }}
      >
        <input
          type="number"
          value={points}
          onChange={(e) => setPoints(e.target.value)}
          style={{ width: 80, padding: 6 }}
        />
        <select
          value={category}
          onChange={(e) => setCategory(e.target.value)}
          style={{ padding: 6 }}
        >
          <option value="points">Points</option>
          <option value="rewards">Rewards</option>
          <option value="experience">Experience</option>
        </select>
      </div>

      <div style={{ marginTop: 8, fontSize: 13 }}>
        <div style={{ marginBottom: 4 }}>Locked card (grey with lock)</div>
        <input
          ref={fileRef}
          type="file"
          accept="image/*"
          onChange={onLockedChange}
        />
      </div>

      <div style={{ marginTop: 8, fontSize: 13 }}>
        <div style={{ marginBottom: 4 }}>Unlocked card (original/full colour)</div>
        <input
          ref={unlockedRef}
          type="file"
          accept="image/*"
          onChange={onUnlockedChange}
        />
      </div>

      <div style={{ marginTop: 8 }}>
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

  function handleCreate() {
    if (!title.trim()) {
      alert("Title required");
      return;
    }
    onCreate({ title, cost, linkedCardId: cardId });
    setTitle("");
    setCost(5);
    setCardId("");
  }

  return (
    <div>
      <input
        placeholder="Title"
        value={title}
        onChange={(e) => setTitle(e.target.value)}
        style={{ width: "100%", padding: 6, marginBottom: 6 }}
      />
      <div style={{ display: "flex", gap: 8 }}>
        <input
          type="number"
          value={cost}
          onChange={(e) => setCost(e.target.value)}
          style={{ padding: 6, width: 80 }}
        />
        <select
          value={cardId}
          onChange={(e) => setCardId(e.target.value)}
          style={{ flex: 1, padding: 6 }}
        >
          <option value="">-- link card (optional) --</option>
          {cards.map((c) => (
            <option key={c.id} value={c.id}>
              {c.title}
            </option>
          ))}
        </select>
      </div>
      <div style={{ marginTop: 6 }}>
        <button className="btn" onClick={handleCreate}>
          Add reward
        </button>
      </div>
    </div>
  );
}

function GroupRedeemInline({ reward, students, shares, setShares, onSubmit }) {
  if (!reward) return null;

  const totalShares = Object.values(shares).reduce(
    (sum, val) => sum + (Number(val) || 0),
    0
  );

  return (
    <div
      style={{
        marginTop: 8,
        borderTop: "1px dashed #ddd",
        paddingTop: 8,
        fontSize: 13,
      }}
    >
      <div style={{ marginBottom: 8, color: "#555" }}>
        Enter shares for group redemption (total must equal {reward.cost} pts)
        {totalShares > 0 && (
          <span
            style={{
              marginLeft: 8,
              fontWeight: 600,
              color: totalShares === reward.cost ? "#0a0" : "#f00",
            }}
          >
            Current total: {totalShares}
          </span>
        )}
      </div>
      {students.map((s) => (
        <div
          key={s.id}
          style={{
            display: "flex",
            gap: 8,
            alignItems: "center",
            marginTop: 4,
          }}
        >
          <div style={{ flex: 1 }}>
            {s.name} (has {s.currentPoints || 0} pts)
          </div>
          <input
            type="number"
            min="0"
            value={shares[s.id] ?? ""}
            onChange={(e) => {
              const val =
                e.target.value === "" ? "" : Number(e.target.value || 0);
              setShares((prev) => ({ ...prev, [s.id]: val }));
            }}
            style={{ width: 80, padding: 4 }}
            placeholder="0"
          />
        </div>
      ))}
      <div style={{ marginTop: 8 }}>
        <button className="btn" onClick={onSubmit}>
          Confirm group redeem
        </button>
      </div>
    </div>
  );
}

function ManageStudentModal({
  mode,
  student,
  studentsInClass,
  cards,
  rewards,
  onClose,
  onUpdate,
  onAddQuickPoints,
  onChangeMeter,
  onResetStreak,
  onQuickAddStreak,
  onResetGhost,
  onQuickAddGhost,
  onGiveCard,
  onRemoveCard,
  onRedeemIndividual,
  onRedeemGroup,
  onDeleteStudent,
  onDeleteHistoryEntry,
  setShowCardPreview,
}) {
  const [redeemId, setRedeemId] = useState("");
  const [groupShares, setGroupShares] = useState({});
  const [name, setName] = useState(student.name);
  const [currentPoints, setCurrentPoints] = useState(
    student.currentPoints || 0
  );
  const [xp, setXp] = useState(student.xp || 0);

  useEffect(() => {
    setRedeemId("");
    setGroupShares({});
    setName(student.name);
    setCurrentPoints(student.currentPoints || 0);
    setXp(student.xp || 0);
  }, [student.id]);

  const selectedReward =
    rewards.find((r) => r.id === redeemId) || null;

  function handleSaveEdits() {
    onUpdate({
      name: name.trim() || student.name,
      currentPoints: Number(currentPoints || 0),
      xp: Number(xp || 0),
    });
  }

  // group student cards by cardId to show counts
  const cardGroups = {};
  (student.cards || []).forEach((o) => {
    if (!cardGroups[o.cardId]) {
      cardGroups[o.cardId] = [];
    }
    cardGroups[o.cardId].push(o);
  });

  const todayStr = new Date().toISOString().slice(0, 10);

  return (
    <div className="modal-backdrop" onClick={onClose}>
      <div className="modal" onClick={(e) => e.stopPropagation()}>
        <div
          style={{
            display: "flex",
            justifyContent: "space-between",
            alignItems: "center",
          }}
        >
          <h3 style={{ margin: 0 }}>Manage: {student.name}</h3>
          <div style={{ display: "flex", gap: 8 }}>
            <button className="btn" onClick={onClose}>
              Close
            </button>
            {mode === "admin" && (
              <button
                className="btn"
                onClick={() => {
                  if (!window.confirm("Delete this student?")) return;
                  onDeleteStudent();
                }}
              >
                Delete student
              </button>
            )}
          </div>
        </div>

        <div
          style={{
            display: "grid",
            gridTemplateColumns: "1fr 340px",
            gap: 12,
            marginTop: 12,
          }}
        >
          {/* LEFT SIDE: Points, XP, streak, ghost, edits, history */}
          <div>
            {/* Points & XP & meters */}
            <div style={{ display: "flex", gap: 16 }}>
              <div>
                <div style={{ fontSize: 12, color: "#666" }}>Points</div>
                <div style={{ fontWeight: 700, fontSize: 20 }}>
                  {student.currentPoints || 0} pts
                </div>
                {mode === "admin" && (
                  <div style={{ marginTop: 6 }}>
                    <button
                      className="btn"
                      onClick={() => onAddQuickPoints(1)}
                    >
                      +1
                    </button>
                    <button
                      className="btn"
                      onClick={() => onAddQuickPoints(5)}
                      style={{ marginLeft: 6 }}
                    >
                      +5
                    </button>
                    <button
                      className="btn"
                      onClick={() => onAddQuickPoints(10)}
                      style={{ marginLeft: 6 }}
                    >
                      +10
                    </button>
                  </div>
                )}
              </div>

              <div>
                <div style={{ fontSize: 12, color: "#666" }}>
                  Experience (XP)
                </div>
                <div style={{ fontWeight: 700, fontSize: 20 }}>
                  {student.xp || 0}
                </div>
              </div>

              <div>
                <div style={{ fontSize: 12, color: "#666" }}>Streak</div>
                <div
                  style={{
                    display: "flex",
                    gap: 6,
                    alignItems: "center",
                    marginTop: 4,
                  }}
                >
                  <button
                    className="btn"
                    onClick={() => onChangeMeter("streak", -1)}
                  >
                    -
                  </button>
                  <div>{"🔥".repeat(student.streak || 0)}</div>
                  <button
                    className="btn"
                    onClick={() => onChangeMeter("streak", +1)}
                  >
                    +
                  </button>
                </div>
                <div
                  style={{
                    display: "flex",
                    gap: 6,
                    alignItems: "center",
                    marginTop: 6,
                  }}
                >
                  <button
                    className="btn"
                    style={{ fontSize: 11 }}
                    onClick={onQuickAddStreak}
                  >
                    Quick +1
                  </button>
                  <button
                    className="btn"
                    style={{ fontSize: 11 }}
                    onClick={onResetStreak}
                  >
                    Reset
                  </button>
                </div>
                {student.streakLastUpdated && (
                  <div
                    style={{
                      fontSize: 11,
                      marginTop: 4,
                      color:
                        student.streakLastUpdated === todayStr
                          ? "#0a0"
                          : "#f00",
                      fontWeight: 600,
                    }}
                  >
                    Last: {student.streakLastUpdated}
                  </div>
                )}

                <div
                  style={{
                    fontSize: 12,
                    color: "#666",
                    marginTop: 8,
                  }}
                >
                  Ghost assistance
                </div>
                <div
                  style={{
                    display: "flex",
                    gap: 6,
                    alignItems: "center",
                    marginTop: 4,
                  }}
                >
                  <button
                    className="btn"
                    onClick={() => onChangeMeter("ghost", -1)}
                  >
                    -
                  </button>
                  <div>{"👻".repeat(student.ghost || 0)}</div>
                  <button
                    className="btn"
                    onClick={() => onChangeMeter("ghost", +1)}
                  >
                    +
                  </button>
                </div>
                <div
                  style={{
                    display: "flex",
                    gap: 6,
                    alignItems: "center",
                    marginTop: 6,
                  }}
                >
                  <button
                    className="btn"
                    style={{ fontSize: 11 }}
                    onClick={onQuickAddGhost}
                  >
                    Quick +1
                  </button>
                  <button
                    className="btn"
                    style={{ fontSize: 11 }}
                    onClick={onResetGhost}
                  >
                    Reset
                  </button>
                </div>
                {student.ghostLastUpdated && (
                  <div
                    style={{
                      fontSize: 11,
                      marginTop: 4,
                      color:
                        student.ghostLastUpdated === todayStr
                          ? "#00f"
                          : "#f00",
                      fontWeight: 600,
                    }}
                  >
                    Last: {student.ghostLastUpdated}
                  </div>
                )}
              </div>
            </div>

            {/* Edit basic fields */}
            <div style={{ marginTop: 12 }}>
              <h4>Edit student</h4>
              <div style={{ display: "grid", gap: 6, maxWidth: 340 }}>
                <div>
                  <div style={{ fontSize: 12 }}>Name</div>
                  <input
                    value={name}
                    onChange={(e) => setName(e.target.value)}
                    style={{ width: "100%", padding: 6 }}
                  />
                </div>
                <div>
                  <div style={{ fontSize: 12 }}>Current points</div>
                  <input
                    type="number"
                    value={currentPoints}
                    onChange={(e) => setCurrentPoints(e.target.value)}
                    style={{ width: "100%", padding: 6 }}
                  />
                </div>
                <div>
                  <div style={{ fontSize: 12 }}>XP (total)</div>
                  <input
                    type="number"
                    value={xp}
                    onChange={(e) => setXp(e.target.value)}
                    style={{ width: "100%", padding: 6 }}
                  />
                </div>
                <div>
                  <button className="btn primary" onClick={handleSaveEdits}>
                    Save edits
                  </button>
                </div>
              </div>
            </div>

            {/* Cards owned (grouped) */}
            <div style={{ marginTop: 12 }}>
              <h4>Cards owned</h4>
              <div style={{ display: "flex", gap: 8, flexWrap: "wrap" }}>
                {Object.entries(cardGroups).map(([cardId, ownedCards]) => {
                  const first = ownedCards[0];
                  const cardMeta =
                    cards.find((c) => c.id === cardId) || first || {};
                  return (
                    <div
                      key={cardId}
                      style={{
                        border: "1px solid #eee",
                        padding: 6,
                        borderRadius: 6,
                        width: 140,
                      }}
                    >
                      {cardMeta.imageURL ? (
                        <div style={{ position: "relative" }}>
                          <img
                            src={cardMeta.imageURL}
                            alt={cardMeta.title}
                            style={{
                              width: "100%",
                              height: 90,
                              objectFit: "cover",
                              borderRadius: 4,
                              cursor: "pointer",
                            }}
                            onClick={() => setShowCardPreview(cardMeta)}
                          />
                          {ownedCards.length > 1 && (
                            <div
                              style={{
                                position: "absolute",
                                top: 4,
                                right: 4,
                                background: "rgba(0,0,0,0.7)",
                                color: "white",
                                borderRadius: 12,
                                padding: "2px 6px",
                                fontSize: 11,
                                fontWeight: 700,
                              }}
                            >
                              ×{ownedCards.length}
                            </div>
                          )}
                        </div>
                      ) : (
                        <div style={{ fontWeight: 600 }}>
                          {cardMeta.title} ×{ownedCards.length}
                        </div>
                      )}
                      <div
                        style={{
                          fontSize: 12,
                          color: "#666",
                          marginTop: 4,
                        }}
                      >
                        Count: {ownedCards.length}
                      </div>
                      {mode === "admin" && (
                        <div
                          style={{
                            marginTop: 6,
                            display: "flex",
                            gap: 4,
                            flexWrap: "wrap",
                          }}
                        >
                          <button
                            className="btn"
                            style={{ fontSize: 11 }}
                            onClick={() =>
                              onRemoveCard(ownedCards[0].id)
                            }
                          >
                            Remove 1
                          </button>
                          {ownedCards.length > 1 && (
                            <button
                              className="btn"
                              style={{ fontSize: 11 }}
                              onClick={() => {
                                if (
                                  !window.confirm(
                                    `Remove all ${ownedCards.length} copies?`
                                  )
                                )
                                  return;
                                ownedCards.forEach((o) =>
                                  onRemoveCard(o.id)
                                );
                              }}
                            >
                              Remove all
                            </button>
                          )}
                        </div>
                      )}
                    </div>
                  );
                })}
              </div>
            </div>

            {/* Rewards history */}
            <div style={{ marginTop: 12 }}>
              <h4>Rewards history</h4>
              <div style={{ display: "grid", gap: 6 }}>
                {(student.rewardsHistory || []).map((rh) => (
                  <div
                    key={rh.id}
                    style={{
                      border: "1px solid #eee",
                      padding: 6,
                      borderRadius: 6,
                    }}
                  >
                    <div style={{ fontWeight: 600 }}>
                      {rh.title} • {rh.cost} pts
                    </div>
                    <div
                      style={{
                        fontSize: 12,
                        color: "#666",
                        marginTop: 2,
                      }}
                    >
                      {rh.date?.slice(0, 19).replace("T", " ")}
                    </div>
                    {mode === "admin" && (
                      <div style={{ marginTop: 6 }}>
                        <button
                          className="btn"
                          onClick={() => {
                            if (
                              !window.confirm(
                                "Delete this reward history entry?"
                              )
                            )
                              return;
                            onDeleteHistoryEntry(rh.id);
                          }}
                        >
                          Delete
                        </button>
                      </div>
                    )}
                  </div>
                ))}
              </div>
            </div>

            {/* Redeem reward */}
            <div style={{ marginTop: 12 }}>
              <h4>Redeem reward</h4>
              <div>
                <select
                  value={redeemId}
                  onChange={(e) => {
                    setRedeemId(e.target.value);
                    setGroupShares({});
                  }}
                  style={{ padding: 6, minWidth: 220 }}
                >
                  <option value="">-- choose reward --</option>
                  {rewards.map((r) => (
                    <option key={r.id} value={r.id}>
                      {r.title} (cost {r.cost})
                    </option>
                  ))}
                </select>
                <div style={{ marginTop: 8 }}>
                  <button
                    className="btn"
                    onClick={() => {
                      if (!redeemId) {
                        alert("Choose a reward first.");
                        return;
                      }
                      const choice = window.prompt(
                        "Redeem individually or as group? Type I or G"
                      );
                      if (!choice) return;
                      const upper = choice.toUpperCase();
                      if (upper === "I") {
                        onRedeemIndividual(redeemId);
                      } else if (upper === "G") {
                        // group view stays visible; user clicks Confirm
                      } else {
                        alert("Please type I or G.");
                      }
                    }}
                  >
                    Redeem
                  </button>
                </div>
              </div>

              {redeemId && (
                <GroupRedeemInline
                  reward={selectedReward}
                  students={studentsInClass}
                  shares={groupShares}
                  setShares={setGroupShares}
                  onSubmit={() => {
                    if (!redeemId) {
                      alert("Select reward first");
                      return;
                    }
                    onRedeemGroup(redeemId, groupShares);
                  }}
                />
              )}
            </div>
          </div>

          {/* RIGHT SIDE: Give card */}
          <div>
            <h4>Give card</h4>
            <div style={{ display: "grid", gap: 8 }}>
              {cards.map((c) => (
                <div
                  key={c.id}
                  style={{
                    border: "1px solid #eee",
                    padding: 6,
                    borderRadius: 6,
                    display: "flex",
                    gap: 8,
                    alignItems: "center",
                  }}
                >
                  <div
                    style={{ width: 64, height: 80, overflow: "hidden" }}
                    onClick={() => setShowCardPreview(c)}
                  >
                    {c.imageURL ? (
                      <img
                        src={c.imageURL}
                        alt={c.title}
                        style={{
                          width: "100%",
                          height: "100%",
                          objectFit: "cover",
                        }}
                      />
                    ) : (
                      <div style={{ padding: 6 }}>{c.title}</div>
                    )}
                  </div>
                  <div style={{ flex: 1 }}>
                    <div style={{ fontWeight: 700 }}>{c.title}</div>
                    <div className="muted">{c.description}</div>
                    <div
                      style={{
                        marginTop: 4,
                        fontSize: 12,
                        fontWeight: 600,
                      }}
                    >
                      {c.points || 0} pts • {c.category || "points"}
                    </div>
                  </div>
                  {mode === "admin" && (
                    <div>
                      <button
                        className="btn"
                        onClick={() => onGiveCard(c.id)}
                      >
                        Give
                      </button>
                    </div>
                  )}
                </div>
              ))}
            </div>
          </div>
        </div>
      </div>
    </div>
  );
}

// -------------------- Main App -------------------- //

export default function App() {
  const [mode, setMode] = useState(null); // null | "admin" | "reader"

  function enterAdmin() {
    const p = window.prompt("Enter admin password:");
    if (p === "cartas") setMode("admin");
    else if (p !== null) window.alert("Wrong password");
  }
  function enterReader() {
    setMode("reader");
  }

  // Firestore-backed state
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
  const [selectedStudent, setSelectedStudent] = useState(null);
  const [cardPreview, setCardPreview] = useState(null);
  const [libraryTab, setLibraryTab] = useState("points");
  const [errorMsg, setErrorMsg] = useState("");
  const [studentFilter, setStudentFilter] = useState("");

  // refs
  const newStudentRef = useRef();
  const newClassRef = useRef();
  const cardFileRef = useRef();

  // Subscribe to classes
  useEffect(() => {
    setLoadingClasses(true);
    const q = query(collection(db, "classes"), orderBy("createdAt", "desc"));
    const unsub = onSnapshot(
      q,
      (snap) => {
        const arr = [];
        snap.forEach((docSnap) => {
          arr.push({ id: docSnap.id, ...docSnap.data() });
        });
        setClassesList(arr);
        setLoadingClasses(false);
        if (!activeClassId && arr.length) {
          setActiveClassId((prev) => prev || arr[0].id);
        }
      },
      (err) => {
        console.error("Failed loading classes:", err);
        setErrorMsg("Failed to load classes from Firestore. Check console.");
        setLoadingClasses(false);
      }
    );
    return () => unsub();
    // eslint-disable-next-line react-hooks/exhaustive-deps
  }, []);

  // Subscribe to students/cards/rewards for active class
  useEffect(() => {
    if (!activeClassId) {
      setStudents([]);
      setCards([]);
      setRewards([]);
      return;
    }

    // students
    setLoadingStudents(true);
    const studentsCol = collection(db, `classes/${activeClassId}/students`);
    const unsubStudents = onSnapshot(
      query(studentsCol, orderBy("name")),
      (snap) => {
        const arr = [];
        snap.forEach((s) =>
          arr.push({ id: s.id, ...s.data(), classId: activeClassId })
        );
        setStudents(arr);
        setLoadingStudents(false);
      },
      (err) => {
        console.error("students snapshot err", err);
        setErrorMsg("Error loading students.");
        setLoadingStudents(false);
      }
    );

    // cards
    setLoadingCards(true);
    const cardsCol = collection(db, `classes/${activeClassId}/cards`);
    const unsubCards = onSnapshot(
      query(cardsCol, orderBy("createdAt", "asc")),
      (snap) => {
        const arr = [];
        snap.forEach((s) => arr.push({ id: s.id, ...s.data() }));
        setCards(arr);
        setLoadingCards(false);
      },
      (err) => {
        console.error("cards snapshot err", err);
        setErrorMsg("Error loading cards.");
        setLoadingCards(false);
      }
    );

    // rewards
    setLoadingRewards(true);
    const rewardsCol = collection(db, `classes/${activeClassId}/rewards`);
    const unsubRewards = onSnapshot(
      query(rewardsCol, orderBy("createdAt", "asc")),
      (snap) => {
        const arr = [];
        snap.forEach((s) => arr.push({ id: s.id, ...s.data() }));
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

  // Keep selectedStudent in sync with latest Firestore data
  useEffect(() => {
    if (!selectedStudent) return;
    const fresh = students.find((s) => s.id === selectedStudent.id);
    if (fresh) {
      setSelectedStudent((prev) => (prev ? { ...prev, ...fresh } : prev));
    }
  }, [students]);

  function ensureClassSelected() {
    if (!activeClassId) {
      window.alert("Please select or create a class first.");
      return false;
    }
    return true;
  }

  // ----- Class CRUD -----

  async function createClass(name) {
    if (!name?.trim()) return;
    try {
      const payload = { name: name.trim(), createdAt: Date.now() };
      const ref = await addDoc(collection(db, "classes"), payload);
      setActiveClassId(ref.id);
      if (newClassRef.current) newClassRef.current.value = "";
    } catch (err) {
      console.error(err);
      window.alert("Failed to create class.");
    }
  }

  async function editClassName(classId, newName) {
    if (!newName?.trim()) return;
    try {
      await updateDoc(doc(db, `classes/${classId}`), {
        name: newName.trim(),
      });
    } catch (err) {
      console.error(err);
      window.alert("Could not rename class.");
    }
  }

  async function removeClass(classId) {
    if (
      !window.confirm(
        "Delete this class and all its students/cards/rewards? (subcollections may remain in Firestore unless cleaned manually)"
      )
    )
      return;
    try {
      await deleteDoc(doc(db, `classes/${classId}`));
      if (activeClassId === classId) setActiveClassId(null);
    } catch (err) {
      console.error(err);
      window.alert("Failed to remove class.");
    }
  }

  // ----- Students -----

  async function addStudent(name) {
    if (!ensureClassSelected()) return;
    if (!name?.trim()) return;
    try {
      const payload = {
        name,
        avatar: "",
        currentPoints: 0,
        cumulativePoints: 0,
        // streak / ghost meters
        streak: 0,
        streakLastUpdated: "",
        ghost: 0,
        ghostLastUpdated: "",
        lastActive: null,
        cards: [], // optional local metadata
      };

      await addDoc(collection(db, `classes/${activeClassId}/students`), payload);
      if (newStudentRef.current) newStudentRef.current.value = "";
    } catch (err) {
      console.error(err);
      window.alert("Failed to add student.");
    }
  }

  async function editStudent(classId, studentId, updates) {
    try {
      await updateDoc(doc(db, `classes/${classId}/students/${studentId}`), updates);
    } catch (err) {
      console.error(err);
      window.alert("Failed saving student changes.");
    }
  }

  async function deleteStudent(classId, studentId) {
    if (!window.confirm("Delete this student?")) return;
    try {
      await deleteDoc(doc(db, `classes/${classId}/students/${studentId}`));
      if (selectedStudent?.id === studentId) setSelectedStudent(null);
    } catch (err) {
      console.error(err);
      window.alert("Failed to delete student.");
    }
  }

  async function setStudentTotalPoints(classId, studentId, totalPoints) {
    try {
      await updateDoc(doc(db, `classes/${classId}/students/${studentId}`), {
        cumulativePoints: Number(totalPoints || 0),
      });
    } catch (err) {
      console.error(err);
      window.alert("Failed to set total points.");
    }
  }

  async function addQuickPoints(classId, studentId, amount) {
    try {
      const ref = doc(db, `classes/${classId}/students/${studentId}`);
      const snap = await getDoc(ref);
      if (!snap.exists()) return;
      const s = snap.data();
      const currentPoints = (s.currentPoints || 0) + Number(amount || 0);
      await updateDoc(ref, { currentPoints });
    } catch (err) {
      console.error(err);
      window.alert("Failed to add quick points.");
    }
  }

  async function changeMeter(classId, studentId, meter, delta) {
    try {
      const ref = doc(db, `classes/${classId}/students/${studentId}`);
      const snap = await getDoc(ref);
      if (!snap.exists()) return;
      const s = snap.data();
      const before = s[meter] || 0;
      let after = before + delta;
      if (after < 0) after = 0;
      if (after > 5) after = 5;
      const updates = { [meter]: after };
      const today = new Date().toISOString().slice(0, 10);
      if (delta > 0) {
        if (meter === "streak") updates.streakLastUpdated = today;
        if (meter === "ghost") updates.ghostLastUpdated = today;
      }
      await updateDoc(ref, updates);
    } catch (err) {
      console.error(err);
      window.alert("Failed to change meter.");
    }
  }

  async function resetStreak(classId, studentId) {
    if (!window.confirm("Reset this student's streak to 0?")) return;
    try {
      await updateDoc(doc(db, `classes/${classId}/students/${studentId}`), {
        streak: 0,
        streakLastUpdated: "",
      });
    } catch (err) {
      console.error(err);
      window.alert("Failed to reset streak.");
    }
  }

  async function quickAddStreak(classId, studentId) {
    await changeMeter(classId, studentId, "streak", 1);
  }

  async function resetGhost(classId, studentId) {
    if (!window.confirm("Reset this student's ghost assistance to 0?")) return;
    try {
      await updateDoc(doc(db, `classes/${classId}/students/${studentId}`), {
        ghost: 0,
        ghostLastUpdated: "",
      });
    } catch (err) {
      console.error(err);
      window.alert("Failed to reset ghost.");
    }
  }

  async function quickAddGhost(classId, studentId) {
    await changeMeter(classId, studentId, "ghost", 1);
  }

  async function deleteRewardHistoryEntry(classId, studentId, historyId) {
    try {
      const ref = doc(db, `classes/${classId}/students/${studentId}`);
      const snap = await getDoc(ref);
      if (!snap.exists()) return;
      const s = snap.data();
      const newHistory = (s.rewardsHistory || []).filter(
        (x) => x.id !== historyId
      );
      await updateDoc(ref, { rewardsHistory: newHistory });
    } catch (err) {
      console.error(err);
      window.alert("Failed to delete history entry.");
    }
  }

  // ----- Cards & rewards -----

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
      window.alert("Card title required");
      return;
    }

    // You can require both if you want:
    // if (!lockedFile || !unlockedFile) { alert("Please select both locked and unlocked images"); return; }

    try {
      let lockedImageURL = "";
      let unlockedImageURL = "";

      // Use one common random id so the files are grouped
      const baseKey = uid("card");

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

      // Fallback: if only one was provided, use it for both fields
      if (!unlockedImageURL && lockedImageURL) {
        unlockedImageURL = lockedImageURL;
      }
      if (!lockedImageURL && unlockedImageURL) {
        lockedImageURL = unlockedImageURL;
      }

      const payload = {
        title: title.trim(),
        description: description || "",
        points: Number(points) || 0,
        category: category || "points",
        // unlocked version used for students
        imageURL: unlockedImageURL,
        // locked version used in library
        lockedImageURL,
        createdAt: Date.now(),
      };

      await addDoc(collection(db, `classes/${activeClassId}/cards`), payload);
    } catch (err) {
      console.error("createCard err:", err);
      window.alert("Failed to add card. Check Storage permissions or console.");
    }
  }

  async function deleteCard(cardId) {
    if (
      !window.confirm(
        "Delete this library card? This will not remove copies already owned by students."
      )
    )
      return;
    try {
      await deleteDoc(doc(db, `classes/${activeClassId}/cards/${cardId}`));
    } catch (err) {
      console.error(err);
      window.alert("Failed to delete card.");
    }
  }

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
      window.alert("Failed to create reward.");
    }
  }

  async function deleteReward(rewardId) {
    if (!window.confirm("Delete this reward?")) return;
    try {
      await deleteDoc(doc(db, `classes/${activeClassId}/rewards/${rewardId}`));
    } catch (err) {
      console.error(err);
      window.alert("Failed to delete reward.");
    }
  }

  // ----- Give / remove cards to/from students -----

  async function giveCardToStudent(classId, studentId, cardId) {
    try {
      const cardRef = doc(db, `classes/${classId}/cards/${cardId}`);
      const cardSnap = await getDoc(cardRef);
      if (!cardSnap.exists()) {
        window.alert("Card not found");
        return;
      }
      const cardData = cardSnap.data();

      const studentRef = doc(db, `classes/${classId}/students/${studentId}`);
      const studentSnap = await getDoc(studentRef);
      if (!studentSnap.exists()) {
        window.alert("Student not found");
        return;
      }
      const s = studentSnap.data();
      const cardsArr = Array.isArray(s.cards) ? [...s.cards] : [];
      const owned = {
        id: uid("owned"),
        cardId,
        title: cardData.title,
        imageURL: cardData.imageURL || "",
        grantedAt: new Date().toISOString(),
        pointsGranted: cardData.points || 0,
      };
      cardsArr.push(owned);
      const currentPoints = (s.currentPoints || 0) + (cardData.points || 0);
      const cumulativePoints =
        (s.cumulativePoints || 0) + (cardData.points || 0);
      await updateDoc(studentRef, {
        cards: cardsArr,
        currentPoints,
        cumulativePoints,
      });
      window.alert(`Gave ${cardData.title} to ${s.name}.`);
    } catch (err) {
      console.error(err);
      window.alert("Failed to give card.");
    }
  }

  async function removeOwnedCard(classId, studentId, ownedId) {
    if (!window.confirm("Remove this card from the student?")) return;
    try {
      const ref = doc(db, `classes/${classId}/students/${studentId}`);
      const snap = await getDoc(ref);
      if (!snap.exists()) return;
      const s = snap.data();
      const cardsArr = (s.cards || []).filter((c) => c.id !== ownedId);
      await updateDoc(ref, { cards: cardsArr });
    } catch (err) {
      console.error(err);
      window.alert("Failed to remove card.");
    }
  }

  // ----- Rewards redeem (individual + group) -----

  async function redeemRewardIndividual(classId, studentId, rewardId) {
    try {
      const rewardRef = doc(db, `classes/${classId}/rewards/${rewardId}`);
      const rewardSnap = await getDoc(rewardRef);
      if (!rewardSnap.exists()) {
        window.alert("Reward not found");
        return;
      }
      const r = rewardSnap.data();

      const studentRef = doc(db, `classes/${classId}/students/${studentId}`);
      const sSnap = await getDoc(studentRef);
      if (!sSnap.exists()) {
        window.alert("Student not found");
        return;
      }
      const s = sSnap.data();
      if ((s.currentPoints || 0) < r.cost) {
        window.alert("Student does not have enough points");
        return;
      }

      const newCurrent = (s.currentPoints || 0) - r.cost;
      const newXP = (s.xp || 0) + r.cost;

      const history = [
        ...(s.rewardsHistory || []),
        {
          id: uid("rh"),
          rewardId,
          title: r.title,
          cost: r.cost,
          date: new Date().toISOString(),
          students: [studentId],
        },
      ];

      const newCards = [...(s.cards || [])];
      if (r.cardId) {
        const cardRef2 = doc(db, `classes/${classId}/cards/${r.cardId}`);
        const cardSnap2 = await getDoc(cardRef2);
        if (cardSnap2.exists()) {
          const cardData = cardSnap2.data();
          newCards.push({
            id: uid("owned"),
            cardId: r.cardId,
            title: cardData.title,
            imageURL: cardData.imageURL || "",
            grantedAt: new Date().toISOString(),
          });
        }
      }

      await updateDoc(studentRef, {
        currentPoints: newCurrent,
        xp: newXP,
        rewardsHistory: history,
        cards: newCards,
      });
      window.alert("Reward redeemed.");
    } catch (err) {
      console.error(err);
      window.alert("Failed to redeem reward.");
    }
  }

  async function redeemRewardGroup(classId, rewardId, shares) {
    try {
      const rewardRef = doc(db, `classes/${classId}/rewards/${rewardId}`);
      const rewardSnap = await getDoc(rewardRef);
      if (!rewardSnap.exists()) {
        window.alert("Reward not found");
        return;
      }
      const r = rewardSnap.data();

      const sum = Object.values(shares).reduce(
        (a, b) => a + Number(b || 0),
        0
      );
      if (sum !== r.cost) {
        window.alert(
          `Sum of shares is ${sum} but reward costs ${r.cost}. Please adjust.`
        );
        return;
      }

      // validate points using local students state
      const lacking = [];
      Object.entries(shares).forEach(([sid, share]) => {
        const amount = Number(share || 0);
        if (amount <= 0) return;
        const st = students.find((s) => s.id === sid);
        if (!st || (st.currentPoints || 0) < amount) {
          lacking.push(st ? st.name : sid);
        }
      });
      if (lacking.length) {
        window.alert(
          `These students lack enough points: ${lacking.join(", ")}`
        );
        return;
      }

      const now = new Date().toISOString();

      // apply updates to each student
      for (const [sid, val] of Object.entries(shares)) {
        const share = Number(val || 0);
        if (share <= 0) continue;
        const st = students.find((s) => s.id === sid);
        if (!st) continue;

        const studentRef = doc(db, `classes/${classId}/students/${sid}`);
        const newCurrent = (st.currentPoints || 0) - share;
        const newXP = (st.xp || 0) + share;
        const history = [
          ...(st.rewardsHistory || []),
          {
            id: uid("rh"),
            rewardId,
            title: r.title,
            cost: share,
            date: now,
            students: Object.keys(shares),
          },
        ];
        const newCards = [...(st.cards || [])];
        if (r.cardId) {
          const cardRef2 = doc(db, `classes/${classId}/cards/${r.cardId}`);
          const cardSnap2 = await getDoc(cardRef2);
          if (cardSnap2.exists()) {
            const cardData = cardSnap2.data();
            newCards.push({
              id: uid("owned"),
              cardId: r.cardId,
              title: cardData.title,
              imageURL: cardData.imageURL || "",
              grantedAt: now,
            });
          }
        }

        await updateDoc(studentRef, {
          currentPoints: newCurrent,
          xp: newXP,
          rewardsHistory: history,
          cards: newCards,
        });
      }

      window.alert("Group reward redeemed.");
    } catch (err) {
      console.error(err);
      window.alert("Failed to redeem group reward.");
    }
  }

  // ---------- First screen (mode selector) ----------

  if (!mode) {
    return (
      <div
        style={{
          fontFamily: "Inter, system-ui, sans-serif",
          padding: 24,
          maxWidth: 520,
        }}
      >
        <h1>Mis logros Pokemáticos</h1>
        <p style={{ marginTop: 8 }}>¿Cómo entras a la app?</p>
        <div style={{ display: "flex", gap: 12, marginTop: 16 }}>
          <button className="btn primary" onClick={enterAdmin}>
            Soy profe (admin)
          </button>
          <button className="btn" onClick={enterReader}>
            Soy estudiante / invitado
          </button>
        </div>
        <p className="muted" style={{ marginTop: 16 }}>
          Admin puede crear clases, alumnos, cartas y recompensas. Estudiante /
          invitado solo ve la información.
        </p>
      </div>
    );
  }

  // ---------- Main layout ----------

  return (
    <div
      style={{
        fontFamily: "Inter, system-ui, sans-serif",
        padding: 12,
      }}
    >
      <style>{`
        .card-thumb { transition: transform 160ms ease, box-shadow 160ms ease; transform-origin: center; }
        .card-thumb:hover { transform: scale(1.18); box-shadow: 0 10px 24px rgba(0,0,0,0.25); z-index: 30; }
        .modal-backdrop { position: fixed; inset: 0; background: rgba(0,0,0,0.45); display:flex; align-items:center; justify-content:center; z-index:1000; }
        .modal { background: white; border-radius: 8px; padding: 12px; max-width: 960px; width: 94%; max-height: 90vh; overflow:auto; }
        .muted { color: #666; font-size: 13px; }
        .btn { padding: 6px 10px; border-radius: 6px; border: 1px solid #ddd; background: white; cursor:pointer; font-size: 13px; }
        .btn.primary { background: #2563eb; color: white; border: none; }
      `}</style>

      <header
        style={{
          display: "flex",
          justifyContent: "space-between",
          alignItems: "center",
          marginBottom: 12,
        }}
      >
        <div>
          <h1 style={{ margin: 0 }}>Mis logros Pokemáticos — Manager</h1>
          <div style={{ color: "#555" }}>
            {mode === "admin"
              ? "Admin mode"
              : mode === "reader"
              ? "Student/Guest mode"
              : "Mode"}
          </div>
        </div>
        <div style={{ display: "flex", gap: 8, alignItems: "center" }}>
          <button className="btn" onClick={() => setMode(null)}>
            Cambiar rol
          </button>
        </div>
      </header>

      {errorMsg && (
        <div style={{ marginBottom: 12, color: "crimson" }}>{errorMsg}</div>
      )}

      <div
        style={{
          display: "grid",
          gridTemplateColumns: "260px 1fr 360px",
          gap: 14,
        }}
      >
        {/* LEFT: Classes */}
        <aside
          style={{ border: "1px solid #eee", padding: 12, borderRadius: 8 }}
        >
          <h3 style={{ marginTop: 0 }}>Classes</h3>
          {loadingClasses ? (
            <div className="muted">Loading classes...</div>
          ) : (
            <div style={{ display: "flex", flexDirection: "column", gap: 6 }}>
              {classesList.map((c) => (
                <div
                  key={c.id}
                  style={{
                    display: "flex",
                    justifyContent: "space-between",
                    alignItems: "center",
                    gap: 6,
                  }}
                >
                  <button
                    className="btn"
                    style={{
                      flex: 1,
                      textAlign: "left",
                      background:
                        c.id === activeClassId ? "#eef" : "transparent",
                    }}
                    onClick={() => setActiveClassId(c.id)}
                  >
                    {c.name}
                  </button>
                  {mode === "admin" && (
                    <>
                      <button
                        className="btn"
                        onClick={() => {
                          const newName = window.prompt(
                            "New class name",
                            c.name
                          );
                          if (newName) editClassName(c.id, newName);
                        }}
                      >
                        Edit
                      </button>
                      <button
                        className="btn"
                        onClick={() => removeClass(c.id)}
                      >
                        Delete
                      </button>
                    </>
                  )}
                </div>
              ))}
            </div>
          )}

          {mode === "admin" && (
            <div style={{ marginTop: 12 }}>
              <h4 style={{ marginTop: 0 }}>Add class</h4>
              <div style={{ display: "flex", gap: 6 }}>
                <input
                  ref={newClassRef}
                  placeholder="Class name"
                  style={{ flex: 1, padding: 6 }}
                />
                <button
                  className="btn primary"
                  onClick={() => {
                    const name = newClassRef.current?.value;
                    createClass(name);
                  }}
                >
                  Create
                </button>
              </div>
            </div>
          )}
        </aside>

        {/* MIDDLE: Students */}
        <main
          style={{ border: "1px solid #eee", padding: 12, borderRadius: 8 }}
        >
          <div
            style={{
              display: "flex",
              justifyContent: "space-between",
              alignItems: "center",
            }}
          >
            <h3 style={{ margin: 0 }}>
              {classesList.find((c) => c.id === activeClassId)?.name ||
                "Select a class"}
            </h3>
            <div
              style={{
                display: "flex",
                justifyContent: "space-between",
                alignItems: "center",
              }}
            >
              <h3 style={{ margin: 0 }}>
                {classesList.find((c) => c.id === activeClassId)?.name ||
                  "Select a class"}
              </h3>

              <input
                placeholder="Filter students..."
                value={studentFilter}
                onChange={(e) => setStudentFilter(e.target.value)}
                style={{
                  padding: 6,
                  fontSize: 13,
                  borderRadius: 6,
                  border: "1px solid #ddd",
                  minWidth: 160,
                }}
              />
            </div>

          </div>

          <div style={{ marginTop: 12 }}>
            {activeClassId ? (
              <>
                <div style={{ marginBottom: 12 }}>
                  {loadingStudents ? (
                    <div className="muted">Loading students...</div>
                  ) : (
                    <div
                      style={{
                        display: "grid",
                        gridTemplateColumns: "repeat(2, 1fr)",
                        gap: 12,
                      }}
                    >
                      {students
                        .filter((s) =>
                          s.name
                            ?.toLowerCase()
                            .includes(studentFilter.toLowerCase().trim())
                        )
                        .map((s) => (
                          <div
                            key={s.id}
                            style={{
                              border: "1px solid #ddd",
                              padding: 10,
                              borderRadius: 6,
                            }}
                          >
                            <div
                              style={{
                                display: "flex",
                                justifyContent: "space-between",
                              }}
                            >
                              <div>
                                <div style={{ fontWeight: 700 }}>{s.name}</div>
                                <div className="muted">
                                  Streak: {s.streak || 0} 🔥
                                  {s.streakLastUpdated && (
                                    <span
                                      style={{
                                        marginLeft: 4,
                                        fontWeight: 600,
                                        color:
                                          s.streakLastUpdated === new Date().toISOString().slice(0, 10)
                                            ? "#0a0" // green if updated today
                                            : "#f00", // red if older
                                      }}
                                    >
                                      ({s.streakLastUpdated})
                                    </span>
                                  )}
                                  {" • "}
                                  Ghost: {s.ghost || 0} 👻
                                  {s.ghostLastUpdated && (
                                    <span
                                      style={{
                                        marginLeft: 4,
                                        fontWeight: 600,
                                        color:
                                          s.ghostLastUpdated === new Date().toISOString().slice(0, 10)
                                            ? "#00f" // blue if updated today
                                            : "#f00", // red if older
                                      }}
                                    >
                                      ({s.ghostLastUpdated})
                                    </span>
                                  )}
                                </div>

                              </div>
                              <div style={{ textAlign: "right" }}>
                                <div style={{ fontWeight: 700 }}>
                                  {s.currentPoints || 0} pts
                                </div>
                                <div className="muted">
                                  Total: {s.cumulativePoints || 0}
                                </div>
                              </div>
                            </div>

                            {/* Buttons ONLY for admins */}
                            {mode === "admin" && (
                              <div
                                style={{
                                  marginTop: 8,
                                  display: "flex",
                                  gap: 8,
                                }}
                              >
                                <button
                                  className="btn"
                                  onClick={() =>
                                    setSelectedStudent({
                                      ...s,
                                      classId: activeClassId,
                                    })
                                  }
                                >
                                  Manage
                                </button>
                              </div>
                            )}

                            <div style={{ marginTop: 8 }}>
                              <div style={{ fontSize: 13, fontWeight: 700 }}>Cards</div>
                              <div
                                style={{
                                  display: "flex",
                                  gap: 8,
                                  flexWrap: "wrap",
                                  marginTop: 8,
                                }}
                              >
                                {(s.cards || [])
                                  .slice(-6)
                                  .map((o) => (
                                    <div
                                      key={o.id}
                                      className="card-thumb"
                                      style={{
                                        width: 80,
                                        height: 110,
                                        border: "1px solid #eee",
                                        borderRadius: 6,
                                        overflow: "hidden",
                                        cursor: "pointer",
                                      }}
                                      onClick={() => setCardPreview(o)}
                                    >
                                      {o.imageURL ? (
                                        <img
                                          src={o.imageURL}
                                          alt={o.title}
                                          style={{
                                            width: "100%",
                                            height: "100%",
                                            objectFit: "cover",
                                          }}
                                        />
                                      ) : (
                                        <div style={{ padding: 6 }}>{o.title}</div>
                                      )}
                                    </div>
                                  ))}
                              </div>
                            </div>
                          </div>
                        ))}

                      {mode === "admin" && (
                        <div
                          style={{
                            border: "1px dashed #ccc",
                            padding: 12,
                            borderRadius: 6,
                          }}
                        >
                          <h4 style={{ marginTop: 0 }}>Add student</h4>
                          <div style={{ display: "flex", gap: 8 }}>
                            <input
                              ref={newStudentRef}
                              placeholder="Student name"
                              style={{ flex: 1, padding: 6 }}
                            />
                            <button
                              className="btn primary"
                              onClick={() => {
                                const name = newStudentRef.current?.value?.trim();
                                if (!name) return alert("Enter name");
                                addStudent(name);
                                newStudentRef.current.value = "";
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
              </>
            ) : (
              <div className="muted">
                Select a class on the left to view and manage students, cards and
                rewards.
              </div>
            )}
          </div>

        </main>

        {/* RIGHT: Library & rewards */}
        <aside
          style={{ border: "1px solid #eee", padding: 12, borderRadius: 8 }}
        >
          <h3>Library (class)</h3>

          {!activeClassId && <div className="muted">Select a class first</div>}

          {activeClassId && (
            <>
              {/* Tabs */}
              <div
                style={{
                  display: "flex",
                  gap: 6,
                  margin: "8px 0 12px",
                  flexWrap: "wrap",
                }}
              >
                <button
                  className="btn"
                  onClick={() => setLibraryTab("points")}
                  style={{
                    background:
                      libraryTab === "points" ? "#def" : "transparent",
                  }}
                >
                  Points
                </button>
                <button
                  className="btn"
                  onClick={() => setLibraryTab("rewards")}
                  style={{
                    background:
                      libraryTab === "rewards" ? "#def" : "transparent",
                  }}
                >
                  Rewards
                </button>
                <button
                  className="btn"
                  onClick={() => setLibraryTab("experience")}
                  style={{
                    background:
                      libraryTab === "experience" ? "#def" : "transparent",
                  }}
                >
                  Experience
                </button>
              </div>

              {/* Create card (admin) */}
              {mode === "admin" && (
                <div
                  style={{
                    border: "1px dashed #ddd",
                    padding: 8,
                    borderRadius: 6,
                    marginBottom: 12,
                  }}
                >
                  <h4 style={{ marginTop: 0 }}>Create new card</h4>
                  <CardCreateForm
                    onCreate={(payload) => createCard(payload)}
                    fileRef={cardFileRef}
                  />
                </div>
              )}

              <div style={{ maxHeight: 420, overflow: "auto" }}>
                {/* POINTS TAB */}
                {libraryTab === "points" && (
                  <div style={{ display: "grid", gap: 8 }}>
                    {loadingCards ? (
                      <div className="muted">Loading cards...</div>
                    ) : (
                      cards
                        .filter(
                          (c) => (c.category || "points") === "points"
                        )
                        .map((c) => (
                          <div
                            key={c.id}
                            style={{
                              display: "flex",
                              gap: 8,
                              alignItems: "center",
                              border: "1px solid #eee",
                              padding: 8,
                              borderRadius: 6,
                            }}
                          >
                            <div
                              style={{
                                width: 64,
                                height: 80,
                                background: "#fafafa",
                                cursor: "pointer",
                              }}
                              onClick={() =>
                                setCardPreview({ ...c, isLibraryCard: true })
                              }
                            >
                              {(c.lockedImageURL || c.imageURL) ? (
                                <img
                                  src={c.lockedImageURL || c.imageURL}
                                  alt={c.title}
                                  style={{ width: "100%", height: "100%", objectFit: "cover" }}
                                />
                              ) : (
                                <div style={{ padding: 6 }}>{c.title}</div>
                              )}

                            </div>
                            <div style={{ flex: 1 }}>
                              <div style={{ fontWeight: 700 }}>{c.title}</div>
                              <div className="muted">
                                {c.description || "—"}
                              </div>
                              <div
                                style={{
                                  marginTop: 6,
                                  fontWeight: 700,
                                }}
                              >
                                {c.points || 0} pts
                              </div>
                            </div>
                            {mode === "admin" && (
                              <div
                                style={{
                                  display: "flex",
                                  flexDirection: "column",
                                  gap: 6,
                                }}
                              >
                                <button
                                  className="btn"
                                  onClick={() => {
                                    const name = window.prompt(
                                      "Give this card to which student (exact name)? Leave blank to cancel."
                                    );
                                    if (!name) return;
                                    const st = students.find(
                                      (s) =>
                                        s.name.toLowerCase() ===
                                        name.toLowerCase()
                                    );
                                    if (!st) {
                                      window.alert(
                                        "Student not found. Use Manage -> Give for picklist."
                                      );
                                      return;
                                    }
                                    giveCardToStudent(
                                      activeClassId,
                                      st.id,
                                      c.id
                                    );
                                  }}
                                >
                                  Quick give
                                </button>
                                <button
                                  className="btn"
                                  onClick={() => deleteCard(c.id)}
                                >
                                  Delete
                                </button>
                              </div>
                            )}
                          </div>
                        ))
                    )}
                  </div>
                )}

                {/* REWARDS TAB */}
                {libraryTab === "rewards" && (
                  <div style={{ display: "grid", gap: 8 }}>
                    {/* Reward cards from library */}
                    <div style={{ marginBottom: 12 }}>
                      <h4
                        style={{
                          fontSize: 13,
                          color: "#555",
                          marginBottom: 8,
                        }}
                      >
                        Reward cards (library)
                      </h4>
                      {loadingCards ? (
                        <div className="muted">Loading cards...</div>
                      ) : (
                        cards
                          .filter((c) => c.category === "rewards")
                          .map((c) => (
                            <div
                              key={c.id}
                              style={{
                                display: "flex",
                                gap: 8,
                                alignItems: "center",
                                border: "1px solid #eee",
                                padding: 8,
                                borderRadius: 6,
                                marginBottom: 8,
                              }}
                            >
                              <div
                                style={{
                                  width: 64,
                                  height: 80,
                                  background: "#fafafa",
                                  cursor: "pointer",
                                }}
                                onClick={() =>
                                  setCardPreview({
                                    ...c,
                                    isLibraryCard: true,
                                  })
                                }
                              >
                                {(c.lockedImageURL || c.imageURL) ? (
                                  <img
                                    src={c.lockedImageURL || c.imageURL}
                                    alt={c.title}
                                    style={{ width: "100%", height: "100%", objectFit: "cover" }}
                                  />
                                ) : (
                                  <div style={{ padding: 6 }}>{c.title}</div>
                                )}

                              </div>
                              <div style={{ flex: 1 }}>
                                <div style={{ fontWeight: 700 }}>
                                  {c.title}
                                </div>
                                <div className="muted">
                                  {c.description || "—"}
                                </div>
                                <div
                                  style={{
                                    marginTop: 6,
                                    fontWeight: 700,
                                  }}
                                >
                                  {c.points || 0} pts
                                </div>
                              </div>
                              {mode === "admin" && (
                                <div
                                  style={{
                                    display: "flex",
                                    flexDirection: "column",
                                    gap: 6,
                                  }}
                                >
                                  <button
                                    className="btn"
                                    onClick={() => deleteCard(c.id)}
                                  >
                                    Delete
                                  </button>
                                </div>
                              )}
                            </div>
                          ))
                      )}
                    </div>

                    {/* Shop items (rewards) */}
                    <div
                      style={{
                        borderTop: "2px solid #ddd",
                        paddingTop: 12,
                      }}
                    >
                      <h4
                        style={{
                          fontSize: 13,
                          color: "#555",
                          marginBottom: 8,
                        }}
                      >
                        Shop items (purchasable)
                      </h4>
                      {loadingRewards ? (
                        <div className="muted">Loading rewards...</div>
                      ) : (
                        rewards.map((r) => {
                          const card =
                            cards.find((c) => c.id === r.cardId) || null;
                          return (
                            <div
                              key={r.id}
                              style={{
                                border: "1px solid #eee",
                                padding: 8,
                                borderRadius: 6,
                                marginBottom: 8,
                              }}
                            >
                              <div style={{ fontWeight: 700 }}>
                                {r.title}
                              </div>
                              <div className="muted">
                                Cost: {r.cost} pts • linked card:{" "}
                                {card ? card.title : "—"}
                              </div>
                              {mode === "admin" && (
                                <div style={{ marginTop: 6 }}>
                                  <button
                                    className="btn"
                                    onClick={() => deleteReward(r.id)}
                                  >
                                    Delete reward
                                  </button>
                                </div>
                              )}
                            </div>
                          );
                        })
                      )}

                      {mode === "admin" && (
                        <div
                          style={{
                            borderTop: "1px dashed #eee",
                            paddingTop: 8,
                            marginTop: 8,
                          }}
                        >
                          <h4 style={{ fontSize: 13, marginBottom: 6 }}>
                            Create shop item (must link to library card)
                          </h4>
                          <RewardCreateForm
                            cards={cards}
                            onCreate={(payload) => createReward(payload)}
                          />
                        </div>
                      )}
                    </div>
                  </div>
                )}

                {/* EXPERIENCE TAB */}
                {libraryTab === "experience" && (
                  <div style={{ display: "grid", gap: 8 }}>
                    {loadingCards ? (
                      <div className="muted">Loading cards...</div>
                    ) : (
                      cards
                        .filter((c) => c.category === "experience")
                        .map((c) => (
                          <div
                            key={c.id}
                            style={{
                              display: "flex",
                              gap: 8,
                              alignItems: "center",
                              border: "1px solid #eee",
                              padding: 8,
                              borderRadius: 6,
                            }}
                          >
                            <div
                              style={{
                                width: 64,
                                height: 80,
                                background: "#fafafa",
                                cursor: "pointer",
                              }}
                              onClick={() =>
                                setCardPreview({ ...c, isLibraryCard: true })
                              }
                            >
                              {(c.lockedImageURL || c.imageURL) ? (
                                <img
                                  src={c.lockedImageURL || c.imageURL}
                                  alt={c.title}
                                  style={{ width: "100%", height: "100%", objectFit: "cover" }}
                                />
                              ) : (
                                <div style={{ padding: 6 }}>{c.title}</div>
                              )}

                            </div>
                            <div style={{ flex: 1 }}>
                              <div style={{ fontWeight: 700 }}>
                                {c.title}
                              </div>
                              <div className="muted">
                                {c.description || "—"}
                              </div>
                            </div>
                            {mode === "admin" && (
                              <div
                                style={{
                                  display: "flex",
                                  flexDirection: "column",
                                  gap: 6,
                                }}
                              >
                                <button
                                  className="btn"
                                  onClick={() => deleteCard(c.id)}
                                >
                                  Delete
                                </button>
                              </div>
                            )}
                          </div>
                        ))
                    )}
                  </div>
                )}
              </div>
            </>
          )}
        </aside>
      </div>

      {/* Card preview modal */}
      {cardPreview && (
        <div
          className="modal-backdrop"
          onClick={() => setCardPreview(null)}
        >
          <div className="modal" onClick={(e) => e.stopPropagation()}>
            <div style={{ display: "flex", gap: 12 }}>
              <div
                style={{
                  width: 360,
                  height: 500,
                  background: "#f6f6f6",
                  borderRadius: 6,
                  overflow: "hidden",
                }}
              >
                {cardPreview.imageURL ? (
                  <img
                    src={cardPreview.imageURL}
                    alt={cardPreview.title}
                    style={{
                      width: "100%",
                      height: "100%",
                      objectFit: "contain",
                    }}
                  />
                ) : (
                  <div style={{ padding: 12 }}>{cardPreview.title}</div>
                )}
              </div>
              <div style={{ flex: 1 }}>
                <h3 style={{ marginTop: 0 }}>{cardPreview.title}</h3>
                <div className="muted">
                  {cardPreview.description || "—"}
                </div>
                <div style={{ marginTop: 8, fontWeight: 700 }}>
                  {cardPreview.points || 0} pts
                </div>
                <div style={{ marginTop: 12, display: "flex", gap: 8 }}>
                  <button
                    className="btn"
                    onClick={() => setCardPreview(null)}
                  >
                    Close
                  </button>
                  {cardPreview.isLibraryCard && mode === "admin" && (
                    <button
                      className="btn primary"
                      onClick={() => {
                        const name = window.prompt(
                          "Give to student (exact name):"
                        );
                        if (!name) return;
                        const st = students.find(
                          (s) =>
                            s.name.toLowerCase() === name.toLowerCase()
                        );
                        if (!st) {
                          window.alert(
                            "Student not found. Use Manage -> Give for picklist."
                          );
                          return;
                        }
                        giveCardToStudent(
                          activeClassId,
                          st.id,
                          cardPreview.id
                        );
                      }}
                    >
                      Give to student
                    </button>
                  )}
                </div>
              </div>
            </div>
          </div>
        </div>
      )}

      {/* Manage student modal */}
      {mode === "admin" && selectedStudent && (
        <ManageStudentModal
          mode={mode}
          student={selectedStudent}
          studentsInClass={students}
          cards={cards}
          rewards={rewards}
          onClose={() => setSelectedStudent(null)}
          onUpdate={(updates) =>
            editStudent(selectedStudent.classId, selectedStudent.id, updates)
          }
          onAddQuickPoints={(amt) =>
            addQuickPoints(selectedStudent.classId, selectedStudent.id, amt)
          }
          onChangeMeter={(meter, delta) =>
            changeMeter(selectedStudent.classId, selectedStudent.id, meter, delta)
          }
          onResetStreak={() =>
            resetStreak(selectedStudent.classId, selectedStudent.id)
          }
          onQuickAddStreak={() =>
            quickAddStreak(selectedStudent.classId, selectedStudent.id)
          }
          onResetGhost={() =>
            resetGhost(selectedStudent.classId, selectedStudent.id)
          }
          onQuickAddGhost={() =>
            quickAddGhost(selectedStudent.classId, selectedStudent.id)
          }
          onGiveCard={(cardId) =>
            giveCardToStudent(
              selectedStudent.classId,
              selectedStudent.id,
              cardId
            )
          }
          onRemoveCard={(ownedId) =>
            removeOwnedCard(
              selectedStudent.classId,
              selectedStudent.id,
              ownedId
            )
          }
          onRedeemIndividual={(rewardId) =>
            redeemRewardIndividual(
              selectedStudent.classId,
              selectedStudent.id,
              rewardId
            )
          }
          onRedeemGroup={(rewardId, shares) =>
            redeemRewardGroup(selectedStudent.classId, rewardId, shares)
          }
          onDeleteStudent={() =>
            deleteStudent(selectedStudent.classId, selectedStudent.id)
          }
          onDeleteHistoryEntry={(historyId) =>
            deleteRewardHistoryEntry(
              selectedStudent.classId,
              selectedStudent.id,
              historyId
            )
          }
          setShowCardPreview={(card) =>
            setCardPreview({ ...card, isLibraryCard: true })
          }
        />
      )}
    </div>
  );
}
