import { TagTreeNode } from '../shared/types';
import { loadSidecar } from './sidecar-store';

export interface RegistryResult {
  tags: TagTreeNode[];
  index: Record<string, string[]>;
}

function insertIntoTree(nodes: TagTreeNode[], parts: string[], count: number): void {
  if (parts.length === 0) return;
  const [head, ...rest] = parts;

  let node = nodes.find((n) => n.name === head);
  if (!node) {
    node = { name: head, count: 0, children: [] };
    nodes.push(node);
    nodes.sort((a, b) => a.name.localeCompare(b.name));
  }

  if (rest.length === 0) {
    node.count = count;
  } else {
    insertIntoTree(node.children, rest, count);
  }
}

export async function buildRegistry(videoPaths: string[]): Promise<RegistryResult> {
  const index: Record<string, string[]> = {};
  const countMap: Record<string, number> = {};

  for (const videoPath of videoPaths) {
    const sidecar = await loadSidecar(videoPath);
    for (const tag of Object.keys(sidecar.tags)) {
      if (!index[tag]) index[tag] = [];
      index[tag].push(videoPath);
      countMap[tag] = (countMap[tag] ?? 0) + 1;
    }
  }

  const tree: TagTreeNode[] = [];
  for (const name of Object.keys(countMap).sort()) {
    insertIntoTree(tree, name.split('/').filter(Boolean), countMap[name]);
  }

  return { tags: tree, index };
}
