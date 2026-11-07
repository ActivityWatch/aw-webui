import { i18n } from '~/i18n';
import { getTitleAttr } from './color';
import { IEvent } from './interfaces';

// Presentation only: getTitleAttr also supplies stable color identities.
export function getEventDisplayTitle(bucket: { type?: string }, event: IEvent) {
  if (bucket.type === 'afkstatus') {
    if (event.data.status === 'afk') return String(i18n.t('common.inactive'));
    if (event.data.status === 'not-afk') return String(i18n.t('common.active'));
  }
  return getTitleAttr(bucket, event);
}
