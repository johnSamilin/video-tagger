using Gee;

namespace VideoTagger {
    public class MainWindow : Gtk.ApplicationWindow {
        private Config config = new Config();
        private SidecarStore sidecars = new SidecarStore();
        private VideoScanner scanner = new VideoScanner();
        private TagRegistry registry = new TagRegistry();
        private PlayerEngine player;
        private ArrayList<VideoNode> videos = new ArrayList<VideoNode>();
        private VideoNode? library_root;
        private HashMap<string, Sidecar> video_sidecars = new HashMap<string, Sidecar>();
        private TreeSet<string> tags = new TreeSet<string>();
        private HashMap<string, double> pending_ranges = new HashMap<string, double>();
        private Gtk.ListBox video_list;
        private Gtk.ListBox tag_list;
        private Gtk.ListBox range_list;
        private Gtk.Label root_label;
        private Gtk.Label title_label;
        private Gtk.Label time_label;
        private Gtk.Label status_label;
        private Gtk.Label query_label;
        private Gtk.Scale seek_scale;
        private Gtk.DrawingArea timeline;
        private Gtk.Button play_button;
        private VideoNode? selected_video;
        private bool playing = false;
        private bool updating_seek = false;

        public MainWindow(Gtk.Application app) {
            Object(application: app, title: "Video Tagger", default_width: 1200, default_height: 760);
            player = new PlayerEngine();
            build_ui();
            player.error.connect((message) => status_label.label = "Playback error: " + message);
            sidecars.sidecar_error.connect((path, message) => status_label.label = "Could not save " + path + ": " + message);
            config.load();
            if (config.root_path != "" && FileUtils.test(config.root_path, FileTest.IS_DIR)) load_library(config.root_path);
            Timeout.add(250, update_playback);
            destroy.connect(() => player.dispose_player());
        }

        private void build_ui() {
            var header = new Gtk.HeaderBar();
            header.show_close_button = true;
            header.title = "Video Tagger";
            var open = new Gtk.Button.with_label("Open folder");
            open.clicked.connect(choose_root_folder);
            header.pack_start(open);
            root_label = new Gtk.Label("No library selected");
            header.pack_end(root_label);
            set_titlebar(header);

            var outer = new Gtk.Paned(Gtk.Orientation.HORIZONTAL);
            outer.position = 250;
            outer.pack1(build_tags(), false, false);
            var content = new Gtk.Paned(Gtk.Orientation.HORIZONTAL);
            content.position = 760;
            content.pack1(build_player(), true, false);
            content.pack2(build_videos(), false, false);
            outer.pack2(content, true, false);
            var layout = new Gtk.Box(Gtk.Orientation.VERTICAL, 0);
            layout.pack_start(outer, true, true, 0);
            status_label = new Gtk.Label("Open a folder containing videos to begin.");
            status_label.xalign = 0;
            status_label.margin = 8;
            layout.pack_end(status_label, false, false, 0);
            add(layout);
        }

        private Gtk.Widget build_tags() {
            var box = new Gtk.Box(Gtk.Orientation.VERTICAL, 8);
            box.margin = 10;
            var heading = new Gtk.Label("TAGS");
            heading.xalign = 0;
            box.pack_start(heading, false, false, 0);
            var add = new Gtk.Button.with_label("New tag");
            add.clicked.connect(add_tag_dialog);
            box.pack_start(add, false, false, 0);
            tag_list = new Gtk.ListBox();
            tag_list.selection_mode = Gtk.SelectionMode.NONE;
            var scroll = new Gtk.ScrolledWindow(null, null);
            scroll.add(tag_list);
            box.pack_start(scroll, true, true, 0);
            return box;
        }

