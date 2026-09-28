import { contextBridge, ipcRenderer } from 'electron';

const api = {
  selectRoot: () => ipcRenderer.invoke('vt:select-root'),
  getConfig: () => ipcRenderer.invoke('vt:get-config'),
  scan: (rootPath: string) => ipcRenderer.invoke('vt:scan', rootPath),
  loadSidecar: (videoPath: string) => ipcRenderer.invoke('vt:load-sidecar', videoPath),
  saveSidecar: (videoPath: string, sidecar: unknown) =>
    ipcRenderer.invoke('vt:save-sidecar', videoPath, sidecar),
  buildRegistry: (rootPath: string) => ipcRenderer.invoke('vt:build-registry', rootPath),
  renameTag: (rootPath: string, oldName: string, newName: string) =>
    ipcRenderer.invoke('vt:rename-tag', rootPath, oldName, newName),
  deleteTag: (rootPath: string, tagName: string) =>
    ipcRenderer.invoke('vt:delete-tag', rootPath, tagName),
  prepareMedia: (videoPath: string) => ipcRenderer.invoke('vt:prepare-media', videoPath),
};

contextBridge.exposeInMainWorld('electronAPI', api);

export type ElectronAPI = typeof api;
