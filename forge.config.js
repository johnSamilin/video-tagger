import ffprobe from 'ffprobe-static';
import ffmpegStatic from 'ffmpeg-static';

// Resolve the platform-specific binaries at build time and copy them out of
// node_modules into the packaged app's resources/ directory (outside asar), so
// they can be spawned on a target machine that has no Node.js installed.
const ffmpegBin =
  typeof ffmpegStatic === 'string'
    ? ffmpegStatic
    : ffmpegStatic?.default ?? ffmpegStatic?.path;

const ffprobeBin = ffprobe?.path;

export default {
  packagerConfig: {
    name: 'video-tagger',
    executableName: 'video-tagger',
    asar: true,
    extraResource: [
      './dist',
      ...(ffprobeBin ? [ffprobeBin] : []),
      ...(ffmpegBin ? [ffmpegBin] : []),
    ],
  },
  rebuildConfig: {},
  makers: [
    {
      name: '@electron-forge/maker-squirrel',
      config: { name: 'video-tagger' },
    },
    {
      name: '@electron-forge/maker-deb',
      config: {
        options: {
          maintainer: 'Alexander Saltykov',
          homepage: 'https://example.com',
        },
      },
    },
    {
      name: '@electron-forge/maker-dmg',
      config: { format: 'ULFO' },
    },
    {
      name: '@electron-forge/maker-zip',
      config: {},
    },
  ],
};
