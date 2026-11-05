/**
 * PKM Reward Code System - Core Utilities (REVISED)
 *
 * Encoding/decoding functions for achievement codes.
 * Generates and validates codes in format: XXXX-XXXX-XXXX-XXXX-XXXX-XXXX-XXXX
 *
 * REVISED ALGORITHM (fits in 28 base36 chars = 18 bytes max):
 * Version (1) + StudentIDHash/CRC-32 (4) + SourceID/6chars (6) + ActivityID/6chars (6) + CRC-16 (2)
 * Total: 18 bytes → base36 → 28 characters
 */
/* global BigInt */

/**
 * Calculate CRC-8 checksum (ATM polynomial)
 * Polynomial: 0x07, Initial: 0x00, No final XOR
 *
 * @param {Uint8Array} buffer - Data to checksum
 * @returns {number} CRC-8 value (8-bit unsigned)
 */
function crc8(buffer) {
  let crc = 0x00;
  for (let i = 0; i < buffer.length; i++) {
    crc ^= buffer[i];
    for (let j = 0; j < 8; j++) {
      if (crc & 0x80) {
        crc = ((crc << 1) ^ 0x07) & 0xFF;
      } else {
        crc = (crc << 1) & 0xFF;
      }
    }
  }
  return crc;
}

/**
 * Calculate CRC-32 checksum
 * Polynomial: 0x04C11DB7, Initial: 0xFFFFFFFF, Final XOR: 0xFFFFFFFF
 *
 * @param {string} str - String to checksum
 * @returns {number} CRC-32 value (32-bit unsigned)
 */
function crc32(str) {
  let crc = 0xFFFFFFFF;

  for (let i = 0; i < str.length; i++) {
    const byte = str.charCodeAt(i) & 0xFF;
    crc ^= byte;
    for (let j = 0; j < 8; j++) {
      crc = (crc >>> 1) ^ ((crc & 1) ? 0xEDB88320 : 0);
    }
  }

  return (crc ^ 0xFFFFFFFF) >>> 0;
}

/**
 * Convert bytes to base36 string (28 characters, padded with '0')
 *
 * @param {Uint8Array} bytes - Binary data
 * @returns {string} Base36 encoded string, exactly 28 characters
 */
function toBase36(bytes) {
  // Convert bytes to big integer
  let n = 0n;
  for (const byte of bytes) {
    n = (n << 8n) | BigInt(byte);
  }

  // Convert to base36
  let base36 = n.toString(36).toUpperCase();

  // Pad to 28 characters (pad left with zeros)
  base36 = base36.padStart(28, '0');

  return base36;
}

/**
 * Convert base36 string back to bytes
 *
 * @param {string} str - Base36 string (28 characters)
 * @returns {Uint8Array} Binary data
 */
function fromBase36(str) {
  // Convert base36 string to BigInt
  // We can't use parseInt() for very large numbers as it loses precision
  // Instead, build the BigInt digit by digit
  let n = 0n;
  for (const char of str) {
    const digit = parseInt(char, 36);
    n = n * 36n + BigInt(digit);
  }

  // Extract bytes (big-endian)
  const bytes = [];
  for (let i = 0; i < 100; i++) {
    bytes.unshift(Number(n & 0xFFn));
    n >>= 8n;
    if (n === 0n) break;
  }

  // Pad with leading zeros to expected payload size (18 bytes)
  while (bytes.length < 18) {
    bytes.unshift(0x00);
  }

  return new Uint8Array(bytes);
}

/**
 * Normalize code input: uppercase, remove hyphens/spaces
 *
 * @param {string} input - Raw user input
 * @returns {string} Normalized code (28 base36 chars, no hyphens)
 */
function normalizeCode(input) {
  return input.toUpperCase().replace(/[-\s]/g, '');
}

/**
 * Format base36 string with hyphens for display
 *
 * @param {string} base36 - 28-character base36 string
 * @returns {string} Formatted code: XXXX-XXXX-XXXX-XXXX-XXXX-XXXX-XXXX
 */
function formatCode(base36) {
  if (base36.length !== 28) {
    throw new Error(`Base36 string must be exactly 28 characters, got ${base36.length}`);
  }
  return (
    base36.substring(0, 4) +
    '-' +
    base36.substring(4, 8) +
    '-' +
    base36.substring(8, 12) +
    '-' +
    base36.substring(12, 16) +
    '-' +
    base36.substring(16, 20) +
    '-' +
    base36.substring(20, 24) +
    '-' +
    base36.substring(24, 28)
  );
}

/**
 * Generate a reward code
 *
 * Same inputs always generate the same code (deterministic).
 *
 * @param {string} studentId - Firestore student document ID (any length)
 * @param {string} sourceId - Application identifier (max 6 chars for this encoding, will truncate)
 * @param {string} activityId - Activity identifier (max 6 chars for this encoding, will truncate)
 * @returns {string} Formatted code (XXXX-XXXX-... format)
 * @throws {Error} If inputs are invalid
 */
