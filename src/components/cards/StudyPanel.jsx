import React, { useState } from "react";
import { uid } from "../../utils/helpers";
import {
  isExternalStudyLink,
  normalizeStudyLink,
  toSafeStudyHref,
} from "../../utils/studyLinkUtils";

function StudyForm({
  initialValues,
  submitLabel,
  savingLabel,
  onSubmit,
  onCancel,
  onValidationError,
}) {
  const [title, setTitle] = useState(initialValues?.title || "");
  const [description, setDescription] = useState(initialValues?.description || "");
  const [linkText, setLinkText] = useState(initialValues?.linkText || "");
  const [link, setLink] = useState(initialValues?.link || "");
  const [saving, setSaving] = useState(false);

  const handleSubmit = async (e) => {
    e.preventDefault();
    const cleanTitle = title.trim();
    const cleanDescription = description.trim();
    const cleanLinkText = linkText.trim();
    const normalizedLink = normalizeStudyLink(link);

    if (!cleanTitle) {
      onValidationError?.("Enter a title for this study post.");
      return;
    }
    if (!cleanLinkText) {
      onValidationError?.("Enter the linked text to display.");
      return;
    }
    if (!normalizedLink) {
      onValidationError?.("Enter a valid link (e.g. 4º ESO/monica.html or https://...).");
      return;
    }

    setSaving(true);
    const ok = await onSubmit({
      title: cleanTitle,
      description: cleanDescription,
      linkText: cleanLinkText,
      link: normalizedLink,
    });
    setSaving(false);
    if (ok !== false) {
      onCancel?.();
    }
  };

  return (
    <form
      onSubmit={handleSubmit}
      style={{
        padding: 12,
        borderRadius: 12,
        background: "linear-gradient(135deg, #eef2ff 0%, #f0f9ff 100%)",
        border: "1.5px solid #6366f1",
        boxShadow: "0 3px 10px rgba(79, 70, 229, 0.12)",
        display: "grid",
        gap: 8,
      }}
    >
      <label style={{ display: "grid", gap: 4, fontSize: 12, fontWeight: 700, color: "#312e81" }}>
        Title
        <input
          type="text"
          value={title}
          onChange={(e) => setTitle(e.target.value)}
          placeholder="e.g. Level Up: Potencias de 10"
          style={{
            width: "100%",
            padding: "6px 8px",
            borderRadius: 8,
            border: "1px solid #a5b4fc",
            fontSize: 13,
            fontWeight: 700,
            color: "#1e1b4b",
            background: "#ffffff",
            boxSizing: "border-box",
          }}
        />
      </label>

      <label style={{ display: "grid", gap: 4, fontSize: 12, fontWeight: 700, color: "#312e81" }}>
        Description
        <textarea
          value={description}
          onChange={(e) => setDescription(e.target.value)}
          placeholder="Describe what students should practice or review..."
          rows={3}
          style={{
            width: "100%",
            padding: "6px 8px",
            borderRadius: 8,
            border: "1px solid #a5b4fc",
            fontSize: 12.5,
            fontWeight: 400,
            color: "#0f172a",
            background: "#ffffff",
            resize: "vertical",
            boxSizing: "border-box",
            fontFamily: "inherit",
          }}
        />
      </label>

      <label style={{ display: "grid", gap: 4, fontSize: 12, fontWeight: 700, color: "#312e81" }}>
        Linked text
        <input
          type="text"
          value={linkText}
          onChange={(e) => setLinkText(e.target.value)}
          placeholder="e.g. Open Potencias de 10 practice"
          style={{
            width: "100%",
            padding: "6px 8px",
            borderRadius: 8,
            border: "1px solid #a5b4fc",
            fontSize: 12.5,
            fontWeight: 600,
            color: "#1e293b",
            background: "#ffffff",
            boxSizing: "border-box",
          }}
        />
      </label>

      <label style={{ display: "grid", gap: 4, fontSize: 12, fontWeight: 700, color: "#312e81" }}>
        Link
        <input
          type="text"
          value={link}
          onChange={(e) => setLink(e.target.value)}
          placeholder="e.g. 4º ESO/monica.html or https://www.desmos.com"
          style={{
            width: "100%",
            padding: "6px 8px",
            borderRadius: 8,
            border: "1px solid #a5b4fc",
            fontSize: 12.5,
            fontWeight: 500,
            color: "#1e293b",
            background: "#ffffff",
            boxSizing: "border-box",
          }}
        />
      </label>

      <div style={{ display: "flex", justifyContent: "flex-end", gap: 6, marginTop: 2 }}>
        <button
          type="button"
          className="btn"
          disabled={saving}
          onClick={onCancel}
          style={{ padding: "4px 10px", fontSize: 12 }}
        >
          Cancel
        </button>
        <button
          type="submit"
          className="btn"
          disabled={saving}
          style={{
            padding: "4px 12px",
            fontSize: 12,
            background: "#4f46e5",
            color: "#ffffff",
            border: "1px solid #4338ca",
            fontWeight: 700,
          }}
        >
          {saving ? savingLabel : submitLabel}
        </button>
      </div>
    </form>
  );
}

