import React, { useMemo, useState } from "react";
import { buildNoticeBoardData } from "../../services/noticeBoardService";
import { uid } from "../../utils/helpers";

function getItemMeta(item) {
  switch (item.type) {
    case "streakMax": {
      const count = item.studentNames?.length || 0;
      const namesText = (item.studentNames || []).join(", ");
      return {
        icon: item.emoji || "🔥",
        accentBg: "#f0fdf4",
        accentBorder: "#bbf7d0",
        badgeText: "Max streak",
        badgeColor: "#16a34a",
        title:
          count > 1
            ? `${namesText} reached max streak`
            : `${namesText} reached max streak`,
        detail: item.streakMax ? `Goal: ${item.streakMax}` : "",
      };
    }
    case "rewardRedeemed": {
      if (item.redeemKind === "group") {
        const n = Number(item.contributorCount || 0);
        return {
          icon: "🤝",
          accentBg: "#fff7ed",
          accentBorder: "#fed7aa",
          badgeText: "Group reward",
          badgeColor: "#fb923c",
          title: `Group redeemed: ${item.rewardTitle}`,
          detail: `${n} ${n === 1 ? "person" : "people"} contributed (1+ pt)`,
        };
      }
      return {
        icon: "🎁",
        accentBg: "#fefce8",
        accentBorder: "#fde047",
        badgeText: "Reward redeemed",
        badgeColor: "#ca8a04",
        title: `${item.studentName} redeemed ${item.rewardTitle}`,
        detail: item.cost > 0 ? `${item.cost} pts` : "",
      };
    }
    case "experienceCard": {
      return {
        icon: "✨",
        accentBg: "#f5f3ff",
        accentBorder: "#ddd6fe",
        badgeText: "Experience card",
        badgeColor: "#7c3aed",
        title: `${item.studentName} achieved ${item.cardTitle}`,
        detail:
          item.xp !== null && item.xp !== undefined && Number.isFinite(item.xp)
            ? `${item.xp} XP`
            : "",
      };
    }
    case "newCard": {
      const catLabel =
        item.category === "rewards"
          ? "Rewards"
          : item.category === "experience"
          ? "Experience"
          : "Points";
      return {
        icon: "🃏",
        accentBg: "#f0f9ff",
        accentBorder: "#bae6fd",
        badgeText: `New ${catLabel} card`,
        badgeColor: "#0284c7",
        title: item.cardTitle,
        detail:
          item.category === "experience"
            ? `${item.points} XP`
            : item.points
            ? `${item.points} pts`
            : "",
      };
    }
    default:
      return {
        icon: "📢",
        accentBg: "#f8fafc",
        accentBorder: "#e2e8f0",
        badgeText: "News",
        badgeColor: "#475569",
        title: "",
        detail: "",
      };
  }
}

