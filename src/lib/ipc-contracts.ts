export interface ApiResult {
  success: boolean;
  error?: string;
}

export const IPC_CHANNELS = {
  selectRoot: 'vt:select-root',
  getConfig: 'vt:get-config',
  scan: 'vt:scan',
  loadSidecar: 'vt:load-sidecar',
  saveSidecar: 'vt:save-sidecar',
  buildRegistry: 'vt:build-registry',
  renameTag: 'vt:rename-tag',
  deleteTag: 'vt:delete-tag',
  prepareMedia: 'vt:prepare-media',
  openFolder: 'vt:open-folder',
  bulkTag: 'vt:bulk-tag',
} as const;
