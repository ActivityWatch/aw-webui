import { activityDiagnostic } from '~/util/activityDiagnostics';

const bucket = (id: string, hostname: string, type: string) => ({ id, hostname, type });

describe('activityDiagnostic', () => {
  test('reports a missing window bucket for the selected host', () => {
    expect(
      activityDiagnostic({
        host: 'laptop',
        buckets: [bucket('aw-watcher-window_other', 'other', 'currentwindow')],
        isMultidevice: false,
        isMobile: false,
        queryComplete: true,
        rawWindowDuration: 0,
      })
    ).toEqual({ kind: 'missing-window', host: 'laptop' });
  });

  test('reports a missing AFK bucket for a desktop host', () => {
    expect(
      activityDiagnostic({
        host: 'laptop',
        buckets: [bucket('aw-watcher-window_laptop', 'laptop', 'currentwindow')],
        isMultidevice: false,
        isMobile: false,
        queryComplete: true,
        rawWindowDuration: 0,
      })
    ).toEqual({ kind: 'missing-afk', host: 'laptop' });
  });

  test('reports missing AFK before hostname variants when both apply', () => {
    // Without an afkstatus bucket set_available keeps the Activity query from
    // running, so the duplicate window buckets cannot be what hides the data;
    // the missing watcher is the actual cause and must win the ordering.
    expect(
      activityDiagnostic({
        host: 'laptop',
        buckets: [
          bucket('aw-watcher-window_laptop', 'laptop', 'currentwindow'),
          bucket('aw-watcher-window_laptop.local', 'laptop.local', 'currentwindow'),
        ],
        isMultidevice: false,
        isMobile: false,
        queryComplete: true,
        rawWindowDuration: 0,
      })
    ).toEqual({ kind: 'missing-afk', host: 'laptop' });
  });

  test('reports missing AFK when no exact window bucket and no AFK watcher for device', () => {
    // "laptop.local" window bucket exists but no AFK watcher at all: choosing
    // the "laptop.local" device variant still won't fix the blank view because
    // set_available needs an afkstatus bucket. Report the watcher as missing,
    // under the hostname the window watcher reports as.
    expect(
      activityDiagnostic({
        host: 'laptop',
        buckets: [bucket('aw-watcher-window_laptop.local', 'laptop.local', 'currentwindow')],
        isMultidevice: false,
        isMobile: false,
        queryComplete: true,
        rawWindowDuration: 0,
      })
    ).toEqual({ kind: 'missing-afk', host: 'laptop.local' });
  });

  test('reports mismatched hostnames when no variant has a complete bucket pair', () => {
    // Window only under "laptop.local", AFK only under "laptop": neither
    // selection gives the exact-host query both buckets, so suggesting a
    // variant or a watcher start would leave the view blank.
    expect(
      activityDiagnostic({
        host: 'laptop',
        buckets: [
          bucket('aw-watcher-window_laptop.local', 'laptop.local', 'currentwindow'),
          bucket('aw-watcher-afk_laptop', 'laptop', 'afkstatus'),
        ],
        isMultidevice: false,
        isMobile: false,
        queryComplete: true,
        rawWindowDuration: 0,
      })
    ).toEqual({
      kind: 'mismatched-hostnames',
      host: 'laptop',
      windowHosts: ['laptop.local'],
      afkHosts: ['laptop'],
    });
  });

  test('reports mismatched hostnames when the AFK watcher runs under another variant', () => {
    expect(
      activityDiagnostic({
        host: 'laptop',
        buckets: [
          bucket('aw-watcher-window_laptop', 'laptop', 'currentwindow'),
          bucket('aw-watcher-afk_laptop.local', 'laptop.local', 'afkstatus'),
        ],
        isMultidevice: false,
        isMobile: false,
        queryComplete: true,
        rawWindowDuration: 0,
      })
    ).toEqual({
      kind: 'mismatched-hostnames',
      host: 'laptop',
      windowHosts: ['laptop'],
      afkHosts: ['laptop.local'],
    });
  });

  test('points at a paired variant when the selected host lacks an AFK bucket', () => {
    expect(
      activityDiagnostic({
        host: 'laptop',
        buckets: [
          bucket('aw-watcher-window_laptop', 'laptop', 'currentwindow'),
          bucket('aw-watcher-window_laptop.local', 'laptop.local', 'currentwindow'),
          bucket('aw-watcher-afk_laptop.local', 'laptop.local', 'afkstatus'),
        ],
        isMultidevice: false,
        isMobile: false,
        queryComplete: true,
        rawWindowDuration: 0,
      })
    ).toEqual({
      kind: 'ambiguous-window',
      host: 'laptop',
      bucketIds: ['aw-watcher-window_laptop.local'],
    });
  });

  test('points at hostname variants when the selected host has no exact bucket', () => {
    // The exact-match query cannot see "laptop.local" when "laptop" is
    // selected, so the view is blank; the fix is to choose the variant, not to
    // start a watcher that is already running. AFK must also be present (as a
    // .local variant) so that selecting the right device will actually fix it.
    expect(
      activityDiagnostic({
        host: 'laptop',
        buckets: [
          bucket('aw-watcher-window_laptop.local', 'laptop.local', 'currentwindow'),
          bucket('aw-watcher-afk_laptop.local', 'laptop.local', 'afkstatus'),
        ],
        isMultidevice: false,
        isMobile: false,
        queryComplete: true,
        rawWindowDuration: 0,
      })
    ).toEqual({
      kind: 'ambiguous-window',
      host: 'laptop',
      bucketIds: ['aw-watcher-window_laptop.local'],
    });
  });

  test('reports hostname variants only when there is no window activity', () => {
    expect(
      activityDiagnostic({
        host: 'laptop',
        buckets: [
          bucket('aw-watcher-window_laptop', 'laptop', 'currentwindow'),
          bucket('aw-watcher-window_laptop.local', 'laptop.local', 'currentwindow'),
          bucket('aw-watcher-afk_laptop', 'laptop', 'afkstatus'),
          bucket('aw-watcher-afk_laptop.local', 'laptop.local', 'afkstatus'),
        ],
        isMultidevice: false,
        isMobile: false,
        queryComplete: true,
        rawWindowDuration: 0,
      })
    ).toEqual({
      kind: 'ambiguous-window',
      host: 'laptop',
      bucketIds: ['aw-watcher-window_laptop', 'aw-watcher-window_laptop.local'],
    });
  });

  test('stays quiet on a populated view even with hostname variants', () => {
    expect(
      activityDiagnostic({
        host: 'laptop',
        buckets: [
          bucket('aw-watcher-window_laptop', 'laptop', 'currentwindow'),
          bucket('aw-watcher-window_laptop.local', 'laptop.local', 'currentwindow'),
          bucket('aw-watcher-afk_laptop', 'laptop', 'afkstatus'),
        ],
        isMultidevice: false,
        isMobile: false,
        queryComplete: true,
        rawWindowDuration: 42,
      })
    ).toBeNull();
  });

  test('does not call a filtered-empty period missing', () => {
    // The user was AFK or picked an empty category: the filtered active time
    // is zero, but the window bucket still holds events for the period.
    expect(
      activityDiagnostic({
        host: 'laptop',
        buckets: [
          bucket('aw-watcher-window_laptop', 'laptop', 'currentwindow'),
          bucket('aw-watcher-afk_laptop', 'laptop', 'afkstatus'),
        ],
        isMultidevice: false,
        isMobile: false,
        queryComplete: true,
        rawWindowDuration: 120,
      })
    ).toBeNull();
  });

  test('does not point at a variant that has no AFK bucket of its own', () => {
    // Selecting "laptop.local" would be just as blank, so the empty period is
    // reported as such instead of sending the user to that variant.
    expect(
      activityDiagnostic({
        host: 'laptop',
        buckets: [
          bucket('aw-watcher-window_laptop', 'laptop', 'currentwindow'),
          bucket('aw-watcher-window_laptop.local', 'laptop.local', 'currentwindow'),
          bucket('aw-watcher-afk_laptop', 'laptop', 'afkstatus'),
        ],
        isMultidevice: false,
        isMobile: false,
        queryComplete: true,
        rawWindowDuration: 0,
      })
    ).toEqual({ kind: 'no-window-events', host: 'laptop' });
  });

  test('reports an empty selected period after a complete desktop query', () => {
    expect(
      activityDiagnostic({
        host: 'laptop',
        buckets: [
          bucket('aw-watcher-window_laptop', 'laptop', 'currentwindow'),
          bucket('aw-watcher-afk_laptop', 'laptop', 'afkstatus'),
          bucket('aw-watcher-window_other', 'other', 'currentwindow'),
        ],
        isMultidevice: false,
        isMobile: false,
        queryComplete: true,
        rawWindowDuration: 0,
      })
    ).toEqual({ kind: 'no-window-events', host: 'laptop' });
  });

  test('stays quiet for mobile hosts', () => {
    // Android/iOS hosts have no afkstatus or currentwindow bucket, so the
    // desktop checks would demand watchers the user cannot run.
    expect(
      activityDiagnostic({
        host: 'phone',
        buckets: [bucket('aw-watcher-android_phone', 'phone', 'currentwindow')],
        isMultidevice: false,
        isMobile: true,
        queryComplete: true,
        rawWindowDuration: 0,
      })
    ).toBeNull();
  });

  test('stays quiet while loading, with data, and for multidevice queries', () => {
    const input = {
      host: 'laptop',
      buckets: [
        bucket('aw-watcher-window_laptop', 'laptop', 'currentwindow'),
        bucket('aw-watcher-afk_laptop', 'laptop', 'afkstatus'),
      ],
      isMultidevice: false,
      isMobile: false,
      queryComplete: true,
      rawWindowDuration: 30,
    };
    expect(activityDiagnostic(input)).toBeNull();
    expect(activityDiagnostic({ ...input, queryComplete: false, rawWindowDuration: 0 })).toBeNull();
    expect(activityDiagnostic({ ...input, isMultidevice: true, rawWindowDuration: 0 })).toBeNull();
  });
});
