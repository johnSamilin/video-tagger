using Gee;

private void test_time_round_trip() {
    assert(VideoTagger.TimeUtils.parse("10:00:00.500") == 36000.5);
    assert(VideoTagger.TimeUtils.format(36000.5) == "10:00:00.500");
}

private void test_sidecar_round_trip() {
    var sidecar = new VideoTagger.Sidecar();
    sidecar.add_range("family", new VideoTagger.TimeRange(5, 80));
    var restored = VideoTagger.Sidecar.from_json(sidecar.to_json());
    assert(restored.ranges_for("family").size == 1);
    assert(restored.ranges_for("family")[0].end == 80);
}

private void test_query_precedence() {
    var registry = new VideoTagger.TagRegistry();
    registry.index_tags("a.mp4", { "family", "travel" });
    registry.index_tags("b.mp4", { "funny" });
    registry.index_tags("c.mp4", { "family", "funny" });
    var result = registry.evaluate_query("family and travel or funny");
    assert(result.contains("a.mp4"));
    assert(result.contains("b.mp4"));
    assert(result.contains("c.mp4"));
}

private void test_query_rejects_invalid_syntax() {
    var registry = new VideoTagger.TagRegistry();
    HashSet<string> result;
    string? error;
    assert(!registry.try_evaluate_query("family and", out result, out error));
    assert(error != null);
    assert(!registry.try_evaluate_query("(family or travel", out result, out error));
    assert(error != null);
    assert(!registry.try_evaluate_query("family travel", out result, out error));
    assert(error != null);
}

int main(string[] args) {
    Test.init(ref args);
    Test.add_func("/time/round-trip", test_time_round_trip);
    Test.add_func("/sidecar/round-trip", test_sidecar_round_trip);
    Test.add_func("/query/precedence", test_query_precedence);
    Test.add_func("/query/invalid-syntax", test_query_rejects_invalid_syntax);
    return Test.run();
}
