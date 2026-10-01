import { app } from 'electron';
import * as fs from 'fs';
import * as path from 'path';
import * as crypto from 'crypto';
import { spawn, ChildProcess } from 'child_process';
import ffmpegBin from 'ffmpeg-static';
import ffprobe from 'ffprobe-static';
import { transcodeDir, onCacheChanged } from './cache';

// Resolve ffmpeg/ffprobe binaries.
//   - dev: use the npm-installed path (node_modules).
//   - packaged: use the binaries copied to resources/ by forge.config.js
//     (extraResource). Fall back to the asar-unpacked path for older builds.
function resolveBinary(name: string, devPath: string): string {
  if (!app.isPackaged) return devPath;
  const bundled = path.join(process.resourcesPath, name);
  if (fs.existsSync(bundled)) return bundled;
  return devPath.replace('app.asar', 'app.asar.unpacked');
}

const ffmpegPath = resolveBinary('ffmpeg', ffmpegBin);
const ffprobePath = resolveBinary('ffprobe', ffprobe.path);

// Containers Chromium's <video> can demux directly.
const DIRECT_PLAYABLE = new Set(['mp4', 'm4v', 'mov', 'webm', 'ogv', 'ogg', 'm4a', 'mp3', 'wav']);

// Codecs Chromium can decode natively.
const DECODABLE_VIDEO = new Set(['h264', 'vp8', 'vp9', 'av1', 'theora']);
const DECODABLE_AUDIO = new Set([
  'aac',
  'mp3',
  'opus',
  'vorbis',
  'flac',
  'alac',
  'pcm_s16le',
  'pcm_s24le',
  'pcm_s32le',
  'pcm_f32le',
  'pcm_u8',
]);

export interface MediaStatus {
  status: 'ready' | 'transcoding' | 'error';
  url?: string;
  progress: number;
  error?: string;
}

interface ProbeInfo {
  duration: number;
  videoCodec: string | null;
  audioCodec: string | null;
}

interface Job {
  status: 'ready' | 'transcoding' | 'error';
  url?: string;
  progress: number;
  error?: string;
  proc?: ChildProcess;
}

const jobs = new Map<string, Job>();

function cacheKey(videoPath: string): string {
  return crypto.createHash('sha1').update(videoPath).digest('hex');
}

function mediaUrl(filePath: string): string {
  return `media://local/${encodeURIComponent(filePath)}`;
}

function probe(videoPath: string): Promise<ProbeInfo> {
  return new Promise((resolve, reject) => {
    const proc = spawn(ffprobePath, [
      '-v',
      'error',
      '-print_format',
      'json',
      '-show_format',
      '-show_streams',
      videoPath,
    ]);
    let out = '';
    let err = '';
    proc.stdout.on('data', (d) => (out += d));
    proc.stderr.on('data', (d) => (err += d));
    proc.on('close', (code) => {
      if (code !== 0) {
        reject(new Error(err.trim() || 'ffprobe failed'));
        return;
      }
      try {
        const data = JSON.parse(out);
        const duration = parseFloat(data.format?.duration ?? '0');
        const video = data.streams?.find((s: { codec_type: string }) => s.codec_type === 'video');
        const audio = data.streams?.find((s: { codec_type: string }) => s.codec_type === 'audio');
        resolve({
          duration: Number.isFinite(duration) ? duration : 0,
          videoCodec: video?.codec_name ?? null,
          audioCodec: audio?.codec_name ?? null,
        });
      } catch (e) {
        reject(e as Error);
      }
    });
    proc.on('error', (e) => {
      reject(e);
    });
  });
}

