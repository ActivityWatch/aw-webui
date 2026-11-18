export interface TimelineGroup {
  id: string;
  content: string;
  nestedGroups?: string[];
}

export const HOST_GROUP_PREFIX = 'host-group:';

// Nest bucket rows under one parent row per host, but only when it helps:
// at least two distinct real hosts. Single-host views come back unchanged.
// Buckets without a host (stopwatch, browser) stay top-level.
//
// Parent groups deliberately carry no `showNested`: vis-timeline writes the
// collapse state into the group DataSet when a label is clicked, and
// `syncTimelineData` leaves keys the rebuilt group does not name untouched,
// so the state survives every rebuild.
export function nestGroupsByHost(
  groups: TimelineGroup[],
  hostOf: (id: string) => string | undefined,
  hostLabel: (host: string) => string
): TimelineGroup[] {
  const byHost = new Map<string, TimelineGroup[]>();
  for (const group of groups) {
    const host = hostOf(group.id);
    if (host) byHost.set(host, [...(byHost.get(host) || []), group]);
  }
  if (byHost.size < 2) return groups;

  const result: TimelineGroup[] = [];
  const emitted = new Set<string>();
  for (const group of groups) {
    const host = hostOf(group.id);
    if (!host) {
      result.push(group);
    } else if (!emitted.has(host)) {
      emitted.add(host);
      const children = byHost.get(host) as TimelineGroup[];
      result.push({
        id: HOST_GROUP_PREFIX + host,
        content: hostLabel(host),
        nestedGroups: children.map(c => c.id),
      });
      result.push(...children);
    }
  }
  return result;
}