        private Gtk.Widget build_player() {
            var box = new Gtk.Box(Gtk.Orientation.VERTICAL, 8);
            box.margin = 12;
            title_label = new Gtk.Label("Select a video");
            title_label.xalign = 0;
            box.pack_start(title_label, false, false, 0);
            var preview_frame = new Gtk.Frame(null);
            preview_frame.add(player.get_preview());
            box.pack_start(preview_frame, true, true, 0);
            var controls = new Gtk.Box(Gtk.Orientation.HORIZONTAL, 8);
            var back = new Gtk.Button.with_label("-5s");
            back.clicked.connect(() => seek(player.position() - 5));
            play_button = new Gtk.Button.with_label("Play");
            play_button.clicked.connect(toggle_playback);
            var forward = new Gtk.Button.with_label("+5s");
            forward.clicked.connect(() => seek(player.position() + 5));
            time_label = new Gtk.Label("00:00:00 / 00:00:00");
            seek_scale = new Gtk.Scale.with_range(Gtk.Orientation.HORIZONTAL, 0, 1, 0.1);
            seek_scale.hexpand = true;
            seek_scale.value_changed.connect(() => { if (!updating_seek) seek(seek_scale.get_value()); });
            controls.pack_start(back, false, false, 0);
            controls.pack_start(play_button, false, false, 0);
            controls.pack_start(forward, false, false, 0);
            controls.pack_start(time_label, false, false, 0);
            controls.pack_start(seek_scale, true, true, 0);
            box.pack_start(controls, false, false, 0);
            var query = new Gtk.SearchEntry();
            query.placeholder_text = "Filter tags: family and travel";
            query.search_changed.connect(() => refresh_videos(query.text));
            box.pack_start(query, false, false, 0);
            query_label = new Gtk.Label("");
            query_label.xalign = 0;
            box.pack_start(query_label, false, false, 0);
            timeline = new Gtk.DrawingArea();
            timeline.height_request = 72;
            timeline.add_events(Gdk.EventMask.BUTTON_PRESS_MASK);
            timeline.draw.connect(draw_timeline);
            timeline.button_press_event.connect((event) => {
                double duration = player.duration();
                if (duration > 0 && timeline.get_allocated_width() > 0)
                    seek(duration * event.x / timeline.get_allocated_width());
                return true;
            });
            box.pack_start(timeline, false, true, 0);
            var ranges_heading = new Gtk.Label("RANGES FOR SELECTED VIDEO");
            ranges_heading.xalign = 0;
            box.pack_start(ranges_heading, false, false, 0);
            range_list = new Gtk.ListBox();
            var range_scroll = new Gtk.ScrolledWindow(null, null);
            range_scroll.min_content_height = 140;
            range_scroll.add(range_list);
            box.pack_start(range_scroll, false, true, 0);
            return box;
        }

        private Gtk.Widget build_videos() {
            var box = new Gtk.Box(Gtk.Orientation.VERTICAL, 8);
            box.margin = 10;
            var heading = new Gtk.Label("VIDEOS");
            heading.xalign = 0;
            box.pack_start(heading, false, false, 0);
            video_list = new Gtk.ListBox();
            var scroll = new Gtk.ScrolledWindow(null, null);
            scroll.add(video_list);
            box.pack_start(scroll, true, true, 0);
            return box;
        }

        private void choose_root_folder() {
            var chooser = new Gtk.FileChooserNative("Open video root", this, Gtk.FileChooserAction.SELECT_FOLDER, "Open", "Cancel");
            chooser.response.connect((response) => {
                string? root_path = chooser.get_filename();
                if (response == Gtk.ResponseType.ACCEPT && root_path != null) load_library(root_path);
            });
            chooser.show();
        }

        private void load_library(string root_path) {
            videos.clear();
            video_sidecars.clear();
            tags.clear();
            registry = new TagRegistry();
            status_label.label = "Scanning " + root_path + "...";
            var root = scanner.scan(root_path);
            library_root = root;
            if (root != null) collect_videos(root);
            config.save_root_path(root_path);
            root_label.label = root_path;
            refresh_tags();
            refresh_videos("");
            status_label.label = "%d videos found".printf(videos.size);
        }

        private void collect_videos(VideoNode node) {
            if (!node.is_directory) {
                videos.add(node);
                var sidecar = sidecars.load(node.path);
                video_sidecars[node.path] = sidecar;
                var names = new ArrayList<string>();
                foreach (string tag in sidecar.tags.keys) { tags.add(tag); names.add(tag); }
                registry.index_tags(node.path, names.to_array());
                return;
            }
            foreach (VideoNode child in node.children) collect_videos(child);
        }

