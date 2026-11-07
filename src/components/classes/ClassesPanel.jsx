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
  authUser,
  newClassNameRef,
  confirmFn,
  alertFn,
  onRenameClass,
  onEndActivity,
}) {
  const [showActivityCatalogue, setShowActivityCatalogue] = useState(false);

  return (
    <aside style={{ border: "none", background: "transparent", padding: 0 }}>
      <h3 style={{ marginTop: 0 }}>
        <span className="column-title-pill">Classes</span>
      </h3>

      {loadingClasses ? (
        <div className="muted">Loading classes...</div>
      ) : classesList.length ? (
        <div style={{ display: "flex", flexDirection: "column", gap: 8 }}>
          {classesList.map((c) => {
            const isActive = c.id === activeClassId;
            return (
              <div key={c.id} style={{ display: "flex", gap: 8, alignItems: "center" }}>
                <button
                  style={{
                    flex: 1,
                    minWidth: 0,
                    textAlign: "left",
                    whiteSpace: "nowrap",
                    overflow: "hidden",
                    textOverflow: "ellipsis",
                    padding: "10px 14px",
                    borderRadius: 12,
                    cursor: "pointer",
                    fontWeight: isActive ? 700 : 600,
                    transition: "all 150ms ease",
                    background: isActive ? "#eff6ff" : "#ffffff",
                    border: isActive ? "1px solid #93c5fd" : "1px solid #e2e8f0",
                    color: isActive ? "#1d4ed8" : "#1e293b",
                    boxShadow: "0 2px 6px rgba(15, 23, 42, 0.05)",
                  }}
                  onClick={() => setActiveClassId((prev) => (prev === c.id ? null : c.id))}
                  title={c.name}
                >
                  {c.name}
                </button>

                {mode === "admin" && (
                  <div style={{ display: "flex", gap: 6, flexShrink: 0, alignItems: "center" }}>
                    <button
                      className="btn"
                      style={{
                        whiteSpace: "nowrap",
                        background: "#ffffff",
                        border: "1px solid #e2e8f0",
                        color: "#1e293b",
                      }}
                      onClick={() => onRenameClass?.(c.id, c.name)}
                    >
                      Edit
                    </button>
                    <button
                      className="btn"
                      style={{
                        whiteSpace: "nowrap",
                        background: "#ffffff",
                        border: "1px solid #fecaca",
                        color: "#dc2626",
                      }}
                      onClick={() => removeClass(db, c.id, activeClassId, setActiveClassId, confirmFn)}
                    >
                      Delete
                    </button>
                    <button
                      className="btn"
                      style={{
                        whiteSpace: "nowrap",
                        background: "#ffffff",
                        border: "1px solid #e2e8f0",
                        color: "#1e293b",
                      }}
                      onClick={() => onEndActivity?.(c.id, c.name)}
                    >
                      End activity
                    </button>
                  </div>
                )}
              </div>
            );
          })}
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
                createClass(db, name, setActiveClassId, alertFn, authUser?.uid);
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
