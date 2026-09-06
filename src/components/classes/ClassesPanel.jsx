import React from "react";
import { createClass, editClassName, removeClass } from "../../services/classService";

export default function ClassesPanel({
  loadingClasses,
  classesList,
  activeClassId,
  setActiveClassId,
  mode,
  db,
  newClassNameRef,
}) {
  return (
    <aside style={{ border: "1px solid #eee", padding: 12, borderRadius: 10 }}>
      <h3 style={{ marginTop: 0 }}>
        <span className="column-title-pill">Classes</span>
      </h3>

      {loadingClasses ? (
        <div className="muted">Loading classes...</div>
      ) : classesList.length ? (
        <div style={{ display: "flex", flexDirection: "column", gap: 8 }}>
          {classesList.map((c) => (
            <div key={c.id} style={{ display: "flex", gap: 8, alignItems: "center" }}>
              <button
                className="btn"
                style={{
                  flex: 1,
                  textAlign: "left",
                  background: c.id === activeClassId ? "#eef" : "white",
                }}
                onClick={() => setActiveClassId((prev) => (prev === c.id ? null : c.id))}
              >
                {c.name}
              </button>

              {mode === "admin" && (
                <>
                  <button className="btn" onClick={() => editClassName(db, c.id, classesList)}>
                    Edit
                  </button>
                  <button
                    className="btn"
                    onClick={() => removeClass(db, c.id, activeClassId, setActiveClassId)}
                  >
                    Delete
                  </button>
                </>
              )}
            </div>
          ))}
        </div>
      ) : (
        <div className="muted">No classes yet</div>
      )}

      {mode === "admin" && (
        <div style={{ marginTop: 16 }}>
          <h4 style={{ margin: "10px 0" }}>Add class</h4>
          <div style={{ display: "flex", gap: 8 }}>
            <input
              className="input"
              ref={newClassNameRef}
              placeholder="Class name"
              style={{ flex: 1, padding: 8, borderRadius: 8, border: "1px solid #ddd" }}
            />
            <button
              className="btn primary"
              onClick={() => {
                const name = newClassNameRef.current?.value?.trim();
                if (!name) return alert("Enter class name");
                createClass(db, name, setActiveClassId);
                if (newClassNameRef.current) newClassNameRef.current.value = "";
              }}
            >
              Create
            </button>
          </div>
        </div>
      )}
    </aside>
  );
}
