import { describe, expect, it } from 'vitest';
import {
  addMonthsClamped,
  buildWeekStartDates,
  fromYmd,
} from '../src/date-utils';

describe('date-utils', () => {
  it('builds weekly starts through one month ahead', () => {
    expect(buildWeekStartDates('2026-07-02', '2026-08-02')).toEqual([
      '2026-07-02',
      '2026-07-09',
      '2026-07-16',
      '2026-07-23',
      '2026-07-30',
    ]);
  });

  it('clamps month additions', () => {
    expect(addMonthsClamped('2026-01-31', 1)).toBe('2026-02-28');
  });

  it('formats yyyymmdd values', () => {
    expect(fromYmd(20260702)).toBe('2026-07-02');
  });
});
