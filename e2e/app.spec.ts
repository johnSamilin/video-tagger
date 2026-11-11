import { test, expect } from '@playwright/test';
import * as fs from 'fs';
import * as os from 'os';
import * as path from 'path';
import { spawnSync } from 'child_process';
import ffmpeg from 'ffmpeg-static';
import { setupFixtures, launchApp, waitForVideoReady, sidecarPathFor } from './helpers';

// End-to-end coverage mapped to the architecture doc `plans/video-tagger-plan.md`:
//   §5 (SidecarStore / TagRegistry / PlayerEngine) + §6 (GUI) + §13 (Testing Strategy).
//
// 1. Select root -> video tree (right sidebar)     (§6 VideoTreePanel)
// 2. Open video -> playback controls               (§6 VideoPlayerPanel / PlaybackControls)
// 3. Non-playable container -> ffmpeg remux        (§9.3 Player Rendering, Electron variant)
// 4. One-click toggle START/STOP -> sidecar write  (§6 TagListPanel + §9.4 Sidecar R/W)
// 5. Restart -> sidecar reload                     (§13 "перезапустить приложение")
// 6. Tag query AND/OR filters tree                 (§6 QueryPanel + §5 TagRegistry)
// 7. Delete range via per-range button             (§6 TimelineRangesPanel)
// 8. Rename / delete tag everywhere                (§6 TagListPanel context menu)

