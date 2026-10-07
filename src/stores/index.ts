import { PlayerStore } from './PlayerStore';
import { VideoTreeStore } from './VideoTreeStore';
import { SidecarStore } from './SidecarStore';
import { TagStore } from './TagStore';
import { QueryStore } from './QueryStore';

export const player = new PlayerStore();
export const videoTree = new VideoTreeStore();
export const sidecar = new SidecarStore();
export const tags = new TagStore(player, sidecar);
export const query = new QueryStore(tags, videoTree);

export function openVideo(path: string) {
  tags.clearPending();
  videoTree.selectVideo(path);
  player.openVideo(path);
  sidecar.load(path);
}

sidecar.onSaved = () => {
  const root = videoTree.rootPath;
  if (root) tags.build(root);
};

videoTree.onScanDone = (root) => {
  tags.build(root);
};

videoTree.onVideosTrashed = () => {
  player.stop();
  sidecar.clear();
  tags.clearPending();
};

videoTree.onRestoreVideo = (path) => {
  openVideo(path);
};
