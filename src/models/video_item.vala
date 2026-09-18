using Gee;

namespace VideoTagger {
    public class VideoItem : Object {
        public string name { get; construct; }
        public string path { get; construct; }
        public ArrayList<string> tags { get; private set; }
        public HashMap<string, ArrayList<TimeRange>> ranges { get; private set; }

        public VideoItem(string name, string path, string[] initial_tags) {
            Object(name: name, path: path);
            tags = new ArrayList<string>();
            ranges = new HashMap<string, ArrayList<TimeRange>>();
            foreach (string tag in initial_tags) {
                tags.add(tag);
            }
        }
    }
}
