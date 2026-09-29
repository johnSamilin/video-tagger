import { test, expect } from '@playwright/test';
import * as fs from 'fs';
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
});
