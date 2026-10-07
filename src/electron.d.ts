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
  openFolder(videoPath: string): Promise<ApiResult>;
  onOpenFolder(cb: () => void): () => void;
  bulkTag(
    videoPaths: string[],
    tagNames: string[],
    mode: 'add' | 'remove',
  ): Promise<ApiResult>;
  trashVideos(videoPaths: string[]): Promise<ApiResult>;
  findDuplicates(rootPath: string): Promise<ApiResult & { count?: number }>;
  onFindDuplicates(cb: () => void): () => void;
}

declare global {
  interface Window {
    electronAPI?: ElectronAPI;
  }
}

export {};
