import { describe, it, expect } from 'vitest';
import { runQuery } from '../src/lib/query';

const index = {
  family: ['a.mp4', 'b.mp4'],
  travel: ['b.mp4', 'c.mkv'],
  funny: ['a.mp4'],
};
const universe = ['a.mp4', 'b.mp4', 'c.mkv'];

function sorted(result: Set<string>): string[] {
  return [...result].sort();
}

describe('query', () => {
  it('evaluates a single tag', () => {
    expect(sorted(runQuery('family', index, universe))).toEqual(['a.mp4', 'b.mp4']);
  });

  it('evaluates AND', () => {
    expect(sorted(runQuery('family and travel', index, universe))).toEqual(['b.mp4']);
  });

  it('evaluates OR', () => {
    expect(sorted(runQuery('family or travel', index, universe))).toEqual([
      'a.mp4',
      'b.mp4',
      'c.mkv',
    ]);
  });

  it('evaluates parentheses', () => {
    expect(sorted(runQuery('(family and travel) or funny', index, universe))).toEqual([
      'a.mp4',
      'b.mp4',
    ]);
  });

  it('evaluates NOT', () => {
    expect(sorted(runQuery('not family', index, universe))).toEqual(['c.mkv']);
  });

  it('is case-insensitive for operators', () => {
    expect(sorted(runQuery('family AND travel', index, universe))).toEqual(['b.mp4']);
  });

  it('throws on malformed input', () => {
    expect(() => runQuery('family and', index, universe)).toThrow();
    expect(() => runQuery('(family', index, universe)).toThrow();
  });
});
