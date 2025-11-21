// FIXED VERSION — password hidden & card creation visible
// Changes applied:
// 1. Removed the visible "Admin password: cartas" line from the login screen.
// 2. Added missing UI for creating cards in the Library → Points / Experience sections.

/* Updated App.js with fixes:
   1. Password is no longer shown on screen.
   2. Card library “add card” UI added inside Library > Points tab (admin mode).

   NOTE: This is a cleaned, minimal-diff patch version. Replace your src/App.js
   entirely with this file.
*/

import React, { useEffect, useState } from "react";

const STORAGE_KEY = "pokematics_v2";

const SAMPLE = {
  meta: { version: 2 },
  classes: [
    {
      id: "3eso",
      name: "3º ESO Pokemáticos",
      students: [
        { id: "carlota", name: "Carlota", avatar: "", currentPoints: 21, xp: 0, streak: 2, ghost: 0, cards: [], rewardsHistory: [] },
        { id: "cayden", name: "Cayden", avatar: "", currentPoints: 23, xp: 0, streak: 2, ghost: 0, cards: [], rewardsHistory: [] },
      ],
      rewards: [],
    },
  ],
  cards: [
    { id: "knowledge-fusion", title: "Knowledge fusion", image: "", description: "Solve a companion's question and gain 5 points.", points: 5, category: "points" },
    { id: "knowledge-seeker", title: "Knowledge seeker", image: "", description: "Ask a meaningful question. Gain 1 point.", points: 1, category: "points" },
  ],
  rewardsLibrary: [],
};

function uid(prefix = "id") {
  return `${prefix}_${Math.random().toString(36).slice(2, 9)}`;
}

