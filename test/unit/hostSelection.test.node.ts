import {
  ALL_DEVICES,
  eligibleMultideviceHosts,
  formatHostParam,
  isMultiHostSelection,
  parseHostParam,
  resolveHostSelection,
  toggleHostInSelection,
} from '~/util/multidevice';

describe('parseHostParam', () => {
  it('parses a single hostname unchanged', () => {
    expect(parseHostParam('erb-m2.localdomain')).toEqual({
      all: false,
      hosts: ['erb-m2.localdomain'],
    });
  });

  it('parses the all-devices token', () => {
    expect(parseHostParam(ALL_DEVICES)).toEqual({ all: true, hosts: [] });
    expect(parseHostParam('@all')).toEqual({ all: true, hosts: [] });
  });

  it('parses a comma-separated host list, trimming and deduplicating', () => {
    expect(parseHostParam('a, b,,a,c')).toEqual({ all: false, hosts: ['a', 'b', 'c'] });
  });

  it('treats a param matching a known hostname as that single host', () => {
    // A hostname containing the separator still works as a single-host URL
    expect(parseHostParam('weird,host', ['weird,host', 'other'])).toEqual({
      all: false,
      hosts: ['weird,host'],
    });
  });

  it('reaches a real host named like the all-devices token via its escaped form', () => {
    const known = ['@all', 'other'];
    const segment = formatHostParam(['@all']);
    expect(segment).toBe('%2540all');
    // the router decodes the path segment once
    expect(parseHostParam(decodeURIComponent(segment), known)).toEqual({
      all: false,
      hosts: ['@all'],
    });
    // the bare token still means all devices
    expect(parseHostParam('@all', known)).toEqual({ all: true, hosts: [] });
  });

  it('prefers a list of known hosts over a known host spelled the same', () => {
    const known = ['a', 'b', 'a,b'];
    expect(parseHostParam('a,b', known)).toEqual({ all: false, hosts: ['a', 'b'] });
    // the single host 'a,b' is linked in escaped form and stays reachable
    const segment = formatHostParam(['a,b']);
    expect(segment).toBe('a%252Cb');
    expect(parseHostParam(decodeURIComponent(segment), known)).toEqual({
      all: false,
      hosts: ['a,b'],
    });
  });

  it('keeps old raw single-host links to comma hostnames working', () => {
    const ios = "ios-('2E78DD6E-FD7B-53E9-978E-F7FFF3EB8701', None)";
    expect(parseHostParam(ios, [ios, 'self'])).toEqual({ all: false, hosts: [ios] });
  });

  it('does not decode an unknown single host', () => {
    expect(parseHostParam('50%25off', [])).toEqual({ all: false, hosts: ['50%25off'] });
  });

  it('handles an empty param', () => {
    expect(parseHostParam('')).toEqual({ all: false, hosts: [] });
  });
});

describe('formatHostParam', () => {
  // The router decodes the path segment once before it becomes the param
  const roundTrip = (hosts: string[], known: string[] = []) =>
    parseHostParam(decodeURIComponent(formatHostParam(hosts)), known);

  it('round-trips through parseHostParam', () => {
    for (const param of ['myhost', 'a,b', ALL_DEVICES]) {
      expect(formatHostParam(parseHostParam(param))).toBe(param);
    }
  });

  it('accepts a plain host list', () => {
    expect(formatHostParam(['a', 'b'])).toBe('a,b');
  });

  it('keeps ordinary hostnames verbatim (existing URLs are unchanged)', () => {
    expect(formatHostParam(['erb-m2.localdomain'])).toBe('erb-m2.localdomain');
    expect(formatHostParam(['poco_f8_ultra'])).toBe('poco_f8_ultra');
    expect(formatHostParam(['erb-m2.localdomain', 'poco_f8_ultra'])).toBe(
      'erb-m2.localdomain,poco_f8_ultra'
    );
  });

  it('URI-encodes characters that would break the route', () => {
    expect(formatHostParam(['my host/1'])).toBe('my%20host%2F1');
    expect(roundTrip(['my host/1', 'a#b']).hosts).toEqual(['my host/1', 'a#b']);
  });

  it('round-trips hostnames containing the separator', () => {
    // Real-world example: hostnames of iOS ScreenTime imports
    const ios = "ios-('2E78DD6E-FD7B-53E9-978E-F7FFF3EB8701', None)";
    expect(roundTrip([ios], [ios]).hosts).toEqual([ios]);
    expect(roundTrip(['self', ios], [ios, 'self']).hosts).toEqual(['self', ios]);
    expect(roundTrip(['a%b', 'c,d']).hosts).toEqual(['a%b', 'c,d']);
  });
});

