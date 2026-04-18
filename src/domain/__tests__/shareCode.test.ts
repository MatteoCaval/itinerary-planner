import { describe, it, expect } from 'vitest';
import { generateShareCode, isShareCodeNode, SHARE_CODE_CHARSET } from '../shareCode';

describe('generateShareCode', () => {
  it('returns a string matching TRIP-XXXXXX format', () => {
    const code = generateShareCode();
    expect(code).toMatch(/^TRIP-[A-Z2-9]{6}$/);
  });

  it('uses only non-ambiguous characters', () => {
    const ambiguous = ['O', '0', 'I', '1', 'L'];
    for (let i = 0; i < 50; i++) {
      const code = generateShareCode();
      const suffix = code.replace('TRIP-', '');
      for (const ch of suffix) {
        expect(ambiguous).not.toContain(ch);
      }
    }
  });

  it('generates unique codes across multiple calls', () => {
    const codes = new Set(Array.from({ length: 100 }, () => generateShareCode()));
    expect(codes.size).toBe(100);
  });

  it('generates a longer code when length param is provided', () => {
    const code = generateShareCode(7);
    expect(code).toMatch(/^TRIP-[A-Z2-9]{7}$/);
  });
});

describe('isShareCodeNode', () => {
  it('returns true for valid ShareCodeNode', () => {
    const node = {
      trip: {
        id: '1',
        name: 'Test',
        startDate: '2025-01-01',
        totalDays: 3,
        stays: [],
        visits: [],
        routes: [],
      },
      createdAt: 1000,
      updatedAt: 1000,
      ownerUid: 'uid-123',
      mode: 'readonly',
    };
    expect(isShareCodeNode(node)).toBe(true);
  });

  it('returns false for raw HybridTrip (legacy format)', () => {
    const raw = {
      id: '1',
      name: 'Test',
      startDate: '2025-01-01',
      totalDays: 3,
      stays: [],
      visits: [],
      routes: [],
    };
    expect(isShareCodeNode(raw)).toBe(false);
  });

  it('returns false for null/undefined', () => {
    expect(isShareCodeNode(null)).toBe(false);
    expect(isShareCodeNode(undefined)).toBe(false);
  });
});

describe('SHARE_CODE_CHARSET', () => {
  it('has 31 characters (no O, 0, I, 1, L)', () => {
    expect(SHARE_CODE_CHARSET).toHaveLength(31);
    expect(SHARE_CODE_CHARSET).not.toContain('O');
    expect(SHARE_CODE_CHARSET).not.toContain('0');
    expect(SHARE_CODE_CHARSET).not.toContain('I');
    expect(SHARE_CODE_CHARSET).not.toContain('1');
    expect(SHARE_CODE_CHARSET).not.toContain('L');
  });
});
