import { makeAutoObservable, toJS } from 'mobx';
import { Sidecar, TimeRange } from '../types';
import { getNativeAPI } from '../lib/nativeBridge';

export class SidecarStore {
  currentVideoPath: string | null = null;
  sidecar: Sidecar = { version: 1, tags: {} };
  onSaved: (() => void) | null = null;

  private saveTimer: ReturnType<typeof setTimeout> | null = null;

  constructor() {
    makeAutoObservable(this);
  }

  async load(videoPath: string) {
    this.currentVideoPath = videoPath;
    const api = getNativeAPI();
    if (!api) return;
    const res = await api.loadSidecar(videoPath);
    this.sidecar = res.success && res.sidecar ? res.sidecar : { version: 1, tags: {} };
  }

  clear() {
    this.currentVideoPath = null;
    this.sidecar = { version: 1, tags: {} };
    if (this.saveTimer) {
      clearTimeout(this.saveTimer);
      this.saveTimer = null;
    }
  }

  get sortedTags(): string[] {
    return Object.keys(this.sidecar.tags).sort();
  }

  rangesFor(tag: string): TimeRange[] {
    return this.sidecar.tags[tag] ?? [];
  }

  addRange(tag: string, range: TimeRange) {
    const list = this.sidecar.tags[tag] ?? [];
    list.push(range);
    list.sort((a, b) => a.start - b.start);
    this.sidecar.tags[tag] = list;
    this.scheduleSave();
  }

  ensureTag(tag: string) {
    if (!this.currentVideoPath) return;
    if (this.sidecar.tags[tag]) return;
    this.sidecar.tags[tag] = [];
    this.scheduleSave();
  }

  updateRange(tag: string, index: number, range: TimeRange) {
    const list = this.sidecar.tags[tag];
    if (!list) return;
    list[index] = range;
    list.sort((a, b) => a.start - b.start);
    this.scheduleSave();
  }

  deleteRange(tag: string, index: number) {
    const list = this.sidecar.tags[tag];
    if (!list) return;
    list.splice(index, 1);
    if (list.length === 0) delete this.sidecar.tags[tag];
    this.scheduleSave();
  }

  scheduleSave() {
    if (this.saveTimer) clearTimeout(this.saveTimer);
    this.saveTimer = setTimeout(() => this.save(), 300);
  }

  async save() {
    const path = this.currentVideoPath;
    const api = getNativeAPI();
    if (!path || !api) return;
    await api.saveSidecar(path, toJS(this.sidecar));
    this.onSaved?.();
  }
}
