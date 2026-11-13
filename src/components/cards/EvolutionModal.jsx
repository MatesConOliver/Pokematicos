import React, { useEffect, useState, useMemo } from "react";
import { getCardDisplayImage } from "../../utils/cardImageUtils";

function playEvolutionChime() {
  try {
    const AudioCtx = window.AudioContext || window.webkitAudioContext;
    if (!AudioCtx) return;
    const ctx = new AudioCtx();
    const notes = [261.63, 329.63, 392.0, 523.25, 659.25, 783.99, 1046.5];
    notes.forEach((freq, i) => {
      const osc = ctx.createOscillator();
      const gain = ctx.createGain();
      osc.type = "triangle";
      osc.frequency.setValueAtTime(freq, ctx.currentTime + i * 0.12);
      gain.gain.setValueAtTime(0.18, ctx.currentTime + i * 0.12);
      gain.gain.exponentialRampToValueAtTime(0.001, ctx.currentTime + i * 0.12 + 0.35);
      osc.connect(gain);
      gain.connect(ctx.destination);
      osc.start(ctx.currentTime + i * 0.12);
      osc.stop(ctx.currentTime + i * 0.12 + 0.4);
    });
  } catch {
    // Audio optional / silenced safely if autoplay policy blocks
  }
}

export default function EvolutionModal({
  baseCard,
  evolvedCard,
  flagValue = "A",
  onClose,
}) {
  // Stages: 0 = intro, 1 = glowing/morphing, 2 = evolved celebration
  const [stage, setStage] = useState(0);

  const baseImage = useMemo(
    () => (baseCard ? getCardDisplayImage(baseCard, flagValue, false) : ""),
    [baseCard, flagValue]
  );
  const evolvedImage = useMemo(
    () => (evolvedCard ? getCardDisplayImage(evolvedCard, flagValue, false) : ""),
    [evolvedCard, flagValue]
  );

  useEffect(() => {
    // Stage sequence
    const t1 = setTimeout(() => {
      setStage(1);
    }, 1200);

    const t2 = setTimeout(() => {
      setStage(2);
      playEvolutionChime();
    }, 3600);

    return () => {
      clearTimeout(t1);
      clearTimeout(t2);
    };
  }, []);

  return (
    <div
      style={{
        position: "fixed",
        inset: 0,
        zIndex: 99999,
        background: "radial-gradient(circle at center, #1e1b4b 0%, #09090b 100%)",
        display: "flex",
        flexDirection: "column",
        alignItems: "center",
        justifyContent: "center",
        padding: 20,
        color: "#ffffff",
        userSelect: "none",
        animation: "fadeIn 0.4s ease-out",
      }}
    >
      <style>{`
        @keyframes evoPulse {
          0% { transform: scale(1); filter: brightness(1); }
          50% { transform: scale(1.08); filter: brightness(2.2) drop-shadow(0 0 35px #a855f7); }
          100% { transform: scale(1); filter: brightness(1); }
        }
        @keyframes evoFlash {
          0%, 100% { opacity: 1; }
          50% { opacity: 0.2; }
        }
        @keyframes popIn {
          0% { transform: scale(0.6) rotate(-5deg); opacity: 0; }
          70% { transform: scale(1.1) rotate(2deg); opacity: 1; }
          100% { transform: scale(1) rotate(0deg); opacity: 1; }
        }
        @keyframes raysRotate {
          0% { transform: rotate(0deg); }
          100% { transform: rotate(360deg); }
        }
      `}</style>

      {/* Rotating ray background during morphing and celebration */}
      {stage >= 1 && (
        <div
          style={{
            position: "absolute",
            width: 600,
            height: 600,
            borderRadius: "50%",
            background:
              stage === 1
                ? "conic-gradient(from 0deg, rgba(168, 85, 247, 0.25), transparent 60deg, rgba(236, 72, 153, 0.25) 120deg, transparent 180deg, rgba(168, 85, 247, 0.25) 240deg, transparent 300deg)"
                : "conic-gradient(from 0deg, rgba(234, 179, 8, 0.35), transparent 45deg, rgba(59, 130, 246, 0.35) 90deg, transparent 135deg, rgba(234, 179, 8, 0.35) 180deg, transparent 225deg, rgba(236, 72, 153, 0.35) 270deg, transparent 315deg)",
            animation: "raysRotate 8s linear infinite",
            pointerEvents: "none",
          }}
        />
      )}

      {/* Title Header */}
      <div style={{ textAlign: "center", marginBottom: 24, zIndex: 2 }}>
        {stage === 0 && (
          <h2 style={{ fontSize: 24, fontWeight: 800, margin: 0, color: "#e0e7ff" }}>
            El poder de la evolución despierta...
          </h2>
        )}
        {stage === 1 && (
          <h2 style={{ fontSize: 28, fontWeight: 900, margin: 0, color: "#fef08a", textShadow: "0 0 20px #eab308" }}>
            ¡¿Qué?! ¡{baseCard?.title || "La carta"} está evolucionando!
          </h2>
        )}
        {stage === 2 && (
          <div>
            <span
              style={{
                display: "inline-block",
                padding: "6px 16px",
                background: "linear-gradient(90deg, #ec4899, #8b5cf6)",
                borderRadius: 999,
                fontSize: 13,
                fontWeight: 800,
                letterSpacing: 1.5,
                textTransform: "uppercase",
                marginBottom: 8,
              }}
            >
              ¡Evolución Completada!
            </span>
            <h1
              style={{
                fontSize: 32,
                fontWeight: 900,
                margin: 0,
                color: "#fde047",
                textShadow: "0 0 25px rgba(253, 224, 71, 0.8)",
              }}
            >
              ¡{baseCard?.title} ha evolucionado a {evolvedCard?.title}!
            </h1>
          </div>
        )}
      </div>

      {/* Card stage display */}
      <div
        style={{
          width: 250,
          height: 350,
          borderRadius: 20,
          overflow: "hidden",
          position: "relative",
          background: "#18181b",
          boxShadow:
            stage === 2
              ? "0 0 50px rgba(234, 179, 8, 0.7), 0 0 20px rgba(255, 255, 255, 0.5)"
              : "0 0 30px rgba(168, 85, 247, 0.4)",
          display: "flex",
          alignItems: "center",
          justifyContent: "center",
          zIndex: 2,
          animation:
            stage === 1
              ? "evoPulse 1.2s ease-in-out infinite"
              : stage === 2
              ? "popIn 0.8s cubic-bezier(0.175, 0.885, 0.32, 1.275)"
              : "none",
        }}
      >
        {stage < 2 ? (
          <div style={{ width: "100%", height: "100%", position: "relative" }}>
            {baseImage ? (
              <img
                src={baseImage}
                alt={baseCard?.title}
                style={{
                  width: "100%",
                  height: "100%",
                  objectFit: "cover",
                  filter: stage === 1 ? "brightness(1.5) contrast(1.2)" : "none",
                }}
              />
            ) : (
              <div style={{ padding: 20, textAlign: "center", color: "#fff" }}>
                {baseCard?.title}
              </div>
            )}
            {stage === 1 && (
              <div
                style={{
                  position: "absolute",
                  inset: 0,
                  background: "radial-gradient(circle, rgba(255,255,255,0.85) 0%, rgba(168,85,247,0.5) 100%)",
                  animation: "evoFlash 0.35s ease-in-out infinite",
                  mixBlendMode: "screen",
                }}
              />
            )}
          </div>
        ) : (
          <div style={{ width: "100%", height: "100%", position: "relative" }}>
            {evolvedImage ? (
              <img
                src={evolvedImage}
                alt={evolvedCard?.title}
                style={{
                  width: "100%",
                  height: "100%",
                  objectFit: "cover",
                }}
              />
            ) : (
              <div style={{ padding: 20, textAlign: "center", color: "#fff", fontWeight: 800 }}>
                {evolvedCard?.title}
              </div>
            )}
          </div>
        )}
      </div>

      {/* Footer Notes and Action */}
      <div style={{ textAlign: "center", marginTop: 24, zIndex: 2, maxWidth: 440 }}>
        {stage === 2 && (
          <div
            style={{
              background: "rgba(255, 255, 255, 0.1)",
              backdropFilter: "blur(10px)",
              padding: "10px 16px",
              borderRadius: 12,
              marginBottom: 16,
              fontSize: 13,
              color: "#e2e8f0",
              border: "1px solid rgba(255, 255, 255, 0.15)",
            }}
          >
            🔮 Se ha consumido <b>1 Catalizador</b> de tu biblioteca. Tus cartas base se han conservado.
          </div>
        )}

        {stage === 2 ? (
          <button
            className="btn"
            onClick={onClose}
            style={{
              padding: "12px 32px",
              fontSize: 16,
              fontWeight: 800,
              borderRadius: 999,
              background: "linear-gradient(135deg, #f59e0b, #ef4444)",
              color: "#ffffff",
              border: "none",
              boxShadow: "0 4px 15px rgba(245, 158, 11, 0.5)",
              cursor: "pointer",
            }}
          >
            ¡Genial! Continuar
          </button>
        ) : (
          <div style={{ fontSize: 13, color: "#a1a1aa", fontStyle: "italic" }}>
            Canalizando energía evolutiva...
          </div>
        )}
      </div>
    </div>
  );
}
