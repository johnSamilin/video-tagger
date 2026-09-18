namespace VideoTagger {
    public class TagInfo : Object {
        public string name { get; construct; }
        public int count { get; set; }

        public TagInfo(string name, int count = 0) {
            Object(name: name, count: count);
        }
    }
}
