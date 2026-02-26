import { addDaysToLocalDateKey } from '../utils/timezone';

describe('addDaysToLocalDateKey', () => {
  it('adds days within same month', () => {
    expect(addDaysToLocalDateKey('2026-02-10', 5)).toBe('2026-02-15');
  });

  it('rolls over month and year boundaries', () => {
    expect(addDaysToLocalDateKey('2026-01-31', 1)).toBe('2026-02-01');
    expect(addDaysToLocalDateKey('2026-12-31', 1)).toBe('2027-01-01');
  });

  it('supports negative offsets', () => {
    expect(addDaysToLocalDateKey('2026-03-01', -1)).toBe('2026-02-28');
  });

  it('returns original value for invalid input', () => {
    expect(addDaysToLocalDateKey('invalid-date', 3)).toBe('invalid-date');
  });
});
