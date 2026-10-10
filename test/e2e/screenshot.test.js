/* global fixture */
/* eslint jest/no-test-callback: "off" */
/* eslint jest/expect-expect: "off" */

import { Selector } from 'testcafe';
import { RequestLogger } from 'testcafe';

const MAX_REFRESH = 2; // the max number of times to refresh if "Loading..." dosent go away
const REFRESH_TIMEPERIOD = 5000; //ms - refresh page after waiting for this amount of ms for "Loading..." to disappear
const MAX_WAIT_TIME = 20000; //ms - max time to wait for "Loading..." to disappear after all refreshes

const baseURL = 'http://127.0.0.1:27180';
const HTTPLogger = RequestLogger(/^(?:(?!\.js|\.css|\.png|\.woff2).)+$/, {
  logRequestHeaders: true,
  logResponseHeaders: true,
  logRequestBody: true,
  logResponseBody: true,
  stringifyRequestBody: true,
  stringifyResponseBody: true,
});

async function hide_devonly(t) {
  // Hide all devonly-elements
  const $hidedevonly = Selector('.hide-devonly');
  for (let i = 0; i < (await $hidedevonly.count); i++) {
    await t.click($hidedevonly.nth(i));
  }
}

async function waitForLoading(t) {
  // Waits for all "Loading..." texts to disappear from page.
  // If it takes longer than 10s, it will fail.
  let $loading,
    refresh_count = 0;

  console.log('Waiting for loading to disappear...');
  let start = new Date();
  do {
    $loading = await Selector('.aw-loading, text', { timeout: 500 }).withText(/Loading[.]{3}/g)();

    // Useful for debugging:
    if ($loading) {
      console.log(`Found loading element with contents - "${$loading.textContent}"`);

      if (new Date() - start > REFRESH_TIMEPERIOD && refresh_count < MAX_REFRESH) {
        console.log('Refreshing page....');
        await t.eval(() => location.reload(true));
        refresh_count++;
        start = new Date();
      }

      // If taking >20s, throw an error
      if (new Date() - start > MAX_WAIT_TIME && refresh_count >= MAX_REFRESH) {
        console.log(await t.getBrowserConsoleMessages());
        console.log(JSON.stringify(HTTPLogger.requests, null, '\t'));
        throw new Error('Timeout while waiting for loading to disappear');
      }
      await t.wait(500);
    }
  } while ($loading);

  await t.wait(500); // wait an extra 500ms, just in case a visualization is still rendering
  console.log('Loading is gone!');
}

async function checkNoError(t) {
  const $error = Selector('div.alert').withText(/[Ee]rror/g);
  try {
    await t.expect(await $error.count).eql(0);
  } catch (e) {
    console.log('Errors found: ' + (await $error.textContent));
    throw e;
  }
}

async function checkNoHorizontalOverflow(t) {
  await t
    .expect(Selector('html').scrollWidth)
    .lte(await t.eval(() => document.documentElement.clientWidth));
}

// Set theme in both localStorage and the server settings, then reload.
// The settings store (ensureLoaded) gives server values priority over localStorage
// (used.has(key) guard), so localStorage alone cannot override a persisted server
// value. Saving to the API first ensures the reload picks up the requested theme.
async function applyTheme(t, theme) {
  await t.eval(
    () => {
      window.localStorage.setItem('theme', theme);
      // Match createClient()'s default development/test API, not the webui
      // dev server at baseURL, which does not proxy /api requests.
      return fetch('http://127.0.0.1:5666/api/0/settings/theme', {
        method: 'POST',
        headers: { 'Content-Type': 'application/json' },
        body: JSON.stringify(theme),
      }).then(response => {
        if (!response.ok) {
          throw new Error(`Saving screenshot theme failed: HTTP ${response.status}`);
        }
      });
    },
    { dependencies: { theme } }
  );
  await t.eval(() => location.reload(true));
  // App.vue only renders the wrapper after settings have loaded and the theme
  // link has been applied. Wait for that, not a fixed delay that can race startup.
  await t.expect(Selector('#wrapper').visible).ok();
  const darkStylesheet = Selector('head link[href="/dark.css"]').addCustomDOMProperties({
    loaded: link => !!link.sheet,
  });
  await t.expect(darkStylesheet.exists).eql(theme === 'dark');
  if (theme === 'dark') {
    await t.expect(darkStylesheet.loaded).ok();
  }
}

const logJsErrorCode = `
  window.addEventListener('error', function (e) {
      console.error(e.message);
  });`;

// ─── Home view ─────────────────────────────────────────────────────────────
// 4-cell matrix: light/dark × desktop/mobile (360×800)

fixture(`Home view`).page(baseURL);

// Log JS errors even if --skip-js-errors is given
// From: https://stackoverflow.com/a/59856422/965332
test.clientScripts({
  content: logJsErrorCode,
})(`Skip error but log it`, async t => {
  console.log(await t.getBrowserConsoleMessages());
});

