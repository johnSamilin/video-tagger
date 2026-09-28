import type { ApiResult } from './lib/ipc-contracts';
import type { Sidecar, TagTreeNode, VideoNode } from './types';

export interface ElectronAPI {
  selectRoot(): Promise<ApiResult & { path?: string }>;
  getConfig(): Promise<ApiResult & { rootPath?: string | null }>;
  scan(rootPath: string): Promise<ApiResult & { tree?: VideoNode }>;
  loadSidecar(videoPath: string): Promise<ApiResult & { sidecar?: Sidecar | null }>;
  saveSidecar(videoPath: string, sidecar: Sidecar): Promise<ApiResult>;
  buildRegistry(
    rootPath: string,
  ): Promise<ApiResult & { tags?: TagTreeNode[]; index?: Record<string, string[]> }>;
  renameTag(rootPath: string, oldName: string, newName: string): Promise<ApiResult>;
  deleteTag(rootPath: string, tagName: string): Promise<ApiResult>;
  prepareMedia(
    videoPath: string,
  ): Promise<
    ApiResult & {
      url?: string;
      status?: 'ready' | 'transcoding' | 'error';
      progress?: number;
    }
  >;
}

declare global {
  interface Window {
    electronAPI?: ElectronAPI;
  }
}

export {};
