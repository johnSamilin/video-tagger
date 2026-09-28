import * as fs from 'fs/promises';
import * as path from 'path';
import { VideoNode } from '../shared/types';

const VIDEO_EXTENSIONS = new Set([
  '.mp4',
  '.mkv',
  '.webm',
  '.avi',
  '.mov',
  '.m4v',
  '.flv',
  '.wmv',
  '.ts',
  '.mts',
]);

async function walk(dir: string): Promise<VideoNode> {
  const entries = await fs.readdir(dir, { withFileTypes: true });
  const children: VideoNode[] = [];

  for (const entry of entries) {
    if (entry.name.startsWith('.')) continue;
    const fullPath = path.join(dir, entry.name);

    let isDir = entry.isDirectory();
    let isFile = entry.isFile();
    if (entry.isSymbolicLink()) {
      try {
        const st = await fs.stat(fullPath);
        isDir = st.isDirectory();
        isFile = st.isFile();
      } catch {
        continue;
      }
    }

    if (isDir) {
      const child = await walk(fullPath);
      if (child.children.length > 0) {
        children.push(child);
      }
    } else if (isFile && VIDEO_EXTENSIONS.has(path.extname(entry.name).toLowerCase())) {
      children.push({ path: fullPath, displayName: entry.name, isDirectory: false, children: [] });
    }
  }

  children.sort((a, b) => {
    if (a.isDirectory !== b.isDirectory) return a.isDirectory ? -1 : 1;
    return a.displayName.localeCompare(b.displayName);
  });

  return { path: dir, displayName: path.basename(dir), isDirectory: true, children };
}

export async function scanRoot(rootPath: string): Promise<VideoNode> {
  return walk(rootPath);
}
