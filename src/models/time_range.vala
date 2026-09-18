namespace VideoTagger {
    public class TimeRange : Object {
        public double start { get; set; }
        public double end { get; set; }

        public TimeRange(double start, double end) {
            this.start = start;
            this.end = end;
        }
    }
}
