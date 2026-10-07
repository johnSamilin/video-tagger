import { makeAutoObservable } from 'mobx';
import { VideoNode } from '../types';
import { getNativeAPI } from '../lib/nativeBridge';
import { loadJSON, saveJSON } from '../lib/persist';

const COLLAPSED_KEY = 'video-tagger:video-collapsed';
const SELECTED_KEY = 'video-tagger:selected-video';

function filterTree(node: VideoNode, paths: Set<string>): VideoNode[] {
  const result: VideoNode[] = [];
  for (const child of node.children) {
    if (child.isDirectory) {
      const filtered = filterTree(child, paths);
      if (filtered.length > 0) {
        result.push({ ...child, children: filtered });
      }
    } else if (paths.has(child.path)) {
      result.push(child);
    }
  }
  return result;
}

export class VideoTreeStore {
  rootPath: string | null = null;
  tree: VideoNode | null = null;
  scanning = false;
  scanError: string | null = null;
  selectedVideoPath: string | null = null;
  selectedPaths: string[] = [];
  filteredPaths: Set<string> | null = null;
  collapsedDirs: Set<string> = new Set(loadJSON<string[]>(COLLAPSED_KEY, []));
  onScanDone: ((root: string) => void) | null = null;
  onVideosTrashed: (() => void) | null = null;
  onRestoreVideo: ((path: string) => void) | null = null;

  constructor() {
    makeAutoObservable(this);
  }

  async init() {
    const api = getNativeAPI();
    if (!api) return;
    const config = await api.getConfig();
    if (config.success && config.rootPath) {
      this.rootPath = config.rootPath;
      await this.scan(config.rootPath);
      this.restoreSelection();
    }
  }

  restoreSelection() {
    const saved = loadJSON<string | null>(SELECTED_KEY, null);
    if (saved && this.allVideoPaths.includes(saved)) {
      this.onRestoreVideo?.(saved);
    }
  }

  async selectRoot() {
    const api = getNativeAPI();
    if (!api) return;
    const res = await api.selectRoot();
    if (res.success && res.path) {
      this.rootPath = res.path;
      await this.scan(res.path);
    }
  }

  async scan(root: string) {
    const api = getNativeAPI();
    if (!api) return;
    this.scanning = true;
    this.scanError = null;
    const res = await api.scan(root);
    this.scanning = false;
    if (res.success && res.tree) {
      this.tree = res.tree;
      this.onScanDone?.(root);
    } else {
      this.scanError = res.error ?? 'Scan failed';
    }
  }

  selectVideo(path: string) {
    this.selectedVideoPath = path;
    this.selectedPaths = [path];
    saveJSON(SELECTED_KEY, path);
  }

  toggleMultiSelect(path: string) {
    const i = this.selectedPaths.indexOf(path);
    if (i >= 0) this.selectedPaths.splice(i, 1);
    else this.selectedPaths.push(path);
    this.selectedVideoPath = this.selectedPaths.length === 1 ? this.selectedPaths[0] : null;
    saveJSON(SELECTED_KEY, this.selectedVideoPath);
  }

  clearMultiSelect() {
    this.selectedPaths = [];
    this.selectedVideoPath = null;
    saveJSON(SELECTED_KEY, null);
  }

  isDirExpanded(path: string): boolean {
    return !this.collapsedDirs.has(path);
  }

  toggleDir(path: string) {
    if (this.collapsedDirs.has(path)) this.collapsedDirs.delete(path);
    else this.collapsedDirs.add(path);
    saveJSON(COLLAPSED_KEY, [...this.collapsedDirs]);
  }

  async trashSelected() {
    const api = getNativeAPI();
    const paths = this.selectedPaths.slice();
    if (!api || paths.length === 0) return;
    const res = await api.trashVideos(paths);
    if (res.success) {
      this.clearMultiSelect();
      this.onVideosTrashed?.();
      if (this.rootPath) await this.scan(this.rootPath);
    }
  }

  isMultiSelected(path: string): boolean {
    return this.selectedPaths.includes(path);
  }

  get selectedCount(): number {
    return this.selectedPaths.length;
  }

  get isBulk(): boolean {
    return this.selectedPaths.length > 1;
  }

  applyFilter(paths: Set<string> | null) {
    this.filteredPaths = paths;
  }

  get visibleTree(): VideoNode[] {
    if (!this.tree) return [];
    if (!this.filteredPaths) return this.tree.children;
    return filterTree(this.tree, this.filteredPaths);
  }

  get allVideoPaths(): string[] {
    const result: string[] = [];
    const walk = (node: VideoNode) => {
      if (!node.isDirectory) {
        result.push(node.path);
        return;
      }
      for (const child of node.children) walk(child);
    };
    if (this.tree) walk(this.tree);
    return result;
  }
}
