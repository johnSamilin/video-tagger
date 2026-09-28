import { observer } from 'mobx-react-lite';
import { player } from '../stores';
import { formatTimeShort } from '../lib/time';

export const PlaybackControls = observer(() => (
  <div className="controls">
    <button className="btn" onClick={() => player.seekBy(-5)} title="Back 5s">
      ⏮
    </button>
    <button className="btn" data-testid="play-btn" onClick={() => player.togglePlay()}>
      {player.isPlaying ? '⏸' : '⏵'}
    </button>
    <button className="btn" onClick={() => player.seekBy(5)} title="Forward 5s">
      ⏭
    </button>
    <span className="time">
      {formatTimeShort(player.currentTime)} / {formatTimeShort(player.duration)}
    </span>
    <input
      className="seek"
      type="range"
      min={0}
      max={player.duration || 0}
      step={0.1}
      value={player.currentTime}
      onChange={(e) => player.seek(Number(e.target.value))}
    />
    <span className="volume-label">🔊</span>
    <input
      className="volume"
      type="range"
      min={0}
      max={1}
      step={0.05}
      value={player.volume}
      onChange={(e) => player.setVolume(Number(e.target.value))}
    />
  </div>
));
