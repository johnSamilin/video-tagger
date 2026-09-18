namespace VideoTagger {
    public class TimeUtils : Object {
        public static double parse(string value) {
            string[] parts = value.strip().split(":");
            if (parts.length != 3) return -1;
            double seconds = double.parse(parts[2]);
            int minutes = int.parse(parts[1]);
            int hours = int.parse(parts[0]);
            if (hours < 0 || minutes < 0 || minutes >= 60 || seconds < 0 || seconds >= 60) return -1;
            return hours * 3600 + minutes * 60 + seconds;
        }

        public static string format(double seconds) {
            int milliseconds = (int) ((seconds - (int) seconds) * 1000);
            int value = (int) seconds;
            string result = "%02d:%02d:%02d".printf(value / 3600, (value / 60) % 60, value % 60);
            return milliseconds > 0 ? result + ".%03d".printf(milliseconds) : result;
        }
    }
}
