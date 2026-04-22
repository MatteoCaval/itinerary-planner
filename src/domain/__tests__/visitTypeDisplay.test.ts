import { describe, it, expect } from 'vitest';
import { getVisitTypeIcon, getVisitTypeBg, getVisitTypeColor, getVisitLabel } from '../visitTypeDisplay';

describe('visitTypeDisplay', () => {
  describe('getVisitTypeIcon', () => {
    it('returns a distinct icon per type', () => {
      const icons = (['food', 'landmark', 'museum', 'walk', 'shopping'] as const).map(
        getVisitTypeIcon,
      );
      const unique = new Set(icons);
      expect(unique.size).toBe(5);
    });

    it('returns Landmark for unknown types', () => {
      const result = getVisitTypeIcon('unknown' as any);
      const landmarkIcon = getVisitTypeIcon('landmark');
      expect(result).toBe(landmarkIcon);
    });
  });

  describe('getVisitTypeBg', () => {
    it('returns a class for each visit type', () => {
      const types = ['landmark', 'museum', 'food', 'walk', 'shopping'] as const;
      types.forEach(type => {
        expect(getVisitTypeBg(type)).toBeTruthy();
      });
    });
  });

  describe('getVisitTypeColor', () => {
    it('returns a class for each visit type', () => {
      const types = ['landmark', 'museum', 'food', 'walk', 'shopping'] as const;
      types.forEach(type => {
        expect(getVisitTypeColor(type)).toBeTruthy();
      });
    });
  });

  describe('getVisitLabel', () => {
    it('returns a label for each visit type', () => {
      const types = ['landmark', 'museum', 'food', 'walk', 'shopping'] as const;
      types.forEach(type => {
        expect(getVisitLabel(type)).toBeTruthy();
      });
    });
  });
});
