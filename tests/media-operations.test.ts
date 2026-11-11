import { afterEach, describe, expect, it } from 'vitest';
import * as fs from 'fs/promises';
import * as os from 'os';
import * as path from 'path';
import { transferMedia } from '../electron/media-operations';

const tempDirs: string[] = [];

async function fixture() {
  const base = await fs.mkdtemp(path.join(os.tmpdir(), 'vt-transfer-'));
  tempDirs.push(base);
  const root = path.join(base, 'root');
  const destination = path.join(base, 'destination');
  await fs.mkdir(path.join(root, 'album'), { recursive: true });
  await fs.mkdir(path.join(root, 'other'));
  await fs.mkdir(destination);
  const audio = path.join(root, 'album', 'song.wav');
  const video = path.join(root, 'other', 'clip.mp4');
  await fs.writeFile(audio, 'audio');
  await fs.writeFile(`${audio}.tags.json`, '{"tags":{"music":[]}}');
  await fs.writeFile(video, 'video');
  return { root, destination, audio, video };
}

afterEach(async () => {
  await Promise.all(tempDirs.splice(0).map((dir) => fs.rm(dir, { recursive: true, force: true })));
});

describe('transferMedia', () => {
  it('copies selected files into one folder, keeping sidecars and originals', async () => {
    const { root, destination, audio, video } = await fixture();
    await transferMedia(root, [audio, video], destination, 'copy', false);
    expect(await fs.readFile(path.join(destination, 'song.wav'), 'utf8')).toBe('audio');
    expect(await fs.readFile(path.join(destination, 'song.wav.tags.json'), 'utf8')).toContain('music');
    expect(await fs.readFile(path.join(destination, 'clip.mp4'), 'utf8')).toBe('video');
    expect(await fs.readFile(audio, 'utf8')).toBe('audio');
  });

  it('moves files with paths relative to the media root and keeps their sidecars', async () => {
    const { root, destination, audio, video } = await fixture();
    await transferMedia(root, [audio, video], destination, 'move', true);
    expect(await fs.readFile(path.join(destination, 'album', 'song.wav'), 'utf8')).toBe('audio');
    expect(await fs.readFile(path.join(destination, 'album', 'song.wav.tags.json'), 'utf8')).toContain('music');
    expect(await fs.readFile(path.join(destination, 'other', 'clip.mp4'), 'utf8')).toBe('video');
    await expect(fs.stat(audio)).rejects.toMatchObject({ code: 'ENOENT' });
    await expect(fs.stat(`${audio}.tags.json`)).rejects.toMatchObject({ code: 'ENOENT' });
  });

  it('copies the folder structure without removing the source', async () => {
    const { root, destination, audio } = await fixture();
    await transferMedia(root, [audio], destination, 'copy', true);
    expect(await fs.readFile(path.join(destination, 'album', 'song.wav'), 'utf8')).toBe('audio');
    expect(await fs.readFile(path.join(destination, 'album', 'song.wav.tags.json'), 'utf8')).toContain('music');
    expect(await fs.readFile(audio, 'utf8')).toBe('audio');
  });

  it('moves into a flat folder even when media has no sidecar', async () => {
    const { root, destination, video } = await fixture();
    await transferMedia(root, [video], destination, 'move', false);
    expect(await fs.readFile(path.join(destination, 'clip.mp4'), 'utf8')).toBe('video');
    await expect(fs.stat(video)).rejects.toMatchObject({ code: 'ENOENT' });
  });

  it('refuses collisions before changing any of the selected files', async () => {
    const { root, destination, audio, video } = await fixture();
    await fs.writeFile(path.join(destination, 'clip.mp4'), 'existing');
    await expect(transferMedia(root, [audio, video], destination, 'move', false)).rejects.toThrow('already exists');
    await expect(fs.stat(path.join(destination, 'song.wav'))).rejects.toMatchObject({ code: 'ENOENT' });
    expect(await fs.readFile(audio, 'utf8')).toBe('audio');
    expect(await fs.readFile(path.join(destination, 'clip.mp4'), 'utf8')).toBe('existing');
  });

  it('rejects duplicate destination names, sidecar collisions, and paths outside the root', async () => {
    const { root, destination, audio } = await fixture();
    const duplicate = path.join(root, 'other', 'song.wav');
    await fs.writeFile(duplicate, 'other audio');
    await expect(transferMedia(root, [audio, duplicate], destination, 'copy', false)).rejects.toThrow('same destination');
    await fs.writeFile(path.join(destination, 'song.wav.tags.json'), 'existing tags');
    await expect(transferMedia(root, [audio], destination, 'copy', false)).rejects.toThrow('already exists');
    await expect(transferMedia(root, [destination], destination, 'move', false)).rejects.toThrow('outside the media root');
  });
});
