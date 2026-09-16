export default function StreakFormModal({ request, cards, onClose, onSave }) {
  if (!request) return null;

  const initial = request.initial || {};
  const selectedRewardIds = Array.isArray(request.rewardCardIds)
    ? request.rewardCardIds
    : Array.isArray(initial.rewardCardIds)
      ? initial.rewardCardIds
      : [];

  function submit(event) {
    event.preventDefault();
    const form = new FormData(event.currentTarget);
    const emoji = String(form.get("emoji") || "").trim();
    const max = Number(form.get("max"));

    if (!emoji || !Number.isFinite(max) || max <= 0) return;

    onSave({
      emoji,
      max,
      float: form.get("float") === "on",
      stickyCelebrate: form.get("stickyCelebrate") === "on",
      rewardCardIds: selectedRewardIds,
    });
  }

  return (
    <div className="modal-backdrop" onClick={onClose}>
      <form className="modal form-modal" onSubmit={submit} onClick={(event) => event.stopPropagation()}>
        <h3 style={{ marginTop: 0 }}>{request.title || "Create streak"}</h3>
        <p className="muted">Set the goal and what happens when students reach it.</p>

        <label className="form-field">
          <span>Emoji</span>
          <input className="input" name="emoji" defaultValue={initial.emoji || ""} placeholder="For example: 🔥" autoFocus required />
        </label>

        <label className="form-field">
          <span>Maximum of the streak</span>
          <input className="input" name="max" type="number" min="1" step="1" defaultValue={initial.max || ""} placeholder="For example: 5" required />
        </label>

        <label className="form-check">
          <input name="float" type="checkbox" defaultChecked={!!initial.float} />
          <span><strong>Floating emoji</strong><small>Show the emoji in the student's background after reaching the maximum.</small></span>
        </label>

        <label className="form-check">
          <input name="stickyCelebrate" type="checkbox" defaultChecked={!!initial.stickyCelebrate} />
          <span><strong>Persistent celebration</strong><small>Keep the celebration visible for the rest of the day after a reset.</small></span>
        </label>

        <fieldset className="reward-picker">
          <legend>Reward cards at the maximum</legend>
          <div className="muted">Choose any cards to give automatically. You can leave this empty.</div>
          <div className="reward-picker-list">
            {cards.filter((card) => (card.category || "points") === "points").map((card) => (
              <label className="reward-picker-option" key={card.id}>
                <input
                  type="checkbox"
                  checked={selectedRewardIds.includes(card.id)}
                  onChange={() => request.toggleRewardCard(card.id)}
                />
                <span>{card.title || "Untitled card"}</span>
                <strong>{Number(card.points || 0)} pts</strong>
              </label>
            ))}
            {cards.filter((card) => (card.category || "points") === "points").length === 0 && (
              <div className="muted">No points cards available.</div>
            )}
          </div>
        </fieldset>

        <div className="feedback-dialog-actions">
          <button type="button" className="btn" onClick={onClose}>Cancel</button>
          <button type="submit" className="btn primary">Save streak</button>
        </div>
      </form>
    </div>
  );
}
