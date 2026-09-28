import { _electron as electron, ElectronApplication, Page } from '@playwright/test';
import { spawnSync } from 'child_process';
import * as fs from 'fs';
import * as os from 'os';
import * as path from 'path';
// @ts-expect-error - electron package exports the binary path as a string
import electronPath from 'electron';
import ffmpegStatic from 'ffmpeg-static';

const ffmpeg: string =
  typeof ffmpegStatic === 'string' ? ffmpegStatic : (ffmpegStatic as unknown as { path: string })?.path;

export interface Fixtures {
  dir: string;
  clipA: string; // no sidecar
  clipB: string; // family + travel
  clipC: string; // mkv, family
  clipD: string; // travel
}

function generateVideo(outPath: string, duration = 10): void {
  const r = spawnSync(
    ffmpeg,
    [
      '-hide_banner',
      '-y',
      '-f',
      'lavfi',
      '-i',
      `testsrc=duration=${duration}:size=640x360:rate=24`,
      '-f',
      'lavfi',
      '-i',
      `sine=duration=${duration}`,
      '-c:v',
      'libx264',
      '-pix_fmt',
      'yuv420p',
      '-preset',
      'ultrafast',
      '-c:a',
      'aac',
      '-b:a',
      '128k',
      '-shortest',
      outPath,
    ],
    { encoding: 'utf-8' },
  );
  if (r.status !== 0) {
    throw new Error(`ffmpeg failed for ${outPath}: ${r.stderr}`);
  }
}

function writeSidecar(videoPath: string, tags: Record<string, [string, string][]>): void {
  const json = { version: 1, tags };
  fs.writeFileSync(`${videoPath}.tags.json`, JSON.stringify(json, null, 2));
}

export function setupFixtures(): Fixtures {
  const dir = fs.mkdtempSync(path.join(os.tmpdir(), 'vt-e2e-'));
  const clipA = path.join(dir, 'clip-a.mp4');
  const clipB = path.join(dir, 'clip-b.mp4');
  const clipC = path.join(dir, 'clip-c.mkv');
  const clipD = path.join(dir, 'clip-d.mp4');

  generateVideo(clipA);
  generateVideo(clipB);
  generateVideo(clipC);
  generateVideo(clipD);

  writeSidecar(clipB, {
    family: [['00:00:01', '00:00:02']],
    travel: [['00:00:03', '00:00:04']],
  });
  writeSidecar(clipC, { family: [['00:00:01', '00:00:02']] });
  writeSidecar(clipD, { travel: [['00:00:01', '00:00:02']] });

  return { dir, clipA, clipB, clipC, clipD };
}

export function sidecarPathFor(videoPath: string): string {
  return `${videoPath}.tags.json`;
}

export async function launchApp(rootDir: string): Promise<{ app: ElectronApplication; page: Page }> {
  const app = await electron.launch({
    executablePath: electronPath,
    args: ['.'],
    cwd: path.join(__dirname, '..'),
    env: {
      ...process.env,
      VT_ROOT: rootDir,
      ELECTRON_DISABLE_SECURITY_WARNINGS: 'true',
    },
  });

  app.process().stdout?.on('data', () => {});
  app.process().stderr?.on('data', () => {});

  const page = await app.firstWindow();
  await page.waitForLoadState('domcontentloaded');
  return { app, page };
}

export async function waitForVideoReady(page: Page, timeout = 30_000): Promise<void> {
  try {
    await page.waitForFunction(
      () => {
        const v = document.querySelector('video');
        return !!v && v.readyState >= 1 && Number.isFinite(v.duration) && v.duration > 0;
      },
      undefined,
      { timeout },
    );
  } catch {
    const state = await page.evaluate(() => {
      const v = document.querySelector('video');
      return {
        hasVideo: !!v,
        readyState: v?.readyState ?? null,
        duration: v?.duration ?? null,
        networkState: v?.networkState ?? null,
        error: document.querySelector('.player-error')?.textContent ?? null,
        preparing: document.querySelector('.preparing')?.textContent ?? null,
        placeholder: document.querySelector('.player-placeholder')?.textContent ?? null,
      };
    });
    throw new Error(`Video not ready. State: ${JSON.stringify(state)}`);
  }
}
