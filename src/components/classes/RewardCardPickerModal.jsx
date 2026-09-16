export default function RewardCardPickerModal({ request, cards, onClose, onSave }) {
  if (!request) return null;

  const selectedIds = request.selectedIds || [];
  const pointCards = cards
    .filter((card) => (card.category || "points") === "points")
    .slice()
    .sort((a, b) => String(a.title || "").localeCompare(String(b.title || "")));

  return (
    <div className="modal-backdrop" onClick={onClose}>
      <div className="modal form-modal" onClick={(event) => event.stopPropagation()}>
        <h3 style={{ marginTop: 0 }}>Reward cards at the maximum</h3>
        <p className="muted">Choose the cards to give automatically when this streak reaches its maximum.</p>

        <div className="reward-picker-list">
          {pointCards.map((card) => (
            <label className="reward-picker-option" key={card.id}>
              <input
                type="checkbox"
                checked={selectedIds.includes(card.id)}
                onChange={() => request.toggleCard(card.id)}
              />
              <span>{card.title || "Untitled card"}</span>
              <strong>{Number(card.points || 0)} pts</strong>
            </label>
          ))}
          {pointCards.length === 0 && <div className="muted">No points cards available.</div>}
        </div>

        <div className="feedback-dialog-actions">
          <button type="button" className="btn" onClick={onClose}>Cancel</button>
          <button type="button" className="btn primary" onClick={() => onSave(selectedIds)}>Save cards</button>
        </div>
      </div>
    </div>
  );
}
