namespace VideoTagger {
    public class Config : Object {
        private const string GROUP = "library";
        private const string ROOT_KEY = "root-path";
        private string path;

        public string root_path { get; private set; default = ""; }

        public Config() {
            path = Path.build_filename(Environment.get_user_config_dir(), "video-tagger", "config.ini");
        }

        public void load() {
            var key_file = new KeyFile();
            try {
                key_file.load_from_file(path, KeyFileFlags.NONE);
                root_path = key_file.get_string(GROUP, ROOT_KEY);
            } catch (Error error) {
                root_path = "";
            }
        }

        public bool save_root_path(string value) {
            var key_file = new KeyFile();
            key_file.set_string(GROUP, ROOT_KEY, value);
            try {
                DirUtils.create_with_parents(Path.get_dirname(path), 0755);
                FileUtils.set_contents(path, key_file.to_data());
                root_path = value;
                return true;
            } catch (Error error) {
                warning("Unable to save configuration: %s", error.message);
                return false;
            }
        }
    }
}