function StudyPostCard({ post, isAdmin, onSaveEdit, onDelete, onValidationError }) {
  const [isEditing, setIsEditing] = useState(false);
  const safeHref = toSafeStudyHref(post.link);
  const external = isExternalStudyLink(post.link);

  if (isEditing) {
    return (
      <StudyForm
        initialValues={post}
        submitLabel="Save"
        savingLabel="Saving..."
        onSubmit={(updates) => onSaveEdit(post.id, updates)}
        onCancel={() => setIsEditing(false)}
        onValidationError={onValidationError}
      />
    );
  }

  return (
    <article
      style={{
        display: "grid",
        gap: 8,
        padding: "12px 14px",
        borderRadius: 12,
        background: "#ffffff",
        border: "1px solid #e2e8f0",
        boxShadow: "0 2px 6px rgba(15, 23, 42, 0.05)",
      }}
    >
      <div style={{ display: "flex", justifyContent: "space-between", alignItems: "flex-start", gap: 8 }}>
        <div
          style={{
            fontSize: 14,
            fontWeight: 800,
            color: "#0f172a",
            lineHeight: 1.35,
            wordBreak: "break-word",
          }}
        >
          {post.title}
        </div>
        <span
          style={{
            fontSize: 10.5,
            fontWeight: 700,
            padding: "2px 7px",
            borderRadius: 999,
            background: external ? "#f0f9ff" : "#eef2ff",
            border: `1px solid ${external ? "#bae6fd" : "#c7d2fe"}`,
            color: external ? "#0369a1" : "#4338ca",
            whiteSpace: "nowrap",
            flexShrink: 0,
          }}
        >
          {external ? "Website" : "Activity"}
        </span>
      </div>

      {post.description && (
        <div
          style={{
            fontSize: 12.5,
            color: "#475569",
            lineHeight: 1.45,
            whiteSpace: "pre-wrap",
            wordBreak: "break-word",
          }}
        >
          {post.description}
        </div>
      )}

      {safeHref && (
        <div style={{ display: "flex", alignItems: "center", justifyContent: "space-between", gap: 8, flexWrap: "wrap", marginTop: 2 }}>
          <a
            href={safeHref}
            target="_blank"
            rel="noopener noreferrer"
            style={{
              display: "inline-flex",
              alignItems: "center",
              gap: 6,
              padding: "6px 12px",
              borderRadius: 10,
              background: "#eef2ff",
              border: "1px solid #c7d2fe",
              color: "#3730a3",
              fontSize: 12.5,
              fontWeight: 700,
              textDecoration: "none",
              wordBreak: "break-word",
            }}
          >
            <span>{post.linkText || post.link}</span>
            <span aria-hidden="true">↗</span>
          </a>
        </div>
      )}

      {isAdmin && (
        <div
          style={{
            display: "flex",
            gap: 6,
            justifyContent: "flex-end",
            flexWrap: "wrap",
            paddingTop: 4,
            borderTop: "1px solid #f1f5f9",
          }}
        >
          <button
            type="button"
            className="btn"
            onClick={() => setIsEditing(true)}
            style={{
              padding: "3px 9px",
              fontSize: 11,
              background: "#ffffff",
              border: "1px solid #c7d2fe",
              color: "#4338ca",
              fontWeight: 700,
            }}
          >
            Edit
          </button>
          <button
            type="button"
            className="btn"
            onClick={() => onDelete(post.id)}
            style={{
              padding: "3px 9px",
              fontSize: 11,
              background: "#ffffff",
              border: "1px solid #fecaca",
              color: "#dc2626",
              fontWeight: 700,
            }}
          >
            Delete
          </button>
        </div>
      )}
    </article>
  );
}

