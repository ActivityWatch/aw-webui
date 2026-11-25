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

/** Split comma-separated input into trimmed, de-duplicated, non-empty tags. */
export function parseTags(input: string): string[] {
  const seen = new Set<string>();
  for (const part of (input || '').split(',')) {
    const tag = part.trim();
    if (tag) seen.add(tag);
  }
  return Array.from(seen);
}

export function formatTags(tags: unknown): string {
  return Array.isArray(tags) ? tags.filter(t => typeof t === 'string').join(', ') : '';
}

export type AnnotationDraft = { start: Date; end: Date; tags: string; note: string };
export type AnnotationError = 'invalidRange' | 'empty';

/**
 * Returns an error key for an unusable draft, or null if it can be saved.
 *
 * `data` is what will actually be written. Pass it when editing: the form
 * cannot represent every stored tag value, so an untouched field must count
 * even though the inputs it renders are blank.
 */
export function validateDraft(
  draft: AnnotationDraft,
  data: { tags?: unknown; note?: unknown } = {
    tags: parseTags(draft.tags),
    note: draft.note.trim(),
  }
): AnnotationError | null {
  const { start, end } = draft;
  if (!(start instanceof Date) || !(end instanceof Date)) return 'invalidRange';
  if (isNaN(start.getTime()) || isNaN(end.getTime()) || end <= start) return 'invalidRange';
  const tags = Array.isArray(data.tags) ? data.tags : [];
  const note = typeof data.note === 'string' ? data.note : '';
  if (tags.length === 0 && !note.trim()) return 'empty';
  return null;
}

/** Build the event to store. A blank note is omitted rather than stored as "". */
export function draftToEvent(draft: AnnotationDraft) {
  const data: AnnotationData = { tags: parseTags(draft.tags) };
  const note = draft.note.trim();
  if (note) data.note = note;
  return {
    timestamp: draft.start,
    duration: (draft.end.getTime() - draft.start.getTime()) / 1000,
    data,
  };
}
