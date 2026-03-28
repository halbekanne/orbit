import { businessDaysSince } from './business-days';

describe('businessDaysSince', () => {
  it('counts only weekdays', () => {
    const wed = new Date(2026, 2, 25).getTime();
    const fri = new Date(2026, 2, 28).getTime();
    expect(businessDaysSince(wed, fri)).toBe(3);
  });

  it('skips weekends', () => {
    const fri = new Date(2026, 2, 27).getTime();
    const mon = new Date(2026, 2, 30).getTime();
    expect(businessDaysSince(fri, mon)).toBe(1);
  });

  it('returns 0 for same day', () => {
    const now = new Date(2026, 2, 28).getTime();
    expect(businessDaysSince(now, now)).toBe(0);
  });

  it('handles full week', () => {
    const mon1 = new Date(2026, 2, 23).getTime();
    const mon2 = new Date(2026, 2, 30).getTime();
    expect(businessDaysSince(mon1, mon2)).toBe(5);
  });
});
