/**
 * Utility helpers - pure, independent functions
 */

function uid(prefix = "id") {
  return `${prefix}_${Math.random().toString(36).slice(2, 10)}`;
}

function round2(x) {
  return Math.round((Number(x) || 0) * 100) / 100;
}

function safeLower(s) {
  return (s || "").toString().toLowerCase();
}

const PASTEL_COLORS = [
  { name: "Mint", value: "#D1FAE5" },
  { name: "Sky", value: "#DBEAFE" },
  { name: "Lavender", value: "#EDE9FE" },
  { name: "Peach", value: "#FFEDD5" },
  { name: "Rose", value: "#FFE4E6" },
  { name: "Lemon", value: "#FEF9C3" },
  { name: "Aqua", value: "#CFFAFE" },
  { name: "Sand", value: "#F5F5DC" },
];

export { uid, round2, safeLower, PASTEL_COLORS };
