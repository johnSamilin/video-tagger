import { useState } from 'react';
import { observer } from 'mobx-react-lite';
import { VideoNode } from '../types';
import { player, sidecar, tags, videoTree } from '../stores';

function openVideo(path: string) {
  tags.clearPending();
  videoTree.selectVideo(path);
  player.openVideo(path);
  sidecar.load(path);
}

function toggleMulti(path: string) {
  videoTree.toggleMultiSelect(path);
  const n = videoTree.selectedPaths.length;
  if (n === 0) {
    tags.clearPending();
    player.stop();
    sidecar.clear();
  } else if (n === 1) {
    openVideo(videoTree.selectedPaths[0]);
  } else {
    tags.clearPending();
    player.stop();
    sidecar.clear();
  }
}

const TreeNode = observer(({ node, depth }: { node: VideoNode; depth: number }) => {
  const [expanded, setExpanded] = useState(true);

  if (node.isDirectory) {
    return (
      <div>
        <div
          className="tree-row dir"
          style={{ paddingLeft: depth * 12 }}
          onClick={() => setExpanded(!expanded)}
        >
          <span className="tree-icon">{expanded ? '▾' : '▸'}</span>
          <span>📁 {node.displayName}</span>
        </div>
        {expanded &&
          node.children.map((child) => (
            <TreeNode key={child.path} node={child} depth={depth + 1} />
          ))}
      </div>
    );
  }

  const selected = videoTree.selectedPaths.includes(node.path);
  return (
    <div
      className={`tree-row file ${selected ? 'selected' : ''}`}
      style={{ paddingLeft: depth * 12 }}
      data-testid="video-row"
      data-name={node.displayName}
      onClick={() => openVideo(node.path)}
    >
      <input
        type="checkbox"
        className="tree-check"
        data-testid="video-check"
        checked={videoTree.isMultiSelected(node.path)}
        onClick={(e) => e.stopPropagation()}
        onChange={() => toggleMulti(node.path)}
      />
      <span className="tree-icon">▶</span>
      <span>{node.displayName}</span>
    </div>
  );
});

export const VideoTreePanel = observer(() => {
  if (videoTree.scanning) {
    return (
      <div className="panel">
        <h3>Videos</h3>
        <div className="muted">Scanning…</div>
      </div>
    );
  }
  if (!videoTree.rootPath) {
    return (
      <div className="panel">
        <h3>Videos</h3>
        <div className="muted">Choose a root folder to start.</div>
      </div>
    );
  }
  return (
    <div className="panel">
      <h3>Videos</h3>
      <div className="tree">
        {videoTree.visibleTree.map((node) => (
          <TreeNode key={node.path} node={node} depth={0} />
        ))}
        {videoTree.visibleTree.length === 0 && (
          <div className="muted">No matching videos.</div>
        )}
      </div>
    </div>
  );
});
