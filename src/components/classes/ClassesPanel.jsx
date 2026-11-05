import React, { useState } from "react";
import { createClass, removeClass } from "../../services/classService";
import { ActivityCatalogueManager } from "../admin/ActivityCatalogueManager";

export default function ClassesPanel({
  loadingClasses,
  classesList,
  activeClassId,
  setActiveClassId,
  mode,
  db,
  newClassNameRef,
  confirmFn,
  alertFn,
  onRenameClass,
  onEndActivity,
}) {
  const [showActivityCatalogue, setShowActivityCatalogue] = useState(false);
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
                  <button className="btn" onClick={() => onRenameClass?.(c.id, c.name)}>
                    Edit
                  </button>
                  <button
                    className="btn"
                    onClick={() => removeClass(db, c.id, activeClassId, setActiveClassId, confirmFn)}
                  >
                    Delete
                  </button>
                  <button className="btn" onClick={() => onEndActivity?.(c.id, c.name)}>
                    End activity
                  </button>
                </>
              )}
            </div>
          ))}
        </div>
      ) : (
        <div className="muted">No classes yet</div>
      )}

      {mode === "admin" && !activeClassId && (
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
                if (!name) return alertFn("Enter class name");
                createClass(db, name, setActiveClassId);
                if (newClassNameRef.current) newClassNameRef.current.value = "";
              }}
            >
              Create
            </button>
          </div>
        </div>
      )}

      {mode === "admin" && activeClassId && (
        <div style={{ marginTop: 16 }}>
          <button
            className="btn"
            onClick={() => setShowActivityCatalogue(!showActivityCatalogue)}
            style={{
              width: "100%",
              padding: 10,
              borderRadius: 8,
              border: "1px solid #ddd",
              background: showActivityCatalogue ? "#eff6ff" : "#ffffff",
              color: showActivityCatalogue ? "#1d4ed8" : "#4b5563",
              fontWeight: showActivityCatalogue ? 700 : 500,
            }}
          >
            {showActivityCatalogue ? "▼" : "▶"} Activity Catalogue
          </button>

          {showActivityCatalogue && activeClassId && (
            <div style={{ marginTop: 12, border: "1px solid #e5e7eb", borderRadius: 8, background: "#fafbfc" }}>
              <ActivityCatalogueManager db={db} classId={activeClassId} alertFn={alertFn} />
            </div>
          )}
        </div>
      )}
    </aside>
  );
}
