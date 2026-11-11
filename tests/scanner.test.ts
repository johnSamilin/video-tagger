import { afterEach, describe, expect, it } from 'vitest';
import * as fs from 'fs/promises';
import * as os from 'os';
import * as path from 'path';
import { scanRoot } from '../electron/scanner';

const roots: string[] = [];

afterEach(async () => {
  await Promise.all(roots.splice(0).map((root) => fs.rm(root, { recursive: true, force: true })));
});

describe('scanRoot', () => {
  it('finds audio alongside videos in nested directories and ignores unrelated files', async () => {
    const root = await fs.mkdtemp(path.join(os.tmpdir(), 'vt-scan-'));
    roots.push(root);
    await fs.mkdir(path.join(root, 'album'));
    for (const name of ['clip.mp4', 'track.MP3', 'notes.txt', '.hidden.wav']) {
      await fs.writeFile(path.join(root, name), '');
    }
    await fs.writeFile(path.join(root, 'album', 'song.flac'), '');

    const tree = await scanRoot(root);

    expect(tree.children.map((node) => node.displayName)).toEqual(['album', 'clip.mp4', 'track.MP3']);
    expect(tree.children[0].children.map((node) => node.displayName)).toEqual(['song.flac']);
  });
});
