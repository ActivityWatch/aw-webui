import { activityDiagnostic } from '~/util/activityDiagnostics';

const bucket = (id: string, hostname: string, type: string) => ({ id, hostname, type });

describe('activityDiagnostic', () => {
  test('reports a missing window bucket for the selected host', () => {
    expect(
      activityDiagnostic({
        host: 'laptop',
        buckets: [bucket('aw-watcher-window_other', 'other', 'currentwindow')],
        isMultidevice: false,
        queryComplete: true,
        windowDuration: 0,
      })
    ).toEqual({ kind: 'missing-window', host: 'laptop' });
  });

  test('reports a missing AFK bucket for a desktop host', () => {
    expect(
      activityDiagnostic({
        host: 'laptop',
        buckets: [bucket('aw-watcher-window_laptop', 'laptop', 'currentwindow')],
        isMultidevice: false,
        queryComplete: true,
        windowDuration: 0,
      })
    ).toEqual({ kind: 'missing-afk', host: 'laptop' });
  });

  test('reports hostname variants before blaming an empty query', () => {
    expect(
      activityDiagnostic({
        host: 'laptop',
        buckets: [
          bucket('aw-watcher-window_laptop', 'laptop', 'currentwindow'),
          bucket('aw-watcher-window_laptop.local', 'laptop.local', 'currentwindow'),
          bucket('aw-watcher-afk_laptop', 'laptop', 'afkstatus'),
        ],
        isMultidevice: false,
        queryComplete: true,
        windowDuration: 0,
      })
    ).toEqual({
      kind: 'ambiguous-window',
      host: 'laptop',
      bucketIds: ['aw-watcher-window_laptop', 'aw-watcher-window_laptop.local'],
    });
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
        queryComplete: true,
        windowDuration: 0,
      })
    ).toEqual({ kind: 'no-window-events', host: 'laptop' });
  });

  test('stays quiet while loading, with data, and for multidevice queries', () => {
    const input = {
      host: 'laptop',
      buckets: [
        bucket('aw-watcher-window_laptop', 'laptop', 'currentwindow'),
        bucket('aw-watcher-afk_laptop', 'laptop', 'afkstatus'),
      ],
      isMultidevice: false,
      queryComplete: true,
      windowDuration: 30,
    };
    expect(activityDiagnostic(input)).toBeNull();
    expect(activityDiagnostic({ ...input, queryComplete: false, windowDuration: 0 })).toBeNull();
    expect(activityDiagnostic({ ...input, isMultidevice: true, windowDuration: 0 })).toBeNull();
  });
});