test('Screenshot home: light desktop', async t => {
  await applyTheme(t, 'light');
  await hide_devonly(t);
  await t.takeScreenshot({
    path: 'home.png',
    fullPage: true,
  });
});

test('Screenshot home: dark desktop', async t => {
  await applyTheme(t, 'dark');
  await hide_devonly(t);
  await t.takeScreenshot({
    path: 'home-dark.png',
    fullPage: true,
  });
});

test('Screenshot home: light mobile', async t => {
  await applyTheme(t, 'light');
  await t.resizeWindow(360, 800);
  await hide_devonly(t);
  await t.takeScreenshot({
    path: 'home-mobile.png',
    fullPage: true,
  });
});

test('Screenshot home: dark mobile', async t => {
  await applyTheme(t, 'dark');
  await t.resizeWindow(360, 800);
  await hide_devonly(t);
  await t.takeScreenshot({
    path: 'home-dark-mobile.png',
    fullPage: true,
  });
});

// Dark drawer: click the toggle so the side-drawer appears in the dark screenshot.
// This is the regression the matrix exists to catch — a dark-mode drawer styling
// defect is invisible in any capture that never opens the drawer.
test('Screenshot home: dark mobile drawer open', async t => {
  await applyTheme(t, 'dark');
  await t.resizeWindow(360, 800);
  await hide_devonly(t);
  await t.click(Selector('[data-testid="nav-drawer-toggle"]'));
  await t.expect(Selector('[data-testid="nav-drawer"]').visible).ok({ timeout: 3000 });
  await t.takeScreenshot({
    path: 'home-dark-mobile-drawer.png',
    fullPage: true,
  });
});

// ─── Activity view ──────────────────────────────────────────────────────────
// 4-cell matrix: light/dark × desktop/mobile

fixture(`Activity view`).page(`${baseURL}/#/activity/fakedata`).requestHooks(HTTPLogger);

test.clientScripts({
  content: logJsErrorCode,
})('Screenshot activity: light desktop', async t => {
  await applyTheme(t, 'light');
  await hide_devonly(t);
  await waitForLoading(t);
  await t.takeScreenshot({
    path: 'activity.png',
    fullPage: true,
  });
  await checkNoError(t);
});

test.clientScripts({
  content: logJsErrorCode,
})('Screenshot activity: dark desktop', async t => {
  await applyTheme(t, 'dark');
  await hide_devonly(t);
  await waitForLoading(t);
  await t.takeScreenshot({
    path: 'activity-dark.png',
    fullPage: true,
  });
  await checkNoError(t);
});

test.clientScripts({
  content: logJsErrorCode,
})('Screenshot activity: light mobile', async t => {
  await applyTheme(t, 'light');
  await t.resizeWindow(360, 800);
  await hide_devonly(t);
  await waitForLoading(t);
  await t.takeScreenshot({
    path: 'activity-mobile.png',
    fullPage: true,
  });
  await checkNoError(t);
});

test.clientScripts({
  content: logJsErrorCode,
})('Screenshot activity: dark mobile', async t => {
  await applyTheme(t, 'dark');
  await t.resizeWindow(360, 800);
  await hide_devonly(t);
  await waitForLoading(t);
  await t.takeScreenshot({
    path: 'activity-dark-mobile.png',
    fullPage: true,
  });
  await checkNoError(t);
});

// ─── Timeline view ──────────────────────────────────────────────────────────
// Kept as a single fixture; the mobile-overflow test already covers the mobile
// layout assertion, and timeline-initial.png captures the loading state.

fixture(`Timeline view`)
  .page(`${baseURL}/#/timeline`)
  .requestHooks(HTTPLogger)
  .beforeEach(async t => {
    // Matrix tests persist their theme on the server; keep Timeline captures light.
    await applyTheme(t, 'light');
  });

test.clientScripts({
  content: logJsErrorCode,
})('Screenshot the timeline view', async t => {
  await hide_devonly(t);
  await t.takeScreenshot({
    path: 'timeline-initial.png',
    fullPage: true,
  });
  await waitForLoading(t);
  await t
    .click(Selector('label').withText('12h'))
    .expect(Selector('input[value="43200"]').checked)
    .eql(true);

  await t.takeScreenshot({
    path: 'timeline.png',
    fullPage: true,
  });
  await checkNoError(t);
});

test('Timeline has no horizontal page overflow on mobile', async t => {
  await t.resizeWindow(360, 800);
  await hide_devonly(t);
  await waitForLoading(t);
  await checkNoHorizontalOverflow(t);

  // Debugging
  // console.log(await t.getBrowserConsoleMessages());
  // console.log(JSON.stringify(HTTPLogger.requests, null, '\t'));
});

// ─── Buckets view ───────────────────────────────────────────────────────────
// 4-cell matrix: light/dark × desktop/mobile

fixture(`Buckets view`).page(`${baseURL}/#/buckets/`).requestHooks(HTTPLogger);