        private void refresh_videos(string expression) {
            foreach (Gtk.Widget child in video_list.get_children()) child.destroy();
            HashSet<string>? matches = null;
            if (expression.strip() != "") {
                HashSet<string> evaluated;
                string? error;
                if (!registry.try_evaluate_query(expression, out evaluated, out error)) {
                    query_label.label = "Invalid filter: " + error;
                    add_video_message("Fix the tag filter to show videos.");
                    video_list.show_all();
                    return;
                }
                matches = evaluated;
                query_label.label = matches.size == 0 ? "No videos match this filter." : "";
            } else query_label.label = "";
            if (library_root != null) add_video_rows(library_root, matches, 0);
            if (video_list.get_children().length() == 0) {
                add_video_message(matches == null ? "No videos found in this folder." : "No videos match this filter.");
            }
            video_list.show_all();
        }

        private void add_video_message(string message) {
            var row = new Gtk.ListBoxRow();
            var label = new Gtk.Label(message);
            label.margin = 8;
            label.xalign = 0;
            row.add(label);
            video_list.add(row);
        }

        private bool add_video_rows(VideoNode node, HashSet<string>? matches, int depth) {
            if (!node.is_directory) {
                if (matches != null && !matches.contains(node.path)) return false;
                var row = new Gtk.ListBoxRow();
                var button = new Gtk.Button.with_label("%s%s".printf(indent(depth), node.display_name));
                button.relief = Gtk.ReliefStyle.NONE;
                button.halign = Gtk.Align.FILL;
                button.clicked.connect(() => select_video(node));
                row.add(button);
                video_list.add(row);
                return true;
            }
            var row = new Gtk.ListBoxRow();
            var label = new Gtk.Label("%s%s".printf(indent(depth), node.display_name));
            label.xalign = 0;
            label.margin = 6;
            row.add(label);
            video_list.add(row);
            bool has_visible_child = false;
            foreach (VideoNode child in node.children) if (add_video_rows(child, matches, depth + 1)) has_visible_child = true;
            if (!has_visible_child) { row.destroy(); return false; }
            return true;
        }

        private void refresh_tags() {
            foreach (Gtk.Widget child in tag_list.get_children()) child.destroy();
            var displayed = new TreeSet<string>();
            foreach (string tag in tags) {
                displayed.add(tag);
                string[] parts = tag.split("/");
                string parent = "";
                for (int index = 0; index + 1 < parts.length; index++) {
                    parent = parent == "" ? parts[index] : parent + "/" + parts[index];
                    displayed.add(parent);
                }
            }
            foreach (string tag in displayed) {
                var row = new Gtk.ListBoxRow();
                var box = new Gtk.Box(Gtk.Orientation.HORIZONTAL, 4);
                bool is_tag = tags.contains(tag);
                string[] parts = tag.split("/");
                var label = "%s%s (%d)%s".printf(indent(parts.length - 1), parts[parts.length - 1], tag_video_count(tag), pending_ranges.has_key(tag) ? " recording" : "");
                var button = new Gtk.Button.with_label(label);
                button.relief = Gtk.ReliefStyle.NONE;
                button.hexpand = true;
                button.clicked.connect(() => { if (is_tag) toggle_range(tag); });
                box.pack_start(button, true, true, 0);
                if (is_tag) {
                    var rename = new Gtk.Button.with_label("Rename");
                    rename.clicked.connect(() => rename_tag_dialog(tag));
                    var remove = new Gtk.Button.with_label("Delete");
                    remove.clicked.connect(() => delete_tag_dialog(tag));
                    box.pack_end(remove, false, false, 0);
                    box.pack_end(rename, false, false, 0);
                }
                row.add(box);
                tag_list.add(row);
            }
            tag_list.show_all();
        }

        private string indent(int depth) {
            string result = "";
            for (int index = 0; index < depth; index++) result += "  ";
            return result;
        }

        private int tag_video_count(string tag) {
            int count = 0;
            foreach (VideoNode video in videos) {
                foreach (string assigned in video_sidecars[video.path].tags.keys) {
                    if (assigned == tag || assigned.has_prefix(tag + "/")) { count++; break; }
                }
            }
            return count;
        }

