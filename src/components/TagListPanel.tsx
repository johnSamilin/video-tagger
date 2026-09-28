import { useState, type MouseEvent } from 'react';
import { observer } from 'mobx-react-lite';
import { TagTreeNode } from '../types';
import { tags, videoTree } from '../stores';
import { NewTagDialog } from './NewTagDialog';
import { ConfirmDialog } from './ConfirmDialog';

const TagRow = observer(
  ({
    node,
    path,
    depth,
  }: {
    node: TagTreeNode;
    path: string;
    depth: number;
  }) => {
    const fullPath = path ? `${path}/${node.name}` : node.name;
    const isLeaf = node.children.length === 0;
    const expanded = tags.expanded.has(fullPath);
    const isActive = tags.isActive(fullPath);

    const [menuOpen, setMenuOpen] = useState(false);
    const [renaming, setRenaming] = useState(false);
    const [deleting, setDeleting] = useState(false);

    const handleClick = (e: MouseEvent<HTMLDivElement>) => {
      if (!isLeaf) {
        tags.toggleExpand(fullPath);
        return;
      }
      if (e.detail >= 2) {
        tags.markWholeFile(fullPath);
        return;
      }
      tags.toggle(fullPath);
    };

    return (
      <div>
        <div
          className={`tag-row ${isActive ? 'active' : ''}`}
          style={{ paddingLeft: depth * 12 }}
          data-testid="tag-row"
          data-name={fullPath}
          title={isLeaf ? 'Click to toggle range · Double-click to mark whole file' : undefined}
          onClick={handleClick}
        >
          {!isLeaf && <span className="tree-icon">{expanded ? '▾' : '▸'}</span>}
          {isLeaf && <span className="tree-icon" />}
          <span className="tag-dot" style={{ background: isLeaf ? 'var(--tag-color)' : 'transparent' }} />
          <span className="tag-name">{node.name}</span>
          {isLeaf && <span className="tag-count">({node.count})</span>}
          {isActive && (
            <span className="recording" data-testid="recording" title="Recording range">
              ●
            </span>
          )}
          {isLeaf && (
            <span className="tag-menu" onClick={(e) => e.stopPropagation()}>
              <button className="mini" onClick={() => setMenuOpen(!menuOpen)}>
                ⋯
              </button>
              {menuOpen && (
                <div className="menu">
                  <button
                    data-testid="tag-rename-btn"
                    onClick={() => {
                      setMenuOpen(false);
                      setRenaming(true);
                    }}
                  >
                    Rename
                  </button>
                  <button
                    data-testid="tag-delete-btn"
                    onClick={() => {
                      setMenuOpen(false);
                      setDeleting(true);
                    }}
                  >
                    Delete everywhere
                  </button>
                </div>
              )}
            </span>
          )}
        </div>
        {!isLeaf &&
          expanded &&
          node.children.map((child) => (
            <TagRow key={child.name} node={child} path={fullPath} depth={depth + 1} />
          ))}
        {renaming && (
          <NewTagDialog
            initialValue={fullPath}
            onCancel={() => setRenaming(false)}
            onSubmit={(newName) => {
              if (newName !== fullPath && videoTree.rootPath) {
                tags.rename(videoTree.rootPath, fullPath, newName);
              }
            }}
          />
        )}
        {deleting && (
          <ConfirmDialog
            title="Delete tag"
            message={`Delete tag "${fullPath}" everywhere?`}
            onConfirm={() => {
              if (videoTree.rootPath) {
                tags.delete(videoTree.rootPath, fullPath);
              }
              setDeleting(false);
            }}
            onCancel={() => setDeleting(false)}
          />
        )}
      </div>
    );
  },
);

export const TagListPanel = observer(() => {
  const [showNew, setShowNew] = useState(false);

  return (
    <div className="panel">
      <div className="panel-head">
        <h3>Tags</h3>
        <button className="btn small" data-testid="new-tag-btn" onClick={() => setShowNew(true)}>
          + New
        </button>
      </div>
      <div className="tree">
        {tags.displayTree.map((node) => (
          <TagRow key={node.name} node={node} path="" depth={0} />
        ))}
        {tags.displayTree.length === 0 && <div className="muted">No tags yet.</div>}
      </div>
      {showNew && <NewTagDialog onCancel={() => setShowNew(false)} />}
    </div>
  );
});
