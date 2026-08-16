import React, { useState } from "react";

export default function RewardCreateForm({ cards, onCreate }) {
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