test.clientScripts({
  content: logJsErrorCode,
})('Screenshot buckets: light desktop', async t => {
  await applyTheme(t, 'light');
  await hide_devonly(t);
  await t.wait(1000);
  await t.takeScreenshot({
    path: 'buckets.png',
    fullPage: true,
  });
  await checkNoError(t);
});

test.clientScripts({
  content: logJsErrorCode,
})('Screenshot buckets: dark desktop', async t => {
  await applyTheme(t, 'dark');
  await hide_devonly(t);
  await t.wait(1000);
  await t.takeScreenshot({
    path: 'buckets-dark.png',
    fullPage: true,
  });
  await checkNoError(t);
});

test('Buckets have no horizontal page overflow on mobile', async t => {
  await t.resizeWindow(360, 800);
  await hide_devonly(t);
  await t.wait(1000);
  await checkNoHorizontalOverflow(t);
});

test.clientScripts({
  content: logJsErrorCode,
})('Screenshot buckets: light mobile', async t => {
  await applyTheme(t, 'light');
  await t.resizeWindow(360, 800);
  await hide_devonly(t);
  await t.wait(1000);
  await t.takeScreenshot({
    path: 'buckets-mobile.png',
    fullPage: true,
  });
  await checkNoError(t);
});

test.clientScripts({
  content: logJsErrorCode,
})('Screenshot buckets: dark mobile', async t => {
  await applyTheme(t, 'dark');
  await t.resizeWindow(360, 800);
  await hide_devonly(t);
  await t.wait(1000);
  await t.takeScreenshot({
    path: 'buckets-dark-mobile.png',
    fullPage: true,
  });
  await checkNoError(t);
});

// ─── Settings view ──────────────────────────────────────────────────────────
// 4-cell matrix: light/dark × desktop/mobile

fixture(`Settings view`).page(`${baseURL}/#/settings/`).requestHooks(HTTPLogger);

test.clientScripts({
  content: logJsErrorCode,
})('Screenshot settings: light desktop', async t => {
  await applyTheme(t, 'light');
  await hide_devonly(t);
  await t.takeScreenshot({
    path: 'settings.png',
    fullPage: true,
  });
  await checkNoError(t);
});

test.clientScripts({
  content: logJsErrorCode,
})('Screenshot settings: dark desktop', async t => {
  await applyTheme(t, 'dark');
  await hide_devonly(t);
  await t.takeScreenshot({
    path: 'settings-dark.png',
    fullPage: true,
  });
  await checkNoError(t);
});

test.clientScripts({
  content: logJsErrorCode,
})('Screenshot settings: light mobile', async t => {
  await applyTheme(t, 'light');
  await t.resizeWindow(360, 800);
  await hide_devonly(t);
  await t.takeScreenshot({
    path: 'settings-mobile.png',
    fullPage: true,
  });
  await checkNoError(t);
});

test.clientScripts({
  content: logJsErrorCode,
})('Screenshot settings: dark mobile', async t => {
  await applyTheme(t, 'dark');
  await t.resizeWindow(360, 800);
  await hide_devonly(t);
  await t.takeScreenshot({
    path: 'settings-dark-mobile.png',
    fullPage: true,
  });
  await checkNoError(t);
});

// ─── Stopwatch view ─────────────────────────────────────────────────────────
// 4-cell matrix: light/dark × desktop/mobile

fixture(`Stopwatch view`).page(`${baseURL}/#/stopwatch/`).requestHooks(HTTPLogger);

test.clientScripts({
  content: logJsErrorCode,
})('Screenshot stopwatch: light desktop', async t => {
  await applyTheme(t, 'light');
  await hide_devonly(t);
  await waitForLoading(t);
  await t.takeScreenshot({
    path: 'stopwatch.png',
    fullPage: true,
  });
  await checkNoError(t);
});

test.clientScripts({
  content: logJsErrorCode,
})('Screenshot stopwatch: dark desktop', async t => {
  await applyTheme(t, 'dark');
  await hide_devonly(t);
  await waitForLoading(t);
  await t.takeScreenshot({
    path: 'stopwatch-dark.png',
    fullPage: true,
  });
  await checkNoError(t);
});

test.clientScripts({
  content: logJsErrorCode,
})('Screenshot stopwatch: light mobile', async t => {
  await applyTheme(t, 'light');
  await t.resizeWindow(360, 800);
  await hide_devonly(t);
  await waitForLoading(t);
  await t.takeScreenshot({
    path: 'stopwatch-mobile.png',
    fullPage: true,
  });
  await checkNoError(t);
});

test.clientScripts({
  content: logJsErrorCode,
})('Screenshot stopwatch: dark mobile', async t => {
  await applyTheme(t, 'dark');
  await t.resizeWindow(360, 800);
  await hide_devonly(t);
  await waitForLoading(t);
  await t.takeScreenshot({
    path: 'stopwatch-dark-mobile.png',
    fullPage: true,
  });
  await checkNoError(t);
});
