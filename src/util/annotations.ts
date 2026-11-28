import { parseTags } from './tags';

// Annotations are user-authored, time-ranged events in their own bucket.
// They carry free-form tags and an optional note and never touch watcher data.
// See knowledge/research/2026-10-19-aw-annotations-design-options in the design thread.

export const ANNOTATION_BUCKET_PREFIX = 'aw-annotations_';
export const ANNOTATION_BUCKET_TYPE = 'annotation';

export interface AnnotationData {
  tags: string[];
  note?: string;
}

export function annotationBucketId(hostname: string): string {
  return ANNOTATION_BUCKET_PREFIX + hostname;
}

/** Trimmed, de-duplicated, non-empty tag names. Never splits a name on commas. */
function cleanTags(tags: unknown[]): string[] {
  const names = tags.map(tag => (typeof tag === 'string' ? tag.trim() : ''));
  return Array.from(new Set(names.filter(Boolean)));
}

/** The editable tags of a stored value. */
export function tagChips(tags: unknown): string[] {
  // A bare string is the comma-separated form some clients write.
  if (typeof tags === 'string') return cleanTags(parseTags(tags));
  return Array.isArray(tags) ? cleanTags(tags) : [];
}

/**
 * Apply tag edits to a stored value. Kept names stay exactly as stored, and so
 * do entries the editor cannot show (anything that is not a string).
 */
export function applyTagEdits(stored: unknown, chips: string[]): unknown[] {
  const wanted = cleanTags(chips);
  const entries: unknown[] = Array.isArray(stored) ? stored : tagChips(stored);
  const kept = entries.filter(t => typeof t !== 'string' || wanted.includes(t.trim()));
  const present = tagChips(kept);
  return [...kept, ...wanted.filter(t => !present.includes(t))];
}

export function formatNote(note: unknown): string {
  return typeof note === 'string' ? note : '';
}

/** Whether a stored field holds anything worth keeping, representable or not. */
function hasContent(value: unknown): boolean {
  if (typeof value === 'string') return !!value.trim();
  if (Array.isArray(value)) return value.length > 0;
  return value !== undefined && value !== null;
}

export type AnnotationDraft = { start: Date; end: Date; tags: string[]; note: string };
export type AnnotationError = 'invalidRange' | 'empty';

/**
 * Returns an error key for an unusable draft, or null if it can be saved.
 *
 * `data` is what will actually be written. Pass it when editing: the form
 * cannot represent every stored tag or note value, so an untouched field must
 * count even though the inputs it renders are blank.
 */
export function validateDraft(
  draft: AnnotationDraft,
  data: { tags?: unknown; note?: unknown } = {
    tags: cleanTags(draft.tags),
    note: draft.note.trim(),
  }
): AnnotationError | null {
  const { start, end } = draft;
  if (!(start instanceof Date) || !(end instanceof Date)) return 'invalidRange';
  if (isNaN(start.getTime()) || isNaN(end.getTime()) || end <= start) return 'invalidRange';
  if (!hasContent(data.tags) && !hasContent(data.note)) return 'empty';
  return null;
}

/** Build the event to store. A blank note is omitted rather than stored as "". */
export function draftToEvent(draft: AnnotationDraft) {
  const data: AnnotationData = { tags: cleanTags(draft.tags) };
  const note = draft.note.trim();
  if (note) data.note = note;
  return {
    timestamp: draft.start,
    duration: (draft.end.getTime() - draft.start.getTime()) / 1000,
    data,
  };
}
