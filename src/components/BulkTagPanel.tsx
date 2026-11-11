import { useState } from 'react';
import { observer } from 'mobx-react-lite';
import { TagTreeNode } from '../types';
import { tags, videoTree } from '../stores';
import { getNativeAPI } from '../lib/nativeBridge';
import { ConfirmDialog } from './ConfirmDialog';

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
  const [confirmDelete, setConfirmDelete] = useState(false);
  const [busy, setBusy] = useState(false);
  const [error, setError] = useState<string | null>(null);

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

  const transfer = async (mode: 'copy' | 'move', preserveFolders: boolean) => {
    const api = getNativeAPI();
    const root = videoTree.rootPath;
    if (!api || !root || busy) return;
    setError(null);
    setBusy(true);
    try {
      const folder = await api.selectDestination();
      if (!folder.success || !folder.path) return;
      const result = await api.transferMedia(root, [...videoTree.selectedPaths], folder.path, mode, preserveFolders);
      if (!result.success) setError(result.error ?? 'Could not transfer media');
      else if (mode === 'move') videoTree.clearMultiSelect();
      await videoTree.scan(root);
    } catch (err) {
      setError((err as Error).message);
    } finally {
      setBusy(false);
    }
  };

  const removeSelected = async () => {
    if (busy) return;
    setConfirmDelete(false);
    setBusy(true);
    setError(null);
    try {
      const result = await videoTree.trashSelected();
      if (!result?.success) setError(result?.error ?? 'Could not move files to Trash');
    } catch (err) {
      setError((err as Error).message);
    } finally {
      setBusy(false);
    }
  };

  return (
    <div className="bulk-panel" data-testid="bulk-panel">
      <div className="bulk-head">
        <h3>{count} files selected</h3>
        <button
          className="btn small"
          data-testid="bulk-clear"
          disabled={busy}
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
      <h3>File operations</h3>
      <p className="muted">
        Choose a destination folder. Preserve folders keeps paths relative to the current media root.
        Tags travel with their files; existing files are never overwritten.
      </p>
      <div className="bulk-actions bulk-file-actions">
        <button className="btn" data-testid="bulk-copy" disabled={busy} onClick={() => void transfer('copy', false)}>Copy to folder…</button>
        <button className="btn" data-testid="bulk-move" disabled={busy} onClick={() => void transfer('move', false)}>Move to folder…</button>
        <button className="btn" data-testid="bulk-copy-tree" disabled={busy} onClick={() => void transfer('copy', true)}>Copy preserving folders…</button>
        <button className="btn" data-testid="bulk-move-tree" disabled={busy} onClick={() => void transfer('move', true)}>Move preserving folders…</button>
        <button className="btn danger" data-testid="bulk-delete" disabled={busy} onClick={() => setConfirmDelete(true)}>Move to Trash</button>
      </div>
      {error && <p className="bulk-error" role="alert">{error}</p>}
      {confirmDelete && (
        <ConfirmDialog
          title="Move selected files to Trash?"
          message={`Move ${count} media files and their tag sidecars to Trash?`}
          confirmLabel="Move to Trash"
          onConfirm={() => void removeSelected()}
          onCancel={() => setConfirmDelete(false)}
        />
      )}
    </div>
  );
});
