import { useCallback } from 'react';
import { observer } from 'mobx-react-lite';
import { player } from '../stores';
import { isAudioFile } from '../../shared/media';

export const VideoPlayerPanel = observer(() => {
  const attachRef = useCallback((el: HTMLMediaElement | null) => player.attach(el), []);
  const audio = !!player.currentVideoPath && isAudioFile(player.currentVideoPath);
  const medium = audio ? 'audio' : 'video';

  if (!player.mediaUrl) {
    if (player.preparing) {
      const pct = Math.round(player.transcodeProgress * 100);
      return (
        <div className="player-placeholder">
          <div className="preparing">
            <div>Preparing {medium}… {pct}%</div>
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
            <div>Could not play this {medium}</div>
            <div className="muted">{player.error}</div>
          </div>
        </div>
      );
    }
    return (
      <div className="player-placeholder">
        {player.currentVideoPath ? `Loading ${medium}…` : 'Select a video or audio file from the tree on the right'}
      </div>
    );
  }

  return (
    <div className="player">
      {audio ? <div className="audio-title">♫ {player.currentVideoPath?.split(/[\\/]/).pop()}</div> : null}
      {audio ? <audio
        ref={attachRef}
        src={player.mediaUrl}
        onLoadedMetadata={(e) => player.setDuration(e.currentTarget.duration)}
        onTimeUpdate={(e) => player.setCurrentTime(e.currentTarget.currentTime)}
        onPlay={() => player.setPlaying(true)}
        onPause={() => player.setPlaying(false)}
        onEnded={() => player.setPlaying(false)}
        onError={() => player.setError('Unsupported format or cannot play this file')}
      /> : <video
        ref={attachRef}
        src={player.mediaUrl}
        onLoadedMetadata={(e) => player.setDuration(e.currentTarget.duration)}
        onTimeUpdate={(e) => player.setCurrentTime(e.currentTarget.currentTime)}
        onPlay={() => player.setPlaying(true)}
        onPause={() => player.setPlaying(false)}
        onEnded={() => player.setPlaying(false)}
        onError={() => player.setError('Unsupported format or cannot play this file')}
        onClick={() => player.togglePlay()}
      />}
      {player.error && <div className="player-error">{player.error}</div>}
    </div>
  );
});
