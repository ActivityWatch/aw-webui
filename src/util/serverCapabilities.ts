// Server features the webui can use only when the connected server provides
// them. Each flag defaults to the safe (oldest supported server) value and is
// turned on by a one-time probe at startup (see stores/server.ts).
//
// Kept dependency-free so pure modules like queries.ts can read the flags
// without pulling in the API client.

let mergeSubwatcherFields = false;

export function supportsMergeSubwatcherFields(): boolean {
  return mergeSubwatcherFields;
}

export function setSupportsMergeSubwatcherFields(supported: boolean): void {
  mergeSubwatcherFields = supported;
}
