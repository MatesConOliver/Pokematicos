import React, { useEffect, useState } from "react";

// Pokemáticos Manager — Revised (class libraries + edit points + hover preview)
// Replace your src/App.js with this file.

const STORAGE_KEY = "pokematics_v2";

const SAMPLE = {
  meta: { version: 2 },
  classes: [
    {
      id: "3eso",
      name: "3º ESO Pokemáticos",
      students: [
        { id: "carlota", name: "Carlota", avatar: "", currentPoints: 21, xp: 0, streak: 2, streakLastUpdated: "", ghost: 0, ghostLastUpdated: "", cards: [], rewardsHistory: [] },
        { id: "cayden", name: "Cayden", avatar: "", currentPoints: 23, xp: 0, streak: 1, streakLastUpdated: "", ghost: 3, ghostLastUpdated: "", cards: [], rewardsHistory: [] },
      rewards: [],
        cardsLibrary: [], // per-class card library (empty by default)
    },
  ],
  cards: [ // legacy global array left alone (we don't use it going forward)
    { id: "knowledge-fusion", title: "Knowledge fusion", image: "", description: "Solve a companion's math or existential question and gain 5 points.", points: 5, category: "points" },
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

  // Admin gating (client-side only)
  const [mode, setMode] = useState(null); // null => ask, 'admin' or 'reader'

  function enterAdmin(password) {
    if (password === "cartas") setMode("admin");
    else alert("Wrong password");
  }

  function enterReader() {
    setMode("reader");
  }

  // UI state
  const [activeClassId, setActiveClassId] = useState(data.classes[0]?.id || null);
  const activeClass = data.classes.find((c) => c.id === activeClassId) || null;
  const [selectedStudent, setSelectedStudent] = useState(null);
  const [libraryTab, setLibraryTab] = useState("points"); // points | rewards | experience
  const [showCardPreview, setShowCardPreview] = useState(null);

  // Helpers to update data
  function saveData(updater) {
    setData((d) => {
      const copy = JSON.parse(JSON.stringify(d));
      const res = typeof updater === "function" ? updater(copy) : updater;
      return res || copy;
    });
  }

  // Classes
  function addClass(name) {
    if (!name) return;
    const cls = { id: uid("class"), name, students: [], rewards: [], cardsLibrary: [] };
    saveData((d) => { d.classes.push(cls); return d; });
    setActiveClassId(cls.id);
  }

  function deleteClass(id) {
    if (!window.confirm("Delete this class and all its students/rewards? This cannot be undone.")) return;
    saveData((d) => { d.classes = d.classes.filter(c => c.id !== id); if (d.classes.length) setActiveClassId(d.classes[0].id); return d; });
  }

  function editClassName(classId) {
    const c = data.classes.find(x => x.id === classId);
    if (!c) return;
    const n = prompt("New class name", c.name);
    if (!n) return;
    saveData(d => { const cls = d.classes.find(x => x.id === classId); cls.name = n; return d; });
  }

  // Students
  function addStudentToActive(name) {
    if (!name || !activeClass) return;
    const st = { id: uid("s"), name, avatar: "", currentPoints: 0, xp: 0, streak: 0, streakLastUpdated: "", ghost: 0, ghostLastUpdated: "", cards: [], rewardsHistory: [] };
  }

  function deleteStudent(classId, studentId) {
    if (!window.confirm("Delete this student? This will remove the student from the class.")) return;
    saveData((d) => { const c = d.classes.find(x => x.id === classId); c.students = c.students.filter(s => s.id !== studentId); return d; });
  }

  function updateStudent(classId, studentId, updates) {
    saveData(d => {
      const cls = d.classes.find(c => c.id === classId);
      if (!cls) return d;
      cls.students = cls.students.map(s => s.id === studentId ? { ...s, ...updates } : s);
      return d;
    });
  }

  // Cards library CRUD (per-class)
  function createCard({ title, description, points, image, category }) {
    if (!activeClass) return alert("Select a class first");
    const card = { id: uid("card"), title, description, points: Number(points) || 0, image: image || "", category: category || "points" };
    saveData(d => {
      const cls = d.classes.find(c => c.id === activeClass.id);
      cls.cardsLibrary = cls.cardsLibrary || [];
      cls.cardsLibrary.push(card);
      return d;
    });
  }

  function deleteCard(cardId) {
    if (!window.confirm("Delete this library card? This will not remove already-owned copies from students.")) return;
    saveData(d => {
      const cls = d.classes.find(c => c.id === activeClass.id);
      if (!cls) return d;
      cls.cardsLibrary = (cls.cardsLibrary || []).filter(c => c.id !== cardId);
      // Also remove link from rewardsLibrary where applicable (class-level rewards)
      cls.rewards = (cls.rewards || []).map(r => r.cardId === cardId ? { ...r, cardId: null } : r);
      return d;
    });
  }

  // Rewards library: must be linked to a cardId
  function createReward({ title, cost, linkedCardId }) {
    if (!linkedCardId) return alert("Rewards must be linked to a library card");
    const r = { id: uid("reward"), title, cost: Number(cost) || 0, cardId: linkedCardId };
    if (!activeClass) return;
    saveData(d => {
      const cls = d.classes.find(c => c.id === activeClass.id);
      cls.rewards = cls.rewards || [];
      cls.rewards.push(r);
      return d;
    });
  }

  function deleteReward(rewardId) {
    if (!window.confirm("Delete this reward?")) return;
    saveData(d => {
      const cls = d.classes.find(c => c.id === activeClass.id);
      if (!cls) return d;
      cls.rewards = (cls.rewards || []).filter(r => r.id !== rewardId);
      return d;
    });
  }

  // Give card to student (inside Manage), awarding points according to card.points
  function giveCardToStudent(classId, studentId, cardId) {
    const cls = data.classes.find(c => c.id === classId);
    const card = cls?.cardsLibrary?.find(c => c.id === cardId);
    if (!card) return alert("Card not found in class library");
    const now = new Date().toISOString();
    saveData(d => {
      const cls2 = d.classes.find(c => c.id === classId);
      const st = cls2.students.find(s => s.id === studentId);
      st.cards.push({ id: uid("owned"), cardId: card.id, grantedAt: now });
      // award points only to currentPoints
      st.currentPoints = (st.currentPoints || 0) + (card.points || 0);
      return d;
    });
  }

  // Remove card from student (retrieve) - does NOT change points (user requested manual handling)
  function removeCardFromStudent(classId, studentId, ownedId) {
    if (!window.confirm("Remove this card from the student?")) return;
    saveData(d => {
      const cls = d.classes.find(c => c.id === classId);
      const st = cls.students.find(s => s.id === studentId);
      st.cards = st.cards.filter(o => o.id !== ownedId);
      return d;
    });
  }

  // Redeem reward flow (class-level rewards)
  function redeemRewardIndividual(classId, studentId, rewardId) {
    const cls = data.classes.find(c => c.id === classId);
    const reward = cls?.rewards?.find(r => r.id === rewardId);
    if (!reward) return alert("Reward invalid");
    saveData(d => {
      const cls2 = d.classes.find(c => c.id === classId);
      const st = cls2.students.find(s => s.id === studentId);
      if ((st.currentPoints || 0) < reward.cost) return alert("Student does not have enough points");
      st.currentPoints = (st.currentPoints || 0) - reward.cost;
      st.xp = (st.xp || 0) + reward.cost;
      const now = new Date().toISOString();
      st.rewardsHistory.push({ id: uid('rh'), rewardId: reward.id, title: reward.title, cost: reward.cost, date: now, students: [studentId] });
      if (reward.cardId) {
        st.cards.push({ id: uid('owned'), cardId: reward.cardId, grantedAt: now });
      }
      return d;
    });
  }

  function redeemRewardGroup(classId, rewardId, shares) {
    const cls = data.classes.find(c => c.id === classId);
    const reward = cls?.rewards?.find(r => r.id === rewardId);
    if (!reward) return alert("Reward invalid");
    const sum = Object.values(shares).reduce((a, b) => a + Number(b || 0), 0);
    if (sum !== reward.cost) return alert(`Sum is ${sum} but required ${reward.cost}. Please adjust shares.`);
    const classObj = data.classes.find(c => c.id === classId);
    const lacking = [];
    for (const sid of Object.keys(shares)) {
      const st = classObj.students.find(s => s.id === sid);
      if ((st.currentPoints || 0) < Number(shares[sid] || 0)) lacking.push(st.name);
    }
    if (lacking.length) return alert(`These students lack enough points: ${lacking.join(", ")}`);

    const now = new Date().toISOString();
    saveData(d => {
      const cls2 = d.classes.find(c => c.id === classId);
      for (const [sid, val] of Object.entries(shares)) {
        const st = cls2.students.find(s => s.id === sid);
        const share = Number(val || 0);
        if (share <= 0) continue;
        st.currentPoints = (st.currentPoints || 0) - share;
        st.xp = (st.xp || 0) + share;
        st.rewardsHistory.push({ id: uid('rh'), rewardId: reward.id, title: reward.title, cost: share, date: now, students: Object.keys(shares) });
        if (reward.cardId) st.cards.push({ id: uid('owned'), cardId: reward.cardId, grantedAt: now });
      }
      return d;
    });
  }

  // Edit streak and ghost (0..5)
  function changeMeter(classId, studentId, meter, delta) {
    saveData(d => {
      const cls = d.classes.find(c => c.id === classId);
      const st = cls.students.find(s => s.id === studentId);
      const before = st[meter] || 0;
      let after = before + delta;
      if (after < 0) after = 0;
      if (after > 5) after = 5;
      st[meter] = after;
      
      // Update date when increased
      if (delta > 0) {
        if (meter === 'streak') {
          st.streakLastUpdated = new Date().toISOString().slice(0, 10);
        } else if (meter === 'ghost') {
          st.ghostLastUpdated = new Date().toISOString().slice(0, 10);
        }
      }
      return d;
    });
  }

  function resetStreak(classId, studentId) {
    if (!window.confirm("Reset this student's streak to 0?")) return;
    saveData(d => {
      const cls = d.classes.find(c => c.id === classId);
      const st = cls.students.find(s => s.id === studentId);
      st.streak = 0;
      st.streakLastUpdated = "";
      return d;
    });
  }

  function quickAddStreak(classId, studentId) {
    saveData(d => {
      const cls = d.classes.find(c => c.id === classId);
      const st = cls.students.find(s => s.id === studentId);
      if ((st.streak || 0) < 5) {
        st.streak = (st.streak || 0) + 1;
        st.streakLastUpdated = new Date().toISOString().slice(0, 10);
      }
      return d;
    });
  }

  function resetGhost(classId, studentId) {
    if (!window.confirm("Reset this student's ghost assistance to 0?")) return;
    saveData(d => {
      const cls = d.classes.find(c => c.id === classId);
      const st = cls.students.find(s => s.id === studentId);
      st.ghost = 0;
      st.ghostLastUpdated = "";
      return d;
    });
  }

  function quickAddGhost(classId, studentId) {
    saveData(d => {
      const cls = d.classes.find(c => c.id === classId);
      const st = cls.students.find(s => s.id === studentId);
      if ((st.ghost || 0) < 5) {
        st.ghost = (st.ghost || 0) + 1;
        st.ghostLastUpdated = new Date().toISOString().slice(0, 10);
      }
      return d;
    });
  }

  // Edit student quick points (admin)
  function addQuickPoints(classId, studentId, amount) {
    saveData(d => { const cls = d.classes.find(c => c.id === classId); const st = cls.students.find(s => s.id === studentId); st.currentPoints = (st.currentPoints||0) + Number(amount||0); return d; });
  }

  // UI components (inline for single-file simplicity)
  if (!mode) {
    return (
      <div style={{ padding: 20, fontFamily: 'system-ui' }}>
        <h2>Pokemáticos — mode</h2>
        <p>Enter as Admin (edit) or Reader (view-only)</p>
        <div style={{ marginTop: 12 }}>
          <button onClick={() => { const p = prompt('Admin password'); enterAdmin(p); }} style={{ marginRight: 8 }}>Admin</button>
          <button onClick={() => enterReader()}>Reader</button>
        </div>
        {/* password removed from visible UI on purpose */}
      </div>
    );
  }

  return (
    <div style={{ fontFamily: 'system-ui', padding: 8 }}>
      <header style={{ display: 'flex', justifyContent: 'space-between', alignItems: 'center', padding: 12 }}>
        <div>
          <h1>Mis logros Pokemáticos — Manager</h1>
          <div style={{ color: '#666' }}>{mode === 'admin' ? 'Admin mode' : 'Reader mode'}</div>
        </div>
        <div style={{ display: 'flex', gap: 8 }}>
          {mode === 'admin' && <button onClick={() => { localStorage.removeItem(STORAGE_KEY); setData(SAMPLE); alert('Reset to sample data'); }}>Reset to sample data</button>}
        </div>
      </header>

      <div style={{ display: 'grid', gridTemplateColumns: '260px 1fr 320px', gap: 12, padding: 12 }}>
        {/* Left: Classes */}
        <aside style={{ border: '1px solid #eee', padding: 12, borderRadius: 8 }}>
          <h3>Classes</h3>
          <div style={{ display: 'flex', flexDirection: 'column', gap: 6 }}>
            {data.classes.map(c => (
              <div key={c.id} style={{ display: 'flex', justifyContent: 'space-between', alignItems: 'center' }}>
                <button style={{ textAlign: 'left', flex: 1, background: c.id === activeClassId ? '#eef' : 'transparent' }} onClick={() => setActiveClassId(c.id)}>{c.name} <span style={{ color: '#888', fontSize: 12 }}> {c.students?.length || 0} students</span></button>
                <div style={{ display: 'flex', gap: 6 }}>
                  {mode === 'admin' && <button onClick={() => editClassName(c.id)}>Edit</button>}
                  {mode === 'admin' && <button onClick={() => deleteClass(c.id)} style={{ marginLeft: 6 }}>Delete</button>}
                </div>
              </div>
            ))}
          </div>

          {mode === 'admin' && (
            <div style={{ marginTop: 12 }}>
              <h4>Add new class</h4>
              <AddClassForm onAdd={(name) => addClass(name)} />
            </div>
          )}
        </aside>

        {/* Middle: Active class students */}
        <main style={{ border: '1px solid #eee', padding: 12, borderRadius: 8 }}>
          <div style={{ display: 'flex', justifyContent: 'space-between', alignItems: 'center' }}>
            <h3>{activeClass?.name || 'Select a class'}</h3>
            <div style={{ display: 'flex', gap: 8 }}>
              <div>
                <input placeholder="filter students..." style={{ padding: 6 }} onChange={(e) => { /* optional search */ }} />
              </div>
            </div>
          </div>

          <div style={{ marginTop: 12, display: 'grid', gridTemplateColumns: 'repeat(2, 1fr)', gap: 12 }}>
            {(activeClass?.students || []).map(s => (
              <div key={s.id} style={{ border: '1px solid #ddd', padding: 10, borderRadius: 6 }}>
                <div style={{ display: 'flex', justifyContent: 'space-between' }}>
                  <div>
                    <div style={{ fontWeight: 600 }}>{s.name}</div>
                    <div style={{ fontSize: 12, color: '#666' }}>
                      Streak: {s.streak}🔥
                      {s.streakLastUpdated && (
                        <span style={{ 
                          marginLeft: 4, 
                          color: s.streakLastUpdated === new Date().toISOString().slice(0, 10) ? '#0a0' : '#f00',
                          fontWeight: 600
                        }}>
                          ({s.streakLastUpdated})
                        </span>
                      )}
                      {' • '}Ghost: {s.ghost}👻
                      {s.ghostLastUpdated && (
                        <span style={{ 
                          marginLeft: 4, 
                          color: s.ghostLastUpdated === new Date().toISOString().slice(0, 10) ? '#00f' : '#f00',
                          fontWeight: 600
                        }}>
                          ({s.ghostLastUpdated})
                        </span>
                      )}
                    </div>                 </div>
                  <div style={{ textAlign: 'right' }}>
                    <div style={{ fontWeight: 700 }}>{s.currentPoints || 0} pts</div>
                    <div style={{ fontSize: 12, color: '#666' }}>XP: {s.xp || 0}</div>
                  </div>
                </div>

                <div style={{ marginTop: 8, display: 'flex', gap: 8 }}>
                  <button onClick={() => setSelectedStudent({ ...s, classId: activeClass.id })}>Manage</button>
                  {mode === 'admin' && <button onClick={() => setSelectedStudent({ ...s, classId: activeClass.id })}>Give card</button>}
                </div>

                <div style={{ marginTop: 8 }}>
                  <div style={{ fontSize: 12, color: '#444', fontWeight: 600 }}>Cards</div>
                  <div style={{ display: 'flex', gap: 6, marginTop: 6, flexWrap: 'wrap' }}>
                    {(() => {
                      const cardGroups = {};
                      (s.cards || []).forEach(o => {
                        if (!cardGroups[o.cardId]) {
                          cardGroups[o.cardId] = { count: 0 };
                        }
                        cardGroups[o.cardId].count++;
                      });
                
                      return Object.entries(cardGroups).slice(-6).map(([cardId, group]) => {
                        const card = activeClass?.cardsLibrary?.find(c => c.id === cardId) || data.cards.find(c => c.id === cardId);
                        if (!card) return null;
                        return (
                          <div key={cardId} style={{ width: 80, height: 110, border: '1px solid #eee', borderRadius: 4, overflow: 'hidden', position: 'relative' }}>
                            {card?.image ? (
                              <img
                                src={card.image}
                                alt={card?.title}
                                style={{ width: '100%', height: '100%', objectFit: 'cover', transition: 'transform 0.18s ease' }}
                                onMouseEnter={e => e.currentTarget.style.transform = 'scale(1.2)'}
                                onMouseLeave={e => e.currentTarget.style.transform = 'scale(1)'}
                                onClick={() => setShowCardPreview(card)}
                              />
                            ) : <div style={{ padding: 6, fontSize: 11 }}>{card?.title}</div>}
                            {group.count > 1 && (
                              <div style={{ position: 'absolute', top: 4, right: 4, background: 'rgba(0,0,0,0.7)', color: 'white', borderRadius: 12, padding: '2px 6px', fontSize: 11, fontWeight: 700 }}>
                                ×{group.count}
                              </div>
                            )}
                          </div>
                        );
                      });
                    })()}
                  </div>
                </div>
              </div>
            ))}

            {/* Add student UI */}
            {mode === 'admin' && (
              <div style={{ border: '1px dashed #ccc', padding: 12, borderRadius: 6 }}>
                <h4>Add student</h4>
                <AddStudentForm onAdd={(name) => addStudentToActive(name)} />
              </div>
            )}
          </div>
        </main>

        {/* Right: Library & rewards */}
        <aside style={{ border: '1px solid #eee', padding: 12, borderRadius: 8 }}>
          <h3>Library (class)</h3>
          <div style={{ display: 'flex', gap: 6, marginBottom: 8 }}>
            <button onClick={() => setLibraryTab('points')} style={{ background: libraryTab === 'points' ? '#def' : 'transparent' }}>Points</button>
            <button onClick={() => setLibraryTab('rewards')} style={{ background: libraryTab === 'rewards' ? '#def' : 'transparent' }}>Rewards</button>
            <button onClick={() => setLibraryTab('experience')} style={{ background: libraryTab === 'experience' ? '#def' : 'transparent' }}>Experience</button>
          </div>

          {/* ADD CARD UI (admin only) - placed ABOVE the list as requested (A) */}
          {mode === 'admin' && (
            <div style={{ marginBottom: 10 }}>
              <CreateCardForm onCreate={(payload) => createCard(payload)} />
            </div>
          )}

          <div style={{ maxHeight: 420, overflow: 'auto' }}>
            {libraryTab === 'points' && (
              <div style={{ display: 'grid', gap: 8 }}>
                {(activeClass?.cardsLibrary || []).filter(c => c.category === 'points').map(c => (
                  <div key={c.id} style={{ display: 'flex', gap: 8, border: '1px solid #eee', padding: 8, borderRadius: 6, alignItems: 'center' }}>
                    <div style={{ width: 64, height: 80, background: '#fafafa', cursor: 'pointer' }} onClick={() => setShowCardPreview(c)}>
                      {c.image ? <img src={c.image} alt={c.title} style={{ width: '100%', height: '100%', objectFit: 'cover' }} /> : <div style={{ padding: 6 }}>{c.title}</div>}
                    </div>
                    <div style={{ flex: 1 }}>
                      <div style={{ fontWeight: 600 }}>{c.title}</div>
                      <div style={{ fontSize: 12, color: '#666' }}>{c.description}</div>
                      <div style={{ marginTop: 6, fontWeight: 700 }}>{c.points} pts</div>
                    </div>
                    {mode === 'admin' && <div style={{ display: 'flex', gap: 6 }}><button onClick={() => deleteCard(c.id)}>Delete</button></div>}
                  </div>
                ))}
              </div>
            )}

            {libraryTab === 'rewards' && (
              <div style={{ display: 'grid', gap: 8 }}>
                {(activeClass?.rewards || []).map(r => {
                  const card = (activeClass?.cardsLibrary || []).find(c => c.id === r.cardId) || { title: '—' };
                  return (
                    <div key={r.id} style={{ border: '1px solid #eee', padding: 8, borderRadius: 6 }}>
                      <div style={{ fontWeight: 700 }}>{r.title}</div>
                      <div style={{ fontSize: 12, color: '#555' }}>Cost: {r.cost} pts • Linked card: {card.title}</div>
                      {mode === 'admin' && <div style={{ marginTop: 6 }}><button onClick={() => deleteReward(r.id)}>Delete reward</button></div>}
                    </div>
                  );
                })}

                {mode === 'admin' && (
                  <div style={{ borderTop: '1px solid #eee', paddingTop: 8, marginTop: 8 }}>
                    <h4>Create reward (must link to library card)</h4>
                    <CreateRewardForm cards={activeClass?.cardsLibrary || []} onCreate={(payload) => createReward(payload)} />
                  </div>
                )}
              </div>
            )}

            {libraryTab === 'experience' && (
              <div style={{ display: 'grid', gap: 8 }}>
                {(activeClass?.cardsLibrary || []).filter(c => c.category === 'experience').map(c => (
                  <div key={c.id} style={{ display: 'flex', gap: 8, border: '1px solid #eee', padding: 8, borderRadius: 6, alignItems: 'center' }}>
                    <div style={{ width: 64, height: 80, background: '#fafafa', cursor: 'pointer' }} onClick={() => setShowCardPreview(c)}>
                      {c.image ? <img src={c.image} alt={c.title} style={{ width: '100%', height: '100%', objectFit: 'cover' }} /> : <div style={{ padding: 6 }}>{c.title}</div>}
                    </div>
                    <div style={{ flex: 1 }}>
                      <div style={{ fontWeight: 600 }}>{c.title}</div>
                      <div style={{ fontSize: 12, color: '#666' }}>{c.description}</div>
                    </div>
                    {mode === 'admin' && <div style={{ display: 'flex', gap: 6 }}><button onClick={() => deleteCard(c.id)}>Delete</button></div>}
                  </div>
                ))}
              </div>
            )}

          </div>

          {showCardPreview && (
            <div style={{ position: 'fixed', inset: 0, background: 'rgba(0,0,0,0.4)', display: 'flex', alignItems: 'center', justifyContent: 'center' }} onClick={() => setShowCardPreview(null)}>
              <div style={{ background: 'white', padding: 12, borderRadius: 8, maxWidth: '80%', maxHeight: '80%', overflow: 'auto' }} onClick={(e) => e.stopPropagation()}>
                <div style={{ display: 'flex', gap: 12 }}>
                  <div style={{ width: 320, height: 440, background: '#f6f6f6' }}>
                    {showCardPreview.image ? <img src={showCardPreview.image} alt={showCardPreview.title} style={{ width: '100%', height: '100%', objectFit: 'contain' }} /> : <div style={{ padding: 12 }}>{showCardPreview.title}</div>}
                  </div>
                  <div style={{ flex: 1 }}>
                    <h3>{showCardPreview.title}</h3>
                    <div style={{ color: '#666' }}>{showCardPreview.description}</div>
                    <div style={{ marginTop: 8, fontWeight: 700 }}>{showCardPreview.points} pts</div>
                    <div style={{ marginTop: 12 }}>
                      <button onClick={() => setShowCardPreview(null)}>Close</button>
                      {mode === 'admin' && <button style={{ marginLeft: 8 }} onClick={() => { deleteCard(showCardPreview.id); setShowCardPreview(null); }}>Delete card</button>}
                    </div>
                  </div>
                </div>
              </div>
            </div>
          )}

        </aside>
      </div>

      {/* Manage student modal */}
      {selectedStudent && (
        <ManageStudentModal
          key={selectedStudent.id}
          student={selectedStudent}
          classObj={activeClass}
          data={data}
          mode={mode}
          onClose={() => setSelectedStudent(null)}
          onGiveCard={(cardId) => giveCardToStudent(selectedStudent.classId, selectedStudent.id, cardId)}
          onRemoveCard={(ownedId) => removeCardFromStudent(selectedStudent.classId, selectedStudent.id, ownedId)}
          onDeleteStudent={() => deleteStudent(selectedStudent.classId, selectedStudent.id)}
          onRedeemIndividual={(rewardId) => redeemRewardIndividual(selectedStudent.classId, selectedStudent.id, rewardId)}
          onRedeemGroup={(rewardId, shares) => redeemRewardGroup(selectedStudent.classId, rewardId, shares)}
          onChangeMeter={(meter, delta) => changeMeter(selectedStudent.classId, selectedStudent.id, meter, delta)}
          onResetStreak={() => resetStreak(selectedStudent.classId, selectedStudent.id)}
          onQuickAddStreak={() => quickAddStreak(selectedStudent.classId, selectedStudent.id)}          onAddQuickPoints={(amt) => addQuickPoints(selectedStudent.classId, selectedStudent.id, amt)}
          onResetGhost={() => resetGhost(selectedStudent.classId, selectedStudent.id)}
          onQuickAddGhost={() => quickAddGhost(selectedStudent.classId, selectedStudent.id)}
          onUpdate={(updates) => updateStudent(selectedStudent.classId, selectedStudent.id, updates)}
          cards={(activeClass?.cardsLibrary || [])}
          rewards={(activeClass?.rewards || [])}
          setShowCardPreview={setShowCardPreview}
        />
      )}

    </div>
  );
}

// ----- Small components -----
function AddClassForm({ onAdd }) {
  const [name, setName] = useState("");
  return (
    <div>
      <input placeholder="Class name" value={name} onChange={(e) => setName(e.target.value)} />
      <div style={{ marginTop: 6 }}><button onClick={() => { onAdd(name); setName(""); }}>Create</button></div>
    </div>
  );
}

function AddStudentForm({ onAdd }) {
  const [name, setName] = useState("");
  return (
    <div>
      <input placeholder="Student name" value={name} onChange={(e) => setName(e.target.value)} />
      <div style={{ marginTop: 6 }}><button onClick={() => { onAdd(name); setName(""); }}>Add</button></div>
    </div>
  );
}

function CreateCardForm({ onCreate }) {
  const [title, setTitle] = useState("");
  const [description, setDescription] = useState("");
  const [points, setPoints] = useState(1);
  const [category, setCategory] = useState("points");
  const [imageUrl, setImageUrl] = useState("");

  function handleCreate() {
    if (!title) return alert('Title required');
    onCreate({ title, description, points, image: imageUrl, category });
    setTitle(''); setDescription(''); setPoints(1); setImageUrl(''); setCategory('points');
  }

  return (
    <div style={{ border: '1px dashed #ccc', padding: 8, borderRadius: 6 }}>
      <h4>Create new card</h4>
      <input placeholder="Title" value={title} onChange={(e) => setTitle(e.target.value)} style={{ width: '100%', marginBottom: 6 }} />
      <textarea placeholder="Description" value={description} onChange={(e) => setDescription(e.target.value)} style={{ width: '100%', marginBottom: 6 }} />
      <div style={{ display: 'flex', gap: 8, alignItems: 'center', marginBottom: 6 }}>
        <input type="number" value={points} onChange={(e) => setPoints(e.target.value)} style={{ width: 80 }} /> pts
        <select value={category} onChange={(e) => setCategory(e.target.value)}>
          <option value="points">Points</option>
          <option value="experience">Experience</option>
        </select>
      </div>
      <input 
        placeholder="Image URL (e.g., https://i.imgur.com/abc123.jpg)" 
        value={imageUrl} 
        onChange={(e) => setImageUrl(e.target.value)} 
        style={{ width: '100%', marginBottom: 6 }}
      />
      <div style={{ fontSize: 11, color: '#666', marginBottom: 6 }}>
        💡 Tip: For Google Drive, use format: https://drive.google.com/uc?export=view&id=YOUR_FILE_ID
      </div>
      {imageUrl && <div style={{ marginTop: 8 }}><img src={imageUrl} alt="preview" style={{ maxWidth: '100%', maxHeight: 120 }} onError={(e) => e.target.style.display = 'none'} /></div>}
      <div style={{ marginTop: 6 }}><button onClick={handleCreate}>Add card</button></div>
    </div>
  );
}

function CreateRewardForm({ cards, onCreate }) {
  const [title, setTitle] = useState("");
  const [cost, setCost] = useState(5);
  const [cardId, setCardId] = useState(cards[0]?.id || "");
  return (
    <div>
      <input placeholder="Reward title" value={title} onChange={(e) => setTitle(e.target.value)} />
      <div style={{ marginTop: 6 }}>
        <input type="number" value={cost} onChange={(e) => setCost(e.target.value)} />
        <select value={cardId} onChange={(e) => setCardId(e.target.value)}>
          <option value="">-- link card --</option>
          {cards.map(c => <option key={c.id} value={c.id}>{c.title}</option>)}
        </select>
      </div>
      <div style={{ marginTop: 6 }}><button onClick={() => { onCreate({ title, cost, linkedCardId: cardId }); setTitle(''); setCost(5); }}>Create reward</button></div>
    </div>
  );
}

function ManageStudentModal({ student, classObj, data, mode, onClose, onGiveCard, onRemoveCard, onDeleteStudent, onRedeemIndividual, onRedeemGroup, onChangeMeter, onResetStreak, onQuickAddStreak, onResetGhost, onQuickAddGhost, onAddQuickPoints, onUpdate, cards, rewards, setShowCardPreview }) {  const [redeemId, setRedeemId] = useState("");
  const [groupShares, setGroupShares] = useState({});
  const [name, setName] = useState(student.name);
  const [currentPoints, setCurrentPoints] = useState(student.currentPoints || 0);
  const [xp, setXp] = useState(student.xp || 0);

  useEffect(() => {
    setGroupShares({});
    setName(student.name);
    setCurrentPoints(student.currentPoints || 0);
    setXp(student.xp || 0);
  }, [student]);

  function handleRedeemGroupSubmit() {
    onRedeemGroup(redeemId, groupShares);
    setRedeemId("");
  }

  function handleSaveEdits() {
    onUpdate({ name, currentPoints: Number(currentPoints || 0), xp: Number(xp || 0) });
  }

  const cls = classObj;
  const st = cls?.students?.find(s => s.id === student.id) || student;

  return (
    <div style={{ position: 'fixed', inset: 0, background: 'rgba(0,0,0,0.4)', display: 'flex', alignItems: 'center', justifyContent: 'center' }}>
      <div style={{ width: 920, maxHeight: '90%', overflow: 'auto', background: 'white', borderRadius: 8, padding: 12 }}>
        <div style={{ display: 'flex', justifyContent: 'space-between', alignItems: 'center' }}>
          <h3>Manage: {st.name}</h3>
          <div><button onClick={onClose}>Close</button></div>
        </div>

        <div style={{ display: 'grid', gridTemplateColumns: '1fr 360px', gap: 12, marginTop: 12 }}>
          <div>
            <div style={{ display: 'flex', gap: 8 }}>
              <div>
                <div style={{ fontSize: 12, color: '#666' }}>Points</div>
                <div style={{ fontWeight: 700, fontSize: 20 }}>{st.currentPoints || 0} pts</div>
                {mode === 'admin' && <div style={{ marginTop: 6 }}>
                  <button onClick={() => onAddQuickPoints(1)}>+1</button>
                  <button onClick={() => onAddQuickPoints(5)} style={{ marginLeft: 6 }}>+5</button>
                  <button onClick={() => onAddQuickPoints(10)} style={{ marginLeft: 6 }}>+10</button>
                </div>}
              </div>

              <div style={{ marginLeft: 12 }}>
                <div style={{ fontSize: 12, color: '#666' }}>Experience (XP)</div>
                <div style={{ fontWeight: 700, fontSize: 20 }}>{st.xp || 0}</div>
              </div>

              <div style={{ marginLeft: 12 }}>
                <div style={{ fontSize: 12, color: '#666' }}>Streak</div>
                <div style={{ display: 'flex', gap: 6, alignItems: 'center' }}>
                  <button onClick={() => onChangeMeter('streak', -1)}>-</button>
                  <div>{'🔥'.repeat(st.streak || 0)}</div>
                  <button onClick={() => onChangeMeter('streak', +1)}>+</button>
                </div>
                <div style={{ display: 'flex', gap: 6, alignItems: 'center', marginTop: 6 }}>
                  <button onClick={() => onQuickAddStreak()} style={{ fontSize: 11 }}>Quick +1</button>
                  <button onClick={() => onResetStreak()} style={{ fontSize: 11 }}>Reset</button>
                </div>
                {st.streakLastUpdated && (
                  <div style={{ 
                    fontSize: 11, 
                    marginTop: 4,
                    color: st.streakLastUpdated === new Date().toISOString().slice(0, 10) ? '#0a0' : '#f00',
                    fontWeight: 600
                  }}>
                    Last: {st.streakLastUpdated}
                  </div>
                )}
                <div style={{ fontSize: 12, color: '#666', marginTop: 8 }}>Ghost assistance</div>
                <div style={{ display: 'flex', gap: 6, alignItems: 'center' }}>
                  <button onClick={() => onChangeMeter('ghost', -1)}>-</button>
                  <div>{'👻'.repeat(st.ghost || 0)}</div>
                  <button onClick={() => onChangeMeter('ghost', +1)}>+</button>
                </div>
                <div style={{ display: 'flex', gap: 6, alignItems: 'center', marginTop: 6 }}>
                  <button onClick={() => onQuickAddGhost()} style={{ fontSize: 11 }}>Quick +1</button>
                  <button onClick={() => onResetGhost()} style={{ fontSize: 11 }}>Reset</button>
                </div>
                {st.ghostLastUpdated && (
                  <div style={{ 
                    fontSize: 11, 
                    marginTop: 4,
                    color: st.ghostLastUpdated === new Date().toISOString().slice(0, 10) ? '#00f' : '#f00',
                    fontWeight: 600
                  }}>
                    Last: {st.ghostLastUpdated}
                  </div>
                )}
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
                  <button onClick={handleSaveEdits}>Save edits</button>
                </div>
              </div>
            </div>

            <div style={{ marginTop: 12 }}>
              <h4>Cards owned</h4>
              <div style={{ display: 'flex', gap: 8, flexWrap: 'wrap' }}>
                {(() => {
                  const cardGroups = {};
                  (st.cards || []).forEach(o => {
                    if (!cardGroups[o.cardId]) {
                      cardGroups[o.cardId] = [];
                    }
                    cardGroups[o.cardId].push(o);
                    });

                    return Object.entries(cardGroups).map(([cardId, ownedCards]) => {
                      const card = (cards || []).find(c => c.id === cardId) || data.cards.find(c => c.id === cardId) || { title: '—' };
                      return (
                        <div key={cardId} style={{ border: '1px solid #eee', padding: 6, borderRadius: 6, width: 140 }}>
                          {card.image ? (
                            <div style={{ position: 'relative' }}>
                              <img
                                src={card.image}
                                alt={card.title}
                                style={{ width: '100%', height: 90, objectFit: 'cover', borderRadius: 4, cursor: 'pointer', transition: 'transform 0.18s ease' }}
                                onMouseEnter={e => e.currentTarget.style.transform = 'scale(1.12)'}
                                onMouseLeave={e => e.currentTarget.style.transform = 'scale(1)'}
                                onClick={() => setShowCardPreview(card)}
                              />
                              {ownedCards.length > 1 && (
                                <div style={{ position: 'absolute', top: 4, right: 4, background: 'rgba(0,0,0,0.7)', color: 'white', borderRadius: 12, padding: '2px 6px', fontSize: 11, fontWeight: 700 }}>
                                  ×{ownedCards.length}
                                </div>
                              )}
                            </div>
                          ) : <div style={{ fontWeight: 600 }}>{card.title} ×{ownedCards.length}</div>}
                          <div style={{ fontSize: 12, color: '#666', marginTop: 4 }}>Count: {ownedCards.length}</div>
                          {mode === 'admin' && (
                            <div style={{ marginTop: 6, display: 'flex', gap: 4 }}>
                              <button onClick={() => onRemoveCard(ownedCards[0].id)} style={{ fontSize: 11 }}>Remove 1</button>
                              {ownedCards.length > 1 && (
                                <button onClick={() => {
                                  if (window.confirm(`Remove all ${ownedCards.length} copies?`)) {
                                    ownedCards.forEach(o => onRemoveCard(o.id));
                                  }
                                }} style={{ fontSize: 11 }}>Remove all</button>
                              )}
                            </div>
                          )}
                        </div>
                      );
                    });
                  })()}
                </div>

              </div>

            <div style={{ marginTop: 12 }}>
              <h4>Rewards history</h4>
              <div style={{ display: 'grid', gap: 6 }}>
                {(st.rewardsHistory || []).map(rh => (
                  <div key={rh.id} style={{ border: '1px solid #eee', padding: 6, borderRadius: 6 }}>
                    <div style={{ fontWeight: 600 }}>{rh.title} • {rh.cost} pts</div>
                    <div style={{ fontSize: 12, color: '#666' }}>{rh.date?.slice(0, 19).replace('T', ' ')}</div>
                    {mode === 'admin' && <div style={{ marginTop: 6 }}><button onClick={() => {
                      if (!confirm('Delete this reward history entry?')) return;
                      saveLocalRemoveRewardHistory(classObj.id, st.id, rh.id);
                    }}>Delete</button></div>}
                  </div>
                ))}
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
                  <button onClick={() => { if (!redeemId) return alert('Choose reward'); const choice = prompt('Individual or Group? type I or G'); if (!choice) return; if (choice.toUpperCase() === 'I') { onRedeemIndividual(redeemId); } else { setShowGiveLibrary(true); } }} >Redeem</button>
                </div>
              </div>

              <GroupRedeemInline key={redeemId + (st.id||'')} rewardId={redeemId} classObj={classObj} onSubmit={(shares) => { if (!redeemId) return alert('Select reward first'); onRedeemGroup(redeemId, shares); }} />

            </div>

          </div>

          <div>
            <div style={{ display: 'flex', justifyContent: 'space-between', alignItems: 'center' }}>
              <h4>Admin actions</h4>
              {mode === 'admin' && <button onClick={() => onDeleteStudent()}>Delete student</button>}
            </div>

            <div style={{ marginTop: 8 }}>
              <h4>Give card</h4>
              <div style={{ display: 'grid', gap: 8 }}>
                {cards.map(c => (
                  <div key={c.id} style={{ border: '1px solid #eee', padding: 6, borderRadius: 6, display: 'flex', justifyContent: 'space-between', alignItems: 'center' }}>
                    <div>
                      <div style={{ fontWeight: 700 }}>{c.title}</div>
                      <div style={{ fontSize: 12, color: '#666' }}>{c.description}</div>
                    </div>
                    {mode === 'admin' && <div><button onClick={() => onGiveCard(c.id)}>Give</button></div>}
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

// small helper used in ManageStudentModal for reward history delete (uses localStorage save directly)
function saveLocalRemoveRewardHistory(classId, studentId, historyId) {
  const raw = localStorage.getItem(STORAGE_KEY);
  if (!raw) return;
  const d = JSON.parse(raw);
  const cls = d.classes.find(c => c.id === classId);
  const st = cls.students.find(s => s.id === studentId);
  st.rewardsHistory = st.rewardsHistory.filter(x => x.id !== historyId);
  localStorage.setItem(STORAGE_KEY, JSON.stringify(d));
  window.location.reload();
}

function GroupRedeemInline({ rewardId, classObj, onSubmit }) {
  const [shares, setShares] = useState({});
  useEffect(() => setShares({}), [rewardId]);
  if (!rewardId) return null;
  const reward = (classObj?.rewards || []).find(r => r.id === rewardId) || null;
  return (
    <div style={{ marginTop: 8, borderTop: '1px dashed #ddd', paddingTop: 8 }}>
      <div style={{ fontSize: 13, color: '#666' }}>Enter shares for group redemption (numbers must add exactly to cost)</div>
      {classObj?.students?.map(s => (
        <div key={s.id} style={{ display: 'flex', gap: 8, alignItems: 'center', marginTop: 6 }}>
          <div style={{ flex: 1 }}>{s.name} (has {s.currentPoints || 0} pts)</div>
          <input type="number" value={shares[s.id] || ''} onChange={(e) => setShares((prev) => ({ ...prev, [s.id]: Number(e.target.value) }))} style={{ width: 80 }} />
        </div>
      ))}
      <div style={{ marginTop: 8 }}>
        <button onClick={() => onSubmit(shares)}>Confirm group redeem</button>
      </div>
    </div>
  );
}
