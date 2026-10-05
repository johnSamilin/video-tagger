import { observer } from 'mobx-react-lite';
import { player, sidecar, videoTree } from '../stores';
import { formatTimeShort } from '../lib/time';

export const StatusBar = observer(() => {
  if (videoTree.isBulk) {
    return <footer className="statusbar">{videoTree.selectedCount} files selected</footer>;
  }
  const video = videoTree.selectedVideoPath;
  if (!video) return <footer className="statusbar">No video selected</footer>;

  const tagCount = Object.keys(sidecar.sidecar.tags).length;
  const rangeCount = Object.values(sidecar.sidecar.tags).reduce((n, r) => n + r.length, 0);

  return (
    <footer className="statusbar">
      {video} — {formatTimeShort(player.currentTime)} / {formatTimeShort(player.duration)} —{' '}
      {tagCount} tags, {rangeCount} ranges
    </footer>
  );
});
