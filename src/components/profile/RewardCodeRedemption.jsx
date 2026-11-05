/**
 * Reward Code Redemption Component
 *
 * UI for students to paste and redeem reward codes
 */

import React, { useState } from "react";
import { redeemRewardCode } from "../../services/rewardCodeService.js";

export function RewardCodeRedemption({ db, classId, studentId, onSuccess }) {
  const [codeInput, setCodeInput] = useState("");
  const [isLoading, setIsLoading] = useState(false);
  const [message, setMessage] = useState(null);
  const [messageType, setMessageType] = useState("info"); // "success" | "error" | "info"

  const handleRedeem = async () => {
    if (!codeInput.trim()) {
      setMessage("Please enter a code.");
      setMessageType("error");
      return;
    }

    setIsLoading(true);
    setMessage(null);

    try {
      const result = await redeemRewardCode({
        db,
        classId,
        studentId,
        codeString: codeInput,
      });

      if (result.success) {
        setMessageType("success");
        setMessage(
          `✓ ${result.message} You earned ${result.achievement.effectivePointsAwarded} points!`
        );
        setCodeInput(""); // Clear input on success

        // Notify parent to refresh data
        if (onSuccess) {
          onSuccess(result.achievement);
        }
      } else {
        setMessageType("error");
        setMessage(`✗ ${result.message}`);
      }
    } catch (err) {
      console.error("Error redeeming code:", err);
      setMessageType("error");
      setMessage("An error occurred while redeeming the code. Try again later.");
    } finally {
      setIsLoading(false);
    }
  };

  const handleKeyPress = (e) => {
    if (e.key === "Enter" && !isLoading) {
      handleRedeem();
    }
  };

  return (
    <div
      style={{
        border: "1px solid #e5e7eb",
        borderRadius: 12,
        padding: 14,
        background: "#ffffff",
      }}
    >
      {/* Label */}
      <div
        style={{
          fontSize: 12,
          textTransform: "uppercase",
          letterSpacing: "0.5px",
          color: "#6b7280",
          fontWeight: 700,
          marginBottom: 8,
        }}
      >
        Redeem Achievement Code
      </div>

      {/* Description */}
      <div
        className="muted"
        style={{
          fontSize: 12,
          marginBottom: 12,
        }}
      >
        Paste a code from an external activity or exercise to claim your reward.
      </div>

      {/* Input Field */}
      <div
        style={{
          display: "flex",
          gap: 8,
          marginBottom: 12,
        }}
      >
        <input
          type="text"
          placeholder="Paste code here (e.g., XXXX-XXXX-XXXX-...)"
          value={codeInput}
          onChange={(e) => setCodeInput(e.target.value.toUpperCase())}
          onKeyPress={handleKeyPress}
          disabled={isLoading}
          style={{
            flex: 1,
            padding: "8px 12px",
            border: "1px solid #d1d5db",
            borderRadius: 6,
            fontSize: 13,
            fontFamily: "monospace",
            fontWeight: 500,
            letterSpacing: "0.5px",
          }}
        />
        <button
          type="button"
          onClick={handleRedeem}
          disabled={isLoading || !codeInput.trim()}
          style={{
            padding: "8px 16px",
            background: isLoading || !codeInput.trim() ? "#d1d5db" : "#2563eb",
            color: "#ffffff",
            border: "none",
            borderRadius: 6,
            cursor: isLoading || !codeInput.trim() ? "not-allowed" : "pointer",
            fontSize: 13,
            fontWeight: 600,
            transition: "background 0.2s",
          }}
        >
          {isLoading ? "Redeeming..." : "Redeem"}
        </button>
      </div>

      {/* Message Display */}
      {message && (
        <div
          style={{
            padding: 10,
            borderRadius: 6,
            fontSize: 13,
            background:
              messageType === "success"
                ? "#dcfce7"
                : messageType === "error"
                  ? "#fee2e2"
                  : "#dbeafe",
            color:
              messageType === "success"
                ? "#166534"
                : messageType === "error"
                  ? "#991b1b"
                  : "#1e40af",
            border: `1px solid ${
              messageType === "success"
                ? "#bbf7d0"
                : messageType === "error"
                  ? "#fecaca"
                  : "#93c5fd"
            }`,
            marginTop: 8,
          }}
        >
          {message}
        </div>
      )}
    </div>
  );
}