describe('isMultiHostSelection', () => {
  it('is true for all devices and for several hosts only', () => {
    expect(isMultiHostSelection({ all: true, hosts: [] })).toBe(true);
    expect(isMultiHostSelection({ all: false, hosts: ['a', 'b'] })).toBe(true);
    expect(isMultiHostSelection({ all: false, hosts: ['a'] })).toBe(false);
  });
});

describe('resolveHostSelection', () => {
  const eligible = ['self', 'laptop', 'phone'];

  it('resolves all devices to every eligible host', () => {
    expect(resolveHostSelection({ all: true, hosts: [] }, eligible)).toEqual(eligible);
  });

  it('orders an explicit list by host priority, not URL order', () => {
    expect(resolveHostSelection({ all: false, hosts: ['phone', 'self'] }, eligible)).toEqual([
      'self',
      'phone',
    ]);
  });

  it('drops hosts without usable buckets from a multi-host list', () => {
    expect(resolveHostSelection({ all: false, hosts: ['phone', 'gone'] }, eligible)).toEqual([
      'phone',
    ]);
  });

  it('keeps a single host as-is', () => {
    expect(resolveHostSelection({ all: false, hosts: ['gone'] }, eligible)).toEqual(['gone']);
  });
});

describe('toggleHostInSelection', () => {
  const eligible = ['self', 'laptop', 'phone'];

  it('adds a host to a single-host selection', () => {
    expect(toggleHostInSelection({ all: false, hosts: ['phone'] }, 'self', eligible)).toEqual({
      all: false,
      hosts: ['self', 'phone'],
    });
  });

  it('removes a host from all devices', () => {
    expect(toggleHostInSelection({ all: true, hosts: [] }, 'laptop', eligible)).toEqual({
      all: false,
      hosts: ['self', 'phone'],
    });
  });

  it('becomes all devices once every host is selected', () => {
    expect(
      toggleHostInSelection({ all: false, hosts: ['self', 'phone'] }, 'laptop', eligible)
    ).toEqual({ all: true, hosts: [] });
  });

  it('never deselects the last host', () => {
    const sel = { all: false, hosts: ['self'] };
    expect(toggleHostInSelection(sel, 'self', eligible)).toBe(sel);
  });
});

describe('eligibleMultideviceHosts', () => {
  const windowBuckets: Record<string, string[]> = {
    self: ['aw-watcher-window_self'],
    synced: ['aw-watcher-window_synced-synced-from-synced'],
    noafk: ['aw-watcher-window_noafk'],
    fakedata: ['aw-watcher-window_fakedata'],
    unknown: ['aw-watcher-window_unknown'],
  };
  const afk: Record<string, string[]> = {
    self: ['aw-watcher-afk_self'],
    synced: ['aw-watcher-afk_synced-synced-from-synced'],
    fakedata: ['aw-watcher-afk_fakedata'],
    unknown: ['aw-watcher-afk_unknown'],
  };
  const android: Record<string, string[]> = {
    phone: ['aw-watcher-android-test-synced-from-phone'],
  };
  const hosts = ['self', 'synced', 'noafk', 'phone', 'fakedata', 'unknown', ''];
  const f = (m: Record<string, string[]>) => (h: string) => m[h] || [];

  it('includes desktop (incl. synced) and mobile hosts, preserving order', () => {
    expect(eligibleMultideviceHosts(hosts, f(windowBuckets), f(afk), f(android))).toEqual([
      'self',
      'synced',
      'phone',
    ]);
  });

  it('includes fakedata hosts only on request', () => {
    expect(
      eligibleMultideviceHosts(hosts, f(windowBuckets), f(afk), f(android), {
        includeFakedata: true,
      })
    ).toContain('fakedata');
  });
});