test.describe('Video Tagger e2e', () => {
  test('finds, plays and tags an audio file, including one requiring conversion', async () => {
    const dir = fs.mkdtempSync(path.join(os.tmpdir(), 'vt-audio-'));
    const audioPath = path.join(dir, 'song.flac');
    const mp3Path = path.join(dir, 'track.mp3');
    const result = spawnSync(ffmpeg, [
      '-y', '-f', 'lavfi', '-i', 'sine=frequency=440:duration=8', audioPath,
    ], { encoding: 'utf-8' });
    expect(result.status, result.stderr).toBe(0);
    const mp3Result = spawnSync(ffmpeg, [
      '-y', '-f', 'lavfi', '-i', 'sine=frequency=440:duration=8', mp3Path,
    ], { encoding: 'utf-8' });
    expect(mp3Result.status, mp3Result.stderr).toBe(0);

    const { app, page } = await launchApp(dir);
    try {
      await page.locator('[data-testid="video-row"][data-name="song.flac"]').click();
      try {
        await page.waitForFunction(() => {
          const audio = document.querySelector('audio');
          return !!audio && audio.readyState >= 1 && audio.duration > 0;
        }, undefined, { timeout: 15_000 });
      } catch (error) {
        const state = await page.evaluate(() => ({
          audio: document.querySelector('audio')?.outerHTML,
          readyState: document.querySelector('audio')?.readyState,
          mediaError: document.querySelector('audio')?.error?.message,
          player: document.querySelector('.player, .player-placeholder')?.textContent,
        }));
        throw new Error(`${String(error)}: ${JSON.stringify(state)}`);
      }

      await page.getByTestId('play-btn').click();
      await expect(page.getByTestId('play-btn')).toContainText('⏸');
      await page.locator('input.seek').fill('1');
      await page.getByTestId('new-tag-btn').click();
      await page.getByTestId('tag-name-input').fill('music');
      await page.getByTestId('tag-submit').click();
      const tag = page.locator('[data-testid="tag-row"][data-name="music"]');
      await tag.click();
      await page.locator('input.seek').fill('3');
      await tag.click();

      await expect(page.getByTestId('range-row').filter({ hasText: 'music' })).toBeVisible();
      await expect.poll(() => fs.existsSync(sidecarPathFor(audioPath))).toBe(true);
      expect(JSON.parse(fs.readFileSync(sidecarPathFor(audioPath), 'utf-8')).tags.music).toHaveLength(1);

      await page.locator('[data-testid="video-row"][data-name="track.mp3"]').click();
      await expect(page.locator('audio')).toHaveAttribute('src', /track\.mp3/);
      await page.waitForFunction(() => document.querySelector('audio')?.readyState >= 1);
    } finally {
      await app.close();
      fs.rmSync(dir, { recursive: true, force: true });
    }
  });

  test('switches between GNOME and Teenage Engineering themes', async () => {
    const fx = setupFixtures();
    const { app, page } = await launchApp(fx.dir);
    try {
      const select = page.getByTestId('theme-select');
      await expect(select).toBeVisible();

      const accent = () =>
        page.evaluate(() =>
          getComputedStyle(document.documentElement).getPropertyValue('--accent').trim(),
        );

      await select.selectOption('gnome');
      expect(await accent()).toBe('#3584e4');

      await select.selectOption('teenage-engineering');
      expect(await accent()).toBe('#ff4d00');

      await select.selectOption('gnome');
      expect(await accent()).toBe('#3584e4');
    } finally {
      await app.close();
    }
  });

  test('collapses and expands the top and bottom panels via the info button', async () => {
    const fx = setupFixtures();
    const { app, page } = await launchApp(fx.dir);
    try {
      const info = page.getByTestId('floating-info');
      const appRoot = page.locator('.app');

      await expect(info).toBeVisible();
      await expect(page.locator('.header')).toBeVisible();
      await expect(page.locator('.statusbar')).toBeVisible();

      await info.click();
      await expect(appRoot).toHaveClass(/chrome-hidden/);
      await expect(page.locator('.header')).toBeHidden();
      await expect(page.locator('.statusbar')).toBeHidden();

      await info.click();
      await expect(appRoot).not.toHaveClass(/chrome-hidden/);
      await expect(page.locator('.header')).toBeVisible();
      await expect(page.locator('.statusbar')).toBeVisible();
    } finally {
      await app.close();
    }
  });

  test('shows the video tree and aggregates tags from sidecars', async () => {
    const fx = setupFixtures();
    const { app, page } = await launchApp(fx.dir);
    try {
      await expect(page).toHaveTitle('Video Tagger');

      for (const name of ['clip-a.mp4', 'clip-b.mp4', 'clip-c.mkv', 'clip-d.mp4']) {
        await expect(page.locator(`[data-testid="video-row"][data-name="${name}"]`)).toBeVisible();
      }

      await expect(page.locator('[data-testid="tag-row"][data-name="family"]')).toContainText('(2)');
      await expect(page.locator('[data-testid="tag-row"][data-name="travel"]')).toContainText('(2)');
    } finally {
      await app.close();
    }
  });

  test('opens an mp4 and plays it', async () => {
    const fx = setupFixtures();
    const { app, page } = await launchApp(fx.dir);
    try {
      await page.locator('[data-testid="video-row"][data-name="clip-b.mp4"]').click();
      await waitForVideoReady(page);

      await expect(page.getByTestId('play-btn')).toContainText('⏵');
      await page.getByTestId('play-btn').click();
      await expect(page.getByTestId('play-btn')).toContainText('⏸');

      const t0 = await page.evaluate(() => document.querySelector('video')!.currentTime);
      await page.waitForTimeout(1200);
      const t1 = await page.evaluate(() => document.querySelector('video')!.currentTime);
      expect(t1).toBeGreaterThan(t0);
    } finally {
      await app.close();
    }
  });

  test('plays an mkv by remuxing/transcoding with ffmpeg', async () => {
    const fx = setupFixtures();
    const { app, page } = await launchApp(fx.dir);
    try {
      await page.locator('[data-testid="video-row"][data-name="clip-c.mkv"]').click();
      await waitForVideoReady(page, 60_000);

      await page.getByTestId('play-btn').click();
      await expect(page.getByTestId('play-btn')).toContainText('⏸');
    } finally {
      await app.close();
    }
  });

  test('creates a tag, marks a range, writes the sidecar, and persists after restart', async () => {
    const fx = setupFixtures();
    const tagName = 'ui-created';

    const s1 = await launchApp(fx.dir);
    let page = s1.page;
    await page.locator('[data-testid="video-row"][data-name="clip-a.mp4"]').click();
    await waitForVideoReady(page);

    await page.locator('input.seek').fill('2');

    await page.getByTestId('new-tag-btn').click();
    await page.getByTestId('tag-name-input').fill(tagName);
    await page.getByTestId('tag-submit').click();

    const tagRow = page.locator(`[data-testid="tag-row"][data-name="${tagName}"]`);
    await expect(tagRow).toBeVisible();

    await tagRow.click();
    await expect(page.getByTestId('recording')).toBeVisible();

    await page.locator('input.seek').fill('5');

    await tagRow.click();
    await expect(page.getByTestId('range-row').filter({ hasText: tagName })).toBeVisible();

    const sidecar = sidecarPathFor(fx.clipA);
    await expect.poll(() => fs.existsSync(sidecar), { timeout: 5000 }).toBe(true);
    const content = JSON.parse(fs.readFileSync(sidecar, 'utf-8'));
    expect(content.tags[tagName]).toBeTruthy();
    expect(content.tags[tagName].length).toBe(1);
    await s1.app.close();

    const s2 = await launchApp(fx.dir);
    page = s2.page;
    await page.locator('[data-testid="video-row"][data-name="clip-a.mp4"]').click();
    await waitForVideoReady(page);
    await expect(page.getByTestId('range-row').filter({ hasText: tagName })).toBeVisible();
    await expect(page.locator(`[data-testid="tag-row"][data-name="${tagName}"]`)).toBeVisible();
    await s2.app.close();
  });

  test('supports one-click toggle START/STOP for multiple tags simultaneously', async () => {
    const fx = setupFixtures();
    const { app, page } = await launchApp(fx.dir);
    try {
      await page.locator('[data-testid="video-row"][data-name="clip-a.mp4"]').click();
      await waitForVideoReady(page);

      for (const name of ['alpha', 'beta']) {
        await page.getByTestId('new-tag-btn').click();
        await page.getByTestId('tag-name-input').fill(name);
        await page.getByTestId('tag-submit').click();
      }

      await page.getByTestId('play-btn').click();
      await page.waitForTimeout(1500);

      const alpha = page.locator('[data-testid="tag-row"][data-name="alpha"]');
      const beta = page.locator('[data-testid="tag-row"][data-name="beta"]');

      await alpha.click();
      await beta.click();
      await expect(page.getByTestId('recording')).toHaveCount(2);

      await page.waitForTimeout(1500);

      await alpha.click();
      await beta.click();
      await expect(page.getByTestId('recording')).toHaveCount(0);

      await expect(page.getByTestId('range-row')).toHaveCount(2);

      const sidecar = sidecarPathFor(fx.clipA);
      await expect
        .poll(
          () => {
            if (!fs.existsSync(sidecar)) return false;
            const c = JSON.parse(fs.readFileSync(sidecar, 'utf-8'));
            return (c.tags.alpha?.length ?? 0) >= 1 && (c.tags.beta?.length ?? 0) >= 1;
          },
          { timeout: 5000 },
        )
        .toBe(true);
      const content = JSON.parse(fs.readFileSync(sidecar, 'utf-8'));
      expect(content.tags.alpha).toBeTruthy();
      expect(content.tags.beta).toBeTruthy();
      expect(content.tags.alpha.length).toBe(1);
      expect(content.tags.beta.length).toBe(1);
    } finally {
      await app.close();
    }
  });

  test('persists a created tag even without marking a range', async () => {
    const fx = setupFixtures();
    const tagName = 'draft-tag';

    const s1 = await launchApp(fx.dir);
    await s1.page.locator('[data-testid="video-row"][data-name="clip-a.mp4"]').click();
    await waitForVideoReady(s1.page);

    await s1.page.getByTestId('new-tag-btn').click();
    await s1.page.getByTestId('tag-name-input').fill(tagName);
    await s1.page.getByTestId('tag-submit').click();

    const sidecar = sidecarPathFor(fx.clipA);
    await expect.poll(() => fs.existsSync(sidecar), { timeout: 5000 }).toBe(true);
    const content = JSON.parse(fs.readFileSync(sidecar, 'utf-8'));
    expect(content.tags[tagName]).toEqual([]);
    await s1.app.close();

    const s2 = await launchApp(fx.dir);
    await expect(s2.page.locator(`[data-testid="tag-row"][data-name="${tagName}"]`)).toBeVisible();
    await s2.app.close();
  });

  test('double-clicking a tag marks the whole file', async () => {
    const fx = setupFixtures();
    const { app, page } = await launchApp(fx.dir);
    try {
      await page.locator('[data-testid="video-row"][data-name="clip-a.mp4"]').click();
      await waitForVideoReady(page);

      await page.getByTestId('new-tag-btn').click();
      await page.getByTestId('tag-name-input').fill('whole');
      await page.getByTestId('tag-submit').click();

      const tagRow = page.locator('[data-testid="tag-row"][data-name="whole"]');
      await tagRow.dblclick();

      await expect(page.getByTestId('range-row').filter({ hasText: 'whole' })).toHaveCount(1);

      const sidecar = sidecarPathFor(fx.clipA);
      await expect
        .poll(
          () => {
            if (!fs.existsSync(sidecar)) return false;
            const c = JSON.parse(fs.readFileSync(sidecar, 'utf-8'));
            const ranges = c.tags.whole ?? [];
            if (ranges.length !== 1) return false;
            return ranges[0][0] === '00:00:00' && ranges[0][1] !== '00:00:00';
          },
          { timeout: 5000 },
        )
        .toBe(true);
    } finally {
      await app.close();
    }
  });

  test('switching videos clears pending range selections', async () => {
    const fx = setupFixtures();
    const { app, page } = await launchApp(fx.dir);
    try {
      await page.locator('[data-testid="video-row"][data-name="clip-a.mp4"]').click();
      await waitForVideoReady(page);

      await page.getByTestId('new-tag-btn').click();
      await page.getByTestId('tag-name-input').fill('pending-tag');
      await page.getByTestId('tag-submit').click();

      const tagRow = page.locator('[data-testid="tag-row"][data-name="pending-tag"]');
      await tagRow.click();
      await expect(page.getByTestId('recording')).toHaveCount(1);

      await page.locator('[data-testid="video-row"][data-name="clip-b.mp4"]').click();
      await waitForVideoReady(page);

      await expect(page.getByTestId('recording')).toHaveCount(0);

      await expect
        .poll(() => {
          const b = JSON.parse(fs.readFileSync(sidecarPathFor(fx.clipB), 'utf-8'));
          return b.tags['pending-tag'] === undefined && b.tags.family !== undefined;
        })
        .toBe(true);
    } finally {
      await app.close();
    }
  });

  test('filters videos by tag query (AND / OR)', async () => {
    const fx = setupFixtures();
    const { app, page } = await launchApp(fx.dir);
    try {
      const input = page.getByTestId('query-input');

      for (const name of ['clip-a.mp4', 'clip-b.mp4', 'clip-c.mkv', 'clip-d.mp4']) {
        await expect(page.locator(`[data-testid="video-row"][data-name="${name}"]`)).toBeVisible();
      }

      await input.fill('family and travel');
      await expect(page.locator('[data-testid="video-row"][data-name="clip-b.mp4"]')).toBeVisible();
      await expect(page.locator('[data-testid="video-row"][data-name="clip-a.mp4"]')).toBeHidden();
      await expect(page.locator('[data-testid="video-row"][data-name="clip-c.mkv"]')).toBeHidden();
      await expect(page.locator('[data-testid="video-row"][data-name="clip-d.mp4"]')).toBeHidden();

      await input.fill('family or travel');
      await expect(page.locator('[data-testid="video-row"][data-name="clip-b.mp4"]')).toBeVisible();
      await expect(page.locator('[data-testid="video-row"][data-name="clip-c.mkv"]')).toBeVisible();
      await expect(page.locator('[data-testid="video-row"][data-name="clip-d.mp4"]')).toBeVisible();
      await expect(page.locator('[data-testid="video-row"][data-name="clip-a.mp4"]')).toBeHidden();

      await input.fill('');
      await expect(page.locator('[data-testid="video-row"][data-name="clip-a.mp4"]')).toBeVisible();
    } finally {
      await app.close();
    }
  });

  test('filters untagged videos via the Untagged button', async () => {
    const fx = setupFixtures();
    const { app, page } = await launchApp(fx.dir);
    try {
      const untagged = page.getByTestId('untagged-filter');

      await untagged.click();
      await expect(page.locator('[data-testid="video-row"][data-name="clip-a.mp4"]')).toBeVisible();
      await expect(page.locator('[data-testid="video-row"][data-name="clip-b.mp4"]')).toBeHidden();
      await expect(page.locator('[data-testid="video-row"][data-name="clip-c.mkv"]')).toBeHidden();
      await expect(page.locator('[data-testid="video-row"][data-name="clip-d.mp4"]')).toBeHidden();

      await untagged.click();
      await expect(page.locator('[data-testid="video-row"][data-name="clip-a.mp4"]')).toBeVisible();
      await expect(page.locator('[data-testid="video-row"][data-name="clip-b.mp4"]')).toBeVisible();
    } finally {
      await app.close();
    }
  });

  test('transcodes to a cache dir and clears it on quit', async () => {
    const fx = setupFixtures();
    const userData = fs.mkdtempSync(path.join(os.tmpdir(), 'vt-ud-'));
    const transcodeDir = path.join(userData, 'transcode');

    const { app, page } = await launchApp(fx.dir, { userData });
    await page.locator('[data-testid="video-row"][data-name="clip-c.mkv"]').click();
    await waitForVideoReady(page, 60_000);
    await expect
      .poll(() => (fs.existsSync(transcodeDir) ? fs.readdirSync(transcodeDir).length : 0), {
        timeout: 10_000,
      })
      .toBeGreaterThan(0);

    await app.close();

    // auto-cleanup on quit cleared the transcode cache
    expect(fs.existsSync(transcodeDir) ? fs.readdirSync(transcodeDir) : []).toHaveLength(0);
  });

  test('deletes a range via the delete button and updates the sidecar', async () => {
    const fx = setupFixtures();
    const { app, page } = await launchApp(fx.dir);
    try {
      await page.locator('[data-testid="video-row"][data-name="clip-b.mp4"]').click();
      await waitForVideoReady(page);

      await expect(page.getByTestId('range-row')).toHaveCount(2);

      const familyRow = page.getByTestId('range-row').filter({ hasText: 'family' });
      await familyRow.getByRole('button', { name: 'Delete' }).click();

      await expect(page.getByTestId('range-row')).toHaveCount(1);

      await expect
        .poll(() => {
          const c = JSON.parse(fs.readFileSync(sidecarPathFor(fx.clipB), 'utf-8'));
          return c.tags.family === undefined && c.tags.travel !== undefined;
        })
        .toBe(true);
    } finally {
      await app.close();
    }
  });

  test('renames a tag everywhere via the tag menu', async () => {
    const fx = setupFixtures();
    const { app, page } = await launchApp(fx.dir);
    try {
      const familyTag = page.locator('[data-testid="tag-row"][data-name="family"]');
      await familyTag.getByRole('button', { name: '⋯' }).click();
      await page.getByTestId('tag-rename-btn').click();
      await page.getByTestId('tag-name-input').fill('relatives');
      await page.getByTestId('tag-submit').click();

      await expect(page.locator('[data-testid="tag-row"][data-name="relatives"]')).toBeVisible();
      await expect(page.locator('[data-testid="tag-row"][data-name="family"]')).toBeHidden();

      await expect
        .poll(() => {
          const c = JSON.parse(fs.readFileSync(sidecarPathFor(fx.clipB), 'utf-8'));
          return c.tags.relatives !== undefined && c.tags.family === undefined;
        })
        .toBe(true);
    } finally {
      await app.close();
    }
  });

  test('deletes a tag everywhere via the tag menu', async () => {
    const fx = setupFixtures();
    const { app, page } = await launchApp(fx.dir);
    try {
      const travelTag = page.locator('[data-testid="tag-row"][data-name="travel"]');
      await travelTag.getByRole('button', { name: '⋯' }).click();
      await page.getByTestId('tag-delete-btn').click();
      await page.getByTestId('confirm-ok').click();

      await expect(page.locator('[data-testid="tag-row"][data-name="travel"]')).toBeHidden();

      await expect
        .poll(() => {
          const c = JSON.parse(fs.readFileSync(sidecarPathFor(fx.clipB), 'utf-8'));
          return c.tags.travel === undefined;
        })
        .toBe(true);
    } finally {
      await app.close();
    }
  });

  test('toggles playback with the spacebar and has no volume slider', async () => {
    const fx = setupFixtures();
    const { app, page } = await launchApp(fx.dir);
    try {
      await page.locator('[data-testid="video-row"][data-name="clip-b.mp4"]').click();
      await waitForVideoReady(page);

      await expect(page.getByTestId('play-btn')).toContainText('⏵');
      await expect(page.locator('input.volume')).toHaveCount(0);

      await page.keyboard.press('Space');
      await expect(page.getByTestId('play-btn')).toContainText('⏸');

      await page.keyboard.press('Space');
      await expect(page.getByTestId('play-btn')).toContainText('⏵');
    } finally {
      await app.close();
    }
  });

  test('bulk-tags multiple files without touching unrelated tags', async () => {
    const fx = setupFixtures();
    const { app, page } = await launchApp(fx.dir);
    try {
      await page
        .locator('[data-testid="video-row"][data-name="clip-a.mp4"] [data-testid="video-check"]')
        .check();
      await page
        .locator('[data-testid="video-row"][data-name="clip-b.mp4"] [data-testid="video-check"]')
        .check();

      await expect(page.getByTestId('bulk-panel')).toBeVisible();
      await expect(page.getByTestId('play-btn')).toHaveCount(0);

      await page.locator('label.bulk-tag', { hasText: 'family' }).locator('input').check();
      await page.getByTestId('bulk-add').click();

      await page.locator('label.bulk-tag', { hasText: 'family' }).locator('input').uncheck();
      await page.locator('label.bulk-tag', { hasText: 'travel' }).locator('input').check();
      await page.getByTestId('bulk-remove').click();

      await expect
        .poll(
          () => {
            const aPath = sidecarPathFor(fx.clipA);
            if (!fs.existsSync(aPath)) return false;
            const a = JSON.parse(fs.readFileSync(aPath, 'utf-8'));
            const b = JSON.parse(fs.readFileSync(sidecarPathFor(fx.clipB), 'utf-8'));
            return (
              (a.tags.family?.length ?? 0) === 1 &&
              b.tags.travel === undefined &&
              b.tags.family !== undefined
            );
          },
          { timeout: 10_000 },
        )
        .toBe(true);
    } finally {
      await app.close();
    }
  });

  test('copies media and sidecars to a folder and moves them preserving their root-relative folders', async () => {
    const fx = setupFixtures();
    const destination = fs.mkdtempSync(path.join(os.tmpdir(), 'vt-destination-'));
    const moveDestination = fs.mkdtempSync(path.join(os.tmpdir(), 'vt-move-'));
    const nestedDir = path.join(fx.dir, 'album');
    fs.mkdirSync(nestedDir);
    const nested = path.join(nestedDir, 'song.wav');
    fs.writeFileSync(nested, 'audio data');
    fs.writeFileSync(sidecarPathFor(nested), JSON.stringify({ version: 1, tags: { music: [] } }));
    const { app, page } = await launchApp(fx.dir);
    try {
      await app.evaluate(({ dialog }, target) => {
        dialog.showOpenDialog = async () => ({ canceled: false, filePaths: [target] });
      }, destination);

      await page.locator('[data-testid="video-row"][data-name="clip-a.mp4"] [data-testid="video-check"]').check();
      await page.locator('[data-testid="video-row"][data-name="clip-b.mp4"] [data-testid="video-check"]').check();
      await page.getByTestId('bulk-copy').click();
      await expect.poll(() => fs.existsSync(path.join(destination, 'clip-b.mp4.tags.json'))).toBe(true);
      expect(fs.readFileSync(path.join(destination, 'clip-b.mp4.tags.json'), 'utf8'))
        .toBe(fs.readFileSync(sidecarPathFor(fx.clipB), 'utf8'));
      expect(fs.existsSync(fx.clipA)).toBe(true);

      await page.locator('[data-testid="video-row"][data-name="clip-b.mp4"] [data-testid="video-check"]').uncheck();
      await page.locator('[data-testid="video-row"][data-name="song.wav"] [data-testid="video-check"]').check();
      await app.evaluate(({ dialog }, target) => {
        dialog.showOpenDialog = async () => ({ canceled: false, filePaths: [target] });
      }, moveDestination);
      await page.getByTestId('bulk-move-tree').click();
      await expect.poll(() => fs.existsSync(path.join(moveDestination, 'album', 'song.wav.tags.json'))).toBe(true);
      await expect.poll(() => fs.existsSync(nested)).toBe(false);
      expect(fs.existsSync(sidecarPathFor(nested))).toBe(false);
      await expect.poll(() => fs.existsSync(fx.clipA)).toBe(false);

      await page.locator('[data-testid="video-row"][data-name="clip-b.mp4"] [data-testid="video-check"]').check();
      await page.locator('[data-testid="video-row"][data-name="clip-d.mp4"] [data-testid="video-check"]').check();
      await app.evaluate(({ dialog }, target) => {
        dialog.showOpenDialog = async () => ({ canceled: false, filePaths: [target] });
      }, destination);
      await page.getByTestId('bulk-move').click();
      await expect(page.getByRole('alert')).toContainText('already exists');
      expect(fs.existsSync(fx.clipB)).toBe(true);
      expect(fs.existsSync(fx.clipD)).toBe(true);

      await page.getByTestId('bulk-delete').click();
      await expect(page.getByText('Move selected files to Trash?')).toBeVisible();
      await page.getByRole('button', { name: 'Cancel' }).click();
      expect(fs.existsSync(fx.clipB)).toBe(true);
      await page.getByTestId('bulk-delete').click();
      await page.getByTestId('confirm-ok').click();
      await expect.poll(() => fs.existsSync(fx.clipB)).toBe(false);
      await expect.poll(() => fs.existsSync(sidecarPathFor(fx.clipB))).toBe(false);
      await expect.poll(() => fs.existsSync(fx.clipD)).toBe(false);
    } finally {
      await app.close();
      fs.rmSync(destination, { recursive: true, force: true });
      fs.rmSync(moveDestination, { recursive: true, force: true });
    }
  });
});
