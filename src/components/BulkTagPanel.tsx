import { useState } from 'react';
import { observer } from 'mobx-react-lite';
import { TagTreeNode } from '../types';
import { tags, videoTree } from '../stores';

function leafTags(nodes: TagTreeNode[], path = ''): string[] {
  const result: string[] = [];
  for (const node of nodes) {
    const full = path ? `${path}/${node.name}` : node.name;
    if (node.children.length === 0) result.push(full);
    else result.push(...leafTags(node.children, full));
  }
  return result;
}

export const BulkTagPanel = observer(() => {
  const [selected, setSelected] = useState<Set<string>>(new Set());

  const allTags = leafTags(tags.displayTree);
  const count = videoTree.selectedCount;

  const toggleTag = (name: string) => {
    const next = new Set(selected);
    if (next.has(name)) next.delete(name);
    else next.add(name);
    setSelected(next);
  };

  const apply = (mode: 'add' | 'remove') => {
    tags.bulkApply(videoTree.selectedPaths, [...selected], mode, videoTree.rootPath);
  };

  return (
    <div className="bulk-panel" data-testid="bulk-panel">
      <div className="bulk-head">
        <h3>{count} files selected</h3>
        <button
          className="btn small"
          data-testid="bulk-clear"
          onClick={() => {
            videoTree.clearMultiSelect();
            setSelected(new Set());
          }}
        >
          Clear
        </button>
      </div>
      <p className="muted">
        Select tags, then apply them to all {count} files (add) or remove them everywhere (remove).
        Only the chosen tags are changed; individual ranges are left untouched.
      </p>
      <div className="bulk-tags">
        {allTags.map((name) => (
          <label key={name} className="bulk-tag">
            <input
              type="checkbox"
              checked={selected.has(name)}
              onChange={() => toggleTag(name)}
            />
            <span>{name}</span>
          </label>
        ))}
        {allTags.length === 0 && <div className="muted">No tags yet.</div>}
      </div>
      <div className="bulk-actions">
        <button
          className="btn primary"
          data-testid="bulk-add"
          disabled={selected.size === 0}
          onClick={() => apply('add')}
        >
          Add to {count} files
        </button>
        <button
          className="btn danger"
          data-testid="bulk-remove"
          disabled={selected.size === 0}
          onClick={() => apply('remove')}
        >
          Remove from {count} files
        </button>
      </div>
    </div>
  );
});
