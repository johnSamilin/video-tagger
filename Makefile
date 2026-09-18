BUILDDIR ?= build

.PHONY: all deps-check deps-install setup build run test clean reconfigure package-deb install-build-deps

all: build

deps-check:

	@command -v meson >/dev/null || { echo "Missing meson"; exit 1; }
	@command -v valac >/dev/null || { echo "Missing valac"; exit 1; }
	@pkg-config --exists gtk+-3.0 gee-0.8 json-glib-1.0 gstreamer-1.0 gstreamer-video-1.0 || { echo "Missing GTK3, Gee, Json-GLib, or GStreamer development packages"; exit 1; }

deps-install:
	sudo apt install valac meson build-essential libgtk-3-dev libgee-0.8-dev libjson-glib-dev libgstreamer1.0-dev libgstreamer-plugins-base1.0-dev gstreamer1.0-plugins-good gstreamer1.0-plugins-bad gstreamer1.0-libav

setup:
	@if [ -d "$(BUILDDIR)" ]; then \
		meson setup --reconfigure $(BUILDDIR); \
	else \
		meson setup $(BUILDDIR); \
	fi

build: setup
	meson compile -C $(BUILDDIR)

run: build
	./$(BUILDDIR)/video-tagger

test: build
	meson test -C $(BUILDDIR) --print-errorlogs

reconfigure:
	meson setup --reconfigure $(BUILDDIR)
	meson compile -C $(BUILDDIR)

clean:
	rm -rf $(BUILDDIR)

install-build-deps:
	sudo apt install build-essential debhelper devscripts

package-deb:
	debuild -us -uc -b
