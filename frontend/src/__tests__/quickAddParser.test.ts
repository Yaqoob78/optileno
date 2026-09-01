import { parseQuickAdd } from '../utils/quickAddParser';

describe('quickAddParser', () => {
  const timezone = 'UTC';

  test('parses simple task title without any special tokens', () => {
    const res = parseQuickAdd('Read 20 pages of book', timezone);
    expect(res.cleanTitle).toBe('Read 20 pages of book');
    expect(res.priority).toBeUndefined();
    expect(res.category).toBeUndefined();
    expect(res.dueDate).toBeUndefined();
    expect(res.isHabit).toBe(false);
    expect(res.tokens.length).toBe(0);
  });

  test('parses priority keywords (!urgent, !high, p1, p3)', () => {
    const resUrgent = parseQuickAdd('Fix prod database outage !urgent', timezone);
    expect(resUrgent.cleanTitle).toBe('Fix prod database outage');
    expect(resUrgent.priority).toBe('urgent');

    const resP1 = parseQuickAdd('Urgent bug fix p1', timezone);
    expect(resP1.cleanTitle).toBe('Urgent bug fix');
    expect(resP1.priority).toBe('urgent');

    const resHigh = parseQuickAdd('Prepare board presentation !high', timezone);
    expect(resHigh.cleanTitle).toBe('Prepare board presentation');
    expect(resHigh.priority).toBe('high');

    const resLow = parseQuickAdd('Clean up downloads folder !low', timezone);
    expect(resLow.cleanTitle).toBe('Clean up downloads folder');
    expect(resLow.priority).toBe('low');
  });

  test('parses categories and tags (#work, #health, @client)', () => {
    const res = parseQuickAdd('Review quarterly financials #work @finance @audit', timezone);
    expect(res.cleanTitle).toBe('Review quarterly financials');
    expect(res.category).toBe('work');
    expect(res.tags).toContain('finance');
    expect(res.tags).toContain('audit');
  });

  test('parses duration (45m, 1.5h, 2hrs)', () => {
    const resMins = parseQuickAdd('Design mockup review 45m', timezone);
    expect(resMins.cleanTitle).toBe('Design mockup review');
    expect(resMins.duration).toBe(45);

    const resHours = parseQuickAdd('Deep work session 2hrs', timezone);
    expect(resHours.cleanTitle).toBe('Deep work session');
    expect(resHours.duration).toBe(120);
  });

  test('parses relative dates (tomorrow at 4pm, today at 9am)', () => {
    const resTomorrow = parseQuickAdd('Team sync tomorrow at 4pm', timezone);
    expect(resTomorrow.cleanTitle).toBe('Team sync');
    expect(resTomorrow.dueTime).toBe('16:00');
    expect(resTomorrow.dueDate).toBeDefined();
    expect(resTomorrow.dateLabel).toContain('Tomorrow at 4 PM');

    const resMorning = parseQuickAdd('Morning standup today morning', timezone);
    expect(resMorning.cleanTitle).toBe('Morning standup');
    expect(resMorning.dueTime).toBe('09:00');
  });

  test('parses habit quick-add with frequency and category', () => {
    const res = parseQuickAdd('Meditate 15m every day #health', timezone);
    expect(res.cleanTitle).toBe('Meditate');
    expect(res.isHabit).toBe(true);
    expect(res.habitFrequency).toBe('daily');
    expect(res.category).toBe('health');
    expect(res.duration).toBe(15);
  });

  test('handles combined complex input cleanly', () => {
    const res = parseQuickAdd('Ship v2 release tomorrow at 3:30pm !high #work for 90m @release', timezone);
    expect(res.cleanTitle).toBe('Ship v2 release');
    expect(res.priority).toBe('high');
    expect(res.category).toBe('work');
    expect(res.duration).toBe(90);
    expect(res.dueTime).toBe('15:30');
    expect(res.dueDate).toBeDefined();
    expect(res.tags).toContain('release');
    expect(res.tokens.length).toBeGreaterThan(4);
  });
});
