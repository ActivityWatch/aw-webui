import { IEvent } from './interfaces';

export function buildGraphData(
  events: IEvent[],
  maxDepth: number,
  colorForCategory: (path: string[]) => string
) {
  const categories = new Map<string, { path: string[]; duration: number }>();
  const transitions = new Map<string, { source: string; target: string; value: number }>();
  let previous: string | undefined;
  for (const event of events) {
    const path = event.data.$category.slice(0, maxDepth);
    const id = JSON.stringify(path);
    const category = categories.get(id);
    if (category) category.duration += event.duration;
    else categories.set(id, { path, duration: event.duration });

    if (previous !== undefined && previous !== id) {
      const key = JSON.stringify([previous, id]);
      const link = transitions.get(key);
      if (link) link.value++;
      else transitions.set(key, { source: previous, target: id, value: 1 });
    }
    previous = id;
  }
  const groups = new Map<string, number>([['Uncategorized', 0]]);
  const nodes = Array.from(categories, ([id, category]) => {
    const root = category.path[0] || '';
    if (!groups.has(root)) groups.set(root, groups.size);
    return {
      id,
      group: groups.get(root),
      color: colorForCategory(category.path),
      value: category.duration,
    };
  });
  return { nodes, links: Array.from(transitions.values()) };
}
