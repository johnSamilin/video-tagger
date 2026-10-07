import { ipcMain, dialog, BrowserWindow, shell } from 'electron';
import * as fs from 'fs';
import * as path from 'path';
import { Sidecar, VideoNode } from '../shared/types';
import { loadConfig, saveConfig } from './config';
import { scanRoot } from './scanner';
import { loadSidecar, saveSidecar, sidecarPathFor } from './sidecar-store';
import { buildRegistry } from './tag-registry';
import { prepareMedia, probeDuration } from './transcode';

function collectVideos(node: VideoNode): string[] {
  const result: string[] = [];
  const walk = (n: VideoNode) => {
    if (!n.isDirectory) {
      result.push(n.path);
      return;
    }
    for (const child of n.children) walk(child);
  };
  walk(node);
  return result;
}

export function registerIpc() {
  ipcMain.handle('vt:select-root', async (event) => {
    const win = BrowserWindow.fromWebContents(event.sender);
    const result = await dialog.showOpenDialog(win!, {
      properties: ['openDirectory'],
      title: 'Select video root folder',
    });
    if (result.canceled || result.filePaths.length === 0) {
      return { success: false };
    }
    const rootPath = result.filePaths[0];
    await saveConfig({ rootPath });
    return { success: true, path: rootPath };
  });

  ipcMain.handle('vt:get-config', async () => {
    const envRoot = process.env.VT_ROOT || null;
    const config = await loadConfig();
    return { success: true, rootPath: envRoot ?? config.rootPath };
  });

  ipcMain.handle('vt:scan', async (_event, rootPath: string) => {
    try {
      const tree = await scanRoot(rootPath);
      return { success: true, tree };
    } catch (err) {
      return { success: false, error: (err as Error).message };
    }
  });

  ipcMain.handle('vt:load-sidecar', async (_event, videoPath: string) => {
    try {
      const sidecar = await loadSidecar(videoPath);
      return { success: true, sidecar };
    } catch (err) {
      return { success: false, error: (err as Error).message };
    }
  });

  ipcMain.handle('vt:save-sidecar', async (_event, videoPath: string, sidecar: Sidecar) => {
    try {
      await saveSidecar(videoPath, sidecar);
      return { success: true };
    } catch (err) {
      return { success: false, error: (err as Error).message };
    }
  });

  ipcMain.handle('vt:build-registry', async (_event, rootPath: string) => {
    try {
      const tree = await scanRoot(rootPath);
      const videoPaths = collectVideos(tree);
      const { tags, index } = await buildRegistry(videoPaths);
      return { success: true, tags, index };
    } catch (err) {
      return { success: false, error: (err as Error).message };
    }
  });

  ipcMain.handle('vt:rename-tag', async (_event, rootPath: string, oldName: string, newName: string) => {
    try {
      const tree = await scanRoot(rootPath);
      for (const videoPath of collectVideos(tree)) {
        const sidecar = await loadSidecar(videoPath);
        if (sidecar.tags[oldName]) {
          sidecar.tags[newName] = (sidecar.tags[newName] ?? []).concat(sidecar.tags[oldName]);
          delete sidecar.tags[oldName];
          await saveSidecar(videoPath, sidecar);
        }
      }
      return { success: true };
    } catch (err) {
      return { success: false, error: (err as Error).message };
    }
  });

  ipcMain.handle('vt:delete-tag', async (_event, rootPath: string, tagName: string) => {
    try {
      const tree = await scanRoot(rootPath);
      for (const videoPath of collectVideos(tree)) {
        const sidecar = await loadSidecar(videoPath);
        if (sidecar.tags[tagName]) {
          delete sidecar.tags[tagName];
          await saveSidecar(videoPath, sidecar);
        }
      }
      return { success: true };
    } catch (err) {
      return { success: false, error: (err as Error).message };
    }
  });

  ipcMain.handle('vt:prepare-media', async (_event, videoPath: string) => {
    try {
      const status = await prepareMedia(videoPath);
      return { success: true, ...status };
    } catch (err) {
      return { success: false, error: (err as Error).message };
    }
  });

  ipcMain.handle('vt:open-folder', async (_event, videoPath: string) => {
    try {
      await shell.openPath(path.dirname(videoPath));
      return { success: true };
    } catch (err) {
      return { success: false, error: (err as Error).message };
    }
  });

  ipcMain.handle('vt:find-duplicates', async (_event, rootPath: string) => {
    try {
      const tree = await scanRoot(rootPath);
      const videos = collectVideos(tree);

      const groups = new Map<string, { name: string; paths: string[] }>();
      for (const videoPath of videos) {
        const name = path.basename(videoPath);
        const size = await fs.promises
          .stat(videoPath)
          .then((s) => s.size)
          .catch(() => -1);
        const key = `${name}|${size}`;
        let group = groups.get(key);
        if (!group) {
          group = { name, paths: [] };
          groups.set(key, group);
        }
        group.paths.push(videoPath);
      }

      let tagged = 0;
      for (const { name, paths: groupPaths } of groups.values()) {
        if (groupPaths.length < 2) continue;
        const tagName = `duplicates/${name}`;
        for (const videoPath of groupPaths) {
          const sidecar = await loadSidecar(videoPath);
          if (!sidecar.tags[tagName]) {
            sidecar.tags[tagName] = [];
            await saveSidecar(videoPath, sidecar);
          }
          tagged += 1;
        }
      }
      return { success: true, count: tagged };
    } catch (err) {
      return { success: false, error: (err as Error).message };
    }
  });

  ipcMain.handle('vt:trash-videos', async (_event, videoPaths: string[]) => {
    try {
      for (const videoPath of videoPaths) {
        if (fs.existsSync(videoPath)) {
          await shell.trashItem(videoPath);
        }
        const sidecar = sidecarPathFor(videoPath);
        if (fs.existsSync(sidecar)) {
          await shell.trashItem(sidecar);
        }
      }
      return { success: true };
    } catch (err) {
      return { success: false, error: (err as Error).message };
    }
  });

  ipcMain.handle(
    'vt:bulk-tag',
    async (_event, videoPaths: string[], tagNames: string[], mode: 'add' | 'remove') => {
      try {
        for (const videoPath of videoPaths) {
          const sidecar = await loadSidecar(videoPath);
          let changed = false;
          for (const tagName of tagNames) {
            if (mode === 'remove') {
              if (sidecar.tags[tagName]) {
                delete sidecar.tags[tagName];
                changed = true;
              }
            } else {
              const existing = sidecar.tags[tagName];
              if (!existing || existing.length === 0) {
                const duration = await probeDuration(videoPath);
                if (duration > 0) {
                  sidecar.tags[tagName] = [{ start: 0, end: duration }];
                  changed = true;
                }
              }
            }
          }
          if (changed) await saveSidecar(videoPath, sidecar);
        }
        return { success: true };
      } catch (err) {
        return { success: false, error: (err as Error).message };
      }
    },
  );
}
