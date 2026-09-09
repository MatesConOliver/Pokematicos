export default function BulkGiveModal({
  card,
  students,
  selectedStudentIds,
  onClose,
  onToggleStudent,
  onToggleSelectAll,
  onGive,
}) {
  if (!card) return null;

  const allStudentsSelected = selectedStudentIds.length === students.length;

  return (
    <div className="modal-backdrop" onClick={onClose}>
      <div className="modal" onClick={(event) => event.stopPropagation()}>
        <h3 style={{ marginTop: 0 }}>Give card</h3>
        <div style={{ fontWeight: 900, marginTop: 6 }}>{card.title}</div>
        <div className="muted" style={{ marginTop: 6 }}>
          Select students to receive this card. Points will be multiplied by each student's multiplier.
        </div>

        <div style={{ marginTop: 12, display: "flex", gap: 8, flexWrap: "wrap", alignItems: "center" }}>
          <button className="btn" onClick={onToggleSelectAll}>
            {allStudentsSelected ? "Deselect all" : "Select all"}
          </button>
          <div className="muted">{selectedStudentIds.length} selected</div>
        </div>

        <div
          style={{
            marginTop: 12,
            maxHeight: 320,
            overflow: "auto",
            border: "1px solid #eee",
            borderRadius: 12,
            padding: 10,
            background: "#fff",
          }}
        >
          {students.map((student) => (
            <label
              key={student.id}
              style={{
                display: "flex",
                alignItems: "center",
                gap: 10,
                padding: "8px 6px",
                borderBottom: "1px solid #f2f2f2",
              }}
            >
              <input
                type="checkbox"
                checked={selectedStudentIds.includes(student.id)}
                onChange={() => onToggleStudent(student.id)}
              />
              <span style={{ fontWeight: 800 }}>{student.name}</span>
              <span className="muted" style={{ marginLeft: "auto" }}>
                x{typeof student.multiplier === "number" ? student.multiplier : 1}
              </span>
            </label>
          ))}
          {students.length === 0 && <div className="muted">No students in this class yet.</div>}
        </div>

        <div style={{ marginTop: 12, display: "flex", gap: 8, flexWrap: "wrap" }}>
          <button className="btn" onClick={onClose}>
            Cancel
          </button>
          <button
            className="btn primary"
            disabled={selectedStudentIds.length === 0}
            onClick={onGive}
          >
            Give to selected
          </button>
        </div>
      </div>
    </div>
  );
}
