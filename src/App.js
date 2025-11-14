import React, { useState, useEffect } from "react";

// Pokemáticos - Single-file React app
// Tailwind CSS assumed. This component is a drop-in App.
// Features:
// - Multiple classes (4 prefilled)
// - Student roster per class
// - Card library (upload images or paste URL)
// - Click a card to add to a student's collection and award points
// - Tracks currentPoints, cumulativePoints, streaks (by date)
// - Reward shop where students can spend points (resets currentPoints on redeem)
// - Persistence via localStorage
// - Export / import JSON

const SAMPLE = {
  classes: [
    {
      id: "3eso",
      name: "3º ESO Pokemáticos",
      students: [
        { id: "carlota", name: "Carlota", avatar: "", currentPoints: 21, cumulativePoints: 120, streak: 2, lastActive: null, cards: [] },
        { id: "cayden", name: "Cayden", avatar: "", currentPoints: 23, cumulativePoints: 130, streak: 2, lastActive: null, cards: [] },
      ],
    },
    {
      id: "ds",
      name: "Digital Society Pokemáticos",
      students: [
        { id: "valeria", name: "Valeria", avatar: "", currentPoints: 8, cumulativePoints: 60, streak: 1, lastActive: null, cards: [] },
      ],
    },
    { id: "aa", name: "Maths AA Pokemáticos", students: [] },
    { id: "ai", name: "Maths AI Pokemáticos", students: [] },
  ],
  cards: [
    {
      id: "knowledge-fusion",
      title: "Knowledge fusion",
      image: "",
      description: "Solve a companion's math or existential question and gain 5 points. Use multiple times in class.",
      points: 5,
      type: "attack",
    },
    {
      id: "knowledge-seeker",
      title: "Knowledge seeker",
      image: "",
      description: "Ask a meaningful question. Gain 1 point. (Supporter: once per turn)",
      points: 1,
      type: "supporter",
    },
  ],
  rewards: [
    { id: "r1", title: "Change your seat for one session", cost: 4 },
    { id: "r2", title: "Bonus hint on an exercise", cost: 5 },
    { id: "r3", title: "Choose your partner for the day", cost: 10 },
  ],
};

function uid(prefix = "id") {
  return `${prefix}_${Math.random().toString(36).slice(2, 9)}`;
}

