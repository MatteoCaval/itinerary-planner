import { describe, it, expect } from 'vitest';
import { STAY_COLORS } from '../constants';

describe('STAY_COLORS', () => {
  it('is the P1 Jewel Tones palette with eight entries', () => {
    expect(STAY_COLORS).toEqual([
      '#b8304f', // Claret
      '#c15a2a', // Rust
      '#2e3f8a', // Indigo
      '#6b7a3a', // Olive
      '#7b3b6b', // Plum
      '#3a4a5a', // Slate
      '#a7772b', // Ochre
      '#3d6b4a', // Moss
    ]);
  });

  it('contains no teal/cyan hues (reserved for chrome)', () => {
    const banned = /#(0f766e|0d9488|14b8a6|5eead4|99f6e4|ccfbf1|22d3ee)/i;
    STAY_COLORS.forEach((hex) => expect(hex).not.toMatch(banned));
  });
});
