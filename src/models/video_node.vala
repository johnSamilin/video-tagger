using Gee;

namespace VideoTagger {
    public class VideoNode : Object {
        public string path { get; construct; }
        public string display_name { get; construct; }
        public bool is_directory { get; construct; }
        public ArrayList<VideoNode> children { get; private set; }

        public VideoNode(string path, bool is_directory) {
            Object(path: path, display_name: Path.get_basename(path), is_directory: is_directory);
            children = new ArrayList<VideoNode>();
        }
    }
}
