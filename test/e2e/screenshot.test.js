/* global fixture */
/* eslint jest/no-test-callback: "off" */
/* eslint jest/expect-expect: "off" */

import { Selector } from 'testcafe';

async function hide_devonly(t) {
  // Hide all devonly-elements
  const $hidedevonly = Selector('.hide-devonly');
  for (let i = 0; i < (await $hidedevonly.count); i++) {
    await t.click($hidedevonly.nth(i));
  }
}

async function waitForLoading(t) {
  let $loading;
  console.log('Waiting for loading to disappear...');
  do {
    $loading = Selector('h1', { timeout: 100 }).withText(/.+[Ll]oading.+/g);
    console.log(await $loading.count);
    //$loading = Selector('.loading');
    await t.wait(200);
  } while ((await $loading.count) >= 1);
  console.log('Loading is gone!');
}

fixture(`Home view`).page(`http://localhost:27180/`);

// Log JS errors even if --skip-js-errors is given
// From: https://stackoverflow.com/a/59856422/965332
test.clientScripts({
  content: `
        window.addEventListener('error', function (e) {
            console.error(e.message);
        });`,
})(`Skip error but log it`, async t => {
  console.log(await t.getBrowserConsoleMessages());
});

test('Screenshot the home view', async t => {
  // TODO: Detect CI instead of never resizing
  // For resizeWindow to work tests needs to run with a ICCCM/EWMH-compliant window manager
  // Since CI just runs plain xvfb, it doesn't have that, so we don't.
  // The resolution is the one used by the testcafe-action:
  //   https://github.com/DevExpress/testcafe-action/blob/0989d5f8ad852d71298ce3b770442cdec309d479/index.js#L59-L60
  // await t.resizeWindow(1280, 720);

  await hide_devonly(t);
  await t.takeScreenshot({
    path: 'home.png',
    fullPage: true,
  });
});

fixture(`Activity view`).page(`http://localhost:27180/#/activity/fakedata`);

test('Screenshot the activity view', async t => {
  await hide_devonly(t);
  await waitForLoading(t);

  await t.takeScreenshot({
    path: 'activity.png',
    fullPage: true,
  });

  // TODO: resize to mobile size and take another screenshot
});

fixture(`Timeline view`).page(`http://localhost:27180/#/timeline`);

const durationSelect = Selector('select#duration');
const durationOption = durationSelect.find('option');

test('Screenshot the timeline view', async t => {
  await hide_devonly(t);
  await waitForLoading(t);
  await t
    .click(durationSelect)
    .click(durationOption.withText('12h'))
    .expect(durationSelect.value)
    .eql('43200');

  await t.takeScreenshot({
    path: 'timeline.png',
    fullPage: true,
  });
});

fixture(`Buckets view`).page(`http://localhost:27180/#/buckets/`);

test('Screenshot the buckets view', async t => {
  await hide_devonly(t);
  await t.wait(1000);
  await t.takeScreenshot({
    path: 'buckets.png',
    fullPage: true,
  });
});

fixture(`Setting view`).page(`http://localhost:27180/#/settings/`);

test('Screenshot the settings view', async t => {
  await hide_devonly(t);
  await t.takeScreenshot({
    path: 'settings.png',
    fullPage: true,
  });
});

fixture(`Stopwatch view`).page(`http://localhost:27180/#/stopwatch/`);

test('Screenshot the stopwatch view', async t => {
  await hide_devonly(t);
  await t.takeScreenshot({
    path: 'stopwatch.png',
    fullPage: true,
  });
});
