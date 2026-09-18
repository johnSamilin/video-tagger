namespace VideoTagger {
    public class RangeEditDialog : Gtk.Dialog {
        private Gtk.Entry start_entry;
        private Gtk.Entry end_entry;
        private double current_position;

        public double start { get; private set; }
        public double end { get; private set; }

        public RangeEditDialog(Gtk.Window parent, TimeRange range, double current_position) {
            Object(title: "Edit range", transient_for: parent, modal: true);
            this.current_position = current_position;
            start = range.start;
            end = range.end;
            add_button("Cancel", Gtk.ResponseType.CANCEL);
            add_button("Save", Gtk.ResponseType.ACCEPT);

            var grid = new Gtk.Grid();
            grid.margin = 12;
            grid.row_spacing = 8;
            grid.column_spacing = 8;
            start_entry = new Gtk.Entry();
            start_entry.text = TimeUtils.format(start);
            end_entry = new Gtk.Entry();
            end_entry.text = TimeUtils.format(end);
            var use_start = new Gtk.Button.with_label("Use current");
            var use_end = new Gtk.Button.with_label("Use current");
            use_start.clicked.connect(() => start_entry.text = TimeUtils.format(this.current_position));
            use_end.clicked.connect(() => end_entry.text = TimeUtils.format(this.current_position));
            grid.attach(new Gtk.Label("Start"), 0, 0, 1, 1);
            grid.attach(start_entry, 1, 0, 1, 1);
            grid.attach(use_start, 2, 0, 1, 1);
            grid.attach(new Gtk.Label("End"), 0, 1, 1, 1);
            grid.attach(end_entry, 1, 1, 1, 1);
            grid.attach(use_end, 2, 1, 1, 1);
            get_content_area().add(grid);
            response.connect(validate_response);
            show_all();
        }

        private void validate_response(int response_id) {
            if (response_id != Gtk.ResponseType.ACCEPT) return;
            double parsed_start = TimeUtils.parse(start_entry.text);
            double parsed_end = TimeUtils.parse(end_entry.text);
            if (parsed_start < 0 || parsed_end <= parsed_start) {
                var message = new Gtk.MessageDialog(this, Gtk.DialogFlags.MODAL,
                    Gtk.MessageType.WARNING, Gtk.ButtonsType.OK,
                    "Enter valid times where end is after start.");
                message.run();
                message.destroy();
                stop_emission_by_name("response");
                return;
            }
            start = parsed_start;
            end = parsed_end;
        }
    }
}
