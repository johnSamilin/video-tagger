import { makeAutoObservable, toJS } from 'mobx';
import { TagTreeNode } from '../types';
import { getNativeAPI } from '../lib/nativeBridge';
import { loadJSON, saveJSON } from '../lib/persist';
import { PlayerStore } from './PlayerStore';
import { SidecarStore } from './SidecarStore';

const EXPANDED_KEY = 'video-tagger:tag-expanded';

function cloneNode(node: TagTreeNode): TagTreeNode {
  return { name: node.name, count: node.count, children: node.children.map(cloneNode) };
}

function insertTag(nodes: TagTreeNode[], parts: string[]): void {
  if (parts.length === 0) return;
  const [head, ...rest] = parts;

  let node = nodes.find((n) => n.name === head);
  if (!node) {
    node = { name: head, count: 0, children: [] };
    nodes.push(node);
    nodes.sort((a, b) => a.name.localeCompare(b.name));
  }
  if (rest.length > 0) {
    insertTag(node.children, rest);
  }
}

export class TagStore {
  tree: TagTreeNode[] = [];
  index: Record<string, string[]> = {};
  localTags: string[] = [];
  pending: Map<string, number> = new Map();
  expanded: Set<string> = new Set();

  private player: PlayerStore;
  private sidecar: SidecarStore;

  constructor(player: PlayerStore, sidecar: SidecarStore) {
    this.player = player;
    this.sidecar = sidecar;
    this.expanded = new Set(loadJSON<string[]>(EXPANDED_KEY, []));
    makeAutoObservable(this);
  }

  async build(rootPath: string) {
    const api = getNativeAPI();
    if (!api) return;
    const res = await api.buildRegistry(rootPath);
    if (res.success) {
      this.tree = res.tags ?? [];
      this.index = res.index ?? {};
    }
  }

  get allVideoPaths(): string[] {
    const set = new Set<string>();
    for (const paths of Object.values(this.index)) {
      for (const p of paths) set.add(p);
    }
    return [...set];
  }

  get displayTree(): TagTreeNode[] {
    const clone = this.tree.map(cloneNode);
    for (const tag of this.localTags) {
      insertTag(clone, tag.split('/').filter(Boolean));
    }
    return clone;
  }

  addLocalTag(name: string) {
    if (name && !this.localTags.includes(name)) {
      this.localTags.push(name);
      this.sidecar.ensureTag(name);
    }
  }

  isActive(tagName: string): boolean {
    return this.pending.has(tagName);
  }

  pendingStartFor(tagName: string): number | null {
    return this.pending.get(tagName) ?? null;
  }

  toggle(tagName: string) {
    if (this.pending.has(tagName)) {
      const start = this.pending.get(tagName) as number;
      const end = this.player.currentTime;
      this.pending.delete(tagName);
      if (Number.isFinite(start) && Number.isFinite(end) && end > start) {
        this.sidecar.addRange(tagName, { start, end });
      }
    } else {
      this.pending.set(tagName, this.player.currentTime);
    }
  }

  clearPending() {
    this.pending.clear();
  }

  markWholeFile(tagName: string) {
    this.pending.delete(tagName);
    const duration = this.player.duration;
    if (!Number.isFinite(duration) || duration <= 0) return;
    const ranges = this.sidecar.rangesFor(tagName);
    const alreadyFull = ranges.some((r) => r.start <= 0.01 && r.end >= duration - 0.01);
    if (alreadyFull) return;
    this.sidecar.addRange(tagName, { start: 0, end: duration });
  }

  toggleExpand(path: string) {
    if (this.expanded.has(path)) this.expanded.delete(path);
    else this.expanded.add(path);
    saveJSON(EXPANDED_KEY, [...this.expanded]);
  }

  async rename(rootPath: string, oldName: string, newName: string) {
    const api = getNativeAPI();
    if (!api) return;
    await api.renameTag(rootPath, oldName, newName);
    this.localTags = this.localTags.filter((t) => t !== oldName);
    await this.build(rootPath);
  }

  async delete(rootPath: string, tagName: string) {
    const api = getNativeAPI();
    if (!api) return;
    await api.deleteTag(rootPath, tagName);
    this.localTags = this.localTags.filter((t) => t !== tagName);
    this.pending.delete(tagName);
    await this.build(rootPath);
  }

  async findDuplicates(rootPath: string) {
    const api = getNativeAPI();
    if (!api) return;
    await api.findDuplicates(rootPath);
    await this.build(rootPath);
  }

  async bulkApply(
    videoPaths: string[],
    tagNames: string[],
    mode: 'add' | 'remove',
    rootPath: string | null,
  ) {
    const api = getNativeAPI();
    if (!api || videoPaths.length === 0 || tagNames.length === 0) return;
    await api.bulkTag(toJS(videoPaths), toJS(tagNames), mode);
    if (rootPath) await this.build(rootPath);
  }
}
