import { describe, expect, it } from 'vitest';
import { buildStory, storyStart, tryLayout } from './story';

const MON = '2026-09-28';

describe('landing story', () => {
  it('starts on a Monday', () => {
    expect(storyStart('2026-09-22')).toBe(MON); // Tuesday → next Monday
    expect(storyStart(MON)).toBe(MON);
    expect(storyStart('2026-09-27')).toBe(MON); // Sunday → tomorrow
  });

  it('lays out the base week earliest-deadline-first', () => {
    const s = buildStory(MON);
    const keys = s.base.segments.map((x) => x.key);
    expect(keys.slice(0, 3)).toEqual(['deck@0', 'deck@1', 'landing@1']);
    expect(s.base.segments.every((x) => x.tone === 'base')).toBe(true);
    // Launch video starts Friday of week one
    expect(keys).toContain('video@4');
  });

  it('shows the truth: saying yes makes the new work and the video late', () => {
    const s = buildStory(MON);
    expect(s.result.verdict).toBe('no');
    const late = s.truth.segments.filter((x) => x.tone === 'late' || x.tone === 'offerLate').map((x) => x.key);
    expect(late).toEqual(['offer@7', 'offer@8', 'video@11']);
  });

  it('answers with next Friday, and nothing turns red', () => {
    const s = buildStory(MON);
    expect(s.safeDay).toBe(11);
    expect(s.answer.beamDay).toBe(11);
    expect(s.answer.segments.some((x) => x.tone === 'late' || x.tone === 'offerLate')).toBe(false);
  });

  it('lets the visitor try their own request', () => {
    const small = tryLayout(MON, 4, 11);
    expect(small.result.verdict).toBe('yes');
    const big = tryLayout(MON, 30, 4);
    expect(big.result.verdict).toBe('no');
  });
});