        private void select_video(VideoNode video) {
            pending_ranges.clear();
            selected_video = video;
            playing = false;
            play_button.label = "Play";
            title_label.label = video.display_name;
            player.open(video.path);
            status_label.label = video.path;
            refresh_tags();
            refresh_ranges();
            timeline.queue_draw();
        }

        private void toggle_range(string tag) {
            if (selected_video == null) { status_label.label = "Select a video before marking a range."; return; }
            if (pending_ranges.has_key(tag)) {
                var start = pending_ranges[tag];
                pending_ranges.unset(tag);
                var end = player.position();
                if (end > start) {
                    var sidecar = video_sidecars[selected_video.path];
                    sidecar.add_range(tag, new TimeRange(start, end));
                    sidecars.save(selected_video.path, sidecar);
                    registry.index_tags(selected_video.path, { tag });
                    tags.add(tag);
                    status_label.label = "Saved range for " + tag;
                    refresh_ranges();
                    timeline.queue_draw();
                } else status_label.label = "Range end must be after its start.";
            } else {
                pending_ranges[tag] = player.position();
                status_label.label = "Recording " + tag + ". Click it again to save.";
            }
            refresh_tags();
        }

        private void refresh_ranges() {
            foreach (Gtk.Widget child in range_list.get_children()) child.destroy();
            if (selected_video == null) return;
            var sidecar = video_sidecars[selected_video.path];
            foreach (string tag in sidecar.tags.keys) foreach (TimeRange range in sidecar.tags[tag]) {
                var row = new Gtk.ListBoxRow();
                var box = new Gtk.Box(Gtk.Orientation.HORIZONTAL, 8);
                var label = new Gtk.Label("%s  %s - %s".printf(tag, TimeUtils.format(range.start), TimeUtils.format(range.end)));
                label.xalign = 0;
                var edit = new Gtk.Button.with_label("Edit");
                edit.clicked.connect(() => edit_range(tag, range));
                var remove = new Gtk.Button.with_label("Delete");
                remove.clicked.connect(() => {
                    sidecar.tags[tag].remove(range);
                    sidecars.save(selected_video.path, sidecar);
                    rebuild_tag_registry();
                    refresh_ranges();
                    timeline.queue_draw();
                });
                box.pack_start(label, true, true, 0);
                box.pack_end(edit, false, false, 0);
                box.pack_end(remove, false, false, 0);
                row.add(box);
                range_list.add(row);
            }
            range_list.show_all();
        }

        private void edit_range(string tag, TimeRange range) {
            if (selected_video == null) return;
            VideoNode video = selected_video;
            var dialog = new RangeEditDialog(this, range, player.position());
            if (dialog.run() == Gtk.ResponseType.ACCEPT) {
                range.start = dialog.start;
                range.end = dialog.end;
                sidecars.save(video.path, video_sidecars[video.path]);
                status_label.label = "Saved changes to " + tag;
                refresh_ranges();
                timeline.queue_draw();
            }
            dialog.destroy();
        }

        private void add_tag_dialog() {
            var dialog = new Gtk.Dialog.with_buttons("New tag", this, Gtk.DialogFlags.MODAL, "Cancel", Gtk.ResponseType.CANCEL, "Add", Gtk.ResponseType.ACCEPT);
            var entry = new Gtk.Entry();
            entry.margin = 12;
            dialog.get_content_area().add(entry);
            dialog.show_all();
            if (dialog.run() == Gtk.ResponseType.ACCEPT && entry.text.strip() != "") { tags.add(entry.text.strip()); refresh_tags(); }
            dialog.destroy();
        }

