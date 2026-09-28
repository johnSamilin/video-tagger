export default {
  packagerConfig: {
    name: 'video-tagger',
    executableName: 'video-tagger',
    asar: true,
    asarUnpack: [
      'node_modules/ffmpeg-static/**',
      'node_modules/ffprobe-static/**',
    ],
    extraResource: ['./dist'],
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