export default function StudyPanel({
  mode,
  studyPosts = [],
  onSaveStudyPosts,
  confirmFn,
  onValidationError,
}) {
  const isAdmin = mode === "admin";
  const [showComposer, setShowComposer] = useState(false);

  const safePosts = Array.isArray(studyPosts) ? studyPosts : [];

  const handleCreatePost = async (data) => {
    const nextPost = {
      id: uid("study"),
      title: data.title,
      description: data.description,
      linkText: data.linkText,
      link: data.link,
      createdAt: Date.now(),
    };
    const nextList = [nextPost, ...safePosts];
    return onSaveStudyPosts?.(nextList);
  };

  const handleSaveEdit = async (postId, updates) => {
    const nextList = safePosts.map((p) =>
      p?.id === postId
        ? {
            ...p,
            title: updates.title,
            description: updates.description,
            linkText: updates.linkText,
            link: updates.link,
            updatedAt: Date.now(),
          }
        : p
    );
    return onSaveStudyPosts?.(nextList);
  };

  const handleDeletePost = async (postId) => {
    if (confirmFn && !(await confirmFn("Delete this study post?"))) return;
    const nextList = safePosts.filter((p) => p?.id !== postId);
    await onSaveStudyPosts?.(nextList);
  };

  return (
    <div style={{ display: "grid", gap: 12 }}>
      {isAdmin && (
        <div style={{ display: "grid", gap: 8 }}>
          <div style={{ display: "flex", justifyContent: "flex-end" }}>
            <button
              type="button"
              className="btn"
              onClick={() => setShowComposer((prev) => !prev)}
              style={{
                background: showComposer ? "#e0e7ff" : "#ffffff",
                border: "1px solid #6366f1",
                color: "#4338ca",
                fontWeight: 700,
                fontSize: 12,
                padding: "5px 10px",
              }}
            >
              {showComposer ? "✕ Cancel" : "+ Add study post"}
            </button>
          </div>

          {showComposer && (
            <StudyForm
              submitLabel="Post"
              savingLabel="Posting..."
              onSubmit={handleCreatePost}
              onCancel={() => setShowComposer(false)}
              onValidationError={onValidationError}
            />
          )}
        </div>
      )}

      {safePosts.length === 0 ? (
        <div
          style={{
            padding: 18,
            borderRadius: 14,
            background: "#ffffff",
            border: "1px solid #e2e8f0",
            textAlign: "center",
            color: "#64748b",
            fontSize: 13,
          }}
        >
          No study resources posted for this class yet.
        </div>
      ) : (
        <div style={{ display: "grid", gap: 10 }}>
          {safePosts.map((post) => (
            <StudyPostCard
              key={post.id}
              post={post}
              isAdmin={isAdmin}
              onSaveEdit={handleSaveEdit}
              onDelete={handleDeletePost}
              onValidationError={onValidationError}
            />
          ))}
        </div>
      )}
    </div>
  );
}
