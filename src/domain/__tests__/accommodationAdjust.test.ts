import { describe, expect, it } from 'vitest';
import { adjustAccommodationsForResize } from '../accommodationAdjust';
import type { NightAccommodation } from '../types';

const hotel = (name: string): NightAccommodation => ({ name });

describe('adjustAccommodationsForResize', () => {
  it('returns undefined and no removals when oldAccoms is undefined', () => {
    const result = adjustAccommodationsForResize(undefined, 3, 4, 0, -1, 'Tokyo');
    expect(result.nightAccommodations).toBeUndefined();
    expect(result.removed).toEqual([]);
  });

  it('grow-end extends the last group forward', () => {
    const accoms = { 0: hotel('A'), 1: hotel('A'), 2: hotel('A') };
    const result = adjustAccommodationsForResize(accoms, 3, 4, 0, -1, 'Tokyo');
    expect(result.nightAccommodations).toEqual({
      0: hotel('A'),
      1: hotel('A'),
      2: hotel('A'),
      3: hotel('A'),
    });
    expect(result.removed).toEqual([]);
  });

  it('grow-end leaves new nights empty when last night was empty', () => {
    const accoms = { 0: hotel('A') };
    const result = adjustAccommodationsForResize(accoms, 3, 4, 0, -1, 'Tokyo');
    expect(result.nightAccommodations).toEqual({ 0: hotel('A') });
    expect(result.removed).toEqual([]);
  });

  it('grow-start reindexes existing keys and fills prefix from first group', () => {
    const accoms = { 0: hotel('A'), 1: hotel('A') };
    const result = adjustAccommodationsForResize(accoms, 2, 3, -1, 0, 'Tokyo');
    expect(result.nightAccommodations).toEqual({
      0: hotel('A'),
      1: hotel('A'),
      2: hotel('A'),
    });
    expect(result.removed).toEqual([]);
  });

  it('grow-start leaves prefix empty when old first night was empty', () => {
    const accoms = { 1: hotel('A') };
    const result = adjustAccommodationsForResize(accoms, 2, 3, -1, 0, 'Tokyo');
    expect(result.nightAccommodations).toEqual({ 2: hotel('A') });
    expect(result.removed).toEqual([]);
  });

  it('shrink-end drops trailing keys from a multi-night group silently', () => {
    const accoms = { 0: hotel('A'), 1: hotel('A'), 2: hotel('A'), 3: hotel('A') };
    const result = adjustAccommodationsForResize(accoms, 4, 3, 0, 1, 'Tokyo');
    expect(result.nightAccommodations).toEqual({
      0: hotel('A'),
      1: hotel('A'),
      2: hotel('A'),
    });
    expect(result.removed).toEqual([]);
  });

  it('shrink-end removes a singleton and reports it', () => {
    const accoms = { 0: hotel('A'), 1: hotel('A'), 2: hotel('B') };
    const result = adjustAccommodationsForResize(accoms, 3, 2, 0, 1, 'Tokyo');
    expect(result.nightAccommodations).toEqual({ 0: hotel('A'), 1: hotel('A') });
    expect(result.removed).toEqual([{ name: 'B', stayLabel: 'Tokyo' }]);
  });

  it('shrink-start drops leading keys and reindexes', () => {
    const accoms = { 0: hotel('A'), 1: hotel('A'), 2: hotel('A') };
    const result = adjustAccommodationsForResize(accoms, 3, 2, 1, 0, 'Tokyo');
    expect(result.nightAccommodations).toEqual({ 0: hotel('A'), 1: hotel('A') });
    expect(result.removed).toEqual([]);
  });

  it('shrink-start removes a singleton at the start', () => {
    const accoms = { 0: hotel('X'), 1: hotel('A'), 2: hotel('A') };
    const result = adjustAccommodationsForResize(accoms, 3, 2, 1, 0, 'Tokyo');
    expect(result.nightAccommodations).toEqual({ 0: hotel('A'), 1: hotel('A') });
    expect(result.removed).toEqual([{ name: 'X', stayLabel: 'Tokyo' }]);
  });

  it('mixed shrink-end + grow-start combines correctly', () => {
    const accoms = { 0: hotel('A'), 1: hotel('A'), 2: hotel('A') };
    const result = adjustAccommodationsForResize(accoms, 3, 3, -1, 1, 'Tokyo');
    expect(result.nightAccommodations).toEqual({
      0: hotel('A'),
      1: hotel('A'),
      2: hotel('A'),
    });
    expect(result.removed).toEqual([]);
  });

  it('returns undefined when every key is dropped', () => {
    const accoms = { 0: hotel('Z') };
    const result = adjustAccommodationsForResize(accoms, 1, 0, 0, 1, 'Tokyo');
    expect(result.nightAccommodations).toBeUndefined();
    expect(result.removed).toEqual([{ name: 'Z', stayLabel: 'Tokyo' }]);
  });

  it('reports multiple singletons removed in one operation', () => {
    const accoms = { 0: hotel('X'), 1: hotel('Y'), 2: hotel('Z') };
    const result = adjustAccommodationsForResize(accoms, 3, 1, 0, 2, 'Tokyo');
    expect(result.nightAccommodations).toEqual({ 0: hotel('X') });
    expect(result.removed).toEqual([
      { name: 'Y', stayLabel: 'Tokyo' },
      { name: 'Z', stayLabel: 'Tokyo' },
    ]);
  });
});
