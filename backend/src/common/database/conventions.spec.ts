import { isMoneyVnd, toBusinessDate } from './conventions.js';

describe('toBusinessDate', () => {
  it('đổi UTC sang ngày theo giờ Việt Nam (UTC+7)', () => {
    expect(toBusinessDate(new Date('2026-10-22T16:59:59Z'))).toBe('2026-10-22');
    expect(toBusinessDate(new Date('2026-10-22T17:00:00Z'))).toBe('2026-10-23');
  });
});

describe('isMoneyVnd', () => {
  it.each([
    [0, true],
    [1_500_000, true],
    [-1, false],
    [1000.5, false],
    [Number.NaN, false],
  ])('%s -> %s', (value, expected) => {
    expect(isMoneyVnd(value)).toBe(expected);
  });
});
