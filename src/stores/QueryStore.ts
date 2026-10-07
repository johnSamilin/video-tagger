import { makeAutoObservable } from 'mobx';
import { runQuery } from '../lib/query';
import type { TagStore } from './TagStore';
import type { VideoTreeStore } from './VideoTreeStore';

export class QueryStore {
  query = '';
  error: string | null = null;
  matchCount: number | null = null;
  untagged = false;

  private tags: TagStore;
  private videoTree: VideoTreeStore;

  constructor(tags: TagStore, videoTree: VideoTreeStore) {
    this.tags = tags;
    this.videoTree = videoTree;
    makeAutoObservable(this);
  }

  setQuery(value: string) {
    this.query = value;
    if (value.trim()) {
      this.untagged = false;
      try {
        const result = runQuery(value, this.tags.index, this.tags.allVideoPaths);
        this.videoTree.applyFilter(result);
        this.error = null;
        this.matchCount = result.size;
      } catch (e) {
        this.error = (e as Error).message;
        this.matchCount = null;
      }
    } else if (!this.untagged) {
      this.videoTree.applyFilter(null);
      this.matchCount = null;
      this.error = null;
    }
  }

  addTag(tag: string) {
    const base = this.query.trim();
    this.setQuery(base ? `${base} and ${tag}` : tag);
  }

  toggleUntagged() {
    this.untagged = !this.untagged;
    if (this.untagged) {
      this.query = '';
      this.error = null;
      this.applyUntagged();
    } else {
      this.videoTree.applyFilter(null);
      this.matchCount = null;
    }
  }

  clear() {
    this.query = '';
    this.untagged = false;
    this.error = null;
    this.matchCount = null;
    this.videoTree.applyFilter(null);
  }

  private applyUntagged() {
    const tagged = new Set(this.tags.allVideoPaths);
    const paths = new Set(this.videoTree.allVideoPaths.filter((p) => !tagged.has(p)));
    this.videoTree.applyFilter(paths);
    this.matchCount = paths.size;
  }
}
