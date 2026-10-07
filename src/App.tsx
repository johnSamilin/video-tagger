import { useEffect, useState } from 'react';
import { observer } from 'mobx-react-lite';
import { player, tags, videoTree } from './stores';
import { getNativeAPI } from './lib/nativeBridge';
import { HeaderBar } from './components/HeaderBar';
import { QueryPanel } from './components/QueryPanel';
import { TagListPanel } from './components/TagListPanel';
import { VideoTreePanel } from './components/VideoTreePanel';
import { VideoPlayerPanel } from './components/VideoPlayerPanel';
import { PlaybackControls } from './components/PlaybackControls';
import { TimelineRangesPanel } from './components/TimelineRangesPanel';
import { BulkTagPanel } from './components/BulkTagPanel';
import { StatusBar } from './components/StatusBar';

const App = observer(() => {
  useEffect(() => {
    videoTree.init();
  }, []);

  useEffect(() => {
    const onKeyDown = (e: KeyboardEvent) => {
      if (e.code !== 'Space') return;
      const el = document.activeElement as HTMLElement | null;
      if (
        el &&
        (el.tagName === 'INPUT' ||
          el.tagName === 'TEXTAREA' ||
          el.tagName === 'SELECT' ||
          el.tagName === 'BUTTON' ||
          el.isContentEditable)
      ) {
        return;
      }
      e.preventDefault();
      player.togglePlay();
    };
    window.addEventListener('keydown', onKeyDown);
    return () => window.removeEventListener('keydown', onKeyDown);
  }, []);

  useEffect(() => {
    const onKeyDown = (e: KeyboardEvent) => {
      if (e.code !== 'Delete' && e.code !== 'Backspace') return;
      const el = document.activeElement as HTMLElement | null;
      if (
        el &&
        (el.tagName === 'INPUT' ||
          el.tagName === 'TEXTAREA' ||
          el.tagName === 'SELECT' ||
          el.isContentEditable)
      ) {
        return;
      }
      if (videoTree.selectedPaths.length === 0) return;
      e.preventDefault();
      void videoTree.trashSelected();
    };
    window.addEventListener('keydown', onKeyDown);
    return () => window.removeEventListener('keydown', onKeyDown);
  }, []);

  useEffect(() => {
    const api = getNativeAPI();
    if (!api) return;
    const offOpenFolder = api.onOpenFolder(() => {
      const path = player.currentVideoPath;
      if (path) api.openFolder(path);
    });
    const offFindDuplicates = api.onFindDuplicates(() => {
      const root = videoTree.rootPath;
      if (root) void tags.findDuplicates(root);
    });
    return () => {
      offOpenFolder();
      offFindDuplicates();
    };
  }, []);

  const [chromeVisible, setChromeVisible] = useState(true);

  return (
    <div className={`app${chromeVisible ? '' : ' chrome-hidden'}`}>
      <HeaderBar />
      <QueryPanel />
      <div className="main">
        <aside className="sidebar left">
          <TagListPanel />
        </aside>
        <section className="center">
          {videoTree.isBulk ? (
            <BulkTagPanel />
          ) : (
            <>
              <VideoPlayerPanel />
              <PlaybackControls />
              <TimelineRangesPanel />
            </>
          )}
        </section>
        <aside className="sidebar right">
          <VideoTreePanel />
        </aside>
      </div>
      <StatusBar />
      <button
        className="floating-info"
        data-testid="floating-info"
        aria-label="Toggle top and bottom panels"
        title="Toggle top and bottom panels"
        onClick={() => setChromeVisible((v) => !v)}
      >
        ⓘ
      </button>
    </div>
  );
});

export default App;
