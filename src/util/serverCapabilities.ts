// Server features the webui can use only when the connected server provides
// them. Each flag defaults to the safe (oldest supported server) value and is
// turned on by a one-time probe at startup (see stores/server.ts).
//
// Kept dependency-free so pure modules like queries.ts can read the flags
// without pulling in the API client.

// The query must RETURN a value: aw-server treats a program with no `RETURN`
// statement as `EmptyQuery` (HTTP 400) regardless of whether the function it
// calls exists, so a probe without one reports "unsupported" on every server.
export const MERGE_SUBWATCHER_FIELDS_PROBE_QUERY =
  'x = merge_subwatcher_fields([], [], ["url"], "sub_wins"); RETURN = x;';

let mergeSubwatcherFields = false;

export function supportsMergeSubwatcherFields(): boolean {
  return mergeSubwatcherFields;
}

export function setSupportsMergeSubwatcherFields(supported: boolean): void {
  mergeSubwatcherFields = supported;
}
