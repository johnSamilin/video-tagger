namespace VideoTagger {
    public class SidecarStore : Object {
        public signal void sidecar_saved(string video_path, Sidecar sidecar);
        public signal void sidecar_error(string video_path, string message);

        public string sidecar_path_for(string video_path) {
            return video_path + ".tags.json";
        }

        public Sidecar load(string video_path) {
            string contents;
            try {
                FileUtils.get_contents(sidecar_path_for(video_path), out contents);
                return Sidecar.from_json(contents);
            } catch (FileError error) {
                return new Sidecar();
            }
        }

        public bool save(string video_path, Sidecar sidecar) {
            string path = sidecar_path_for(video_path);
            string temporary = path + ".tmp";
            try {
                FileUtils.set_contents(temporary, sidecar.to_json());
                if (FileUtils.rename(temporary, path) != 0) {
                    throw new FileError.FAILED("Could not replace sidecar atomically");
                }
                sidecar_saved(video_path, sidecar);
                return true;
            } catch (FileError error) {
                sidecar_error(video_path, error.message);
                return false;
            }
        }
    }
}
