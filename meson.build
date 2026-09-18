project('video-tagger', 'vala',
  version: '0.1.0',
  meson_version: '>=0.56.0'
)

gnome = import('gnome')

deps = [
  dependency('glib-2.0', version: '>=2.56'),
  dependency('gobject-2.0'),
  dependency('gio-2.0'),
  dependency('gtk+-3.0', version: '>=3.22'),
  dependency('gee-0.8'),
  dependency('json-glib-1.0'),
  dependency('gstreamer-1.0'),
  dependency('gstreamer-video-1.0')
]

resources = gnome.compile_resources('video_tagger_resources',
  'video-tagger.gresource.xml',
  source_dir: 'src/utils/resources',
  c_name: 'video_tagger'
)

sources = [
  'src/main.vala',
  'src/application.vala',
  'src/models/time_range.vala',
  'src/models/sidecar.vala',
  'src/models/video_node.vala',
  'src/models/tag_info.vala',
  'src/backend/sidecar_store.vala',
  'src/backend/config.vala',
  'src/backend/player_engine.vala',
  'src/backend/video_scanner.vala',
  'src/backend/tag_registry.vala',
  'src/widgets/main_window.vala',
  'src/widgets/range_edit_dialog.vala',
  'src/utils/time_utils.vala'
]

executable('video-tagger', sources + resources,
  dependencies: deps,
  vala_args: ['--target-glib=2.56'],
  install: true
)

install_data('data/io.github.video-tagger.desktop',
  install_dir: join_paths(get_option('datadir'), 'applications')
)

test_exe = executable('test-core',
  ['tests/test_core.vala', 'src/utils/time_utils.vala', 'src/models/time_range.vala',
   'src/models/sidecar.vala', 'src/backend/tag_registry.vala'],
  dependencies: [dependency('glib-2.0'), dependency('gobject-2.0'), dependency('gee-0.8'), dependency('json-glib-1.0')]
)
test('core', test_exe)
