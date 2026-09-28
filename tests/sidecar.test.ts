import { describe, it, expect } from 'vitest';
import { sidecarToJson, sidecarFromJson, emptySidecar } from '../src/lib/sidecar';

describe('sidecar', () => {
  it('roundtrips ranges', () => {
    const sidecar = {
      version: 1 as const,
      tags: {
        family: [{ start: 5, end: 80 }],
        travel: [
          { start: 130, end: 165 },
          { start: 300, end: 330 },
        ],
      },
    };
    const parsed = sidecarFromJson(sidecarToJson(sidecar));
    expect(parsed).toEqual(sidecar);
  });

  it('writes HH:MM:SS strings', () => {
    const json = sidecarToJson({ version: 1, tags: { t: [{ start: 5, end: 80 }] } });
    expect(JSON.parse(json)).toEqual({
      version: 1,
      tags: { t: [['00:00:05', '00:01:20']] },
    });
  });

  it('parses HH:MM:SS strings', () => {
    const parsed = sidecarFromJson(
      JSON.stringify({ version: 1, tags: { t: [['00:00:05', '00:01:20']] } }),
    );
    expect(parsed.tags.t).toEqual([{ start: 5, end: 80 }]);
  });

  it('returns empty sidecar on garbage', () => {
    expect(sidecarFromJson('not json')).toEqual(emptySidecar());
  });

  it('drops invalid ranges but keeps the tag', () => {
    const parsed = sidecarFromJson(
      JSON.stringify({ version: 1, tags: { t: [['00:01:00', '00:00:05']] } }),
    );
    expect(parsed.tags.t).toEqual([]);
  });

  it('preserves tags with no ranges', () => {
    const parsed = sidecarFromJson(JSON.stringify({ version: 1, tags: { t: [] } }));
    expect(parsed.tags.t).toEqual([]);
  });
});
