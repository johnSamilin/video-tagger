import { makeAutoObservable } from 'mobx';
import { getNativeAPI } from '../lib/nativeBridge';

export class PlayerStore {
  currentVideoPath: string | null = null;
  mediaUrl: string | null = null;
  videoElement: HTMLVideoElement | null = null;
  duration = 0;
  currentTime = 0;
  isPlaying = false;
  error: string | null = null;
  preparing = false;
  transcodeProgress = 0;

  private loadToken = 0;

  constructor() {
    makeAutoObservable(this);
  }

  attach(element: HTMLVideoElement | null) {
    this.videoElement = element;
  }

  async openVideo(path: string) {
    const token = ++this.loadToken;
    this.currentVideoPath = path;
    this.mediaUrl = null;
    this.error = null;
    this.duration = 0;
    this.currentTime = 0;
    this.isPlaying = false;
    this.preparing = false;
    this.transcodeProgress = 0;

    const api = getNativeAPI();
    if (!api) {
      this.error = 'No native API available';
      return;
    }
    await this.prepareLoop(path, token);
  }

  private async prepareLoop(path: string, token: number) {
    const api = getNativeAPI();
    if (!api) return;

    let res;
    try {
      res = await api.prepareMedia(path);
    } catch {
      if (token === this.loadToken) this.setError('Failed to prepare media');
      return;
    }

    if (token !== this.loadToken) return;

    if (res.status === 'ready' && res.url) {
      this.mediaUrl = res.url;
      this.preparing = false;
      this.transcodeProgress = 1;
    } else if (res.status === 'transcoding') {
      this.preparing = true;
      this.transcodeProgress = res.progress ?? 0;
      setTimeout(() => this.prepareLoop(path, token), 800);
    } else {
      this.preparing = false;
      this.error = res.error ?? 'Failed to prepare video';
    }
  }

  play() {
    this.videoElement?.play().catch(() => undefined);
  }

  pause() {
    this.videoElement?.pause();
  }

  togglePlay() {
    if (this.isPlaying) this.pause();
    else this.play();
  }

  stop() {
    this.loadToken++;
    this.videoElement?.pause();
    this.currentVideoPath = null;
    this.mediaUrl = null;
    this.duration = 0;
    this.currentTime = 0;
    this.isPlaying = false;
    this.error = null;
    this.preparing = false;
    this.transcodeProgress = 0;
  }

  seek(time: number) {
    const el = this.videoElement;
    if (el) el.currentTime = time;
    this.currentTime = time;
  }

  seekBy(delta: number) {
    this.seek(this.currentTime + delta);
  }

  setCurrentTime(time: number) {
    this.currentTime = time;
  }

  setDuration(duration: number) {
    this.duration = duration;
  }

  setPlaying(playing: boolean) {
    this.isPlaying = playing;
  }

  setError(error: string | null) {
    this.error = error;
  }
}
