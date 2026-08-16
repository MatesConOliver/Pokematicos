import React, { useMemo } from "react";

function hashStrToInt(str) {
  let h = 2166136261;
  for (let i = 0; i < str.length; i++) {
    h ^= str.charCodeAt(i);
    h = Math.imul(h, 16777619);
  }
  return h >>> 0;
}

function mulberry32(seed) {
  return function () {
    let t = (seed += 0x6d2b79f5);
    t = Math.imul(t ^ (t >>> 15), t | 1);
    t ^= t + Math.imul(t ^ (t >>> 7), t | 61);
    return ((t ^ (t >>> 14)) >>> 0) / 4294967296;
  };
}

export default function EmojiParty({ emoji, seedKey, count = 18 }) {
  const particles = useMemo(() => {
    const rnd = mulberry32(hashStrToInt(seedKey));
    return Array.from({ length: count }).map((_, i) => {
      const left = rnd() * 100;
      const delay = rnd() * 1.4;
      const dur = 1.2 + rnd() * 1.2;
      const size = 18 + rnd() * 22;
      const drift = (rnd() - 0.5) * 60;
      return { i, left, delay, dur, size, drift };
    });
  }, [seedKey, count]);

  return (
    <div className="emoji-party-layer" aria-hidden="true">
      {particles.map((p) => (
        <span
          key={p.i}
          className="emoji-party-particle"
          style={{
            left: `${p.left}%`,
            fontSize: p.size,
            animationDuration: `${p.dur}s`,
            animationDelay: `${p.delay}s`,
            transform: `translate(-50%, 0) translateX(${p.drift}px)`,
          }}
        >
          {emoji}
        </span>
      ))}
    </div>
  );
}
