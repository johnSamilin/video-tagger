import { PlayerStore } from './PlayerStore';
import { VideoTreeStore } from './VideoTreeStore';
import { SidecarStore } from './SidecarStore';
import { TagStore } from './TagStore';

export const player = new PlayerStore();
export const videoTree = new VideoTreeStore();
export const sidecar = new SidecarStore();
export const tags = new TagStore(player, sidecar);

sidecar.onSaved = () => {
  const root = videoTree.rootPath;
  if (root) tags.build(root);
};

videoTree.onScanDone = (root) => {
  tags.build(root);
};
