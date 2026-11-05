/**
 * Activity Catalogue Management Component
 *
 * Admin interface for adding, editing, and disabling activities
 */

import React, { useState, useEffect } from "react";
import {
  getActivityCatalogue,
  addActivityToCatalogue,
  updateActivityInCatalogue,
  deleteActivityFromCatalogue,
} from "../../services/rewardCodeService.js";

export function ActivityCatalogueManager({ db, classId }) {
  const [activities, setActivities] = useState([]);
  const [isLoading, setIsLoading] = useState(true);
  const [isAdding, setIsAdding] = useState(false);
  const [editingId, setEditingId] = useState(null);
  const [message, setMessage] = useState(null);

  // Form state for new/edit activity
  const [formData, setFormData] = useState({
    sourceId: "",
    activityId: "",
    name: "",
    description: "",
    pointsAwarded: 10,
    rewardType: "points",
    isActive: true,
  });

  // Load activities on mount
  useEffect(() => {
    loadActivities();
  }, [db, classId]);

  const loadActivities = async () => {
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
  };

  const resetForm = () => {
    setFormData({
      sourceId: "",
      activityId: "",
      name: "",
      description: "",
      pointsAwarded: 10,
      rewardType: "points",
      isActive: true,
    });
    setEditingId(null);
  };

  const handleAddActivity = async (e) => {
    e.preventDefault();

    if (!formData.sourceId.trim() || !formData.activityId.trim()) {
      setMessage({ type: "error", text: "Source ID and Activity ID are required." });
      return;
    }

    try {
      await addActivityToCatalogue({
        db,
        classId,
        activity: formData,
      });

      setMessage({ type: "success", text: "Activity added successfully!" });
      resetForm();
      setIsAdding(false);
      await loadActivities();
    } catch (err) {
      console.error("Failed to add activity:", err);
      setMessage({ type: "error", text: "Failed to add activity." });
    }
  };

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
      setMessage({ type: "error", text: "Failed to update activity." });
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
        <h3 style={{ margin: 0, fontSize: 18, fontWeight: 600, color: "#1f2937" }}>
          Activity Catalogue
        </h3>
        <button
          type="button"
          onClick={() => setIsAdding(!isAdding)}
          style={{
            padding: "8px 16px",
            background: "#2563eb",
            color: "#ffffff",
            border: "none",
            borderRadius: 6,
            cursor: "pointer",
            fontSize: 13,
            fontWeight: 600,
          }}
        >
          {isAdding ? "Cancel" : "+ Add Activity"}
        </button>
      </div>

      {/* Message */}
      {message && (
        <div
          style={{
            padding: 10,
            borderRadius: 6,
            fontSize: 13,
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
          }}
        >
          {message.text}
        </div>
      )}

      {/* Add/Edit Form */}
      {isAdding && (
        <form
          onSubmit={handleAddActivity}
          style={{
            border: "1px solid #e5e7eb",
            borderRadius: 12,
            padding: 14,
            background: "#f9fafb",
            display: "flex",
            flexDirection: "column",
            gap: 12,
          }}
        >
          <div style={{ display: "grid", gridTemplateColumns: "1fr 1fr", gap: 12 }}>
            <div>
              <label style={{ display: "block", fontSize: 12, fontWeight: 600, marginBottom: 4 }}>
                Source ID *
              </label>
              <input
                type="text"
                placeholder="e.g., mathquest"
                value={formData.sourceId}
                onChange={(e) => setFormData({ ...formData, sourceId: e.target.value })}
                maxLength={6}
                style={{
                  width: "100%",
                  padding: "8px 12px",
                  border: "1px solid #d1d5db",
                  borderRadius: 6,
                  fontSize: 13,
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
                value={formData.activityId}
                onChange={(e) => setFormData({ ...formData, activityId: e.target.value })}
                maxLength={6}
                style={{
                  width: "100%",
                  padding: "8px 12px",
                  border: "1px solid #d1d5db",
                  borderRadius: 6,
                  fontSize: 13,
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
              value={formData.name}
              onChange={(e) => setFormData({ ...formData, name: e.target.value })}
              style={{
                width: "100%",
                padding: "8px 12px",
                border: "1px solid #d1d5db",
                borderRadius: 6,
                fontSize: 13,
              }}
            />
          </div>

          <div>
            <label style={{ display: "block", fontSize: 12, fontWeight: 600, marginBottom: 4 }}>
              Description
            </label>
            <textarea
              placeholder="Brief description of the activity"
              value={formData.description}
              onChange={(e) => setFormData({ ...formData, description: e.target.value })}
              style={{
                width: "100%",
                padding: "8px 12px",
                border: "1px solid #d1d5db",
                borderRadius: 6,
                fontSize: 13,
                minHeight: 60,
                fontFamily: "inherit",
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
                min="1"
                value={formData.pointsAwarded}
                onChange={(e) => setFormData({ ...formData, pointsAwarded: Number(e.target.value) })}
                style={{
                  width: "100%",
                  padding: "8px 12px",
                  border: "1px solid #d1d5db",
                  borderRadius: 6,
                  fontSize: 13,
                }}
              />
            </div>
            <div>
              <label style={{ display: "block", fontSize: 12, fontWeight: 600, marginBottom: 4 }}>
                Reward Type
              </label>
              <select
                value={formData.rewardType}
                onChange={(e) => setFormData({ ...formData, rewardType: e.target.value })}
                style={{
                  width: "100%",
                  padding: "8px 12px",
                  border: "1px solid #d1d5db",
                  borderRadius: 6,
                  fontSize: 13,
                }}
              >
                <option value="points">Points</option>
                <option value="card">Card</option>
                <option value="both">Both</option>
              </select>
            </div>
          </div>

          <button
            type="submit"
            style={{
              padding: "10px 16px",
              background: "#10b981",
              color: "#ffffff",
              border: "none",
              borderRadius: 6,
              cursor: "pointer",
              fontSize: 13,
              fontWeight: 600,
            }}
          >
            Add Activity
          </button>
        </form>
      )}

      {/* Activities List */}
      <div
        style={{
          display: "grid",
          gridTemplateColumns: "repeat(auto-fill, minmax(300px, 1fr))",
          gap: 12,
        }}
      >
        {activities.length === 0 ? (
          <div style={{ gridColumn: "1 / -1", textAlign: "center", color: "#9ca3af", padding: 20 }}>
            No activities added yet.
          </div>
        ) : (
          activities.map((activity) => (
            <div
              key={activity.id}
              style={{
                border: `1px solid ${activity.isActive ? "#e5e7eb" : "#f3f4f6"}`,
                borderRadius: 8,
                padding: 12,
                background: activity.isActive ? "#ffffff" : "#f9fafb",
                opacity: activity.isActive ? 1 : 0.6,
              }}
            >
              <div
                style={{
                  fontSize: 13,
                  fontWeight: 600,
                  color: "#1f2937",
                  marginBottom: 4,
                }}
              >
                {activity.name || `${activity.sourceId}/${activity.activityId}`}
              </div>
              <div
                style={{
                  fontSize: 11,
                  color: "#6b7280",
                  marginBottom: 8,
                  fontFamily: "monospace",
                }}
              >
                {activity.sourceId} → {activity.activityId}
              </div>
              {activity.description && (
                <div
                  style={{
                    fontSize: 12,
                    color: "#4b5563",
                    marginBottom: 8,
                    lineHeight: 1.4,
                  }}
                >
                  {activity.description}
                </div>
              )}
              <div
                style={{
                  fontSize: 11,
                  color: "#6b7280",
                  marginBottom: 8,
                }}
              >
                <strong>{activity.pointsAwarded}</strong> points • <strong>{activity.rewardType}</strong>
              </div>
              <button
                type="button"
                onClick={() => handleToggleActive(activity)}
                style={{
                  width: "100%",
                  padding: "6px 12px",
                  background: activity.isActive ? "#fee2e2" : "#dcfce7",
                  color: activity.isActive ? "#991b1b" : "#166534",
                  border: `1px solid ${activity.isActive ? "#fecaca" : "#bbf7d0"}`,
                  borderRadius: 4,
                  cursor: "pointer",
                  fontSize: 12,
                  fontWeight: 600,
                }}
              >
                {activity.isActive ? "Disable" : "Enable"}
              </button>
            </div>
          ))
        )}
      </div>
    </div>
  );
}
