import * as fs from 'fs/promises';
import * as path from 'path';
import { sidecarPathFor } from './sidecar-store';
import type { MediaTransferMode } from '../shared/types';

interface TransferItem {
  source: string;
  target: string;
  sourceSidecar: string | null;
  targetSidecar: string;
}

async function exists(filePath: string): Promise<boolean> {
  try {
    await fs.lstat(filePath);
    return true;
  } catch (error) {
    if ((error as NodeJS.ErrnoException).code === 'ENOENT') return false;
    throw error;
  }
}

export async function transferMedia(
  rootPath: string,
  selectedPaths: string[],
  destinationPath: string,
  mode: MediaTransferMode,
  preserveFolders: boolean,
): Promise<void> {
  if (selectedPaths.length === 0) throw new Error('Select at least one media file');
  if (!(await fs.stat(destinationPath)).isDirectory()) throw new Error('Destination must be a folder');

  const targets = new Set<string>();
  const items: TransferItem[] = [];
  for (const source of selectedPaths) {
    const relative = path.relative(rootPath, source);
    if (!relative || relative === '..' || relative.startsWith(`..${path.sep}`) || path.isAbsolute(relative)) {
      throw new Error(`File is outside the media root: ${source}`);
    }
    if (!(await fs.stat(source)).isFile()) throw new Error(`Not a file: ${source}`);

    const target = path.resolve(destinationPath, preserveFolders ? relative : path.basename(source));
    const targetSidecar = sidecarPathFor(target);
    if (targets.has(target)) throw new Error(`Selected files have the same destination: ${target}`);
    targets.add(target);
    const sourceSidecarPath = sidecarPathFor(source);
    items.push({
      source,
      target,
      sourceSidecar: (await exists(sourceSidecarPath)) ? sourceSidecarPath : null,
      targetSidecar,
    });
  }

  // Reject the entire batch before touching the disk if a file or sidecar would be overwritten.
  for (const { source, target, targetSidecar } of items) {
    if (source === target || (await exists(target)) || (await exists(targetSidecar))) {
      throw new Error(`Destination already exists: ${target}`);
    }
  }

  for (const { source, target, sourceSidecar, targetSidecar } of items) {
    await fs.mkdir(path.dirname(target), { recursive: true });
    await fs.copyFile(source, target, fs.constants.COPYFILE_EXCL);
    try {
      if (sourceSidecar) {
        await fs.copyFile(sourceSidecar, targetSidecar, fs.constants.COPYFILE_EXCL);
      }
    } catch (error) {
      await fs.unlink(target);
      throw error;
    }
    if (mode === 'move') {
      await fs.unlink(source);
      if (sourceSidecar) await fs.unlink(sourceSidecar);
    }
  }
}
