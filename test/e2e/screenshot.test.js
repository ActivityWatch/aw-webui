/* global fixture */
/* eslint jest/no-test-callback: "off" */
/* eslint jest/expect-expect: "off" */

import { Selector } from 'testcafe';

fixture(`Home view`).page(`http://localhost:27180/`);

test('Screenshot the home view', async t => {
  // TODO: Detect CI instead of never resizing
  // For resizeWindow to work tests needs to run with a ICCCM/EWMH-compliant window manager
  // Since CI just runs plain xvfb, it doesn't have that, so we don't.
  // The resolution is the one used by the testcafe-action:
  //   https://github.com/DevExpress/testcafe-action/blob/0989d5f8ad852d71298ce3b770442cdec309d479/index.js#L59-L60
  // await t.resizeWindow(1280, 720);

  // Hide all devonly-elements
  const $hidedevonly = Selector('.hide-devonly');
  for (let i = 0; i < $hidedevonly.count; i++) {
    await t.click($hidedevonly.nth(i));
  }

  await t.takeScreenshot({
    path: 'home.png',
    fullPage: true,
  });
});

fixture(`Activity view`).page(`http://localhost:27180/#/activity/fakedata`);

test('Screenshot the activity view', async t => {
  // Hide all devonly-elements
  const $hidedevonly = Selector('.hide-devonly');
  for (let i = 0; i < $hidedevonly.count; i++) {
    await t.click($hidedevonly.nth(i));
  }

  await t.takeScreenshot({
    path: 'activity.png',
    fullPage: true,
  });
});

fixture(`Timeline view`).page(`http://localhost:27180/#/timeline`);

test('Screenshot the timeline view', async t => {
  // TODO: Detect CI instead of never resizing
  // For resizeWindow to work tests needs to run with a ICCCM/EWMH-compliant window manager
  // Since CI just runs plain xvfb, it doesn't have that, so we don't.
  // The resolution is the one used by the testcafe-action:
  //   https://github.com/DevExpress/testcafe-action/blob/0989d5f8ad852d71298ce3b770442cdec309d479/index.js#L59-L60
  await t.resizeWindow(1280, 720);

  // Hide all devonly-elements
  const $hidedevonly = Selector('.hide-devonly');
  for (let i = 0; i < $hidedevonly.count; i++) {
    await t.click($hidedevonly.nth(i));
  }

  await t.takeScreenshot({
    path: 'timeline.png',
    fullPage: true,
  });
});
