import { app } from 'electron';
import * as fs from 'fs';
import * as path from 'path';

export function transcodeDir(): string {
  return path.join(app.getPath('userData'), 'transcode');
}

export function getCacheSizeBytes(): number {
  const dir = transcodeDir();
  let total = 0;
  let entries;
  try {
    entries = fs.readdirSync(dir, { withFileTypes: true });
  } catch {
    return 0;
  }
  for (const entry of entries) {
    if (!entry.isFile()) continue;
    try {
      total += fs.statSync(path.join(dir, entry.name)).size;
    } catch {
      // ignore
    }
  }
  return total;
}

export function clearCache(): void {
  const dir = transcodeDir();
  try {
    fs.rmSync(dir, { recursive: true, force: true });
  } catch {
    // ignore
  }
  try {
    fs.mkdirSync(dir, { recursive: true });
  } catch {
    // ignore
  }
}

export function formatBytes(bytes: number): string {
  const gb = 1024 ** 3;
  const mb = 1024 ** 2;
  const kb = 1024;
  if (bytes >= gb) return `${(bytes / gb).toFixed(2)} ГБ`;
  if (bytes >= mb) return `${Math.round(bytes / mb)} МБ`;
  if (bytes >= kb) return `${Math.round(bytes / kb)} КБ`;
  return `${bytes} Б`;
}

// Set by main.ts to refresh the menu label when the cache changes.
export let onCacheChanged: (() => void) | null = null;

export function setOnCacheChanged(cb: (() => void) | null): void {
  onCacheChanged = cb;
}
