/* global fixture */
/* eslint jest/no-test-callback: "off" */
/* eslint jest/expect-expect: "off" */

import { Selector } from 'testcafe';

fixture(`My fixture`).page(`http://localhost:27180/#/activity/erb-main2-arch`);

test('Take a screenshot of the activity view', async t => {
  await t
    // TODO: Detect CI instead of never resizing
    // For resizeWindow to work tests needs to run with a ICCCM/EWMH-compliant window manager
    // Since CI just runs plain xvfb, it doesn't have that, so we don't.
    // The resolution is the one used by the testcafe-action:
    //   https://github.com/DevExpress/testcafe-action/blob/0989d5f8ad852d71298ce3b770442cdec309d479/index.js#L59-L60
    //.resizeWindow(1280, 720)
    .click('#load-demo')
    // TODO: Figure out how to click all hide-devonly buttons instead of hardcoding number of clicks
    .click('.hide-devonly')
    .click('.hide-devonly');

  // Closes the 'Network Error' message if running without aw-server
  const $close = Selector('.close');
  if (await $close.exists) {
    await t.click('.close');
  }

  await t.takeScreenshot({
    path: 'activity.png',
    fullPage: true,
  });
});
