/**
 * Public Student ID Display Component
 *
 * Displays the student's Public ID (Firestore UID) for sharing with external apps
 * Includes copy-to-clipboard button for ease of use
 */

import React, { useState } from "react";

export function PublicStudentIdDisplay({ studentId }) {
  const [copied, setCopied] = useState(false);

  const handleCopyToClipboard = async () => {
    try {
      await navigator.clipboard.writeText(studentId);
      setCopied(true);

      // Reset "copied" message after 2 seconds
      setTimeout(() => setCopied(false), 2000);
    } catch (err) {
      console.error("Failed to copy to clipboard:", err);
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
        Your Public ID
      </div>

      {/* Description */}
      <div
        className="muted"
        style={{
          fontSize: 12,
          marginBottom: 12,
        }}
      >
        Share this ID with external apps to generate achievement codes. This ID is permanent and
        unique to your account.
      </div>

      {/* ID Display Container */}
      <div
        style={{
          display: "flex",
          gap: 8,
          alignItems: "center",
          padding: 12,
          background: "#f9fafb",
          borderRadius: 6,
          border: "1px solid #f3f4f6",
        }}
      >
        {/* ID Value */}
        <div
          style={{
            flex: 1,
            fontFamily: "monospace",
            fontSize: 13,
            fontWeight: 600,
            color: "#1f2937",
            wordBreak: "break-all",
            lineHeight: 1.4,
            userSelect: "all",
          }}
        >
          {studentId}
        </div>

        {/* Copy Button */}
        <button
          type="button"
          onClick={handleCopyToClipboard}
          title={copied ? "Copied!" : "Copy to clipboard"}
          style={{
            flexShrink: 0,
            padding: "8px 12px",
            background: copied ? "#dcfce7" : "#f3f4f6",
            color: copied ? "#166534" : "#6b7280",
            border: `1px solid ${copied ? "#bbf7d0" : "#d1d5db"}`,
            borderRadius: 6,
            cursor: "pointer",
            fontSize: 12,
            fontWeight: 600,
            transition: "all 0.2s",
            whiteSpace: "nowrap",
            lineHeight: 1,
          }}
        >
          {copied ? "✓ Copied" : "Copy"}
        </button>
      </div>

      {/* Info Box */}
      <div
        style={{
          marginTop: 12,
          padding: 10,
          background: "#f0f9ff",
          border: "1px solid #bfdbfe",
          borderRadius: 6,
          fontSize: 12,
          color: "#1e40af",
          lineHeight: 1.5,
        }}
      >
        <strong>How to use:</strong>
        <ol style={{ margin: "4px 0 0 16px", paddingLeft: 0 }}>
          <li>Copy your Public ID</li>
          <li>Provide it to the external app/exercise platform</li>
          <li>The app will generate a unique achievement code for you</li>
          <li>
            Return to Pokemáticos and paste the code in the <strong>Redeem Achievement Code</strong>{" "}
            section
          </li>
        </ol>
      </div>
    </div>
  );
}
