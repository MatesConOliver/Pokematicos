/**
 * Activity Catalogue Management Component
 *
 * Admin interface for adding, editing, disabling, and deleting activities
 */

import React, { useState, useEffect, useCallback, useMemo } from "react";
import { collection, getDocs } from "firebase/firestore";
import {
  getActivityCatalogue,
  addActivityToCatalogue,
  bulkAddActivitiesToCatalogue,
  updateActivityInCatalogue,
  deleteActivityFromCatalogue,
} from "../../services/rewardCodeService.js";
import { generateRewardCode } from "../../utils/rewardCodeUtils.js";
import { PREDEFINED_ACTIVITY_PACKS } from "../../constants/activityPacks.js";

export function ActivityCatalogueManager({ db, classId, alertFn }) {
  const [activities, setActivities] = useState([]);
  const [cards, setCards] = useState([]);
  const [students, setStudents] = useState([]);
  const [isLoading, setIsLoading] = useState(true);
  const [isAdding, setIsAdding] = useState(false);
  const [isBulkOpen, setIsBulkOpen] = useState(false);
  const [bulkRows, setBulkRows] = useState([]);
  const [jsonImportOpen, setJsonImportOpen] = useState(false);
  const [jsonImportText, setJsonImportText] = useState("");
  const [codeTargetActivity, setCodeTargetActivity] = useState(null);
  const [selectedStudentId, setSelectedStudentId] = useState("");
  const [copiedStudentCode, setCopiedStudentCode] = useState(false);
  const [editingActivity, setEditingActivity] = useState(null);
  const [selectedSourceFilter, setSelectedSourceFilter] = useState("ALL");
  const [message, setMessage] = useState(null);
  const [isSaving, setIsSaving] = useState(false);

  // Form state for new activity
  const [newFormData, setNewFormData] = useState({
    sourceId: "",
    activityId: "",
    name: "",
    description: "",
    pointsAwarded: 10,
    rewardType: "points",
    cardId: "",
    isActive: true,
  });

  // Form state for editing existing activity
  const [editFormData, setEditFormData] = useState({
    name: "",
    description: "",
    pointsAwarded: 10,
    rewardType: "points",
    cardId: "",
    isActive: true,
  });

  // Load activities from catalogue
  const loadActivities = useCallback(async () => {
    setIsLoading(true);
    try {
      const data = await getActivityCatalogue({ db, classId });
      setActivities(data);
    } catch (err) {
      console.error("Failed to load activities:", err);
      setMessage({ type: "error", text: "Failed to load activities." });
    } finally {
      setIsLoading(false);
    }
  }, [db, classId]);

  // Load available cards
  const loadCards = useCallback(async () => {
    try {
      const cardsRef = collection(db, `classes/${classId}/cards`);
      const snapshot = await getDocs(cardsRef);
      const cardsData = snapshot.docs.map((doc) => {
        const d = doc.data();
        return {
          id: doc.id,
          name: d.title || d.name || doc.id,
          title: d.title || d.name || doc.id,
          imageURL: d.imageURL || "",
          ...d,
        };
      });
      setCards(cardsData);
    } catch (err) {
      console.error("Failed to load cards:", err);
    }
  }, [db, classId]);

  // Load available students for teacher code issuance (e.g., Probab/selJus)
  const loadStudents = useCallback(async () => {
    try {
      const studentsRef = collection(db, `classes/${classId}/students`);
      const snapshot = await getDocs(studentsRef);
      const list = snapshot.docs
        .map((doc) => {
          const d = doc.data() || {};
          return {
            id: doc.id,
            name: d.name || doc.id,
          };
        })
        .sort((a, b) => a.name.localeCompare(b.name));
      setStudents(list);
    } catch (err) {
      console.error("Failed to load students:", err);
    }
  }, [db, classId]);

  useEffect(() => {
    loadActivities();
    loadCards();
    loadStudents();
  }, [loadActivities, loadCards, loadStudents]);

  // Card lookup map
  const cardsMap = useMemo(() => {
    const map = new Map();
    cards.forEach((c) => map.set(c.id, c));
    return map;
  }, [cards]);

  const resetNewForm = () => {
    setNewFormData({
      sourceId: "",
      activityId: "",
      name: "",
      description: "",
      pointsAwarded: 10,
      rewardType: "points",
      cardId: "",
      isActive: true,
    });
  };

  // Add new activity
  const handleAddActivity = async (e) => {
    e.preventDefault();

    if (!newFormData.sourceId.trim() || !newFormData.activityId.trim()) {
      setMessage({ type: "error", text: "Source ID and Activity ID are required." });
      return;
    }

    if (
      (newFormData.rewardType === "card" || newFormData.rewardType === "both") &&
      !newFormData.cardId.trim()
    ) {
      setMessage({ type: "error", text: "Please select a card for card rewards." });
      return;
    }

    setIsSaving(true);
    try {
      await addActivityToCatalogue({
        db,
        classId,
        activity: {
          ...newFormData,
          pointsAwarded: Number(newFormData.pointsAwarded) || 0,
        },
      });

      setMessage({ type: "success", text: "Activity added successfully!" });
      resetNewForm();
      setIsAdding(false);
      await loadActivities();
    } catch (err) {
      console.error("Failed to add activity:", err);
      setMessage({
        type: "error",
        text: `Failed to add activity: ${err.message || "Unknown error"}`,
      });
    } finally {
      setIsSaving(false);
    }
  };

  // Open edit modal for an activity
  const handleStartEdit = (activity) => {
    setEditingActivity(activity);
    setEditFormData({
      name: activity.name || "",
      description: activity.description || "",
      pointsAwarded: Number(activity.pointsAwarded) || 0,
      rewardType: activity.rewardType || "points",
      cardId: activity.cardId || "",
      isActive: activity.isActive !== false,
    });
    setMessage(null);
  };

  // Save edits to existing activity
  const handleSaveEdit = async (e) => {
    e.preventDefault();
    if (!editingActivity) return;

    if (
      (editFormData.rewardType === "card" || editFormData.rewardType === "both") &&
      !editFormData.cardId?.trim()
    ) {
      setMessage({ type: "error", text: "Please select a card for card rewards." });
      return;
    }

    setIsSaving(true);
    try {
      await updateActivityInCatalogue({
        db,
        classId,
        sourceId: editingActivity.sourceId,
        activityId: editingActivity.activityId,
        updates: {
          name: editFormData.name.trim() || `${editingActivity.sourceId}/${editingActivity.activityId}`,
          description: editFormData.description.trim(),
          pointsAwarded: Number(editFormData.pointsAwarded) || 0,
          rewardType: editFormData.rewardType,
          cardId:
            editFormData.rewardType === "points" ? null : editFormData.cardId,
          isActive: editFormData.isActive,
        },
      });

      setMessage({ type: "success", text: `Activity "${editFormData.name || editingActivity.activityId}" updated successfully!` });
      setEditingActivity(null);
      await loadActivities();
    } catch (err) {
      console.error("Failed to update activity:", err);
      setMessage({
        type: "error",
        text: `Failed to update activity: ${err.message || "Unknown error"}`,
      });
    } finally {
      setIsSaving(false);
    }
  };

  // Delete activity permanently
  const handleDeleteActivity = async (activity) => {
    const activityName = activity.name || `${activity.sourceId}/${activity.activityId}`;
    const confirmed = window.confirm(
      `Are you sure you want to permanently delete the activity "${activityName}"?\n\nStudents will no longer be able to redeem this code.`
    );
    if (!confirmed) return;

    setIsSaving(true);
    try {
      await deleteActivityFromCatalogue({
        db,
        classId,
        sourceId: activity.sourceId,
        activityId: activity.activityId,
      });

      setMessage({
        type: "success",
        text: `Activity "${activityName}" deleted successfully!`,
      });
      if (editingActivity?.id === activity.id) {
        setEditingActivity(null);
      }
      await loadActivities();
    } catch (err) {
      console.error("Failed to delete activity:", err);
      setMessage({
        type: "error",
        text: `Failed to delete activity: ${err.message || "Unknown error"}`,
      });
    } finally {
      setIsSaving(false);
    }
  };

  // Toggle active status
  const handleToggleActive = async (activity) => {
    try {
      await updateActivityInCatalogue({
        db,
        classId,
        sourceId: activity.sourceId,
        activityId: activity.activityId,
        updates: { isActive: !activity.isActive },
      });

      setMessage({
        type: "success",
        text: `Activity ${!activity.isActive ? "enabled" : "disabled"}.`,
      });
      await loadActivities();
    } catch (err) {
      console.error("Failed to toggle activity:", err);
      setMessage({
        type: "error",
        text: `Failed to update activity: ${err.message || "Unknown error"}`,
      });
    }
  };

  // Load predefined activity pack into editable bulk table
  const handleLoadPack = (packKeys) => {
    const existingKeys = new Set(activities.map((a) => `${a.sourceId}_${a.activityId}`));
    const merged = [];
    for (const key of packKeys) {
      const pack = PREDEFINED_ACTIVITY_PACKS[key];
      if (!pack) continue;
      for (const act of pack.activities) {
        merged.push({
          ...act,
          selected: true,
          existsInClass: existingKeys.has(`${act.sourceId}_${act.activityId}`),
        });
      }
    }
    setBulkRows(merged);
    setJsonImportOpen(false);
    setMessage(null);
  };

  const handleLoadJsonPack = () => {
    try {
      const parsed = JSON.parse(jsonImportText);
      const arr = Array.isArray(parsed) ? parsed : Array.isArray(parsed?.activities) ? parsed.activities : null;
      if (!arr || arr.length === 0) {
        setMessage({ type: "error", text: "JSON must be a non-empty array of activities (or { activities: [...] })." });
        return;
      }
      const existingKeys = new Set(activities.map((a) => `${a.sourceId}_${a.activityId}`));
      const mapped = arr.map((item) => {
        const sourceId = String(item.sourceId || "").trim().slice(0, 6);
        const activityId = String(item.activityId || "").trim().slice(0, 6);
        return {
          sourceId,
          activityId,
          name: String(item.name || "").trim() || `${sourceId}/${activityId}`,
          description: String(item.description || "").trim(),
          pointsAwarded: Math.max(0, Number(item.pointsAwarded) || 0),
          rewardType: ["points", "card", "both"].includes(item.rewardType) ? item.rewardType : "points",
          cardId: String(item.cardId || "").trim(),
          isActive: item.isActive !== false,
          selected: true,
          existsInClass: existingKeys.has(`${sourceId}_${activityId}`),
        };
      });
      setBulkRows(mapped);
      setJsonImportOpen(false);
      setMessage(null);
    } catch (err) {
      setMessage({ type: "error", text: `Invalid JSON: ${err.message}` });
    }
  };

  const handleBulkRowChange = (idx, patch) => {
    setBulkRows((prev) =>
      prev.map((row, i) => (i === idx ? { ...row, ...patch } : row))
    );
  };

  const handleBulkSubmit = async () => {
    const selected = bulkRows.filter((r) => r.selected);
    if (selected.length === 0) {
      setMessage({ type: "error", text: "Select at least one activity to upload." });
      return;
    }

    setIsSaving(true);
    try {
      const { count } = await bulkAddActivitiesToCatalogue({
        db,
        classId,
        activities: selected,
      });
      setMessage({
        type: "success",
        text: `Uploaded ${count} activities to this class successfully!`,
      });
      setIsBulkOpen(false);
      setBulkRows([]);
      await loadActivities();
    } catch (err) {
      console.error("Bulk upload failed:", err);
      setMessage({
        type: "error",
        text: `Bulk upload failed: ${err.message || "Unknown error"}`,
      });
    } finally {
      setIsSaving(false);
    }
  };

  const selectedBulkRows = useMemo(() => bulkRows.filter((r) => r.selected), [bulkRows]);
  const selectedBulkTotalPoints = useMemo(
    () => selectedBulkRows.reduce((sum, r) => sum + (Number(r.pointsAwarded) || 0), 0),
    [selectedBulkRows]
  );

  const generatedStudentCode = useMemo(() => {
    if (!codeTargetActivity || !selectedStudentId) return "";
    try {
      return generateRewardCode(
        selectedStudentId,
        codeTargetActivity.sourceId,
        codeTargetActivity.activityId
      );
    } catch {
      return "";
    }
  }, [codeTargetActivity, selectedStudentId]);

  // Distinct Source IDs with counts & total points for filtering
  const sourceOptions = useMemo(() => {
    const map = new Map();
    for (const act of activities) {
      const src = act.sourceId || "(no source)";
      const cur = map.get(src) || { sourceId: src, count: 0, totalPoints: 0 };
      cur.count += 1;
      cur.totalPoints += Number(act.pointsAwarded) || 0;
      map.set(src, cur);
    }
    return Array.from(map.values()).sort((a, b) => a.sourceId.localeCompare(b.sourceId));
  }, [activities]);

  // Keep filter valid if all activities of a source are deleted
  const effectiveSourceFilter =
    selectedSourceFilter !== "ALL" && !sourceOptions.some((s) => s.sourceId === selectedSourceFilter)
      ? "ALL"
      : selectedSourceFilter;

  const filteredActivities = useMemo(() => {
    if (effectiveSourceFilter === "ALL") return activities;
    return activities.filter((a) => (a.sourceId || "(no source)") === effectiveSourceFilter);
  }, [activities, effectiveSourceFilter]);

  const filteredTotalPoints = useMemo(
    () => filteredActivities.reduce((sum, a) => sum + (Number(a.pointsAwarded) || 0), 0),
    [filteredActivities]
  );

  if (isLoading) {
    return (
      <div style={{ padding: 16, textAlign: "center", color: "#6b7280" }}>
        Loading activity catalogue...
      </div>
    );
  }

  return (
    <div style={{ display: "flex", flexDirection: "column", gap: 16 }}>
      {/* Header */}
      <div style={{ display: "flex", justifyContent: "space-between", alignItems: "center", flexWrap: "wrap", gap: 10 }}>
        <div>
          <h3 style={{ margin: 0, fontSize: 18, fontWeight: 700, color: "#1f2937" }}>
            Activity Catalogue
          </h3>
          <p style={{ margin: "2px 0 0", fontSize: 13, color: "#6b7280" }}>
            Manage activities, points, and card rewards claimable with codes.
          </p>
        </div>
        <div style={{ display: "flex", gap: 8, flexWrap: "wrap" }}>
          <button
            type="button"
            onClick={() => {
              const next = !isBulkOpen;
              setIsBulkOpen(next);
              if (next) {
                setIsAdding(false);
                setEditingActivity(null);
              }
            }}
            style={{
              padding: "8px 14px",
              background: isBulkOpen ? "#64748b" : "#0f766e",
              color: "#ffffff",
              border: "none",
              borderRadius: 8,
              cursor: "pointer",
              fontSize: 13,
              fontWeight: 700,
              display: "inline-flex",
              alignItems: "center",
              gap: 6,
            }}
          >
            {isBulkOpen ? "✕ Close Bulk" : "📦 Bulk Upload / Presets"}
          </button>
          <button
            type="button"
            onClick={() => {
              const next = !isAdding;
              setIsAdding(next);
              if (next) {
                setEditingActivity(null);
                setIsBulkOpen(false);
              }
            }}
            style={{
              padding: "8px 16px",
              background: isAdding ? "#64748b" : "#2563eb",
              color: "#ffffff",
              border: "none",
              borderRadius: 8,
              cursor: "pointer",
              fontSize: 13,
              fontWeight: 700,
              display: "inline-flex",
              alignItems: "center",
              gap: 6,
            }}
          >
            {isAdding ? "✕ Cancel" : "+ Add Activity"}
          </button>
        </div>
      </div>

      {/* Message Banner */}
      {message && (
        <div
          style={{
            padding: "10px 14px",
            borderRadius: 8,
            fontSize: 13,
            fontWeight: 600,
            background:
              message.type === "success"
                ? "#dcfce7"
                : message.type === "error"
                  ? "#fee2e2"
                  : "#dbeafe",
            color:
              message.type === "success"
                ? "#166534"
                : message.type === "error"
                  ? "#991b1b"
                  : "#1e40af",
            border: `1px solid ${
              message.type === "success"
                ? "#bbf7d0"
                : message.type === "error"
                  ? "#fecaca"
                  : "#93c5fd"
            }`,
            display: "flex",
            justifyContent: "space-between",
            alignItems: "center",
          }}
        >
          <span>{message.text}</span>
          <button
            type="button"
            onClick={() => setMessage(null)}
            style={{
              background: "transparent",
              border: "none",
              color: "inherit",
              cursor: "pointer",
              fontWeight: 800,
            }}
          >
            ✕
          </button>
        </div>
      )}

      {/* Teacher Student Code Modal / Overlay */}
      {codeTargetActivity && (
        <div
          style={{
            border: "2px solid #0d9488",
            borderRadius: 14,
            padding: 18,
            background: "#f0fdfa",
            boxShadow: "0 10px 25px -5px rgba(13, 148, 136, 0.16)",
          }}
        >
          <div style={{ display: "flex", justifyContent: "space-between", alignItems: "center", marginBottom: 12 }}>
            <div>
              <h4 style={{ margin: 0, fontSize: 16, fontWeight: 800, color: "#134e4a" }}>
                🔑 Issue Student Activity Code
              </h4>
              <div style={{ fontSize: 12, color: "#0f766e", marginTop: 2 }}>
                <strong>{codeTargetActivity.name || `${codeTargetActivity.sourceId}/${codeTargetActivity.activityId}`}</strong>{" "}
                · <code>{codeTargetActivity.sourceId} → {codeTargetActivity.activityId}</code> (+{codeTargetActivity.pointsAwarded || 0} pts)
              </div>
            </div>
            <button
              type="button"
              onClick={() => {
                setCodeTargetActivity(null);
                setCopiedStudentCode(false);
              }}
              style={{
                background: "transparent",
                border: "none",
                fontSize: 18,
                color: "#0f766e",
                cursor: "pointer",
                fontWeight: 700,
              }}
            >
              ✕
            </button>
          </div>

          <div style={{ display: "flex", flexDirection: "column", gap: 10 }}>
            <div>
              <label style={{ display: "block", fontSize: 12, fontWeight: 700, color: "#134e4a", marginBottom: 4 }}>
                Select Student from Current Class
              </label>
              <select
                value={selectedStudentId}
                onChange={(e) => {
                  setSelectedStudentId(e.target.value);
                  setCopiedStudentCode(false);
                }}
                style={{
                  width: "100%",
                  padding: "8px 12px",
                  border: "1px solid #99f6e4",
                  borderRadius: 6,
                  fontSize: 13,
                  background: "#ffffff",
                }}
              >
                <option value="">-- Choose a student --</option>
                {students.map((st) => (
                  <option key={st.id} value={st.id}>
                    {st.name} ({st.id})
                  </option>
                ))}
              </select>
            </div>

            {generatedStudentCode && (
              <div
                style={{
                  background: "#ffffff",
                  border: "1px solid #5eead4",
                  borderRadius: 10,
                  padding: 12,
                  display: "flex",
                  flexDirection: "column",
                  gap: 8,
                }}
              >
                <div
                  style={{
                    fontFamily: "monospace",
                    fontSize: 15,
                    fontWeight: 800,
                    color: "#0f172a",
                    letterSpacing: "0.04em",
                    wordBreak: "break-all",
                    textAlign: "center",
                    padding: "6px 4px",
                  }}
                >
                  {generatedStudentCode}
                </div>
                <div style={{ display: "flex", justifyContent: "space-between", alignItems: "center", gap: 8, flexWrap: "wrap" }}>
                  <span style={{ fontSize: 11, color: "#475569" }}>
                    Student can redeem this code in Pokemáticos → Redeem Achievement Code.
                  </span>
                  <button
                    type="button"
                    onClick={() => {
                      if (navigator.clipboard?.writeText) {
                        navigator.clipboard.writeText(generatedStudentCode).then(() => setCopiedStudentCode(true));
                      }
                    }}
                    style={{
                      padding: "7px 14px",
                      background: "#0d9488",
                      color: "#ffffff",
                      border: "none",
                      borderRadius: 6,
                      cursor: "pointer",
                      fontSize: 12,
                      fontWeight: 700,
                    }}
                  >
                    {copiedStudentCode ? "✓ Copied!" : "Copy Code"}
                  </button>
                </div>
              </div>
            )}
          </div>
        </div>
      )}

      {/* Bulk Upload Panel */}
      {isBulkOpen && (
        <div
          style={{
            border: "2px solid #0f766e",
            borderRadius: 14,
            padding: 16,
            background: "#f8fafc",
            display: "flex",
            flexDirection: "column",
            gap: 12,
          }}
        >
          <div style={{ display: "flex", justifyContent: "space-between", alignItems: "center", flexWrap: "wrap", gap: 8 }}>
            <div>
              <h4 style={{ margin: 0, fontSize: 15, fontWeight: 800, color: "#0f172a" }}>
                📦 Bulk Upload Activities to Selected Class
              </h4>
              <div style={{ fontSize: 12, color: "#475569" }}>
                Load a predefined app pack or paste JSON, adjust points/cards if needed, and upload in one batch.
              </div>
            </div>
            <div style={{ display: "flex", gap: 6, flexWrap: "wrap" }}>
              <button
                type="button"
                onClick={() => handleLoadPack(["estadi"])}
                style={{
                  padding: "7px 12px",
                  background: "#eff6ff",
                  color: "#1d4ed8",
                  border: "1px solid #bfdbfe",
                  borderRadius: 6,
                  cursor: "pointer",
                  fontSize: 12,
                  fontWeight: 700,
                }}
              >
                Statistics ({PREDEFINED_ACTIVITY_PACKS.estadi.activities.length} ·{" "}
                {PREDEFINED_ACTIVITY_PACKS.estadi.activities.reduce((s, a) => s + a.pointsAwarded, 0)} pts)
              </button>
              <button
                type="button"
                onClick={() => handleLoadPack(["probab"])}
                style={{
                  padding: "7px 12px",
                  background: "#f0fdfa",
                  color: "#0f766e",
                  border: "1px solid #99f6e4",
                  borderRadius: 6,
                  cursor: "pointer",
                  fontSize: 12,
                  fontWeight: 700,
                }}
              >
                Probability ({PREDEFINED_ACTIVITY_PACKS.probab.activities.length} ·{" "}
                {PREDEFINED_ACTIVITY_PACKS.probab.activities.reduce((s, a) => s + a.pointsAwarded, 0)} pts)
              </button>
              <button
                type="button"
                onClick={() => handleLoadPack(["estadi", "probab"])}
                style={{
                  padding: "7px 12px",
                  background: "#f5f3ff",
                  color: "#6d28d9",
                  border: "1px solid #ddd6fe",
                  borderRadius: 6,
                  cursor: "pointer",
                  fontSize: 12,
                  fontWeight: 700,
                }}
              >
                Both 4º Packs (
                {PREDEFINED_ACTIVITY_PACKS.estadi.activities.length +
                  PREDEFINED_ACTIVITY_PACKS.probab.activities.length}{" "}
                ·{" "}
                {PREDEFINED_ACTIVITY_PACKS.estadi.activities.reduce((s, a) => s + a.pointsAwarded, 0) +
                  PREDEFINED_ACTIVITY_PACKS.probab.activities.reduce((s, a) => s + a.pointsAwarded, 0)}{" "}
                pts)
              </button>
              <button
                type="button"
                onClick={() => handleLoadPack(["ration"])}
                style={{
                  padding: "7px 12px",
                  background: "#fdf4ff",
                  color: "#7e22ce",
                  border: "1px solid #e9d5ff",
                  borderRadius: 6,
                  cursor: "pointer",
                  fontSize: 12,
                  fontWeight: 700,
                }}
              >
                Rationals 3º ESO ({PREDEFINED_ACTIVITY_PACKS.ration.activities.length} ·{" "}
                {PREDEFINED_ACTIVITY_PACKS.ration.activities.reduce((s, a) => s + a.pointsAwarded, 0)} pts)
              </button>
              <button
                type="button"
                onClick={() => setJsonImportOpen((v) => !v)}
                style={{
                  padding: "7px 12px",
                  background: "#ffffff",
                  color: "#334155",
                  border: "1px solid #cbd5e1",
                  borderRadius: 6,
                  cursor: "pointer",
                  fontSize: 12,
                  fontWeight: 700,
                }}
              >
                {jsonImportOpen ? "Hide JSON" : "Paste JSON"}
              </button>
            </div>
          </div>

          {jsonImportOpen && (
            <div style={{ display: "flex", flexDirection: "column", gap: 8 }}>
              <textarea
                value={jsonImportText}
                onChange={(e) => setJsonImportText(e.target.value)}
                placeholder='[{"sourceId":"Estadi","activityId":"expMue","name":"...","pointsAwarded":1,"rewardType":"points"}]'
                style={{
                  width: "100%",
                  minHeight: 88,
                  padding: 10,
                  borderRadius: 6,
                  border: "1px solid #cbd5e1",
                  fontFamily: "monospace",
                  fontSize: 12,
                  background: "#ffffff",
                }}
              />
              <div>
                <button
                  type="button"
                  onClick={handleLoadJsonPack}
                  style={{
                    padding: "7px 14px",
                    background: "#334155",
                    color: "#ffffff",
                    border: "none",
                    borderRadius: 6,
                    cursor: "pointer",
                    fontSize: 12,
                    fontWeight: 700,
                  }}
                >
                  Parse JSON into Preview
                </button>
              </div>
            </div>
          )}

          {bulkRows.length > 0 && (
            <>
              <div style={{ display: "flex", justifyContent: "space-between", alignItems: "center", flexWrap: "wrap", gap: 8 }}>
                <div style={{ display: "flex", gap: 10, alignItems: "center", fontSize: 12 }}>
                  <button
                    type="button"
                    onClick={() => setBulkRows((prev) => prev.map((r) => ({ ...r, selected: true })))}
                    style={{ background: "none", border: "none", color: "#2563eb", cursor: "pointer", fontWeight: 700, padding: 0 }}
                  >
                    Select all
                  </button>
                  <button
                    type="button"
                    onClick={() => setBulkRows((prev) => prev.map((r) => ({ ...r, selected: false })))}
                    style={{ background: "none", border: "none", color: "#64748b", cursor: "pointer", fontWeight: 700, padding: 0 }}
                  >
                    Select none
                  </button>
                  <span style={{ color: "#334155", fontWeight: 700 }}>
                    {selectedBulkRows.length}/{bulkRows.length} selected · Total: {selectedBulkTotalPoints} pts
                  </span>
                </div>
                <button
                  type="button"
                  disabled={isSaving || selectedBulkRows.length === 0}
                  onClick={handleBulkSubmit}
                  style={{
                    padding: "8px 16px",
                    background: "#10b981",
                    color: "#ffffff",
                    border: "none",
                    borderRadius: 6,
                    cursor: isSaving || selectedBulkRows.length === 0 ? "not-allowed" : "pointer",
                    fontSize: 13,
                    fontWeight: 700,
                    opacity: isSaving || selectedBulkRows.length === 0 ? 0.65 : 1,
                  }}
                >
                  {isSaving ? "Uploading..." : `Upload ${selectedBulkRows.length} Activities to Class`}
                </button>
              </div>

              <div style={{ maxHeight: 380, overflow: "auto", border: "1px solid #e2e8f0", borderRadius: 8, background: "#ffffff" }}>
                <table style={{ width: "100%", borderCollapse: "collapse", fontSize: 12 }}>
                  <thead>
                    <tr style={{ background: "#f1f5f9", textAlign: "left", color: "#334155" }}>
                      <th style={{ padding: "8px 6px" }}>Use</th>
                      <th style={{ padding: "8px 6px" }}>ID</th>
                      <th style={{ padding: "8px 6px" }}>Name</th>
                      <th style={{ padding: "8px 6px", width: 72 }}>Pts</th>
                      <th style={{ padding: "8px 6px", width: 112 }}>Reward</th>
                      <th style={{ padding: "8px 6px" }}>Card</th>
                      <th style={{ padding: "8px 6px" }}>Active</th>
                    </tr>
                  </thead>
                  <tbody>
                    {bulkRows.map((row, idx) => (
                      <tr key={`${row.sourceId}_${row.activityId}_${idx}`} style={{ borderTop: "1px solid #e2e8f0" }}>
                        <td style={{ padding: "6px" }}>
                          <input
                            type="checkbox"
                            checked={row.selected}
                            onChange={(e) => handleBulkRowChange(idx, { selected: e.target.checked })}
                          />
                        </td>
                        <td style={{ padding: "6px", fontFamily: "monospace", whiteSpace: "nowrap" }}>
                          {row.sourceId}/{row.activityId}
                          {row.existsInClass && (
                            <span
                              title="Already exists in this class and will be updated"
                              style={{
                                marginLeft: 4,
                                fontSize: 10,
                                background: "#fef3c7",
                                color: "#92400e",
                                padding: "1px 4px",
                                borderRadius: 4,
                                fontFamily: "sans-serif",
                              }}
                            >
                              update
                            </span>
                          )}
                        </td>
                        <td style={{ padding: "6px" }}>
                          <input
                            type="text"
                            value={row.name}
                            onChange={(e) => handleBulkRowChange(idx, { name: e.target.value })}
                            style={{ width: "100%", minWidth: 160, padding: "4px 6px", border: "1px solid #cbd5e1", borderRadius: 4, fontSize: 12 }}
                          />
                        </td>
                        <td style={{ padding: "6px" }}>
                          <input
                            type="number"
                            min="0"
                            value={row.pointsAwarded}
                            onChange={(e) => handleBulkRowChange(idx, { pointsAwarded: Math.max(0, Number(e.target.value) || 0) })}
                            style={{ width: 62, padding: "4px 6px", border: "1px solid #cbd5e1", borderRadius: 4, fontSize: 12 }}
                          />
                        </td>
                        <td style={{ padding: "6px" }}>
                          <select
                            value={row.rewardType}
                            onChange={(e) =>
                              handleBulkRowChange(idx, {
                                rewardType: e.target.value,
                                cardId: e.target.value === "points" ? "" : row.cardId,
                              })
                            }
                            style={{ width: "100%", padding: "4px 6px", border: "1px solid #cbd5e1", borderRadius: 4, fontSize: 12 }}
                          >
                            <option value="points">Points</option>
                            <option value="card">Card</option>
                            <option value="both">Both</option>
                          </select>
                        </td>
                        <td style={{ padding: "6px" }}>
                          {row.rewardType === "points" ? (
                            <span style={{ color: "#94a3b8" }}>—</span>
                          ) : (
                            <select
                              value={row.cardId}
                              onChange={(e) => handleBulkRowChange(idx, { cardId: e.target.value })}
                              style={{
                                width: "100%",
                                minWidth: 120,
                                padding: "4px 6px",
                                border: !row.cardId ? "1px solid #ef4444" : "1px solid #cbd5e1",
                                borderRadius: 4,
                                fontSize: 12,
                              }}
                            >
                              <option value="">-- Choose card --</option>
                              {cards.map((c) => (
                                <option key={c.id} value={c.id}>
                                  {c.title || c.name}
                                </option>
                              ))}
                            </select>
                          )}
                        </td>
                        <td style={{ padding: "6px", textAlign: "center" }}>
                          <input
                            type="checkbox"
                            checked={row.isActive}
                            onChange={(e) => handleBulkRowChange(idx, { isActive: e.target.checked })}
                          />
                        </td>
                      </tr>
                    ))}
                  </tbody>
                </table>
              </div>
            </>
          )}
        </div>
      )}

      {/* Edit Activity Modal / Overlay */}
      {editingActivity && (
        <div
          style={{
            border: "2px solid #3b82f6",
            borderRadius: 14,
            padding: 18,
            background: "#eff6ff",
            boxShadow: "0 10px 25px -5px rgba(59, 130, 246, 0.15)",
          }}
        >
          <div style={{ display: "flex", justifyContent: "space-between", alignItems: "center", marginBottom: 14 }}>
            <div>
              <span style={{ fontSize: 11, fontWeight: 700, textTransform: "uppercase", color: "#2563eb", letterSpacing: "0.05em" }}>
                Editing Activity
              </span>
              <h4 style={{ margin: "2px 0 0", fontSize: 16, fontWeight: 800, color: "#1e3a8a" }}>
                {editingActivity.name || `${editingActivity.sourceId}/${editingActivity.activityId}`}
              </h4>
              <span style={{ fontSize: 12, color: "#64748b", fontFamily: "monospace" }}>
                {editingActivity.sourceId} → {editingActivity.activityId}
              </span>
            </div>
            <button
              type="button"
              onClick={() => setEditingActivity(null)}
              style={{
                background: "#ffffff",
                border: "1px solid #cbd5e1",
                borderRadius: 6,
                padding: "4px 10px",
                cursor: "pointer",
                fontSize: 12,
                fontWeight: 600,
                color: "#475569",
              }}
            >
              Cancel
            </button>
          </div>

          <form onSubmit={handleSaveEdit} style={{ display: "flex", flexDirection: "column", gap: 12 }}>
            <div>
              <label style={{ display: "block", fontSize: 12, fontWeight: 700, color: "#1e293b", marginBottom: 4 }}>
                Display Name
              </label>
              <input
                type="text"
                placeholder="e.g., Algebra Challenge 1"
                value={editFormData.name}
                onChange={(e) => setEditFormData({ ...editFormData, name: e.target.value })}
                style={{
                  width: "100%",
                  padding: "8px 12px",
                  border: "1px solid #cbd5e1",
                  borderRadius: 6,
                  fontSize: 13,
                  background: "#ffffff",
                }}
              />
            </div>

            <div>
              <label style={{ display: "block", fontSize: 12, fontWeight: 700, color: "#1e293b", marginBottom: 4 }}>
                Description
              </label>
              <textarea
                placeholder="Brief description of the activity"
                value={editFormData.description}
                onChange={(e) => setEditFormData({ ...editFormData, description: e.target.value })}
                style={{
                  width: "100%",
                  padding: "8px 12px",
                  border: "1px solid #cbd5e1",
                  borderRadius: 6,
                  fontSize: 13,
                  minHeight: 50,
                  fontFamily: "inherit",
                  background: "#ffffff",
                }}
              />
            </div>

            <div style={{ display: "grid", gridTemplateColumns: "1fr 1fr", gap: 12 }}>
              <div>
                <label style={{ display: "block", fontSize: 12, fontWeight: 700, color: "#1e293b", marginBottom: 4 }}>
                  Points Awarded
                </label>
                <input
                  type="number"
                  min="0"
                  value={editFormData.pointsAwarded}
                  onChange={(e) =>
                    setEditFormData({ ...editFormData, pointsAwarded: Number(e.target.value) })
                  }
                  style={{
                    width: "100%",
                    padding: "8px 12px",
                    border: "1px solid #cbd5e1",
                    borderRadius: 6,
                    fontSize: 13,
                    background: "#ffffff",
                  }}
                />
              </div>

              <div>
                <label style={{ display: "block", fontSize: 12, fontWeight: 700, color: "#1e293b", marginBottom: 4 }}>
                  Reward Type
                </label>
                <select
                  value={editFormData.rewardType}
                  onChange={(e) =>
                    setEditFormData({
                      ...editFormData,
                      rewardType: e.target.value,
                      cardId: e.target.value === "points" ? "" : editFormData.cardId,
                    })
                  }
                  style={{
                    width: "100%",
                    padding: "8px 12px",
                    border: "1px solid #cbd5e1",
                    borderRadius: 6,
                    fontSize: 13,
                    background: "#ffffff",
                  }}
                >
                  <option value="points">Points Only</option>
                  <option value="card">Card Only</option>
                  <option value="both">Points & Card</option>
                </select>
              </div>
            </div>

            {(editFormData.rewardType === "card" || editFormData.rewardType === "both") && (
              <div>
                <label style={{ display: "block", fontSize: 12, fontWeight: 700, color: "#1e293b", marginBottom: 4 }}>
                  Select Reward Card *
                </label>
                <select
                  value={editFormData.cardId}
                  onChange={(e) => setEditFormData({ ...editFormData, cardId: e.target.value })}
                  style={{
                    width: "100%",
                    padding: "8px 12px",
                    border: !editFormData.cardId ? "2px solid #ef4444" : "1px solid #cbd5e1",
                    borderRadius: 6,
                    fontSize: 13,
                    backgroundColor: "#ffffff",
                  }}
                >
                  <option value="">-- Choose a card --</option>
                  {cards.length === 0 ? (
                    <option disabled>No cards available in this class</option>
                  ) : (
                    cards.map((card) => (
                      <option key={card.id} value={card.id}>
                        {card.title || card.name}
                      </option>
                    ))
                  )}
                </select>
                {cards.length === 0 && (
                  <div style={{ fontSize: 12, color: "#dc2626", marginTop: 4 }}>
                    ⚠️ No cards found. Create cards in the Card Library first.
                  </div>
                )}
              </div>
            )}

            <div style={{ display: "flex", alignItems: "center", gap: 8, marginTop: 4 }}>
              <input
                type="checkbox"
                id="editIsActive"
                checked={editFormData.isActive}
                onChange={(e) => setEditFormData({ ...editFormData, isActive: e.target.checked })}
                style={{ accentColor: "#2563eb", width: 16, height: 16 }}
              />
              <label htmlFor="editIsActive" style={{ fontSize: 13, fontWeight: 600, color: "#1e293b", cursor: "pointer" }}>
                Active (available for redemption)
              </label>
            </div>

            <div style={{ display: "flex", gap: 10, justifyContent: "flex-end", marginTop: 8 }}>
              <button
                type="button"
                onClick={() => setEditingActivity(null)}
                style={{
                  padding: "9px 16px",
                  background: "#ffffff",
                  color: "#475569",
                  border: "1px solid #cbd5e1",
                  borderRadius: 6,
                  cursor: "pointer",
                  fontSize: 13,
                  fontWeight: 600,
                }}
              >
                Cancel
              </button>
              <button
                type="submit"
                disabled={isSaving}
                style={{
                  padding: "9px 20px",
                  background: "#2563eb",
                  color: "#ffffff",
                  border: "none",
                  borderRadius: 6,
                  cursor: isSaving ? "not-allowed" : "pointer",
                  fontSize: 13,
                  fontWeight: 700,
                  opacity: isSaving ? 0.7 : 1,
                }}
              >
                {isSaving ? "Saving..." : "Save Changes"}
              </button>
            </div>
          </form>
        </div>
      )}

      {/* Add New Activity Form */}
      {isAdding && (
        <form
          onSubmit={handleAddActivity}
          style={{
            border: "1px solid #e5e7eb",
            borderRadius: 12,
            padding: 16,
            background: "#f9fafb",
            display: "flex",
            flexDirection: "column",
            gap: 12,
          }}
        >
          <h4 style={{ margin: 0, fontSize: 15, fontWeight: 700, color: "#1f2937" }}>
            Add New Activity
          </h4>

          <div style={{ display: "grid", gridTemplateColumns: "1fr 1fr", gap: 12 }}>
            <div>
              <label style={{ display: "block", fontSize: 12, fontWeight: 600, marginBottom: 4 }}>
                Source ID *
              </label>
              <input
                type="text"
                placeholder="e.g., mathquest"
                value={newFormData.sourceId}
                onChange={(e) => setNewFormData({ ...newFormData, sourceId: e.target.value })}
                maxLength={6}
                style={{
                  width: "100%",
                  padding: "8px 12px",
                  border: "1px solid #d1d5db",
                  borderRadius: 6,
                  fontSize: 13,
                  background: "#ffffff",
                }}
              />
            </div>
            <div>
              <label style={{ display: "block", fontSize: 12, fontWeight: 600, marginBottom: 4 }}>
                Activity ID *
              </label>
              <input
                type="text"
                placeholder="e.g., algebra_01"
                value={newFormData.activityId}
                onChange={(e) => setNewFormData({ ...newFormData, activityId: e.target.value })}
                maxLength={6}
                style={{
                  width: "100%",
                  padding: "8px 12px",
                  border: "1px solid #d1d5db",
                  borderRadius: 6,
                  fontSize: 13,
                  background: "#ffffff",
                }}
              />
            </div>
          </div>

          <div>
            <label style={{ display: "block", fontSize: 12, fontWeight: 600, marginBottom: 4 }}>
              Display Name
            </label>
            <input
              type="text"
              placeholder="e.g., Algebra Challenge 1"
              value={newFormData.name}
              onChange={(e) => setNewFormData({ ...newFormData, name: e.target.value })}
              style={{
                width: "100%",
                padding: "8px 12px",
                border: "1px solid #d1d5db",
                borderRadius: 6,
                fontSize: 13,
                background: "#ffffff",
              }}
            />
          </div>

          <div>
            <label style={{ display: "block", fontSize: 12, fontWeight: 600, marginBottom: 4 }}>
              Description
            </label>
            <textarea
              placeholder="Brief description of the activity"
              value={newFormData.description}
              onChange={(e) => setNewFormData({ ...newFormData, description: e.target.value })}
              style={{
                width: "100%",
                padding: "8px 12px",
                border: "1px solid #d1d5db",
                borderRadius: 6,
                fontSize: 13,
                minHeight: 50,
                fontFamily: "inherit",
                background: "#ffffff",
              }}
            />
          </div>

          <div style={{ display: "grid", gridTemplateColumns: "1fr 1fr", gap: 12 }}>
            <div>
              <label style={{ display: "block", fontSize: 12, fontWeight: 600, marginBottom: 4 }}>
                Points Awarded
              </label>
              <input
                type="number"
                min="0"
                value={newFormData.pointsAwarded}
                onChange={(e) =>
                  setNewFormData({ ...newFormData, pointsAwarded: Number(e.target.value) })
                }
                style={{
                  width: "100%",
                  padding: "8px 12px",
                  border: "1px solid #d1d5db",
                  borderRadius: 6,
                  fontSize: 13,
                  background: "#ffffff",
                }}
              />
            </div>
            <div>
              <label style={{ display: "block", fontSize: 12, fontWeight: 600, marginBottom: 4 }}>
                Reward Type
              </label>
              <select
                value={newFormData.rewardType}
                onChange={(e) =>
                  setNewFormData({
                    ...newFormData,
                    rewardType: e.target.value,
                    cardId: e.target.value === "points" ? "" : newFormData.cardId,
                  })
                }
                style={{
                  width: "100%",
                  padding: "8px 12px",
                  border: "1px solid #d1d5db",
                  borderRadius: 6,
                  fontSize: 13,
                  background: "#ffffff",
                }}
              >
                <option value="points">Points Only</option>
                <option value="card">Card Only</option>
                <option value="both">Points & Card</option>
              </select>
            </div>
          </div>

          {(newFormData.rewardType === "card" || newFormData.rewardType === "both") && (
            <div>
              <label style={{ display: "block", fontSize: 12, fontWeight: 600, marginBottom: 4 }}>
                Select Reward Card *
              </label>
              <select
                value={newFormData.cardId}
                onChange={(e) => setNewFormData({ ...newFormData, cardId: e.target.value })}
                style={{
                  width: "100%",
                  padding: "8px 12px",
                  border: !newFormData.cardId ? "2px solid #ef4444" : "1px solid #d1d5db",
                  borderRadius: 6,
                  fontSize: 13,
                  backgroundColor: "#ffffff",
                }}
              >
                <option value="">-- Choose a card --</option>
                {cards.length === 0 ? (
                  <option disabled>No cards available in this class</option>
                ) : (
                  cards.map((card) => (
                    <option key={card.id} value={card.id}>
                      {card.title || card.name}
                    </option>
                  ))
                )}
              </select>
              {cards.length === 0 && (
                <div style={{ fontSize: 12, color: "#dc2626", marginTop: 4 }}>
                  ⚠️ No cards found. Create cards in the Card Library first.
                </div>
              )}
            </div>
          )}

          <button
            type="submit"
            disabled={isSaving}
            style={{
              padding: "10px 16px",
              background: "#10b981",
              color: "#ffffff",
              border: "none",
              borderRadius: 6,
              cursor: isSaving ? "not-allowed" : "pointer",
              fontSize: 13,
              fontWeight: 700,
              opacity: isSaving ? 0.7 : 1,
            }}
          >
            {isSaving ? "Saving..." : "Add Activity"}
          </button>
        </form>
      )}

      {/* Source Filter Bar */}
      {activities.length > 0 && (
        <div
          style={{
            display: "flex",
            justifyContent: "space-between",
            alignItems: "center",
            flexWrap: "wrap",
            gap: 10,
            padding: "10px 14px",
            background: "#f8fafc",
            border: "1px solid #e2e8f0",
            borderRadius: 10,
          }}
        >
          <div style={{ display: "flex", alignItems: "center", gap: 8, flexWrap: "wrap" }}>
            <label
              htmlFor="activitySourceFilter"
              style={{ fontSize: 13, fontWeight: 700, color: "#1e293b" }}
            >
              Source:
            </label>
            <select
              id="activitySourceFilter"
              value={effectiveSourceFilter}
              onChange={(e) => setSelectedSourceFilter(e.target.value)}
              style={{
                padding: "6px 10px",
                border: "1px solid #cbd5e1",
                borderRadius: 6,
                fontSize: 13,
                fontWeight: 600,
                background: "#ffffff",
                color: "#0f172a",
                minWidth: 190,
              }}
            >
              <option value="ALL">
                All sources ({activities.length})
              </option>
              {sourceOptions.map((opt) => (
                <option key={opt.sourceId} value={opt.sourceId}>
                  {opt.sourceId} ({opt.count} · {opt.totalPoints} pts)
                </option>
              ))}
            </select>
          </div>
          <div style={{ fontSize: 12, fontWeight: 600, color: "#475569" }}>
            Showing <strong>{filteredActivities.length}</strong> of {activities.length} activities ·{" "}
            <strong>{filteredTotalPoints} pts</strong>
          </div>
        </div>
      )}

      {/* Activities List */}
      <div
        style={{
          display: "grid",
          gridTemplateColumns: "repeat(auto-fill, minmax(320px, 1fr))",
          gap: 14,
        }}
      >
        {filteredActivities.length === 0 ? (
          <div
            style={{
              gridColumn: "1 / -1",
              textAlign: "center",
              color: "#9ca3af",
              padding: "36px 16px",
              background: "#f9fafb",
              borderRadius: 12,
              border: "1px dashed #d1d5db",
            }}
          >
            {activities.length === 0
              ? 'No activities created yet. Click "+ Add Activity" above to register an activity.'
              : "No activities match the selected source."}
          </div>
        ) : (
          filteredActivities.map((activity) => {
            const linkedCard = activity.cardId ? cardsMap.get(activity.cardId) : null;
            const cardDisplayName = linkedCard
              ? linkedCard.title || linkedCard.name
              : activity.cardId || null;

            return (
              <div
                key={activity.id}
                style={{
                  border: `1px solid ${activity.isActive ? "#e2e8f0" : "#f1f5f9"}`,
                  borderRadius: 12,
                  padding: 14,
                  background: activity.isActive ? "#ffffff" : "#f8fafc",
                  boxShadow: activity.isActive ? "0 2px 6px rgba(0,0,0,0.04)" : "none",
                  opacity: activity.isActive ? 1 : 0.65,
                  display: "flex",
                  flexDirection: "column",
                  justifyContent: "space-between",
                  gap: 12,
                }}
              >
                <div>
                  {/* Top Bar: Title & Status Badge */}
                  <div style={{ display: "flex", justifyContent: "space-between", alignItems: "flex-start", gap: 8 }}>
                    <div style={{ fontSize: 15, fontWeight: 700, color: "#0f172a", lineHeight: 1.3 }}>
                      {activity.name || `${activity.sourceId}/${activity.activityId}`}
                    </div>
                    <span
                      style={{
                        padding: "2px 8px",
                        borderRadius: 12,
                        fontSize: 11,
                        fontWeight: 700,
                        background: activity.isActive ? "#dcfce7" : "#f1f5f9",
                        color: activity.isActive ? "#166534" : "#64748b",
                        border: `1px solid ${activity.isActive ? "#bbf7d0" : "#e2e8f0"}`,
                        whiteSpace: "nowrap",
                      }}
                    >
                      {activity.isActive ? "Active" : "Disabled"}
                    </span>
                  </div>

                  {/* Source and Activity ID Code */}
                  <div
                    style={{
                      fontSize: 11,
                      color: "#64748b",
                      marginTop: 4,
                      fontFamily: "monospace",
                      background: "#f1f5f9",
                      display: "inline-block",
                      padding: "2px 6px",
                      borderRadius: 4,
                    }}
                  >
                    {activity.sourceId} → {activity.activityId}
                  </div>

                  {/* Description */}
                  {activity.description && (
                    <div
                      style={{
                        fontSize: 12,
                        color: "#475569",
                        marginTop: 8,
                        lineHeight: 1.45,
                      }}
                    >
                      {activity.description}
                    </div>
                  )}

                  {/* Rewards Breakdown */}
                  <div
                    style={{
                      marginTop: 10,
                      padding: "8px 10px",
                      background: "#f8fafc",
                      borderRadius: 8,
                      border: "1px solid #e2e8f0",
                      fontSize: 12,
                      display: "flex",
                      flexDirection: "column",
                      gap: 4,
                    }}
                  >
                    <div style={{ display: "flex", justifyContent: "space-between", alignItems: "center" }}>
                      <span style={{ color: "#64748b", fontWeight: 600 }}>Points:</span>
                      <strong style={{ color: "#0f172a" }}>+{activity.pointsAwarded || 0} pts</strong>
                    </div>

                    <div style={{ display: "flex", justifyContent: "space-between", alignItems: "center" }}>
                      <span style={{ color: "#64748b", fontWeight: 600 }}>Reward Type:</span>
                      <span
                        style={{
                          textTransform: "capitalize",
                          fontWeight: 700,
                          color:
                            activity.rewardType === "card"
                              ? "#7c3aed"
                              : activity.rewardType === "both"
                                ? "#0284c7"
                                : "#059669",
                        }}
                      >
                        {activity.rewardType || "points"}
                      </span>
                    </div>

                    {(activity.rewardType === "card" || activity.rewardType === "both") && (
                      <div
                        style={{
                          display: "flex",
                          alignItems: "center",
                          gap: 6,
                          paddingTop: 4,
                          borderTop: "1px dashed #e2e8f0",
                          color: "#6b21a8",
                          fontWeight: 600,
                        }}
                      >
                        <span>🃏</span>
                        <span style={{ overflow: "hidden", textOverflow: "ellipsis", whiteSpace: "nowrap" }}>
                          Card: <strong>{cardDisplayName || "No card linked"}</strong>
                        </span>
                      </div>
                    )}
                  </div>
                </div>

                {/* Action Buttons */}
                <div style={{ display: "grid", gridTemplateColumns: "1fr 1fr 1fr 1fr", gap: 6, marginTop: 4 }}>
                  {/* Issue Code button */}
                  <button
                    type="button"
                    onClick={() => {
                      setCodeTargetActivity(activity);
                      setCopiedStudentCode(false);
                    }}
                    style={{
                      padding: "6px 6px",
                      background: "#f0fdfa",
                      color: "#0f766e",
                      border: "1px solid #99f6e4",
                      borderRadius: 6,
                      cursor: "pointer",
                      fontSize: 12,
                      fontWeight: 700,
                    }}
                    title="Generate redeemable code for a specific student"
                  >
                    🔑 Code
                  </button>

                  {/* Edit button */}
                  <button
                    type="button"
                    onClick={() => handleStartEdit(activity)}
                    style={{
                      padding: "6px 8px",
                      background: "#eff6ff",
                      color: "#1d4ed8",
                      border: "1px solid #bfdbfe",
                      borderRadius: 6,
                      cursor: "pointer",
                      fontSize: 12,
                      fontWeight: 700,
                    }}
                    title="Edit activity points, reward type, card or description"
                  >
                    ✏️ Edit
                  </button>

                  {/* Enable / Disable toggle button */}
                  <button
                    type="button"
                    onClick={() => handleToggleActive(activity)}
                    style={{
                      padding: "6px 8px",
                      background: activity.isActive ? "#fef2f2" : "#f0fdf4",
                      color: activity.isActive ? "#b91c1c" : "#15803d",
                      border: `1px solid ${activity.isActive ? "#fecaca" : "#bbf7d0"}`,
                      borderRadius: 6,
                      cursor: "pointer",
                      fontSize: 12,
                      fontWeight: 700,
                    }}
                    title={activity.isActive ? "Disable code redemption" : "Enable code redemption"}
                  >
                    {activity.isActive ? "Disable" : "Enable"}
                  </button>

                  {/* Delete button */}
                  <button
                    type="button"
                    onClick={() => handleDeleteActivity(activity)}
                    style={{
                      padding: "6px 8px",
                      background: "#ffffff",
                      color: "#dc2626",
                      border: "1px solid #fca5a5",
                      borderRadius: 6,
                      cursor: "pointer",
                      fontSize: 12,
                      fontWeight: 700,
                    }}
                    title="Permanently delete this activity"
                  >
                    🗑️ Delete
                  </button>
                </div>
              </div>
            );
          })
        )}
      </div>
    </div>
  );
}