export function generateRewardCode(studentId, sourceId, activityId) {
  // Validate inputs
  if (!studentId || studentId.length === 0) {
    throw new Error('Student ID is required');
  }
  if (!sourceId || sourceId.length === 0) {
    throw new Error('Source ID is required');
  }
  if (!activityId || activityId.length === 0) {
    throw new Error('Activity ID is required');
  }

  // Build payload
  const payload = [];

  // Version (1 byte)
  payload.push(0x01);

  // Student ID hash (CRC-32 of full ID, 4 bytes, big-endian)
  const studentHash = crc32(studentId);
  payload.push((studentHash >> 24) & 0xFF);
  payload.push((studentHash >> 16) & 0xFF);
  payload.push((studentHash >> 8) & 0xFF);
  payload.push(studentHash & 0xFF);

  // Source ID (6 bytes, truncate and pad with spaces)
  const sourceIdTrunc = sourceId.substring(0, 6).padEnd(6, ' ');
  for (let i = 0; i < 6; i++) {
    payload.push(sourceIdTrunc.charCodeAt(i));
  }

  // Activity ID (6 bytes, truncate and pad with spaces)
  const activityIdTrunc = activityId.substring(0, 6).padEnd(6, ' ');
  for (let i = 0; i < 6; i++) {
    payload.push(activityIdTrunc.charCodeAt(i));
  }

  // Calculate checksum on 17-byte payload
  const checksum = crc8(new Uint8Array(payload));

  // Append checksum (1 byte)
  payload.push(checksum);

  // Encode to base36
  const base36 = toBase36(new Uint8Array(payload));

  // Format with hyphens
  return formatCode(base36);
}

/**
 * Decode and validate a reward code
 *
 * Returns decoded components or error object.
 *
 * @param {string} codeString - Code to decode (hyphens optional)
 * @returns {Object} { success: true, version, studentHash, sourceId, activityId } or
 *                   { success: false, error: 'ERROR_CODE', message: '...' }
 */
export function decodeRewardCode(codeString) {
  try {
    // Normalize input
    const normalized = normalizeCode(codeString);

    // Validate format (must be 28 base36 chars)
    if (!/^[0-9A-Z]{28}$/.test(normalized)) {
      return {
        success: false,
        error: 'INVALID_FORMAT',
        message: 'Code must be 28 alphanumeric characters',
      };
    }

    // Decode from base36 to bytes
    const bytes = fromBase36(normalized);

    // Extract checksum (last 1 byte)
    const checksumByte = bytes[bytes.length - 1];
    const expectedChecksum = checksumByte;

    // Extract payload (all but last 1 byte)
    const payload = bytes.slice(0, -1);

    // Verify checksum
    const calculatedChecksum = crc8(payload);
    if (calculatedChecksum !== expectedChecksum) {
      return {
        success: false,
        error: 'CHECKSUM_ERROR',
        message: 'Checksum validation failed - code may be corrupted',
      };
    }

    // Parse payload
    let offset = 0;

    // Version (1 byte)
    const version = payload[offset++];
    if (version !== 1) {
      return {
        success: false,
        error: 'INVALID_VERSION',
        message: 'Unsupported code version',
      };
    }

    // Student ID hash (4 bytes)
    const studentHash =
      ((payload[offset] << 24) |
        (payload[offset + 1] << 16) |
        (payload[offset + 2] << 8) |
        payload[offset + 3]) >>>
      0;
    offset += 4;

    // Source ID (6 bytes, trim trailing spaces)
    const sourceIdBytes = payload.slice(offset, offset + 6);
    const sourceId = String.fromCharCode(...sourceIdBytes).trimEnd();
    offset += 6;

    // Activity ID (6 bytes, trim trailing spaces)
    const activityIdBytes = payload.slice(offset, offset + 6);
    const activityId = String.fromCharCode(...activityIdBytes).trimEnd();

    return {
      success: true,
      version,
      studentHash,
      sourceId,
      activityId,
    };
  } catch (err) {
    return {
      success: false,
      error: 'DECODE_ERROR',
      message: err.message,
    };
  }
}

/**
 * Validate code format without full decode
 *
 * Quick check: is this a valid code format?
 *
 * @param {string} codeString - Code to check
 * @returns {boolean} True if format is valid
 */
export function validateCodeFormat(codeString) {
  const normalized = normalizeCode(codeString);
  return /^[0-9A-Z]{28}$/.test(normalized);
}

/**
 * Get hash of a student ID (for verification)
 *
 * @param {string} studentId - Student's Firestore ID
 * @returns {number} CRC-32 hash
 */
export function getStudentHash(studentId) {
  return crc32(studentId);
}

/**
 * Export internal functions for testing
 */
export const _internal = {
  crc8,
  crc32,
  toBase36,
  fromBase36,
  normalizeCode,
  formatCode,
};