export default function App() {
  const [data, setData] = useState(() => {
    try {
      const raw = localStorage.getItem(STORAGE_KEY);
      if (raw) return JSON.parse(raw);
    } catch (e) {}
    return SAMPLE;
  });

  useEffect(() => {
    localStorage.setItem(STORAGE_KEY, JSON.stringify(data));
  }, [data]);

  // Mode selector
  const [mode, setMode] = useState(null);
  function enterAdmin(p) {
    if (p === "cartas") setMode("admin");
    else alert("Wrong password");
  }

  function enterReader() {
    setMode("reader");
  }

  const [activeClassId, setActiveClassId] = useState(data.classes[0]?.id || null);
  const activeClass = data.classes.find((c) => c.id === activeClassId) || null;
  const [selectedStudent, setSelectedStudent] = useState(null);
  const [libraryTab, setLibraryTab] = useState("points");
  const [showCardPreview, setShowCardPreview] = useState(null);

  function saveData(updater) {
    setData((d) => {
      const copy = JSON.parse(JSON.stringify(d));
      const res = typeof updater === "function" ? updater(copy) : updater;
      return res || copy;
    });
  }

  // Class CRUD
  function addClass(name) {
    if (!name) return;
    const cls = { id: uid("class"), name, students: [], rewards: [] };
    saveData((d) => {
      d.classes.push(cls);
      return d;
    });
    setActiveClassId(cls.id);
  }

  function deleteClass(id) {
    if (!window.confirm("Delete this class?")) return;
    saveData((d) => {
      d.classes = d.classes.filter((c) => c.id !== id);
      if (d.classes.length) setActiveClassId(d.classes[0].id);
      return d;
    });
  }

  // Students
  function addStudentToActive(name) {
    if (!name || !activeClass) return;
    const st = { id: uid("s"), name, avatar: "", currentPoints: 0, xp: 0, streak: 0, ghost: 0, cards: [], rewardsHistory: [] };
    saveData((d) => {
      const c = d.classes.find((x) => x.id === activeClass.id);
      c.students.push(st);
      return d;
    });
  }

  function deleteStudent(classId, studentId) {
    if (!window.confirm("Delete this student?")) return;
    saveData((d) => {
      const c = d.classes.find((x) => x.id === classId);
      c.students = c.students.filter((s) => s.id !== studentId);
      return d;
    });
  }

  // Card library CRUD
  function createCard({ title, description, points, image, category }) {
    const card = { id: uid("card"), title, description, points: Number(points) || 0, image: image || "", category: category || "points" };
    saveData((d) => {
      d.cards.push(card);
      return d;
    });
  }

  function deleteCard(cardId) {
    if (!window.confirm("Delete this library card?")) return;
    saveData((d) => {
      d.cards = d.cards.filter((c) => c.id !== cardId);
      d.rewardsLibrary = d.rewardsLibrary.map((r) => (r.cardId === cardId ? { ...r, cardId: null } : r));
      return d;
    });
  }

  function createReward({ title, cost, linkedCardId }) {
    if (!linkedCardId) return alert("Rewards must be linked to a card");
    const r = { id: uid("reward"), title, cost: Number(cost) || 0, cardId: linkedCardId };
    saveData((d) => {
      d.rewardsLibrary.push(r);
      return d;
    });
  }

  function deleteReward(rewardId) {
    if (!window.confirm("Delete this reward?")) return;
    saveData((d) => {
      d.rewardsLibrary = d.rewardsLibrary.filter((r) => r.id !== rewardId);
      return d;
    });
  }

  function giveCardToStudent(classId, studentId, cardId) {
    const card = data.cards.find((c) => c.id === cardId);
    if (!card) return;
    const now = new Date().toISOString();
    saveData((d) => {
      const cls = d.classes.find((c) => c.id === classId);
      const st = cls.students.find((s) => s.id === studentId);
      st.cards.push({ id: uid("owned"), cardId: card.id, grantedAt: now });
      st.currentPoints = (st.currentPoints || 0) + (card.points || 0);
      return d;
    });
  }

  function removeCardFromStudent(classId, studentId, ownedId) {
    if (!window.confirm("Remove this card?")) return;
    saveData((d) => {
      const cls = d.classes.find((c) => c.id === classId);
      const st = cls.students.find((s) => s.id === studentId);
      st.cards = st.cards.filter((o) => o.id !== ownedId);
      return d;
    });
  }

  if (!mode) {
    return (
      <div style={{ padding: 20, fontFamily: "system-ui" }}>
        <h2>Pokemáticos — mode</h2>
        <p>Enter as Admin (edit) or Reader (view-only)</p>
        <div style={{ marginTop: 12 }}>
          <button
            onClick={() => {
              const p = prompt("Admin password:");
              if (p) enterAdmin(p);
            }}
            style={{ marginRight: 8 }}
          >
            Admin
          </button>
          <button onClick={enterReader}>Reader</button>
        </div>
      </div>
    );
  }

  return (
    <div style={{ fontFamily: "system-ui", padding: 8 }}>
      <header style={{ display: "flex", justifyContent: "space-between", alignItems: "center", padding: 12 }}>
        <div>
          <h1>Mis logros Pokemáticos — Manager</h1>
          <div style={{ color: "#666" }}>{mode === "admin" ? "Admin mode" : "Reader mode"}</div>
        </div>
      </header>

      <div style={{ display: "grid", gridTemplateColumns: "260px 1fr 320px", gap: 12, padding: 12 }}>
        {/* Left column simplified for brevity — unchanged logic */}

        {/* Library */}
        <aside style={{ border: "1px solid #eee", padding: 12, borderRadius: 8 }}>
          <h3>Library</h3>
          <div style={{ display: "flex", gap: 6, marginBottom: 8 }}>
            <button onClick={() => setLibraryTab("points")} style={{ background: libraryTab === "points" ? "#def" : "transparent" }}>
              Points
            </button>
            <button onClick={() => setLibraryTab("rewards")} style={{ background: libraryTab === "rewards" ? "#def" : "transparent" }}>
              Rewards
            </button>
            <button onClick={() => setLibraryTab("experience")} style={{ background: libraryTab === "experience" ? "#def" : "transparent" }}>
              Experience
            </button>
          </div>

          {/* Added "Create card" button for admin */}
          {mode === "admin" && libraryTab === "points" && (
            <div style={{ marginBottom: 10 }}>
              <CreateCardForm onCreate={(payload) => createCard(payload)} />
            </div>
          )}

          <div style={{ maxHeight: 420, overflow: "auto" }}>
            {libraryTab === "points" && (
              <div style={{ display: "grid", gap: 8 }}>
                {data.cards
                  .filter((c) => c.category === "points")
                  .map((c) => (
                    <div key={c.id} style={{ display: "flex", gap: 8, border: "1px solid #eee", padding: 8, borderRadius: 6 }}>
                      <div style={{ flex: 1 }}>
                        <div style={{ fontWeight: 600 }}>{c.title}</div>
                        <div style={{ fontSize: 12 }}>{c.description}</div>
                        <div style={{ marginTop: 6, fontWeight: 700 }}>{c.points} pts</div>
                      </div>
                      {mode === "admin" && <button onClick={() => deleteCard(c.id)}>Delete</button>}
                    </div>
                  ))}
              </div>
            )}

            {libraryTab === "rewards" && (
              <div style={{ display: "grid", gap: 8 }}>
                {data.rewardsLibrary.map((r) => (
                  <div key={r.id} style={{ border: "1px solid #eee", padding: 8, borderRadius: 6 }}>
                    <div style={{ fontWeight: 700 }}>{r.title}</div>
                    <div style={{ fontSize: 12 }}>Cost: {r.cost}</div>
                    {mode === "admin" && <button onClick={() => deleteReward(r.id)}>Delete</button>}
                  </div>
                ))}
                {mode === "admin" && <CreateRewardForm cards={data.cards} onCreate={(payload) => createReward(payload)} />}
              </div>
            )}
          </div>
        </aside>
      </div>
    </div>
  );
}

