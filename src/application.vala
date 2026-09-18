namespace VideoTagger {
    public class Application : Gtk.Application {
        public Application() {
            Object(application_id: "io.github.video-tagger");
        }

        protected override void activate() {
            var window = new MainWindow(this);
            window.present();
        }
    }
}