export default function App() {
  const [data, setData] = useState(() => {
    const raw = localStorage.getItem("pokematics_v1");
    if (raw) try { return JSON.parse(raw); } catch (e) {}
    return SAMPLE;
  });

  const [activeClassId, setActiveClassId] = useState(data.classes[0]?.id || null);
  const [selectedStudent, setSelectedStudent] = useState(null);
  const [showCardModal, setShowCardModal] = useState(false);
  const [filter, setFilter] = useState("");
  const [showLibrary, setShowLibrary] = useState(false);
  const [showExport, setShowExport] = useState(false);

  useEffect(() => {
    localStorage.setItem("pokematics_v1", JSON.stringify(data));
  }, [data]);

  const activeClass = data.classes.find((c) => c.id === activeClassId) || data.classes[0];

  function updateClass(cls) {
    setData((d) => ({ ...d, classes: d.classes.map((c) => (c.id === cls.id ? cls : c)) }));
  }

  function addStudent(name) {
    if (!name) return;
    const newStudent = { id: uid("s"), name, avatar: "", currentPoints: 0, cumulativePoints: 0, streak: 0, lastActive: null, cards: [] };
    const cls = { ...activeClass, students: [...(activeClass.students || []), newStudent] };
    updateClass(cls);
  }

  function awardCardToStudent(studentId, cardId) {
    const card = data.cards.find((c) => c.id === cardId);
    if (!card) return;
    const today = new Date().toISOString().slice(0, 10);
    setData((d) => ({
      ...d,
      classes: d.classes.map((c) => {
        if (c.id !== activeClass.id) return c;
        return {
          ...c,
          students: c.students.map((s) => {
            if (s.id !== studentId) return s;
            // manage streak
            let streak = s.streak || 0;
            if (s.lastActive !== today) {
              // increment streak if they had any activity yesterday or earlier? Keep simple: if lastActive is yesterday or earlier -> if lastActive is not today and not null then either reset or increment
              // For simplicity: increment if lastActive === yesterday else set to 1
              const yesterday = new Date(Date.now() - 86400000).toISOString().slice(0, 10);
              streak = (s.lastActive === yesterday) ? (s.streak || 0) + 1 : 1;
            }
            const currentPoints = (s.currentPoints || 0) + (card.points || 0);
            const cumulative = (s.cumulativePoints || 0) + (card.points || 0);
            const cards = [...(s.cards || []), { id: uid("owned"), cardId: card.id, grantedAt: new Date().toISOString() }];

            return { ...s, cards, currentPoints, cumulativePoints: cumulative, streak, lastActive: today };
          }),
        };
      }),
    }));
  }

  function spendReward(studentId, rewardId) {
    const reward = data.rewards.find((r) => r.id === rewardId);
    if (!reward) return; // fail silently
    setData((d) => ({
      ...d,
      classes: d.classes.map((c) => {
        if (c.id !== activeClass.id) return c;
        return {
          ...c,
          students: c.students.map((s) => {
            if (s.id !== studentId) return s;
            if ((s.currentPoints || 0) < reward.cost) return s; // not enough points
            return { ...s, currentPoints: 0, cumulativePoints: (s.cumulativePoints || 0) }; // reset current points
          }),
        };
      }),
    }));
  }

  function addCardToLibrary({ title, description, points, image }) {
    const card = { id: uid("card"), title, description, points: Number(points) || 0, image: image || "", type: "custom" };
    setData((d) => ({ ...d, cards: [...d.cards, card] }));
  }

  function uploadImageFile(file, cb) {
    const reader = new FileReader();
    reader.onload = (e) => cb(e.target.result);
    reader.readAsDataURL(file);
  }

  function handleCardUpload(e) {
    const f = e.target.files?.[0];
    if (!f) return;
    uploadImageFile(f, (dataUrl) => {
      // create a sample card using the image
      addCardToLibrary({ title: `Custom Card ${Date.now()}`, description: "Uploaded image card", points: 5, image: dataUrl });
    });
  }

  function addReward(title, cost) {
    const r = { id: uid("reward"), title, cost: Number(cost || 0) };
    setData((d) => ({ ...d, rewards: [...d.rewards, r] }));
  }

  function importJSON(text) {
    try {
      const parsed = JSON.parse(text);
      setData(parsed);
      localStorage.setItem("pokematics_v1", JSON.stringify(parsed));
      alert("Imported OK");
    } catch (e) {
      alert("Invalid JSON");
    }
  }

  function exportJSON() {
    const blob = new Blob([JSON.stringify(data, null, 2)], { type: "application/json" });
    const url = URL.createObjectURL(blob);
    const a = document.createElement("a");
    a.href = url; a.download = "pokematics_export.json"; a.click();
    URL.revokeObjectURL(url);
  }

  return (
    <div className="min-h-screen bg-gray-50 p-6">
      <div className="max-w-7xl mx-auto bg-white shadow rounded-lg overflow-hidden">
        <header className="flex items-center justify-between p-4 border-b">
          <div className="flex items-center gap-4">
            <div className="w-12 h-12 rounded-full flex items-center justify-center bg-yellow-200 text-2xl font-bold">P</div>
            <div>
              <h1 className="text-2xl font-semibold">Mis logros Pokemáticos — Manager</h1>
              <p className="text-sm text-gray-500">Manage classes, award cards and points with a click. Local-only storage.</p>
            </div>
          </div>
          <div className="flex items-center gap-2">
            <button onClick={() => { setShowLibrary(true); }} className="px-3 py-1 bg-indigo-600 text-white rounded">Card Library</button>
            <button onClick={() => { setShowExport(true); }} className="px-3 py-1 bg-gray-200 rounded">Export / Import</button>
            <button onClick={() => { localStorage.removeItem("pokematics_v1"); setData(SAMPLE); alert("Reset to sample data"); }} className="px-3 py-1 bg-red-50 text-red-600 rounded">Reset</button>
          </div>
        </header>

        <main className="grid grid-cols-4 gap-4 p-4">
          <aside className="col-span-1 border rounded p-3 h-[60vh] overflow-auto">
            <h2 className="font-semibold mb-2">Classes</h2>
            <div className="flex flex-col gap-2">
              {data.classes.map((c) => (
                <button key={c.id} onClick={() => { setActiveClassId(c.id); }} className={`text-left p-2 rounded ${c.id === activeClassId ? "bg-indigo-100" : "hover:bg-gray-50"}`}>
                  <div className="flex justify-between"><div>{c.name}</div><div className="text-xs text-gray-500">{c.students?.length || 0} students</div></div>
                </button>
              ))}
            </div>
            <div className="mt-4 border-t pt-3">
              <h3 className="text-sm font-medium">Add new student</h3>
              <AddStudentForm onAdd={(name) => addStudent(name)} />
            </div>
            <div className="mt-4 border-t pt-3">
              <h3 className="text-sm font-medium">Upload card image</h3>
              <input type="file" accept="image/*" onChange={handleCardUpload} className="mt-2" />
            </div>
          </aside>

          <section className="col-span-2 border rounded p-3 h-[60vh] overflow-auto">
            <div className="flex items-center justify-between">
              <h2 className="font-semibold">{activeClass?.name}</h2>
              <div className="flex items-center gap-2">
                <input placeholder="filter students..." value={filter} onChange={(e) => setFilter(e.target.value)} className="px-2 py-1 border rounded" />
                <button onClick={() => setShowLibrary(true)} className="px-2 py-1 border rounded">Open Library</button>
              </div>
            </div>

            <div className="mt-4 grid grid-cols-2 gap-4">
              {(activeClass?.students || []).filter(s => s.name.toLowerCase().includes(filter.toLowerCase())).map((s) => (
                <div key={s.id} className="border rounded p-3 bg-white">
                  <div className="flex items-center justify-between">
                    <div className="flex items-center gap-3">
                      <div className="w-12 h-12 rounded-full bg-gray-100 flex items-center justify-center">{s.name[0]}</div>
                      <div>
                        <div className="font-semibold">{s.name}</div>
                        <div className="text-xs text-gray-500">Level: {Math.floor((s.cumulativePoints||0)/100) + 1} • Streak: {s.streak || 0}🔥</div>
                      </div>
                    </div>
                    <div className="text-right">
                      <div className="font-bold text-lg">{s.currentPoints || 0} pts</div>
                      <div className="text-xs text-gray-500">Total: {s.cumulativePoints || 0}</div>
                    </div>
                  </div>

                  <div className="mt-3 flex gap-2">
                    <button onClick={() => setSelectedStudent({ ...s, classId: activeClass.id })} className="px-3 py-1 border rounded">Manage</button>
                    <button onClick={() => { setSelectedStudent({ ...s, classId: activeClass.id }); setShowCardModal(true); }} className="px-3 py-1 bg-green-50 border rounded">Give card</button>
                  </div>

                  <div className="mt-3">
                    <div className="text-sm font-medium">Cards</div>
                    <div className="flex gap-2 mt-2 flex-wrap">
                      {(s.cards || []).slice(-6).map((own) => {
                        const card = data.cards.find(c => c.id === own.cardId);
                        return (
                          <div key={own.id} className="w-20 h-28 border rounded overflow-hidden bg-white text-xs shadow-sm">
                            {card?.image ? <img src={card.image} alt={card.title} className="w-full h-full object-cover"/> : <div className="p-2">{card?.title}</div>}
                          </div>
                        );
                      })}
                    </div>
                  </div>
                </div>
              ))}
            </div>
          </section>

          <aside className="col-span-1 border rounded p-3 h-[60vh] overflow-auto">
            <h3 className="font-semibold">Rewards</h3>
            <div className="mt-2 flex flex-col gap-2">
              {data.rewards.map((r) => (
                <div key={r.id} className="p-2 border rounded flex justify-between items-center">
                  <div>
                    <div className="font-medium">{r.title}</div>
                    <div className="text-xs text-gray-500">Cost: {r.cost} pts</div>
                  </div>
                  <div>
                    <button onClick={() => { if (!selectedStudent) return alert('Select a student first'); spendReward(selectedStudent.id, r.id); }} className="px-2 py-1 bg-yellow-100 rounded">Redeem</button>
                  </div>
                </div>
              ))}
            </div>

            <div className="mt-4 border-t pt-3">
              <h3 className="text-sm font-medium">Add reward</h3>
              <AddRewardForm onAdd={(t,c) => addReward(t,c)} />
            </div>

            <div className="mt-4 border-t pt-3">
              <h3 className="text-sm font-medium">Actions</h3>
              <div className="flex flex-col gap-2 mt-2">
                <button onClick={() => exportJSON()} className="px-3 py-1 border rounded">Export JSON</button>
                <button onClick={() => { setShowExport(true); }} className="px-3 py-1 border rounded">Import JSON</button>
              </div>
            </div>
          </aside>
        </main>

        {/* Card modal */}
        {showLibrary && (
          <div className="fixed inset-0 bg-black/40 flex items-start justify-center p-6">
            <div className="bg-white w-full max-w-4xl rounded shadow-lg p-4">
              <div className="flex justify-between items-center">
                <h3 className="font-semibold">Card Library</h3>
                <div className="flex items-center gap-2">
                  <button onClick={() => { setShowLibrary(false); }} className="px-3 py-1 border rounded">Close</button>
                  <button onClick={() => { setShowCardModal(true); setShowLibrary(false); }} className="px-3 py-1 bg-green-600 text-white rounded">Create Card</button>
                </div>
              </div>

              <div className="mt-4 grid grid-cols-3 gap-4">
                {data.cards.map((c) => (
                  <div key={c.id} className="border rounded p-2 bg-gray-50">
                    <div className="h-36 bg-white flex items-center justify-center overflow-hidden">
                      {c.image ? <img src={c.image} alt={c.title} className="w-full h-full object-cover"/> : <div className="text-xs text-gray-500 p-2">No image</div>}
                    </div>
                    <div className="mt-2">
                      <div className="font-medium">{c.title}</div>
                      <div className="text-xs text-gray-500">{c.description}</div>
                      <div className="mt-2 flex items-center justify-between">
                        <div className="text-sm font-bold">{c.points} pts</div>
                        <div className="flex gap-2">
                          <button onClick={() => { if (!selectedStudent) return alert('Select a student first'); awardCardToStudent(selectedStudent.id, c.id); }} className="px-2 py-1 border rounded">Give</button>
                          <button onClick={() => { navigator.clipboard?.writeText(c.description || ''); alert('Copied description'); }} className="px-2 py-1 border rounded">Copy</button>
                        </div>
                      </div>
                    </div>
                  </div>
                ))}
              </div>

            </div>
          </div>
        )}

        {/* Create / Give card modal */}
        {showCardModal && (
          <CardModal onClose={() => { setShowCardModal(false); }} onCreate={(payload) => { addCardToLibrary(payload); setShowCardModal(false); }} onGive={(cardId) => { if (!selectedStudent) return alert('Select student first'); awardCardToStudent(selectedStudent.id, cardId); setShowCardModal(false); }} cards={data.cards} />
        )}

        {/* Manage selected student */}
        {selectedStudent && (
          <StudentManager student={selectedStudent} onClose={() => setSelectedStudent(null)} onUpdate={(updates) => {
            // merge updates into student
            const clsId = selectedStudent.classId;
            setData((d) => ({ ...d, classes: d.classes.map((c) => {
              if (c.id !== clsId) return c;
              return { ...c, students: c.students.map((s) => s.id === selectedStudent.id ? { ...s, ...updates } : s) };
            }) }));
            setSelectedStudent((s) => ({ ...s, ...updates }));
          }} onAwardCard={(cardId) => awardCardToStudent(selectedStudent.id, cardId)} cards={data.cards} rewards={data.rewards} spendReward={spendReward} />
        )}

        {/* Export / Import modal */}
        {showExport && (
          <div className="fixed inset-0 bg-black/40 flex items-center justify-center p-6">
            <div className="bg-white w-full max-w-2xl rounded shadow p-4">
              <div className="flex justify-between items-center"><h3 className="font-semibold">Export / Import</h3><button onClick={() => setShowExport(false)} className="px-2 py-1 border rounded">Close</button></div>
              <div className="mt-4">
                <button onClick={() => exportJSON()} className="px-3 py-1 border rounded">Download JSON</button>
              </div>
              <div className="mt-4">
                <textarea placeholder="Paste exported JSON here to import" id="importArea" className="w-full h-40 p-2 border rounded" />
                <div className="mt-2 flex gap-2 justify-end">
                  <button onClick={() => { const t = document.getElementById('importArea').value; importJSON(t); setShowExport(false); }} className="px-3 py-1 bg-indigo-600 text-white rounded">Import</button>
                </div>
              </div>
            </div>
          </div>
        )}

      </div>
    </div>
  );
}

