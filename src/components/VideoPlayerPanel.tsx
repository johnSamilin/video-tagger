import { useCallback } from 'react';
import { observer } from 'mobx-react-lite';
import { player } from '../stores';

export const VideoPlayerPanel = observer(() => {
  const attachRef = useCallback((el: HTMLVideoElement | null) => player.attach(el), []);

  if (!player.mediaUrl) {
    if (player.preparing) {
      const pct = Math.round(player.transcodeProgress * 100);
      return (
        <div className="player-placeholder">
          <div className="preparing">
            <div>Preparing video… {pct}%</div>
            <div className="muted">
              Unsupported container — remuxing/transcoding with FFmpeg
            </div>
          </div>
        </div>
      );
    }
    if (player.error) {
      return (
        <div className="player-placeholder">
          <div className="preparing">
            <div>Could not play this video</div>
            <div className="muted">{player.error}</div>
          </div>
        </div>
      );
    }
    return (
      <div className="player-placeholder">
        {player.currentVideoPath ? 'Loading video…' : 'Select a video from the tree on the right'}
      </div>
    );
  }

  return (
    <div className="player">
      <video
        ref={attachRef}
        src={player.mediaUrl}
        onLoadedMetadata={(e) => player.setDuration(e.currentTarget.duration)}
        onTimeUpdate={(e) => player.setCurrentTime(e.currentTarget.currentTime)}
        onPlay={() => player.setPlaying(true)}
        onPause={() => player.setPlaying(false)}
        onEnded={() => player.setPlaying(false)}
        onError={() => player.setError('Unsupported format or cannot play this file')}
        onClick={() => player.togglePlay()}
      />
      {player.error && <div className="player-error">{player.error}</div>}
    </div>
  );
});
