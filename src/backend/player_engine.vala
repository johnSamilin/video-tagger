namespace VideoTagger {
    public class PlayerEngine : Object {
        private Gst.Element? playbin;
        private Gtk.Widget preview;

        public bool available { get; private set; default = false; }
        public signal void error(string message);

        public PlayerEngine() {
            playbin = Gst.ElementFactory.make("playbin", "video-tagger-player");
            if (playbin == null) {
                preview = new Gtk.Label("GStreamer playbin is unavailable");
                return;
            }

            var sink = Gst.ElementFactory.make("gtksink", "video-tagger-sink");
            if (sink != null) {
                Gtk.Widget widget;
                sink.get("widget", out widget);
                preview = widget;
                playbin.set("video-sink", sink);
            } else {
                preview = new Gtk.Label("Video preview is unavailable\nInstall the GStreamer GTK sink to embed playback.");
                preview.justify = Gtk.Justification.CENTER;
                playbin.set("video-sink", Gst.ElementFactory.make("fakesink", "video-tagger-fallback-sink"));
            }
            preview.hexpand = true;
            preview.vexpand = true;
            available = true;

            var bus = playbin.get_bus();
            bus.add_watch(GLib.Priority.DEFAULT, on_bus_message);
        }

        public Gtk.Widget get_preview() {
            return preview;
        }

        public void open(string path) {
            if (playbin == null) return;
            playbin.set_state(Gst.State.NULL);
            playbin.set("uri", File.new_for_path(path).get_uri());
            playbin.set_state(Gst.State.PAUSED);
        }

        public void play() {
            if (playbin != null) playbin.set_state(Gst.State.PLAYING);
        }

        public void pause() {
            if (playbin != null) playbin.set_state(Gst.State.PAUSED);
        }

        public void seek(double seconds) {
            if (playbin != null) playbin.seek_simple(Gst.Format.TIME,
                Gst.SeekFlags.FLUSH | Gst.SeekFlags.KEY_UNIT, (int64) (seconds * Gst.SECOND));
        }

        public double position() {
            int64 value;
            return playbin != null && playbin.query_position(Gst.Format.TIME, out value) ? value / (double) Gst.SECOND : 0;
        }

        public double duration() {
            int64 value;
            return playbin != null && playbin.query_duration(Gst.Format.TIME, out value) ? value / (double) Gst.SECOND : 0;
        }

        public void dispose_player() {
            if (playbin != null) playbin.set_state(Gst.State.NULL);
        }

        private bool on_bus_message(Gst.Bus bus, Gst.Message message) {
            if (message.type == Gst.MessageType.ERROR) {
                Error gst_error;
                string debug;
                message.parse_error(out gst_error, out debug);
                error(gst_error.message);
            }
            return true;
        }
    }
}
