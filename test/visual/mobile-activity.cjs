// Optional visual smoke test; no real server or personal activity data is used.
// Kept outside test/e2e/: TestCafe imports every script in that directory.
// With Playwright installed: node test/visual/mobile-activity.cjs [base URL] [output dir]
// PLAYWRIGHT_MODULE and CHROMIUM_PATH can select an existing local installation.
const assert = require('node:assert/strict');
const fs = require('node:fs');
const path = require('node:path');
const { chromium } = require(process.env.PLAYWRIGHT_MODULE || 'playwright');

const baseURL = process.argv[2] || 'http://127.0.0.1:27180';
const output = process.argv[3] || 'screenshots/mobile-activity';
const androidViews = [
  {
    id: 'summary',
    name: 'Summary',
    elements: [
      { type: 'top_apps', size: 3 },
      { type: 'top_categories', size: 3 },
      { type: 'timeline_barchart', size: 3 },
      { type: 'category_tree', size: 3 },
      { type: 'category_sunburst', size: 3 },
    ],
  },
];

async function fixture(page, settings = {}) {
  const errors = [];
  page.on('pageerror', error => errors.push(error.message));
  await page.route('**/api/0/**', async route => {
    const request = route.request();
    const pathname = new URL(request.url()).pathname;
    let body = {};
    if (pathname.endsWith('/info')) {
      body = { hostname: 'demo-device', version: 'v0.14.3', testing: true };
    } else if (pathname.endsWith('/settings')) {
      body = settings;
    } else if (pathname.endsWith('/buckets/')) {
      body = Object.fromEntries(
        [
          ['window', 'currentwindow'],
          ['afk', 'afkstatus'],
        ].map(([watcher, type]) => {
          const id = `aw-watcher-${watcher}_demo-device`;
          return [
            id,
            {
              id,
              type,
              client: `aw-watcher-${watcher}`,
              hostname: 'demo-device',
              created: '2026-11-18T00:00:00Z',
            },
          ];
        })
      );
    } else if (pathname.includes('/query/')) {
      const { query, timeperiods } = request.postDataJSON();
      const code = query.join('\n');
      body = timeperiods.map(period => {
        const timestamp = period.split('/')[0];
        const event = (duration, data) => ({ timestamp, duration, data });
        const windowResult = {
          duration: 14400,
          raw_duration: 14400,
          app_events: [
            event(7200, { app: 'Editor' }),
            event(3600, { app: 'Browser' }),
            event(3600, { app: 'Terminal' }),
          ],
          title_events: [event(14400, { app: 'Editor', title: 'Demo project' })],
          cat_events: [event(14400, { $category: ['Work'] })],
          active_events: [event(14400, { status: 'not-afk' })],
        };
        if (code.includes('"window":'))
          return {
            window: windowResult,
            browser: { domains: [], urls: [], titles: [], duration: 0 },
            stopwatch: { stopwatch_events: [] },
          };
        if (code.includes('RETURN = history_events')) return [event(14400, { status: 'not-afk' })];
        if (code.includes('"cat_events": cat_events')) {
          const hour = new Date(timestamp).getUTCHours();
          return {
            cat_events: hour >= 9 && hour < 17 ? [event(1800, { $category: ['Work'] })] : [],
          };
        }
        if (code.includes('sum_durations')) return 14400;
        throw new Error(`Unrecognized fixture query: ${code}`);
      });
    } else if (pathname.includes('/events')) {
      body = [];
    }
    await route.fulfill({
      status: 200,
      contentType: 'application/json',
      body: JSON.stringify(body),
    });
  });
  await page.goto(`${baseURL}/#/activity/demo-device/day/2026-11-18/view/summary`, {
    waitUntil: 'networkidle',
  });
  await page.locator('canvas').waitFor();
  await page.waitForTimeout(800); // Chart.js animation
  assert.deepEqual(errors, []);
  assert.equal(await page.locator('.alert-danger').count(), 0);
}

async function geometry(page) {
  return page.evaluate(() => {
    const bounds = selector => {
      const r = document.querySelector(selector).getBoundingClientRect();
      return { top: r.top, bottom: r.bottom, left: r.left, right: r.right, height: r.height };
    };
    const cards = [...document.querySelectorAll('.row > .p-3')];
    return {
      heading: bounds('h3'),
      tabs: bounds('ul.nav-tabs'),
      add: bounds(
        document.querySelector('.activity-add-view')
          ? '.activity-add-view'
          : 'ul.nav-tabs > li:last-child'
      ),
      chart: bounds('canvas'),
      firstCard: cards[0].getBoundingClientRect().top,
      overflow: document.documentElement.scrollWidth > innerWidth,
    };
  });
}

(async () => {
  fs.mkdirSync(output, { recursive: true });
  const browser = await chromium.launch({
    executablePath: process.env.CHROMIUM_PATH || undefined,
    headless: true,
  });
  try {
    for (const width of [360, 393, 1280]) {
      const page = await browser.newPage({ viewport: { width, height: 852 } });
      await fixture(page);
      const rect = await geometry(page);
      console.log(JSON.stringify({ width, ...rect }));
      await page.screenshot({ path: path.join(output, `desktop-default-${width}.png`) });
      if (!process.env.CAPTURE_BASELINE) {
        assert.equal(rect.overflow, false);
        if (width < 576) {
          assert.ok(rect.heading.height < 30, 'single-line phone heading');
          assert.ok(Math.abs(rect.tabs.top - rect.add.top) < 2, 'tabs and add on one row');
          assert.ok(rect.add.right <= width, 'add button remains inside viewport');
          assert.ok(rect.chart.bottom < 852, 'entire populated chart within first viewport');
          assert.ok(rect.chart.top < rect.firstCard, 'default chart visually before tables');
          await page.getByRole('button', { name: 'Edit view', exact: true }).click();
          const editing = await geometry(page);
          assert.ok(editing.chart.top > editing.firstCard, 'editing restores actual element order');
        } else {
          assert.ok(rect.chart.left > rect.heading.left + 500, 'desktop chart remains third');
        }
      }
      await page.close();
    }
    if (!process.env.CAPTURE_BASELINE) {
      const page = await browser.newPage({ viewport: { width: 360, height: 852 } });
      await fixture(page, { views: androidViews });
      assert.ok((await geometry(page)).chart.bottom < 852, 'Android default also chart-first');
      await page.screenshot({ path: path.join(output, 'android-default-360.png') });
      await page.close();

      const customViews = JSON.parse(JSON.stringify(androidViews));
      customViews[0].name = 'My customized summary with a very long name';
      customViews.push({ id: 'second', name: 'Another extremely long view name', elements: [] });
      const custom = await browser.newPage({ viewport: { width: 360, height: 852 } });
      await fixture(custom, { views: customViews, locale: 'de' });
      const rect = await geometry(custom);
      assert.equal(rect.overflow, false);
      assert.ok(rect.chart.top > rect.firstCard, 'customized summary retains user order');
      const tabs = custom.locator('.activity-view-tabs a');
      await tabs.last().focus();
      assert.ok(
        await custom.locator('.activity-view-tabs').evaluate(el => el.scrollLeft > 0),
        'focus scrolls long tab into view'
      );
      const add = custom.locator('.activity-add-view');
      await add.focus();
      await custom.keyboard.press('Enter');
      await custom.locator('#new_view').waitFor({ state: 'visible' });
      await custom.screenshot({ path: path.join(output, 'localized-long-tabs-add-view.png') });
      await custom.close();
    }
  } finally {
    await browser.close();
  }
})().catch(error => {
  console.error(error);
  process.exitCode = 1;
});
