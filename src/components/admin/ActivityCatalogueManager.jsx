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
  updateActivityInCatalogue,
  deleteActivityFromCatalogue,
} from "../../services/rewardCodeService.js";

export function ActivityCatalogueManager({ db, classId, alertFn }) {
  const [activities, setActivities] = useState([]);
  const [cards, setCards] = useState([]);
  const [isLoading, setIsLoading] = useState(true);
  const [isAdding, setIsAdding] = useState(false);
  const [editingActivity, setEditingActivity] = useState(null);
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

  useEffect(() => {
    loadActivities();
    loadCards();
  }, [loadActivities, loadCards]);

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
      <div style={{ display: "flex", justifyContent: "space-between", alignItems: "center" }}>
        <div>
          <h3 style={{ margin: 0, fontSize: 18, fontWeight: 700, color: "#1f2937" }}>
            Activity Catalogue
          </h3>
          <p style={{ margin: "2px 0 0", fontSize: 13, color: "#6b7280" }}>
            Manage activities, points, and card rewards claimable with codes.
          </p>
        </div>
        <button
          type="button"
          onClick={() => {
            setIsAdding(!isAdding);
            if (!isAdding) setEditingActivity(null);
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

      {/* Activities List */}
      <div
        style={{
          display: "grid",
          gridTemplateColumns: "repeat(auto-fill, minmax(320px, 1fr))",
          gap: 14,
        }}
      >
        {activities.length === 0 ? (
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
            No activities created yet. Click "+ Add Activity" above to register an activity.
          </div>
        ) : (
          activities.map((activity) => {
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
                <div style={{ display: "grid", gridTemplateColumns: "1fr 1fr 1fr", gap: 6, marginTop: 4 }}>
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