        private void rename_tag_dialog(string tag) {
            var dialog = new Gtk.Dialog.with_buttons("Rename tag", this, Gtk.DialogFlags.MODAL, "Cancel", Gtk.ResponseType.CANCEL, "Rename", Gtk.ResponseType.ACCEPT);
            var entry = new Gtk.Entry();
            entry.text = tag;
            entry.margin = 12;
            dialog.get_content_area().add(entry);
            dialog.show_all();
            int response = dialog.run();
            string renamed = entry.text.strip();
            if (response == Gtk.ResponseType.ACCEPT && renamed != "" && renamed != tag) {
                if (tags.contains(renamed)) status_label.label = "A tag named " + renamed + " already exists.";
                else {
                    bool changed_sidecar = false;
                    foreach (VideoNode video in videos) {
                        var sidecar = video_sidecars[video.path];
                        if (!sidecar.tags.has_key(tag)) continue;
                        sidecar.tags[renamed] = sidecar.tags[tag];
                        sidecar.tags.unset(tag);
                        sidecars.save(video.path, sidecar);
                        changed_sidecar = true;
                    }
                    if (pending_ranges.has_key(tag)) {
                        pending_ranges[renamed] = pending_ranges[tag];
                        pending_ranges.unset(tag);
                    }
                    if (changed_sidecar) rebuild_tag_registry();
                    else { tags.remove(tag); tags.add(renamed); refresh_tags(); }
                    refresh_ranges();
                    timeline.queue_draw();
                    status_label.label = "Renamed " + tag + " to " + renamed;
                }
            }
            dialog.destroy();
        }

        private void delete_tag_dialog(string tag) {
            var dialog = new Gtk.MessageDialog(this, Gtk.DialogFlags.MODAL, Gtk.MessageType.WARNING, Gtk.ButtonsType.NONE,
                "Delete tag '%s' from all videos?".printf(tag));
            dialog.add_button("Cancel", Gtk.ResponseType.CANCEL);
            dialog.add_button("Delete", Gtk.ResponseType.ACCEPT);
            if (dialog.run() == Gtk.ResponseType.ACCEPT) {
                foreach (VideoNode video in videos) {
                    var sidecar = video_sidecars[video.path];
                    if (!sidecar.tags.has_key(tag)) continue;
                    sidecar.tags.unset(tag);
                    sidecars.save(video.path, sidecar);
                }
                pending_ranges.unset(tag);
                rebuild_tag_registry();
                refresh_ranges();
                timeline.queue_draw();
                status_label.label = "Deleted " + tag;
            }
            dialog.destroy();
        }

        private void rebuild_tag_registry() {
            registry = new TagRegistry();
            tags.clear();
            foreach (VideoNode video in videos) {
                var names = new ArrayList<string>();
                foreach (string tag in video_sidecars[video.path].tags.keys) { names.add(tag); tags.add(tag); }
                registry.index_tags(video.path, names.to_array());
            }
            refresh_tags();
        }

        private void toggle_playback() {
            if (selected_video == null || !player.available) return;
            playing = !playing;
            if (playing) player.play(); else player.pause();
            play_button.label = playing ? "Pause" : "Play";
        }

        private void seek(double value) {
            double duration = player.duration();
            player.seek(value < 0 ? 0 : (duration > 0 && value > duration ? duration : value));
        }

        private bool update_playback() {
            var duration = player.duration();
            var position = player.position();
            updating_seek = true;
            seek_scale.set_range(0, duration > 0 ? duration : 1);
            seek_scale.set_value(position);
            updating_seek = false;
            time_label.label = "%s / %s".printf(TimeUtils.format(position), TimeUtils.format(duration));
            timeline.queue_draw();
            return true;
        }

        private bool draw_timeline(Cairo.Context context) {
            int width = timeline.get_allocated_width();
            int height = timeline.get_allocated_height();
            context.set_source_rgb(0.16, 0.16, 0.16);
            context.rectangle(0, 0, width, height);
            context.fill();
            double duration = player.duration();
            if (selected_video == null || duration <= 0) return false;
            var sidecar = video_sidecars[selected_video.path];
            int lane = 0;
            foreach (string tag in sidecar.tags.keys) {
                foreach (TimeRange range in sidecar.tags[tag]) {
                    double start = width * range.start / duration;
                    double end = width * range.end / duration;
                    double red = 0.25 + (lane % 3) * 0.2;
                    context.set_source_rgb(red, 0.55, 0.85 - (lane % 2) * 0.2);
                    context.rectangle(start, 6 + (lane % 4) * 15, end - start, 11);
                    context.fill();
                }
                lane++;
            }
            context.set_source_rgb(0.95, 0.95, 0.95);
            double playhead = width * player.position() / duration;
            context.rectangle(playhead, 0, 2, height);
            context.fill();
            return false;
        }
    }
}
