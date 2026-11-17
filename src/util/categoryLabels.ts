import { i18n } from '~/i18n';

/**
 * Display labels for the install-default category names.
 *
 * A category's stored `name` path is its identity: it is sent to aw-server in the
 * categorize query, links parents, keys merges/tombstones and the install-default
 * checks. Translating stored names would break all of that, so the stored path stays
 * English and only the label shown in read-only surfaces is translated.
 *
 * Only segments that appear in the default category set are translated; anything
 * else (user-created names) is shown exactly as stored. Exports and the category
 * editor keep the stored string so files round-trip between locales.
 */
const DEFAULT_SEGMENT_KEYS: Record<string, string> = {
  Audio: 'categoryNames.audio',
  Comms: 'categoryNames.comms',
  Email: 'categoryNames.email',
  Games: 'categoryNames.games',
  IM: 'categoryNames.im',
  Image: 'categoryNames.image',
  Media: 'categoryNames.media',
  Music: 'categoryNames.music',
  Programming: 'categoryNames.programming',
  'Social Media': 'categoryNames.socialMedia',
  Uncategorized: 'common.uncategorized',
  Video: 'categoryNames.video',
  Work: 'categoryNames.work',
};

export function categorySegmentLabel(segment: string): string {
  const key = Object.prototype.hasOwnProperty.call(DEFAULT_SEGMENT_KEYS, segment)
    ? DEFAULT_SEGMENT_KEYS[segment]
    : undefined;
  return key ? String(i18n.t(key)) : segment;
}

export function categoryPathLabel(path: string[] | null | undefined, sep = ' > '): string {
  if (!Array.isArray(path)) return '';
  return path.map(categorySegmentLabel).join(sep);
}
