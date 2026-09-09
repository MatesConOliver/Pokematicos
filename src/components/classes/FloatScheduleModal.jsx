export default function FloatScheduleModal({ request, onClose, onSave }) {
  if (!request) return null;

  const initial = request.initial || { delayDays: 7, durationDays: 7 };

  function submit(event) {
    event.preventDefault();
    const form = new FormData(event.currentTarget);
    const delayDays = Number(form.get("delayDays"));
    const durationDays = Number(form.get("durationDays"));

    if (!Number.isInteger(delayDays) || delayDays < 0) return;
    if (!Number.isInteger(durationDays) || durationDays <= 0) return;

    onSave({ delayDays, durationDays });
  }

  return (
    <div className="modal-backdrop" onClick={onClose}>
      <form className="modal form-modal schedule-modal" onSubmit={submit} onClick={(event) => event.stopPropagation()}>
        <h3 style={{ marginTop: 0 }}>Floating emoji schedule</h3>
        <p className="muted">{request.message || "Choose when the floating emoji starts and how long it stays visible."}</p>

        <div className="schedule-fields">
          <label className="form-field">
            <span>Start after (days)</span>
            <input className="input" name="delayDays" type="number" min="0" step="1" defaultValue={initial.delayDays} autoFocus />
            <small className="muted">0 means today.</small>
          </label>
          <label className="form-field">
            <span>Duration (days)</span>
            <input className="input" name="durationDays" type="number" min="1" step="1" defaultValue={initial.durationDays} />
          </label>
        </div>

        <div className="feedback-dialog-actions">
          <button type="button" className="btn" onClick={onClose}>Cancel</button>
          <button type="submit" className="btn primary">Save schedule</button>
        </div>
      </form>
    </div>
  );
}
