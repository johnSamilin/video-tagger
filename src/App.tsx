import { useEffect, useState } from 'react';
import { observer } from 'mobx-react-lite';
import { videoTree } from './stores';
import { HeaderBar } from './components/HeaderBar';
import { QueryPanel } from './components/QueryPanel';
import { TagListPanel } from './components/TagListPanel';
import { VideoTreePanel } from './components/VideoTreePanel';
import { VideoPlayerPanel } from './components/VideoPlayerPanel';
import { PlaybackControls } from './components/PlaybackControls';
import { TimelineRangesPanel } from './components/TimelineRangesPanel';
import { StatusBar } from './components/StatusBar';

const App = observer(() => {
  useEffect(() => {
    videoTree.init();
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
          <VideoPlayerPanel />
          <PlaybackControls />
          <TimelineRangesPanel />
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
