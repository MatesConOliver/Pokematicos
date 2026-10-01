export default function FloatWindowEditModal({ request, onClose, onSave }) {
  if (!request) return null;

  const initial = request.initial || {};

  function submit(event) {
    event.preventDefault();
    const form = new FormData(event.currentTarget);
    const start = String(form.get("start") || "").trim();
    const end = String(form.get("end") || "").trim();
    const multiplierBonus = Number(form.get("multiplierBonus"));

    if (!start || !end || end < start) return;

    onSave({ start, end, multiplierBonus: Number.isFinite(multiplierBonus) ? multiplierBonus : 0 });
  }

  return (
    <div className="modal-backdrop" onClick={onClose}>
      <form className="modal form-modal schedule-modal" onSubmit={submit} onClick={(event) => event.stopPropagation()}>
        <h3 style={{ marginTop: 0 }}>Edit floating window</h3>
        <p className="muted">{request.message || "Edit the dates and the multiplier bonus for this student's floating emoji."}</p>

        <div className="schedule-fields">
          <label className="form-field">
            <span>Start date</span>
            <input className="input" name="start" type="date" defaultValue={initial.start} autoFocus required />
          </label>
          <label className="form-field">
            <span>End date</span>
            <input className="input" name="end" type="date" defaultValue={initial.end} required />
          </label>
        </div>

        <label className="form-field">
          <span>Multiplier bonus during this window</span>
          <input className="input" name="multiplierBonus" type="number" step="0.01" defaultValue={initial.multiplierBonus ?? 0} />
        </label>

        <div className="feedback-dialog-actions">
          <button type="button" className="btn" onClick={onClose}>Cancel</button>
          <button type="submit" className="btn primary">Save changes</button>
        </div>
      </form>
    </div>
  );
}
