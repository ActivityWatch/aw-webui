import router from '~/route';

describe('router', () => {
  test('root redirect uses localStorage landingpage when set', () => {
    const rootRoute = router.options.routes.find(route => route.path === '/');

    localStorage.landingpage = '/work-report';
    expect(rootRoute.redirect({})).toBe('/work-report');
  });

  test('root redirect falls back to /home when localStorage landingpage is missing', () => {
    const rootRoute = router.options.routes.find(route => route.path === '/');

    delete localStorage.landingpage;
    expect(rootRoute.redirect({})).toBe('/home');
  });

  test('includes the work report route', () => {
    const workReportRoute = router.options.routes.find(route => route.path === '/work-report');

    expect(workReportRoute).toBeTruthy();
    expect(typeof workReportRoute.component).toBe('function');
  });
});

describe('activity route host param', () => {
  test.each([
    ['/activity/erb-m2.localdomain/day/2026-09-26', 'erb-m2.localdomain'],
    ['/activity/@all/day/2026-09-26', '@all'],
    ['/activity/host1,host2/week/2026-09-21', 'host1,host2'],
    ['/activity/my%20host/day', 'my host'],
    // list items are encoded twice so a ',' inside a hostname survives
    ['/activity/self,a%252Cb/day', 'self,a%2Cb'],
  ])('%s resolves to the activity view with host %s', (path, host) => {
    const resolved = router.resolve(path + '/view/').route;
    expect(resolved.name).toBe('activity-view');
    expect(resolved.params.host).toBe(host);
  });
});
