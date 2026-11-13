import { isEvolutionCard, isCardUnlockedForStudent } from "../../services/cardEvolutionService";

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

  const isEvo = isEvolutionCard(card);
  const eligibleStudents = isEvo
    ? students.filter((s) => isCardUnlockedForStudent(s, card))
    : students;
  const allEligibleSelected =
    eligibleStudents.length > 0 &&
    eligibleStudents.every((s) => selectedStudentIds.includes(s.id));

  return (
    <div className="modal-backdrop" onClick={onClose}>
      <div className="modal" onClick={(event) => event.stopPropagation()}>
        <h3 style={{ marginTop: 0 }}>Give card</h3>
        <div style={{ fontWeight: 900, marginTop: 6 }}>{card.title}</div>
        <div className="muted" style={{ marginTop: 6 }}>
          Select students to receive this card. Points will be multiplied by each student's multiplier.
          {isEvo && (
            <div style={{ marginTop: 4, color: "#6d28d9", fontWeight: 700, fontSize: 12 }}>
              🧬 Carta de evolución: solo los alumnos que ya la hayan desbloqueado pueden recibirla.
            </div>
          )}
        </div>

        <div style={{ marginTop: 12, display: "flex", gap: 8, flexWrap: "wrap", alignItems: "center" }}>
          <button
            className="btn"
            onClick={() => onToggleSelectAll(eligibleStudents.map((s) => s.id))}
            disabled={eligibleStudents.length === 0}
          >
            {allEligibleSelected ? "Deselect all" : "Select all"}
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
          {students.map((student) => {
            const unlocked = isCardUnlockedForStudent(student, card);
            return (
              <label
                key={student.id}
                style={{
                  display: "flex",
                  alignItems: "center",
                  gap: 10,
                  padding: "8px 6px",
                  borderBottom: "1px solid #f2f2f2",
                  opacity: unlocked ? 1 : 0.55,
                  cursor: unlocked ? "pointer" : "not-allowed",
                }}
              >
                <input
                  type="checkbox"
                  disabled={!unlocked}
                  checked={selectedStudentIds.includes(student.id)}
                  onChange={() => unlocked && onToggleStudent(student.id)}
                />
                <span style={{ fontWeight: 800 }}>{student.name}</span>
                {!unlocked && (
                  <span
                    style={{
                      fontSize: 11,
                      padding: "1px 6px",
                      borderRadius: 999,
                      background: "#fee2e2",
                      color: "#b91c1c",
                      fontWeight: 700,
                    }}
                  >
                    🔒 Evolución bloqueada
                  </span>
                )}
                <span className="muted" style={{ marginLeft: "auto" }}>
                  x{typeof student.multiplier === "number" ? student.multiplier : 1}
                </span>
              </label>
            );
          })}
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
