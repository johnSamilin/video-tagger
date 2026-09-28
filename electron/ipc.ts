import { ipcMain, dialog, BrowserWindow } from 'electron';
import { Sidecar, VideoNode } from '../shared/types';
import { loadConfig, saveConfig } from './config';
import { scanRoot } from './scanner';
import { loadSidecar, saveSidecar } from './sidecar-store';
import { buildRegistry } from './tag-registry';
import { prepareMedia } from './transcode';

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
}