function AdminMessageCard({
  item,
  isAdmin,
  onSaveEdit,
  onTogglePin,
  onDelete,
  onValidationError,
}) {
  const [isEditing, setIsEditing] = useState(false);
  const [draftTitle, setDraftTitle] = useState(item.title || "");
  const [draftText, setDraftText] = useState(item.text || "");
  const [draftPinned, setDraftPinned] = useState(Boolean(item.pinned));
  const [saving, setSaving] = useState(false);

  const startEdit = () => {
    setDraftTitle(item.title || "");
    setDraftText(item.text || "");
    setDraftPinned(Boolean(item.pinned));
    setIsEditing(true);
  };

  const handleSave = async (e) => {
    e.preventDefault();
    const cleanTitle = draftTitle.trim();
    const cleanText = draftText.trim();
    if (!cleanTitle && !cleanText) {
      onValidationError?.("Enter a title or message text.");
      return;
    }
    setSaving(true);
    const ok = await onSaveEdit(item.messageId, {
      title: cleanTitle,
      text: cleanText,
      pinned: draftPinned,
    });
    setSaving(false);
    if (ok !== false) setIsEditing(false);
  };

  if (isEditing) {
    return (
      <form
        onSubmit={handleSave}
        style={{
          padding: 12,
          borderRadius: 12,
          background: "linear-gradient(135deg, #fff1f2 0%, #fef2f2 100%)",
          border: "1.5px solid #ef4444",
          boxShadow: "0 3px 10px rgba(220, 38, 38, 0.14)",
          display: "grid",
          gap: 8,
        }}
      >
        <input
          type="text"
          value={draftTitle}
          onChange={(e) => setDraftTitle(e.target.value)}
          placeholder="Title (optional)"
          style={{
            width: "100%",
            padding: "6px 8px",
            borderRadius: 8,
            border: "1px solid #fca5a5",
            fontSize: 13,
            fontWeight: 700,
            color: "#dc2626",
            background: "#ffffff",
            boxSizing: "border-box",
          }}
        />
        <textarea
          value={draftText}
          onChange={(e) => setDraftText(e.target.value)}
          placeholder="Message text (optional)"
          rows={3}
          style={{
            width: "100%",
            padding: "6px 8px",
            borderRadius: 8,
            border: "1px solid #fca5a5",
            fontSize: 12.5,
            color: "#0f172a",
            background: "#ffffff",
            resize: "vertical",
            boxSizing: "border-box",
            fontFamily: "inherit",
          }}
        />
        <div
          style={{
            display: "flex",
            justifyContent: "space-between",
            alignItems: "center",
            gap: 8,
            flexWrap: "wrap",
          }}
        >
          <label
            style={{
              display: "inline-flex",
              alignItems: "center",
              gap: 6,
              fontSize: 12,
              fontWeight: 700,
              color: "#991b1b",
              cursor: "pointer",
            }}
          >
            <input
              type="checkbox"
              checked={draftPinned}
              onChange={(e) => setDraftPinned(e.target.checked)}
              style={{ accentColor: "#dc2626" }}
            />
            📌 Pin to top
          </label>
          <div style={{ display: "flex", gap: 6 }}>
            <button
              type="button"
              className="btn"
              disabled={saving}
              onClick={() => setIsEditing(false)}
              style={{ padding: "4px 10px", fontSize: 12 }}
            >
              Cancel
            </button>
            <button
              type="submit"
              className="btn"
              disabled={saving}
              style={{
                padding: "4px 10px",
                fontSize: 12,
                background: "#dc2626",
                color: "#ffffff",
                border: "1px solid #b91c1c",
                fontWeight: 700,
              }}
            >
              {saving ? "Saving..." : "Save"}
            </button>
          </div>
        </div>
      </form>
    );
  }

  return (
    <div
      style={{
        display: "flex",
        gap: 10,
        alignItems: "flex-start",
        padding: "10px 12px",
        borderRadius: 12,
        background: "linear-gradient(135deg, #fff1f2 0%, #fef2f2 100%)",
        border: "1.5px solid #ef4444",
        boxShadow: "0 3px 10px rgba(220, 38, 38, 0.14)",
      }}
    >
      <div
        aria-hidden="true"
        style={{
          width: 36,
          height: 44,
          borderRadius: 8,
          background: "#ffffff",
          border: "1px solid #fecaca",
          display: "grid",
          placeItems: "center",
          flexShrink: 0,
          overflow: "hidden",
          padding: 3,
          boxSizing: "border-box",
        }}
      >
        <img
          src="/logo.png"
          alt=""
          style={{
            width: "100%",
            height: "100%",
            objectFit: "contain",
            display: "block",
          }}
        />
      </div>

      <div style={{ flex: 1, minWidth: 0 }}>
        <div
          style={{
            display: "flex",
            justifyContent: "space-between",
            alignItems: "center",
            gap: 6,
            flexWrap: "wrap",
            marginBottom: 3,
          }}
        >
          <span
            style={{
              fontSize: 11,
              fontWeight: 800,
              color: "#dc2626",
              textTransform: "uppercase",
              letterSpacing: "0.03em",
              display: "inline-flex",
              alignItems: "center",
              gap: 4,
            }}
          >
            {item.pinned ? "📌 Pinned" : "Admin"}
          </span>
          <span style={{ fontSize: 11, color: "#7f1d1d", fontWeight: 600 }}>
            {item.formattedDateTime}
          </span>
        </div>

        {item.title && (
          <div
            style={{
              fontSize: 13.5,
              fontWeight: 800,
              color: "#dc2626",
              lineHeight: 1.35,
              wordBreak: "break-word",
            }}
          >
            {item.title}
          </div>
        )}

        {item.text && (
          <div
            style={{
              fontSize: 12.5,
              color: "#1e293b",
              lineHeight: 1.4,
              marginTop: item.title ? 3 : 0,
              whiteSpace: "pre-wrap",
              wordBreak: "break-word",
            }}
          >
            {item.text}
          </div>
        )}

        {isAdmin && (
          <div
            style={{
              display: "flex",
              gap: 6,
              marginTop: 8,
              justifyContent: "flex-end",
              flexWrap: "wrap",
            }}
          >
            <button
              type="button"
              className="btn"
              onClick={() => onTogglePin(item.messageId)}
              title={item.pinned ? "Unpin message" : "Pin message to top"}
              style={{
                padding: "2px 7px",
                fontSize: 11,
                background: item.pinned ? "#fee2e2" : "#ffffff",
                border: "1px solid #fca5a5",
                color: "#991b1b",
                fontWeight: 700,
              }}
            >
              {item.pinned ? "Unpin" : "📌 Pin"}
            </button>
            <button
              type="button"
              className="btn"
              onClick={startEdit}
              style={{
                padding: "2px 7px",
                fontSize: 11,
                background: "#ffffff",
                border: "1px solid #fca5a5",
                color: "#991b1b",
                fontWeight: 700,
              }}
            >
              Edit
            </button>
            <button
              type="button"
              className="btn"
              onClick={() => onDelete(item.messageId)}
              style={{
                padding: "2px 7px",
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
      </div>
    </div>
  );
}

function NoticeCard({ item }) {
  const meta = getItemMeta(item);
  const showCardArt = item.type !== "streakMax" && Boolean(item.imageURL);

  return (
    <div
      style={{
        display: "flex",
        gap: 10,
        alignItems: "flex-start",
        padding: "10px 12px",
        borderRadius: 12,
        background: "#ffffff",
        border: "1px solid #e2e8f0",
        boxShadow: "0 2px 6px rgba(15, 23, 42, 0.04)",
      }}
    >
      <div
        aria-hidden="true"
        style={{
          width: 36,
          height: 44,
          borderRadius: 8,
          background: showCardArt ? "#f8fafc" : meta.accentBg,
          border: `1px solid ${showCardArt ? "#e2e8f0" : meta.accentBorder}`,
          display: "grid",
          placeItems: "center",
          fontSize: 18,
          flexShrink: 0,
          overflow: "hidden",
          padding: showCardArt ? 2 : 0,
          boxSizing: "border-box",
        }}
      >
        {showCardArt ? (
          <img
            src={item.imageURL}
            alt=""
            style={{
              width: "100%",
              height: "100%",
              objectFit: "contain",
              display: "block",
            }}
          />
        ) : (
          meta.icon
        )}
      </div>

      <div style={{ flex: 1, minWidth: 0 }}>
        <div
          style={{
            display: "flex",
            justifyContent: "space-between",
            alignItems: "center",
            gap: 6,
            flexWrap: "wrap",
            marginBottom: 3,
          }}
        >
          <span
            style={{
              fontSize: 11,
              fontWeight: 800,
              color: meta.badgeColor,
              textTransform: "uppercase",
              letterSpacing: "0.03em",
            }}
          >
            {meta.badgeText}
          </span>
          <span style={{ fontSize: 11, color: "#64748b", fontWeight: 600 }}>
            {item.formattedDateTime}
          </span>
        </div>

        <div
          style={{
            fontSize: 13,
            fontWeight: 700,
            color: "#0f172a",
            lineHeight: 1.35,
            wordBreak: "break-word",
          }}
        >
          {meta.title}
        </div>

        {meta.detail && (
          <div style={{ fontSize: 12, color: "#475569", marginTop: 2 }}>
            {meta.detail}
          </div>
        )}
      </div>
    </div>
  );
}

function NoticeGroup({
  heading,
  items,
  isAdmin,
  onSaveEdit,
  onTogglePin,
  onDelete,
  onValidationError,
}) {
  if (!items || items.length === 0) return null;

  return (
    <section style={{ display: "grid", gap: 8 }}>
      <div>
        <span
          style={{
            display: "inline-block",
            fontSize: 11,
            fontWeight: 900,
            textTransform: "uppercase",
            letterSpacing: "0.06em",
            color: "#0f172a",
            background: "rgba(255, 255, 255, 0.94)",
            border: "1px solid #cbd5e1",
            borderRadius: 999,
            padding: "4px 10px",
            boxShadow: "0 2px 6px rgba(15, 23, 42, 0.14)",
          }}
        >
          {heading}
        </span>
      </div>
      {items.map((item) =>
        item.type === "adminMessage" ? (
          <AdminMessageCard
            key={item.id}
            item={item}
            isAdmin={isAdmin}
            onSaveEdit={onSaveEdit}
            onTogglePin={onTogglePin}
            onDelete={onDelete}
            onValidationError={onValidationError}
          />
        ) : (
          <NoticeCard key={item.id} item={item} />
        )
      )}
    </section>
  );
}

export default function NoticeBoardPanel({
  mode,
  students = [],
  cards = [],
  rewards = [],
  streakConfigs = [],
  newsMessages = [],
  flagValue = "A",
  onSaveNewsMessages,
  confirmFn,
  onValidationError,
}) {
  const isAdmin = mode === "admin";
  const [showComposer, setShowComposer] = useState(false);
  const [title, setTitle] = useState("");
  const [text, setText] = useState("");
  const [pinned, setPinned] = useState(false);
  const [posting, setPosting] = useState(false);

  const { pinnedItems, items, todayItems, olderItems } = useMemo(
    () =>
      buildNoticeBoardData({
        students,
        cards,
        rewards,
        streakConfigs,
        newsMessages,
        flagValue,
      }),
    [students, cards, rewards, streakConfigs, newsMessages, flagValue]
  );

  const handleCreateMessage = async (e) => {
    e.preventDefault();
    const cleanTitle = title.trim();
    const cleanText = text.trim();
    if (!cleanTitle && !cleanText) {
      onValidationError?.("Enter a title or message text.");
      return;
    }

    const nextMsg = {
      id: uid("news"),
      title: cleanTitle,
      text: cleanText,
      pinned,
      createdAt: Date.now(),
    };

    const nextList = [nextMsg, ...(Array.isArray(newsMessages) ? newsMessages : [])];
    setPosting(true);
    const ok = await onSaveNewsMessages?.(nextList);
    setPosting(false);

    if (ok !== false) {
      setTitle("");
      setText("");
      setPinned(false);
      setShowComposer(false);
    }
  };

  const handleSaveEdit = async (messageId, updates) => {
    const current = Array.isArray(newsMessages) ? newsMessages : [];
    const nextList = current.map((m) =>
      m?.id === messageId
        ? {
            ...m,
            title: updates.title,
            text: updates.text,
            pinned: Boolean(updates.pinned),
            updatedAt: Date.now(),
          }
        : m
    );
    return onSaveNewsMessages?.(nextList);
  };

  const handleTogglePin = async (messageId) => {
    const current = Array.isArray(newsMessages) ? newsMessages : [];
    const nextList = current.map((m) =>
      m?.id === messageId
        ? {
            ...m,
            pinned: !m.pinned,
            updatedAt: Date.now(),
          }
        : m
    );
    await onSaveNewsMessages?.(nextList);
  };

  const handleDeleteMessage = async (messageId) => {
    if (confirmFn && !(await confirmFn("Delete this news message?"))) return;
    const current = Array.isArray(newsMessages) ? newsMessages : [];
    const nextList = current.filter((m) => m?.id !== messageId);
    await onSaveNewsMessages?.(nextList);
  };

  return (
    <div style={{ display: "grid", gap: 14 }}>
      {isAdmin && (
        <div style={{ display: "grid", gap: 8 }}>
          <div style={{ display: "flex", justifyContent: "flex-end" }}>
            <button
              type="button"
              className="btn"
              onClick={() => setShowComposer((prev) => !prev)}
              style={{
                background: showComposer ? "#fee2e2" : "#ffffff",
                border: "1px solid #ef4444",
                color: "#dc2626",
                fontWeight: 700,
                fontSize: 12,
                padding: "5px 10px",
              }}
            >
              {showComposer ? "✕ Cancel" : "+ Write news"}
            </button>
          </div>

          {showComposer && (
            <form
              onSubmit={handleCreateMessage}
              style={{
                padding: 12,
                borderRadius: 12,
                background: "linear-gradient(135deg, #fff1f2 0%, #fef2f2 100%)",
                border: "1.5px solid #ef4444",
                boxShadow: "0 3px 10px rgba(220, 38, 38, 0.12)",
                display: "grid",
                gap: 8,
              }}
            >
              <input
                type="text"
                value={title}
                onChange={(e) => setTitle(e.target.value)}
                placeholder="Title (optional)"
                style={{
                  width: "100%",
                  padding: "6px 8px",
                  borderRadius: 8,
                  border: "1px solid #fca5a5",
                  fontSize: 13,
                  fontWeight: 700,
                  color: "#dc2626",
                  background: "#ffffff",
                  boxSizing: "border-box",
                }}
              />
              <textarea
                value={text}
                onChange={(e) => setText(e.target.value)}
                placeholder="Message text (optional)"
                rows={3}
                style={{
                  width: "100%",
                  padding: "6px 8px",
                  borderRadius: 8,
                  border: "1px solid #fca5a5",
                  fontSize: 12.5,
                  color: "#0f172a",
                  background: "#ffffff",
                  resize: "vertical",
                  boxSizing: "border-box",
                  fontFamily: "inherit",
                }}
              />
              <div
                style={{
                  display: "flex",
                  justifyContent: "space-between",
                  alignItems: "center",
                  gap: 8,
                  flexWrap: "wrap",
                }}
              >
                <label
                  style={{
                    display: "inline-flex",
                    alignItems: "center",
                    gap: 6,
                    fontSize: 12,
                    fontWeight: 700,
                    color: "#991b1b",
                    cursor: "pointer",
                  }}
                >
                  <input
                    type="checkbox"
                    checked={pinned}
                    onChange={(e) => setPinned(e.target.checked)}
                    style={{ accentColor: "#dc2626" }}
                  />
                  📌 Pin to top
                </label>
                <button
                  type="submit"
                  className="btn"
                  disabled={posting}
                  style={{
                    padding: "5px 12px",
                    fontSize: 12,
                    background: "#dc2626",
                    color: "#ffffff",
                    border: "1px solid #b91c1c",
                    fontWeight: 700,
                  }}
                >
                  {posting ? "Posting..." : "Post"}
                </button>
              </div>
            </form>
          )}
        </div>
      )}

      {items.length === 0 ? (
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
          No news yet for this class.
        </div>
      ) : (
        <>
          <NoticeGroup
            heading="📌 Pinned"
            items={pinnedItems}
            isAdmin={isAdmin}
            onSaveEdit={handleSaveEdit}
            onTogglePin={handleTogglePin}
            onDelete={handleDeleteMessage}
            onValidationError={onValidationError}
          />
          <NoticeGroup
            heading="Today"
            items={todayItems}
            isAdmin={isAdmin}
            onSaveEdit={handleSaveEdit}
            onTogglePin={handleTogglePin}
            onDelete={handleDeleteMessage}
            onValidationError={onValidationError}
          />
          <NoticeGroup
            heading="Older"
            items={olderItems}
            isAdmin={isAdmin}
            onSaveEdit={handleSaveEdit}
            onTogglePin={handleTogglePin}
            onDelete={handleDeleteMessage}
            onValidationError={onValidationError}
          />
        </>
      )}
    </div>
  );
}
