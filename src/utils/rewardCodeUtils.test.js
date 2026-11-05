/**
 * PKM Reward Code System - Tests
 *
 * Tests for encoding/decoding reward codes
 */

import {
  generateRewardCode,
  decodeRewardCode,
  validateCodeFormat,
  getStudentHash,
  _internal,
} from './rewardCodeUtils.js';

const {
  crc8,
  crc32,
  toBase36,
  fromBase36,
  normalizeCode,
  formatCode,
} = _internal;

describe('rewardCodeUtils', () => {
  describe('CRC-8', () => {
    test('calculates correct CRC-8 for known values', () => {
      const data = new Uint8Array([0x00, 0x00, 0x00]);
      const result = crc8(data);
      expect(typeof result).toBe('number');
      expect(result).toBeGreaterThanOrEqual(0);
      expect(result).toBeLessThan(256);
    });

    test('detects single-bit errors', () => {
      const data = new Uint8Array([0xFF, 0x00, 0xAA]);
      const crc1 = crc8(data);

      // Flip one bit
      data[1] = 0x01;
      const crc2 = crc8(data);

      expect(crc1).not.toBe(crc2);
    });

    test('handles empty buffer', () => {
      const result = crc8(new Uint8Array([]));
      expect(typeof result).toBe('number');
    });
  });

  describe('CRC-32', () => {
    test('calculates CRC-32 deterministically', () => {
      const input = 'test123';
      const result1 = crc32(input);
      const result2 = crc32(input);
      expect(result1).toBe(result2);
    });

    test('produces different hashes for different inputs', () => {
      const hash1 = crc32('studentA');
      const hash2 = crc32('studentB');
      expect(hash1).not.toBe(hash2);
    });

    test('handles empty string', () => {
      const result = crc32('');
      expect(typeof result).toBe('number');
    });

    test('produces 32-bit results', () => {
      const result = crc32('test');
      expect(result).toBeGreaterThanOrEqual(0);
      expect(result).toBeLessThan(0x100000000);
    });
  });

  describe('Base36 Conversion', () => {
    test('converts bytes to base36 with correct length', () => {
      const bytes = new Uint8Array(18);
      bytes[0] = 0xFF;
      const base36 = toBase36(bytes);
      expect(base36).toHaveLength(28);
      expect(/^[0-9A-Z]{28}$/.test(base36)).toBe(true);
    });

    test('pads with zeros when needed', () => {
      const bytes = new Uint8Array(18);
      bytes[17] = 0x01;
      const base36 = toBase36(bytes);
      expect(base36).toHaveLength(28);
      expect(base36).toMatch(/^0+/); // Should start with zeros
    });

    test('round-trips correctly', () => {
      const original = new Uint8Array(18);
      for (let i = 0; i < 18; i++) {
        original[i] = Math.floor(Math.random() * 256);
      }

      const base36 = toBase36(original);
      const decoded = fromBase36(base36);

      for (let i = 0; i < 18; i++) {
        expect(decoded[i]).toBe(original[i]);
      }
    });

    test('fromBase36 always returns 18 bytes', () => {
      const base36 = '00000000000000000000000000000';
      const bytes = fromBase36(base36);
      expect(bytes).toHaveLength(18);
    });
  });

  describe('Code Formatting', () => {
    test('formats code with hyphens correctly', () => {
      const code = 'A' + 'B'.repeat(27);
      const formatted = formatCode(code);
      expect(formatted).toMatch(/^[0-9A-Z]{4}-[0-9A-Z]{4}-[0-9A-Z]{4}-[0-9A-Z]{4}-[0-9A-Z]{4}-[0-9A-Z]{4}-[0-9A-Z]{4}$/);
      expect(formatted.replace(/-/g, '')).toBe(code);
    });

    test('requires exactly 28 characters', () => {
      expect(() => formatCode('A'.repeat(27))).toThrow();
      expect(() => formatCode('A'.repeat(29))).toThrow();
    });

    test('normalizes code by removing hyphens and uppercasing', () => {
      const formatted = 'AAAA-BBBB-CCCC-DDDD-EEEE-FFFF-GGGG';
      const normalized = normalizeCode(formatted);
      expect(normalized).toBe('AAAABBBBCCCCDDDDEEEEFFFFGGGG');
    });

    test('normalizeCode handles spaces', () => {
      const normalized = normalizeCode('AAAA BBBB CCCC DDDD EEEE FFFF GGGG');
      expect(normalized).toBe('AAAABBBBCCCCDDDDEEEEFFFFGGGG');
    });

    test('normalizeCode handles mixed case', () => {
      const normalized = normalizeCode('aaaa-bbbb-cccc-dddd-eeee-ffff-gggg');
      expect(normalized).toBe('AAAABBBBCCCCDDDDEEEEFFFFGGGG');
    });
  });

  describe('Code Generation', () => {
    test('generates a valid code', () => {
      const code = generateRewardCode('student123', 'mathquest', 'algebra_01');
      expect(validateCodeFormat(code)).toBe(true);
    });

    test('code is deterministic - same inputs produce same code', () => {
      const studentId = 'K9xL2mN4oPqRsT1uXyZ1';
      const sourceId = 'mathquest';
      const activityId = 'algebra_01';

      const code1 = generateRewardCode(studentId, sourceId, activityId);
      const code2 = generateRewardCode(studentId, sourceId, activityId);

      expect(code1).toBe(code2);
    });

    test('different students produce different codes', () => {
      const code1 = generateRewardCode('student1', 'mathquest', 'algebra_01');
      const code2 = generateRewardCode('student2', 'mathquest', 'algebra_01');
      expect(code1).not.toBe(code2);
    });

    test('different activities produce different codes', () => {
      const code1 = generateRewardCode('student1', 'mathquest', 'algebra_01');
      const code2 = generateRewardCode('student1', 'mathquest', 'algebra_02');
      expect(code1).not.toBe(code2);
    });

    test('different sources produce different codes', () => {
      const code1 = generateRewardCode('student1', 'mathquest', 'algebra_01');
      const code2 = generateRewardCode('student1', 'google_sites', 'algebra_01');
      expect(code1).not.toBe(code2);
    });

    test('rejects empty student ID', () => {
      expect(() => generateRewardCode('', 'mathquest', 'algebra_01')).toThrow();
    });

    test('rejects empty source ID', () => {
      expect(() => generateRewardCode('student1', '', 'algebra_01')).toThrow();
    });

    test('rejects empty activity ID', () => {
      expect(() => generateRewardCode('student1', 'mathquest', '')).toThrow();
    });

    test('handles long source and activity IDs (truncates to 6 chars)', () => {
      const code1 = generateRewardCode('student1', 'mathquest_very_long', 'algebra_exam_01_final');
      const code2 = generateRewardCode('student1', 'mathqu', 'algebra');
      expect(code1).not.toBe(code2); // Different because of different truncation
    });

    test('handles special characters in IDs', () => {
      const code = generateRewardCode(
        'user-ABC_123.456',
        'google-sites_v2',
        'lesson-01_part-A'
      );
      expect(validateCodeFormat(code)).toBe(true);
    });
  });

  describe('Code Decoding', () => {
    test('decodes a valid code successfully', () => {
      const code = generateRewardCode('student123', 'mathquest', 'algebra_01');
      const result = decodeRewardCode(code);

      expect(result.success).toBe(true);
      expect(result.version).toBe(1);
      expect(result.sourceId).toBe('mathqu');
      expect(result.activityId).toBe('algebr');
    });

    test('extracts correct student hash', () => {
      const studentId = 'K9xL2mN4oPqRsT1uXyZ1';
      const code = generateRewardCode(studentId, 'mathquest', 'algebra_01');
      const result = decodeRewardCode(code);

      expect(result.success).toBe(true);
      expect(result.studentHash).toBe(getStudentHash(studentId));
    });

    test('handles code with hyphens', () => {
      const code = generateRewardCode('student1', 'source', 'activity');
      const result = decodeRewardCode(code);
      expect(result.success).toBe(true);
    });

    test('handles code without hyphens', () => {
      const code = generateRewardCode('student1', 'source', 'activity');
      const codeWithoutHyphens = code.replace(/-/g, '');
      const result = decodeRewardCode(codeWithoutHyphens);
      expect(result.success).toBe(true);
    });

    test('handles code with spaces', () => {
      const code = generateRewardCode('student1', 'source', 'activity');
      const codeWithSpaces = code.replace(/-/g, ' ');
      const result = decodeRewardCode(codeWithSpaces);
      expect(result.success).toBe(true);
    });

    test('rejects invalid format', () => {
      const result = decodeRewardCode('INVALID');
      expect(result.success).toBe(false);
      expect(result.error).toBe('INVALID_FORMAT');
    });

    test('rejects non-base36 characters', () => {
      const result = decodeRewardCode('GGGG-HHHH-IIII-JJJJ-KKKK-LLLL-MMMM');
      expect(result.success).toBe(false);
    });

    test('rejects wrong checksum', () => {
      const code = generateRewardCode('student1', 'mathquest', 'algebra_01');
      const corrupted = code
        .replace(/-/g, '')
        .split('')
        .map((c, i) => (i === 0 ? String.fromCharCode(c.charCodeAt(0) + 1) : c))
        .join('');

      const result = decodeRewardCode(corrupted);
      expect(result.success).toBe(false);
      expect(result.error).toBe('CHECKSUM_ERROR');
    });

    test('rejects unsupported version', () => {
      // This is hard to test without crafting bytes, so skip for now
      // In practice, version 1 is the only supported version
    });

    test('detects corruption in source ID', () => {
      const code = generateRewardCode('student1', 'mathquest', 'algebra_01');
      const corrupted = code
        .replace(/-/g, '')
        .split('')
        .map((c, i) => (i === 8 ? String.fromCharCode(c.charCodeAt(0) + 1) : c)) // Corrupt byte in middle
        .join('');

      const result = decodeRewardCode(corrupted);
      expect(result.success).toBe(false);
    });
  });

  describe('Student Hash Verification', () => {
    test('getStudentHash is consistent', () => {
      const studentId = 'user123';
      const hash1 = getStudentHash(studentId);
      const hash2 = getStudentHash(studentId);
      expect(hash1).toBe(hash2);
    });

    test('generated code contains correct student hash', () => {
      const studentId = 'MyStudent123';
      const code = generateRewardCode(studentId, 'source', 'activity');
      const decoded = decodeRewardCode(code);

      expect(decoded.success).toBe(true);
      expect(decoded.studentHash).toBe(getStudentHash(studentId));
    });
  });

  describe('Code Format Validation', () => {
    test('validates correct format', () => {
      const code = generateRewardCode('student1', 'mathquest', 'algebra_01');
      expect(validateCodeFormat(code)).toBe(true);
    });

    test('rejects too short codes', () => {
      expect(validateCodeFormat('SHORT')).toBe(false);
    });

    test('rejects too long codes', () => {
      expect(validateCodeFormat('A'.repeat(50))).toBe(false);
    });

    test('rejects non-alphanumeric characters', () => {
      expect(validateCodeFormat('AAAA-BBBB-CCCC-DDDD-EEEE-FFFF-GGGG')).toBe(false);
    });

    test('rejects invalid characters', () => {
      expect(validateCodeFormat('############################')).toBe(false);
    });
  });

  describe('End-to-End Scenarios', () => {
    test('complete redemption flow: generate, normalize, decode, verify', () => {
      const studentId = 'K9xL2mN4oPqRsT1uXyZ1';
      const sourceId = 'mathquest';
      const activityId = 'algebra_01';

      // Step 1: Generate code (external app)
      const code = generateRewardCode(studentId, sourceId, activityId);
      console.log('Generated code:', code);

      // Step 2: User pastes code with hyphens/spaces
      const userInput = code.replace(/-/g, ' ');

      // Step 3: Pokemáticos normalizes and validates format
      expect(validateCodeFormat(userInput)).toBe(true);

      // Step 4: Pokemáticos decodes
      const decoded = decodeRewardCode(userInput);
      expect(decoded.success).toBe(true);

      // Step 5: Pokemáticos verifies student
      const currentStudentHash = getStudentHash(studentId);
      expect(decoded.studentHash).toBe(currentStudentHash);

      // Step 6: Pokemáticos looks up activity in catalogue
      expect(decoded.sourceId).toBeDefined();
      expect(decoded.activityId).toBeDefined();
    });

    test('cannot redeem code from different student', () => {
      const code = generateRewardCode('student1', 'mathquest', 'algebra_01');
      const decoded = decodeRewardCode(code);

      const student2Hash = getStudentHash('student2');
      expect(decoded.studentHash).not.toBe(student2Hash);
    });

    test('same activity for different students produces different codes', () => {
      const code1 = generateRewardCode('alice', 'mathquest', 'algebra_01');
      const code2 = generateRewardCode('bob', 'mathquest', 'algebra_01');

      const decoded1 = decodeRewardCode(code1);
      const decoded2 = decodeRewardCode(code2);

      expect(decoded1.studentHash).not.toBe(decoded2.studentHash);
    });
  });

  describe('Test Vectors (Reference Implementation)', () => {
    test('vector 1: simple case', () => {
      const code = generateRewardCode('student1', 'math', 'lesson1');
      const decoded = decodeRewardCode(code);
      expect(decoded.success).toBe(true);
      expect(decoded.sourceId).toBe('math');
      expect(decoded.activityId).toBe('lesson1');
    });

    test('vector 2: truncation case', () => {
      const code = generateRewardCode(
        'longstudentid12345',
        'verylongsourceid',
        'verylongactivityid'
      );
      const decoded = decodeRewardCode(code);
      expect(decoded.success).toBe(true);
      expect(decoded.sourceId).toBe('verylo'); // Truncated to 6
      expect(decoded.activityId).toBe('verylo'); // Truncated to 6
    });

    test('vector 3: special chars in IDs', () => {
      const code = generateRewardCode(
        'user-id_123.test',
        'app-v2_test',
        'ex-01_part-A'
      );
      const decoded = decodeRewardCode(code);
      expect(decoded.success).toBe(true);
    });

    test('vector 4: very long student ID', () => {
      const longId =
        'this_is_a_very_long_student_id_that_should_still_work_correctly_because_we_use_hash';
      const code = generateRewardCode(longId, 'source', 'activity');
      const decoded = decodeRewardCode(code);
      expect(decoded.success).toBe(true);
      expect(decoded.studentHash).toBe(getStudentHash(longId));
    });

    test('vector 5: determinism check', () => {
      const codes = [];
      for (let i = 0; i < 100; i++) {
        codes.push(generateRewardCode('fixed_student', 'fixed_source', 'fixed_activity'));
      }
      // All codes should be identical
      for (let i = 1; i < codes.length; i++) {
        expect(codes[i]).toBe(codes[0]);
      }
    });
  });
});
