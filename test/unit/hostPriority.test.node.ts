import { orderMultideviceHosts } from '~/util/multidevice';

const windowBuckets = (h: string) => (h.startsWith('desktop') ? [`aw-watcher-window_${h}`] : []);
const afkBuckets = (h: string) => (h.startsWith('desktop') ? [`aw-watcher-afk_${h}`] : []);
const mobileBuckets = (h: string) =>
  h === 'phone' ? ['aw-watcher-android_phone'] : h === 'import' ? ['screentime-import'] : [];
const order = (hosts: string[], saved: string[] = []) =>
  orderMultideviceHosts(hosts, saved, windowBuckets, afkBuckets, mobileBuckets);

describe('multi-device overlap priority', () => {
  test('defaults to desktops then phones then imports, alphabetical within a type', () => {
    expect(order(['import', 'desktop-z', 'phone', 'desktop-a'])).toEqual([
      'desktop-a',
      'desktop-z',
      'phone',
      'import',
    ]);
    expect(order(['phone', 'desktop-a', 'import', 'desktop-z'])).toEqual(
      order(['import', 'desktop-z', 'phone', 'desktop-a'])
    );
  });

  test('saved priority wins and newly discovered hosts follow deterministic defaults', () => {
    expect(
      order(['import', 'desktop-z', 'phone', 'desktop-a'], ['phone', 'gone', 'desktop-z', 'phone'])
    ).toEqual(['phone', 'desktop-z', 'desktop-a', 'import']);
  });

  test('ordering never adds deselected or missing hosts or mutates settings', () => {
    const saved = ['phone', 'gone', 'desktop-z'];
    const hosts = ['desktop-a', 'desktop-z'];
    expect(order(hosts, saved)).toEqual(['desktop-z', 'desktop-a']);
    expect(hosts).toEqual(['desktop-a', 'desktop-z']);
    expect(saved).toEqual(['phone', 'gone', 'desktop-z']);
    expect(order([], saved)).toEqual([]);
  });
});
