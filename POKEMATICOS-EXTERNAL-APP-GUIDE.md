# Pokemáticos External App Integration Guide

This guide explains how any external educational app, quiz, or game can generate reward codes compatible with Pokemáticos.

---

## 1. How the Flow Works

1. **Student Public ID**:
   - In Pokemáticos, each student has a unique **Public ID** found under **Profile → Settings → Public ID**.
   - In your external app, ask the student for their Public Student ID (or prompt them to enter/paste it).

2. **Source ID & Activity ID (Max 6 Characters Each)**:
   - `sourceId`: Identifies your app (up to 6 alphanumeric characters, e.g., `MATH01`, `TRIVIA`, `READ01`).
   - `activityId`: Identifies the specific exercise or level (up to 6 alphanumeric characters, e.g., `EX0001`, `LVL002`, `QUIZ05`).
   - *Important*: These exact IDs must be added to Pokemáticos under **Class Admin → Activity Catalogue** so Pokemáticos knows how many points or cards to award.

3. **Code Generation**:
   - When the student completes an exercise/quiz, your app runs the generator function with `(studentId, sourceId, activityId)`.
   - It outputs a 28-character code formatted as: `XXXX-XXXX-XXXX-XXXX-XXXX-XXXX-XXXX`.

4. **Redemption in Pokemáticos**:
   - The student copies the code, opens Pokemáticos, and pastes it into **Profile → Redeem**.
   - Points and/or cards are immediately credited, and the achievement is logged in their profile history.

---

## 2. Complete Code Generator (Copy & Paste into Your App)

Here is the exact, zero-dependency JavaScript/TypeScript code generator used by Pokemáticos:

```javascript
/* global BigInt */

/**
 * Calculate CRC-8 checksum (ATM polynomial)
 */
function crc8(buffer) {
  let crc = 0xff;
  for (let i = 0; i < buffer.length; i++) {
    crc ^= buffer[i];
    for (let j = 0; j < 8; j++) {
      if (crc & 0x80) {
        crc = ((crc << 1) ^ 0x07) & 0xff;
      } else {
        crc = (crc << 1) & 0xff;
      }
    }
  }
  return crc ^ 0xff;
}

/**
 * Calculate CRC-32 checksum
 */
function crc32(str) {
  let crc = 0xffffffff;
  for (let i = 0; i < str.length; i++) {
    const byte = str.charCodeAt(i) & 0xff;
    crc ^= byte;
    for (let j = 0; j < 8; j++) {
      crc = (crc >>> 1) ^ (crc & 1 ? 0xedb88320 : 0);
    }
  }
  return (crc ^ 0xffffffff) >>> 0;
}

/**
 * Convert bytes to a 28-character base36 string
 */
function toBase36(bytes) {
  let n = 0n;
  for (const byte of bytes) {
    n = (n << 8n) | BigInt(byte);
  }
  let base36 = n.toString(36).toUpperCase();
  return base36.padStart(28, '0');
}

/**
 * Format base36 string into 7 groups of 4 characters
 */
function formatCode(base36) {
  return (
    base36.substring(0, 4) + '-' +
    base36.substring(4, 8) + '-' +
    base36.substring(8, 12) + '-' +
    base36.substring(12, 16) + '-' +
    base36.substring(16, 20) + '-' +
    base36.substring(20, 24) + '-' +
    base36.substring(24, 28)
  );
}

/**
 * Generate a valid Pokemáticos Reward Code
 *
 * @param {string} studentId - The student's Public ID from Pokemáticos
 * @param {string} sourceId - App ID (max 6 characters, e.g. "MATH01")
 * @param {string} activityId - Activity/Quiz ID (max 6 characters, e.g. "EX0001")
 * @returns {string} Formatted code: XXXX-XXXX-XXXX-XXXX-XXXX-XXXX-XXXX
 */
export function generateRewardCode(studentId, sourceId, activityId) {
  if (!studentId || !studentId.trim()) throw new Error('Student ID is required');
  if (!sourceId || !sourceId.trim()) throw new Error('Source ID is required');
  if (!activityId || !activityId.trim()) throw new Error('Activity ID is required');

  const payload = [];

  // Version: 1 byte (0x01)
  payload.push(0x01);

  // Student ID hash: CRC-32 (4 bytes, big-endian)
  const studentHash = crc32(studentId.trim());
  payload.push((studentHash >> 24) & 0xff);
  payload.push((studentHash >> 16) & 0xff);
  payload.push((studentHash >> 8) & 0xff);
  payload.push(studentHash & 0xff);

  // Source ID: 6 bytes (padded with spaces)
  const sourceTrunc = sourceId.trim().substring(0, 6).padEnd(6, ' ');
  for (let i = 0; i < 6; i++) {
    payload.push(sourceTrunc.charCodeAt(i));
  }

  // Activity ID: 6 bytes (padded with spaces)
  const actTrunc = activityId.trim().substring(0, 6).padEnd(6, ' ');
  for (let i = 0; i < 6; i++) {
    payload.push(actTrunc.charCodeAt(i));
  }

  // Checksum: CRC-8 (1 byte)
  const checksum = crc8(new Uint8Array(payload));
  payload.push(checksum);

  // Encode to 28-character base36 and format
  const base36 = toBase36(new Uint8Array(payload));
  return formatCode(base36);
}
```

---

## 3. Python Version (if your external app runs in Python/Streamlit/Flask)

```python
import zlib

def crc8(data: bytes) -> int:
    crc = 0xFF
    for byte in data:
        crc ^= byte
        for _ in range(8):
            if crc & 0x80:
                crc = ((crc << 1) ^ 0x07) & 0xFF
            else:
                crc = (crc << 1) & 0xFF
    return crc ^ 0xFF

def generate_reward_code(student_id: str, source_id: str, activity_id: str) -> str:
    student_id = student_id.strip()
    source_id = source_id.strip()[:6].ljust(6, ' ')
    activity_id = activity_id.strip()[:6].ljust(6, ' ')
    
    payload = bytearray([0x01])
    student_hash = zlib.crc32(student_id.encode('utf-8')) & 0xFFFFFFFF
    payload.extend(student_hash.to_bytes(4, byteorder='big'))
    payload.extend(source_id.encode('latin1'))
    payload.extend(activity_id.encode('latin1'))
    
    checksum = crc8(payload)
    payload.append(checksum)
    
    num = int.from_bytes(payload, byteorder='big')
    chars = "0123456789ABCDEFGHIJKLMNOPQRSTUVWXYZ"
    base36 = ""
    while num > 0:
        num, rem = divmod(num, 36)
        base36 = chars[rem] + base36
    base36 = base36.zfill(28)
    
    return "-".join([base36[i:i+4] for i in range(0, 28, 4)])
```
