import React, { useMemo } from "react";
import { buildNoticeBoardData } from "../../services/noticeBoardService";

function getItemMeta(item) {
  switch (item.type) {
    case "streakMax": {
      const count = item.studentNames?.length || 0;
      const namesText = (item.studentNames || []).join(", ");
      return {
        icon: item.emoji || "🔥",
        accentBg: "#fff7ed",
        accentBorder: "#fed7aa",
        badgeText: "Max streak",
        badgeColor: "#c2410c",
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
          accentBg: "#f5f3ff",
          accentBorder: "#ddd6fe",
          badgeText: "Group reward",
          badgeColor: "#6d28d9",
          title: `Group redeemed: ${item.rewardTitle}`,
          detail: `${n} ${n === 1 ? "person" : "people"} contributed (1+ pt)`,
        };
      }
      return {
        icon: "🎁",
        accentBg: "#ecfdf5",
        accentBorder: "#a7f3d0",
        badgeText: "Reward redeemed",
        badgeColor: "#047857",
        title: `${item.studentName} redeemed ${item.rewardTitle}`,
        detail: item.cost > 0 ? `${item.cost} pts` : "",
      };
    }
    case "experienceCard": {
      return {
        icon: "✨",
        accentBg: "#eff6ff",
        accentBorder: "#bfdbfe",
        badgeText: "Experience card",
        badgeColor: "#1d4ed8",
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
        accentBg: "#fefce8",
        accentBorder: "#fde68a",
        badgeText: `New ${catLabel} card`,
        badgeColor: "#a16207",
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
        badgeText: "Notice",
        badgeColor: "#475569",
        title: "",
        detail: "",
      };
  }
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

function NoticeGroup({ heading, items }) {
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
      {items.map((item) => (
        <NoticeCard key={item.id} item={item} />
      ))}
    </section>
  );
}

export default function NoticeBoardPanel({
  students = [],
  cards = [],
  rewards = [],
  streakConfigs = [],
  flagValue = "A",
}) {
  const { items, todayItems, olderItems } = useMemo(
    () => buildNoticeBoardData({ students, cards, rewards, streakConfigs, flagValue }),
    [students, cards, rewards, streakConfigs, flagValue]
  );

  if (items.length === 0) {
    return (
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
        No announcements yet for this class.
      </div>
    );
  }

  return (
    <div style={{ display: "grid", gap: 14 }}>
      <NoticeGroup heading="Today" items={todayItems} />
      <NoticeGroup heading="Older" items={olderItems} />
    </div>
  );
}
