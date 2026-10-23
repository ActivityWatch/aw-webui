import router from '~/route';

const routes: any[] = router.options.routes;

describe('router', () => {
  test('root redirect uses localStorage landingpage when set', () => {
    const rootRoute = routes.find(route => route.path === '/');

    localStorage.landingpage = '/work-report';
    expect(rootRoute.redirect({})).toBe('/work-report');
  });

  test('root redirect falls back to /home when localStorage landingpage is missing', () => {
    const rootRoute = routes.find(route => route.path === '/');

    delete localStorage.landingpage;
    expect(rootRoute.redirect({})).toBe('/home');
  });

  test('opens Category Builder as a standalone page and redirects its legacy URL', () => {
    const builderRoute = router.options.routes.find(route => route.path === '/category-builder');

    expect(builderRoute).toBeTruthy();
    expect(typeof (builderRoute as any).component).toBe('function');
    expect(router.resolve('/settings/category-builder').route.path).toBe('/category-builder');
    expect(router.resolve('/settings/categorization').route.path).toBe('/settings/categorization');
  });

  test('includes the work report route', () => {
    const workReportRoute = routes.find(route => route.path === '/work-report');

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

describe('activity route exact interval segment', () => {
  test.each([
    '2026-10-20T13:00:00Z..2026-10-20T14:30:00Z',
    '2026-10-20T15:00:00+02:00..2026-10-20T16:30:00+02:00',
  ])('%s survives path resolution and URI encoding unchanged', segment => {
    for (const path of [
      `/activity/host/interval/${segment}/view/`,
      `/activity/host/interval/${encodeURIComponent(segment)}/view/`,
    ]) {
      const resolved = router.resolve(path).route;
      expect(resolved.name).toBe('activity-view');
      expect(resolved.params.periodLength).toBe('interval');
      expect(resolved.params.date).toBe(segment);
    }
  });
});