function AddStudentForm({ onAdd }) {
  const [name, setName] = useState("");
  return (
    <div>
      <input value={name} onChange={(e) => setName(e.target.value)} placeholder="Student name" className="w-full border px-2 py-1 rounded" />
      <div className="mt-2 flex gap-2">
        <button onClick={() => { onAdd(name); setName(""); }} className="px-3 py-1 bg-green-600 text-white rounded">Add</button>
      </div>
    </div>
  );
}

function AddRewardForm({ onAdd }) {
  const [title, setTitle] = useState("");
  const [cost, setCost] = useState(5);
  return (
    <div>
      <input value={title} onChange={(e) => setTitle(e.target.value)} placeholder="Reward title" className="w-full border px-2 py-1 rounded" />
      <div className="mt-2 flex gap-2">
        <input type="number" value={cost} onChange={(e) => setCost(e.target.value)} className="w-24 border px-2 py-1 rounded" />
        <button onClick={() => { onAdd(title, cost); setTitle(""); setCost(5); }} className="px-3 py-1 bg-blue-600 text-white rounded">Add</button>
      </div>
    </div>
  );
}

function CardModal({ onClose, onCreate, onGive, cards = [] }) {
  const [title, setTitle] = useState("");
  const [description, setDescription] = useState("");
  const [points, setPoints] = useState(5);
  const [image, setImage] = useState("");

  function handleFile(e) {
    const f = e.target.files?.[0];
    if (!f) return;
    const r = new FileReader();
    r.onload = (ev) => setImage(ev.target.result);
    r.readAsDataURL(f);
  }

  return (
    <div className="fixed inset-0 bg-black/40 flex items-start justify-center p-6">
      <div className="bg-white w-full max-w-2xl rounded shadow-lg p-4">
        <div className="flex justify-between items-center">
          <h3 className="font-semibold">Create / Give Card</h3>
          <div className="flex gap-2">
            <button onClick={onClose} className="px-2 py-1 border rounded">Close</button>
          </div>
        </div>

        <div className="mt-4 grid grid-cols-2 gap-4">
          <div>
            <input value={title} onChange={(e) => setTitle(e.target.value)} placeholder="Title" className="w-full border px-2 py-1 rounded" />
            <textarea value={description} onChange={(e) => setDescription(e.target.value)} placeholder="Description" className="w-full mt-2 border px-2 py-1 rounded h-28"></textarea>
            <div className="mt-2 flex gap-2 items-center">
              <input type="number" value={points} onChange={(e) => setPoints(e.target.value)} className="w-20 border px-2 py-1 rounded" />
              <input type="file" accept="image/*" onChange={handleFile} />
            </div>
            <div className="mt-3 flex gap-2">
              <button onClick={() => { onCreate({ title, description, points, image }); }} className="px-3 py-1 bg-green-600 text-white rounded">Create card</button>
            </div>
          </div>
          <div>
            <div className="h-64 border rounded overflow-hidden flex items-center justify-center bg-gray-100">
              {image ? <img src={image} alt="preview" className="w-full h-full object-cover" /> : <div className="text-gray-400">Image preview</div>}
            </div>

            <div className="mt-3">
              <div className="font-semibold">Existing cards</div>
              <div className="mt-2 grid grid-cols-2 gap-2">
                {cards.map(c => (
                  <div key={c.id} className="border rounded p-2 bg-white">
                    <div className="h-20 overflow-hidden">{c.image ? <img src={c.image} alt={c.title} className="w-full h-full object-cover"/> : <div className="text-xs text-gray-500">No image</div>}</div>
                    <div className="mt-1 text-xs">{c.title}</div>
                    <div className="mt-1 flex gap-2"><button onClick={() => onGive(c.id)} className="px-2 py-1 border rounded">Give</button></div>
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

function StudentManager({ student, onClose, onUpdate, onAwardCard, cards, rewards, spendReward }) {
  const [name, setName] = useState(student.name);
  return (
    <div className="fixed inset-0 bg-black/40 flex items-start justify-center p-6">
      <div className="bg-white w-full max-w-2xl rounded shadow p-4">
        <div className="flex justify-between items-center">
          <h3 className="font-semibold">Manage: {student.name}</h3>
          <div className="flex gap-2"><button onClick={onClose} className="px-2 py-1 border rounded">Close</button></div>
        </div>

        <div className="mt-4 grid grid-cols-2 gap-4">
          <div>
            <div className="text-sm">Name</div>
            <input value={name} onChange={(e) => setName(e.target.value)} className="w-full border px-2 py-1 rounded" />
            <div className="mt-2">
              <button onClick={() => onUpdate({ name })} className="px-3 py-1 bg-blue-600 text-white rounded">Save</button>
            </div>

            <div className="mt-4">
              <div className="text-sm font-medium">Award quick points</div>
              <div className="flex gap-2 mt-2">
                <button onClick={() => onUpdate({ currentPoints: (student.currentPoints||0)+1, cumulativePoints: (student.cumulativePoints||0)+1 })} className="px-2 py-1 border rounded">+1</button>
                <button onClick={() => onUpdate({ currentPoints: (student.currentPoints||0)+5, cumulativePoints: (student.cumulativePoints||0)+5 })} className="px-2 py-1 border rounded">+5</button>
                <button onClick={() => onUpdate({ currentPoints: (student.currentPoints||0)+10, cumulativePoints: (student.cumulativePoints||0)+10 })} className="px-2 py-1 border rounded">+10</button>
              </div>
            </div>

          </div>
          <div>
            <div className="text-sm font-medium">Redeem rewards</div>
            <div className="mt-2 flex flex-col gap-2">
              {rewards.map(r => (
                <div key={r.id} className="p-2 border rounded flex justify-between items-center">
                  <div>
                    <div className="font-medium">{r.title}</div>
                    <div className="text-xs text-gray-500">Cost: {r.cost}</div>
                  </div>
                  <div>
                    <button onClick={() => spendReward(student.id, r.id)} className="px-2 py-1 bg-yellow-100 rounded">Spend</button>
                  </div>
                </div>
              ))}
            </div>

            <div className="mt-4">
              <div className="text-sm font-medium">Student Cards ({(student.cards||[]).length})</div>
              <div className="mt-2 grid grid-cols-4 gap-2">
                {(student.cards||[]).map(own => {
                  const c = cards.find(x => x.id === own.cardId);
                  return (
                    <div key={own.id} className="border rounded p-1 text-xs overflow-hidden">
                      {c?.image ? <img src={c.image} alt={c.title} className="w-full h-20 object-cover"/> : <div className="p-2">{c?.title}</div>}
                      <div className="mt-1">{c?.title}</div>
                    </div>
                  );
                })}
              </div>
            </div>

            <div className="mt-4">
              <div className="text-sm font-medium">Give a card</div>
              <div className="mt-2 grid grid-cols-3 gap-2">
                {cards.map(c => (
                  <div key={c.id} className="border rounded p-2">
                    <div className="h-20 overflow-hidden">{c.image ? <img src={c.image} alt={c.title} className="w-full h-full object-cover"/> : <div className="text-xs text-gray-500">No image</div>}</div>
                    <div className="mt-1 text-xs">{c.title}</div>
                    <div className="mt-1 flex gap-2"><button onClick={() => onAwardCard(c.id)} className="px-2 py-1 border rounded">Give</button></div>
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
