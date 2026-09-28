import { describe, it, expect } from 'vitest';
import { parseTime, formatTime, formatTimeShort } from '../src/lib/time';

describe('time', () => {
  it('parses HH:MM:SS', () => {
    expect(parseTime('00:00:05')).toBe(5);
    expect(parseTime('00:01:20')).toBe(80);
    expect(parseTime('10:00:00')).toBe(36000);
  });

  it('parses fractional seconds', () => {
    expect(parseTime('00:00:00.500')).toBeCloseTo(0.5);
    expect(parseTime('10:00:00.500')).toBeCloseTo(36000.5);
  });

  it('formats back to HH:MM:SS', () => {
    expect(formatTime(80)).toBe('00:01:20');
    expect(formatTime(5)).toBe('00:00:05');
    expect(formatTime(36000)).toBe('10:00:00');
  });

  it('roundtrips', () => {
    const cases = [0, 5, 80, 165, 3599, 36000, 3661];
    for (const s of cases) {
      expect(parseTime(formatTime(s))).toBe(s);
    }
  });

  it('rejects invalid input', () => {
    expect(parseTime('')).toBeNaN();
    expect(parseTime('ab:cd:ef')).toBeNaN();
    expect(parseTime('00:60:00')).toBeNaN();
  });

  it('formats short clock', () => {
    expect(formatTimeShort(65)).toBe('1:05');
    expect(formatTimeShort(3661)).toBe('1:01:01');
    expect(formatTimeShort(0)).toBe('0:00');
  });
});
