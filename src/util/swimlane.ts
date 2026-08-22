import _ from 'lodash';
import { IEvent } from './interfaces';

const escapeText = (value: unknown): string => _.escape(value == null ? 'unknown' : String(value));

export function getSwimlane(
  bucket: { type?: string } | null | undefined,
  color: any,
  groupBy: string,
  e: IEvent
): string {
  let subgroup = 'unknown';

  // A bucket with no type, or an event with no data, must not throw and take
  // the whole visualization down with it.
  const data = (e && e.data) || {};
  const type = String((bucket && bucket.type) || '');

  if (groupBy == 'category') {
    subgroup = escapeText(color);
  } else if (groupBy == 'bucketType') {
    if (type == 'currentwindow') {
      subgroup = escapeText(data.app);
    } else if (type == 'web.tab.current') {
      try {
        const hostname = new URL(data.url).hostname;
        subgroup = hostname ? escapeText(hostname.replace(/^www\./, '')) : 'unknown';
      } catch {
        subgroup = 'unknown';
      }
    } else if (type.startsWith('app.editor')) {
      subgroup = escapeText(data.language);
    } else if (type.startsWith('general.stopwatch')) {
      subgroup = escapeText(data.label);
    }
  }

  return subgroup;
}