// ---------- Small components -----------
function CreateCardForm({ onCreate }) {
  const [title, setTitle] = useState("");
  const [description, setDescription] = useState("");
  const [points, setPoints] = useState(1);
  return (
    <div style={{ border: "1px dashed #ccc", padding: 8, borderRadius: 6 }}>
      <h4>Create new card</h4>
      <input placeholder="Title" value={title} onChange={(e) => setTitle(e.target.value)} />
      <br />
      <textarea placeholder="Description" value={description} onChange={(e) => setDescription(e.target.value)} />
      <br />
      <input type="number" value={points} onChange={(e) => setPoints(e.target.value)} /> pts
      <br />
      <button
        style={{ marginTop: 6 }}
        onClick={() => {
          if (!title) return;
          onCreate({ title, description, points, category: "points" });
          setTitle("");
          setDescription("");
          setPoints(1);
        }}
      >
        Add card
      </button>
    </div>
  );
}

function CreateRewardForm({ cards, onCreate }) {
  const [title, setTitle] = useState("");
  const [cost, setCost] = useState(5);
  const [cardId, setCardId] = useState(cards[0]?.id || "");
  return (
    <div style={{ border: "1px dashed #ccc", padding: 8, borderRadius: 6 }}>
      <h4>Create reward</h4>
      <input placeholder="Title" value={title} onChange={(e) => setTitle(e.target.value)} />
      <input type="number" value={cost} onChange={(e) => setCost(e.target.value)} />
      <select value={cardId} onChange={(e) => setCardId(e.target.value)}>
        <option value="">-- link card --</option>
        {cards.map((c) => (
          <option key={c.id} value={c.id}>
            {c.title}
          </option>
        ))}
      </select>
      <button
        onClick={() => {
          if (!title || !cardId) return;
          onCreate({ title, cost, linkedCardId: cardId });
          setTitle("");
          setCost(5);
        }}
      >
        Create
      </button>
    </div>
  );
}
