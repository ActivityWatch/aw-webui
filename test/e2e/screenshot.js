import { Selector } from 'testcafe';

fixture(`My fixture`).page(`http://localhost:27180/#/activity/erb-main2-arch`);

test('Take a screenshot of the activity view', async t => {
  const width = 1280;
  const height = 800;
  await t
    // For resizeWindow to work tests needs to run with a ICCCM/EWMH-compliant window manager
    .resizeWindow(width, height)
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
