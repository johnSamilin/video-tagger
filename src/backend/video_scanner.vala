using Gee;

namespace VideoTagger {
    public class VideoScanner : Object {
        private HashSet<string> extensions = new HashSet<string>();
        public signal void scan_completed(VideoNode root);
        public signal void scan_progress(int found_count);

        public VideoScanner() {
            foreach (string extension in { "mp4", "mkv", "webm", "avi", "mov", "m4v", "flv", "wmv", "ts", "mts" }) extensions.add(extension);
        }

        public VideoNode? scan(string root_path) {
            int count = 0;
            var root = scan_directory(root_path, ref count);
            if (root != null) scan_completed(root);
            return root;
        }

        private VideoNode? scan_directory(string path, ref int count) {
            var node = new VideoNode(path, true);
            try {
                var directory = Dir.open(path);
                string? name;
                while ((name = directory.read_name()) != null) {
                    if (name == "." || name == "..") continue;
                    string child_path = Path.build_filename(path, name);
                    if (FileUtils.test(child_path, FileTest.IS_DIR)) {
                        var child = scan_directory(child_path, ref count);
                        if (child != null) node.children.add(child);
                    } else if (is_video(child_path)) {
                        node.children.add(new VideoNode(child_path, false));
                        count++;
                        scan_progress(count);
                    }
                }
            } catch (FileError error) {
                return null;
            }
            return node.children.size > 0 ? node : null;
        }

        private bool is_video(string path) {
            int dot = path.last_index_of_char('.');
            return dot >= 0 && extensions.contains(path.substring(dot + 1).down());
        }
    }
}
