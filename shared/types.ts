export interface TimeRange {
  start: number;
  end: number;
}

export interface Sidecar {
  version: 1;
  tags: Record<string, TimeRange[]>;
}

export interface VideoNode {
  path: string;
  displayName: string;
  isDirectory: boolean;
  children: VideoNode[];
}

export interface TagInfo {
  name: string;
  count: number;
}

export interface TagTreeNode {
  name: string;
  count: number;
  children: TagTreeNode[];
}