function decide(videoPath: string, info: ProbeInfo): 'direct' | 'remux' | 'transcode' {
  const ext = path.extname(videoPath).slice(1).toLowerCase();

  if (DIRECT_PLAYABLE.has(ext)) {
    const videoOk = !info.videoCodec || DECODABLE_VIDEO.has(info.videoCodec);
    const audioOk = !info.audioCodec || DECODABLE_AUDIO.has(info.audioCodec);
    if (videoOk && audioOk) return 'direct';
    return 'transcode';
  }

  if (info.videoCodec === 'h264') return 'remux';
  return 'transcode';
}

function startTranscode(videoPath: string, mode: 'remux' | 'transcode', info: ProbeInfo, job: Job) {
  const dir = transcodeDir();
  fs.mkdirSync(dir, { recursive: true });
  const outputPath = path.join(dir, `${cacheKey(videoPath)}.mp4`);
  const partPath = `${outputPath}.part`;

  const args = ['-hide_banner', '-y', '-i', videoPath, '-map', '0:v:0', '-map', '0:a:0?'];
  if (mode === 'remux') {
    args.push('-c:v', 'copy', '-c:a', 'aac', '-b:a', '192k');
  } else {
    args.push('-c:v', 'libx264', '-preset', 'veryfast', '-crf', '23', '-c:a', 'aac', '-b:a', '192k');
  }
  args.push('-movflags', '+faststart', '-f', 'mp4', partPath);

  const proc = spawn(ffmpegPath, args);
  job.proc = proc;

  let errBuf = '';
  proc.stderr.on('data', (d: Buffer) => {
    const s = d.toString();
    errBuf += s;
    const m = /time=(\d+):(\d+):(\d+\.?\d*)/.exec(s);
    if (m && info.duration > 0) {
      const sec = Number(m[1]) * 3600 + Number(m[2]) * 60 + Number(m[3]);
      job.progress = Math.min(0.99, sec / info.duration);
    }
  });

  proc.on('close', (code) => {
    job.proc = undefined;
    if (code === 0 && fs.existsSync(partPath)) {
      fs.renameSync(partPath, outputPath);
      job.status = 'ready';
      job.progress = 1;
      job.url = mediaUrl(outputPath);
    } else {
      try {
        if (fs.existsSync(partPath)) fs.unlinkSync(partPath);
      } catch {
        // ignore
      }
      job.status = 'error';
      job.error = errBuf.trim().slice(-2000) || 'Transcode failed';
    }
    onCacheChanged?.();
  });

  proc.on('error', (err) => {
    job.proc = undefined;
    try {
      if (fs.existsSync(partPath)) fs.unlinkSync(partPath);
    } catch {
      // ignore
    }
    job.status = 'error';
    job.error = err.message;
    onCacheChanged?.();
  });
}

export async function prepareMedia(videoPath: string): Promise<MediaStatus> {
  const key = cacheKey(videoPath);

  const existing = jobs.get(key);
  if (existing) {
    return {
      status: existing.status,
      url: existing.url,
      progress: existing.progress,
      error: existing.error,
    };
  }

  let info: ProbeInfo;
  try {
    info = await probe(videoPath);
  } catch (e) {
    const failed: Job = { status: 'error', progress: 0, error: (e as Error).message };
    jobs.set(key, failed);
    return { status: 'error', progress: 0, error: (e as Error).message };
  }

  const mode = decide(videoPath, info);

  if (mode === 'direct') {
    const ready: Job = { status: 'ready', url: mediaUrl(videoPath), progress: 1 };
    jobs.set(key, ready);
    return { status: 'ready', url: ready.url, progress: 1 };
  }

  const outputPath = path.join(transcodeDir(), `${key}.mp4`);
  if (fs.existsSync(outputPath)) {
    const ready: Job = { status: 'ready', url: mediaUrl(outputPath), progress: 1 };
    jobs.set(key, ready);
    return { status: 'ready', url: ready.url, progress: 1 };
  }

  const job: Job = { status: 'transcoding', progress: 0 };
  jobs.set(key, job);
  startTranscode(videoPath, mode, info, job);

  return { status: 'transcoding', progress: 0 };
}
