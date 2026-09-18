using Gee;

namespace VideoTagger {
    public class Sidecar : Object {
        public HashMap<string, ArrayList<TimeRange>> tags { get; private set; }

        public Sidecar() {
            tags = new HashMap<string, ArrayList<TimeRange>>();
        }

        public ArrayList<TimeRange> ranges_for(string tag) {
            if (!tags.has_key(tag)) tags[tag] = new ArrayList<TimeRange>();
            return tags[tag];
        }

        public void add_range(string tag, TimeRange range) {
            ranges_for(tag).add(range);
        }

        public string to_json() {
            var builder = new Json.Builder();
            builder.begin_object();
            builder.set_member_name("version");
            builder.add_int_value(1);
            builder.set_member_name("tags");
            builder.begin_object();
            foreach (string tag in tags.keys) {
                builder.set_member_name(tag);
                builder.begin_array();
                foreach (TimeRange range in tags[tag]) {
                    builder.begin_array();
                    builder.add_string_value(TimeUtils.format(range.start));
                    builder.add_string_value(TimeUtils.format(range.end));
                    builder.end_array();
                }
                builder.end_array();
            }
            builder.end_object();
            builder.end_object();
            var generator = new Json.Generator();
            generator.set_root(builder.get_root());
            generator.pretty = true;
            return generator.to_data(null);
        }

        public static Sidecar from_json(string data) {
            var result = new Sidecar();
            try {
                var parser = new Json.Parser();
                parser.load_from_data(data, -1);
                var root = parser.get_root();
                if (root == null || root.get_node_type() != Json.NodeType.OBJECT) return result;
                var object = root.get_object();
                if (!object.has_member("tags")) return result;
                var tag_object = object.get_object_member("tags");
                foreach (string tag in tag_object.get_members()) {
                    var ranges = tag_object.get_array_member(tag);
                    for (uint index = 0; index < ranges.get_length(); index++) {
                        var pair = ranges.get_array_element(index).get_array();
                        if (pair.get_length() != 2) continue;
                        double start = TimeUtils.parse(pair.get_string_element(0));
                        double end = TimeUtils.parse(pair.get_string_element(1));
                        if (start >= 0 && end > start) result.add_range(tag, new TimeRange(start, end));
                    }
                }
            } catch (Error error) {
                warning("Invalid tag sidecar: %s", error.message);
            }
            return result;
        }
    }
}
