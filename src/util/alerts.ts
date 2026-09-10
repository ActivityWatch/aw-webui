// Alert goals ("spend at least N minutes in category X today"), as persisted
// in settings. Only the definition is stored — never query results or other
// transient view state.

export interface AlertGoal {
  name: string;
  // Category path, e.g. ['Work', 'Programming']. An empty path is not a valid
  // goal, since the view needs a concrete category to sum time for.
  category: string[];
  // Target duration in minutes.
  goal: number;
}

// Sample goals shown on first use, before the user has stored any of their own.
// A stored empty list is a deliberate choice and must not bring these back.
export function getDefaultAlertGoals(): AlertGoal[] {
  return [
    { name: 'Work', category: ['Work'], goal: 100 },
    { name: 'Media', category: ['Media'], goal: 10 },
  ];
}

// Coerce one candidate into a valid goal, or return null if it cannot be used.
// Accepts the string values that number inputs produce.
export function cleanAlertGoal(candidate: unknown): AlertGoal | null {
  if (typeof candidate !== 'object' || candidate === null) return null;
  const { name, category, goal } = candidate as Record<string, unknown>;

  if (typeof name !== 'string' || name.trim() === '') return null;
  if (!Array.isArray(category) || category.length === 0) return null;
  if (!category.every(segment => typeof segment === 'string')) return null;

  const goalNumber = typeof goal === 'string' ? Number(goal.trim()) : goal;
  if (typeof goalNumber !== 'number' || !Number.isFinite(goalNumber) || goalNumber < 0) {
    return null;
  }

  return { name: name.trim(), category: [...(category as string[])], goal: goalNumber };
}

// Drop malformed entries from stored (and therefore untrusted) data, so a bad
// value in settings cannot break the view.
export function cleanAlertGoals(candidates: unknown): AlertGoal[] {
  if (!Array.isArray(candidates)) return [];
  return candidates.map(cleanAlertGoal).filter((goal): goal is AlertGoal => goal !== null);
}
