/* global fixture */
/* eslint jest/no-test-callback: "off" */
/* eslint jest/expect-expect: "off" */

import { Selector } from 'testcafe';

const baseURL = 'http://127.0.0.1:27180';

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
  let $loading;
  let matches = 1;

  console.log('Waiting for loading to disappear...');
  const start = new Date();
  do {
    $loading = Selector('.aw-loading, text', { timeout: 500 }).withText(/Loading[.]{3}/g);

    // Useful for debugging:
    matches = await $loading.count;
    if (matches > 0) {
      console.log(`Found ${matches} loading element with contents`); //: ${await $loading.innerText}`);

      // If taking >20s, throw an error
      if (new Date() - start > 20000) {
        throw new Error('Timeout while waiting for loading to disappear');
      }
      await t.wait(500);
    }
  } while (matches >= 1);

  await t.wait(500); // wait an extra 500ms, just in case a visualization is still rendering
  console.log('Loading is gone!');
}

async function checkNoError(t) {
  const $error = Selector('div').withText(/[Ee]rror/g);
  try {
    await t.expect(await $error.count).eql(0);
  } catch (e) {
    console.log('Errors found: ' + $error);
    throw e;
  }
}

fixture(`Home view`).page(baseURL);

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

fixture(`Activity view`).page(`${baseURL}/#/activity/fakedata`);

test('Screenshot the activity view', async t => {
  await hide_devonly(t);
  await waitForLoading(t);
  await checkNoError(t);
  await t.takeScreenshot({
    path: 'activity.png',
    fullPage: true,
  });

  // TODO: resize to mobile size and take another screenshot
});

fixture(`Timeline view`).page(`${baseURL}/#/timeline`);

const durationSelect = Selector('select#duration');
const durationOption = durationSelect.find('option');

test('Screenshot the timeline view', async t => {
  await hide_devonly(t);
  await waitForLoading(t);
  await checkNoError(t);
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

fixture(`Buckets view`).page(`${baseURL}/#/buckets/`);

test('Screenshot the buckets view', async t => {
  await hide_devonly(t);
  await t.wait(1000);
  await checkNoError(t);
  await t.takeScreenshot({
    path: 'buckets.png',
    fullPage: true,
  });
});

fixture(`Setting view`).page(`${baseURL}/#/settings/`);

test('Screenshot the settings view', async t => {
  await hide_devonly(t);
  await checkNoError(t);
  await t.takeScreenshot({
    path: 'settings.png',
    fullPage: true,
  });
});

fixture(`Stopwatch view`).page(`${baseURL}/#/stopwatch/`);

test('Screenshot the stopwatch view', async t => {
  await hide_devonly(t);
  await waitForLoading(t);
  await checkNoError(t);
  await t.takeScreenshot({
    path: 'stopwatch.png',
    fullPage: true,
  });
});
