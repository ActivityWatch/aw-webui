import moment from 'moment';
import { seconds_to_duration } from './time';
import DOMPurify from 'dompurify';
import _ from 'lodash';
import { t } from '~/i18n';

const sanitize = DOMPurify.sanitize;

function label(key) {
  return sanitize(t(key));
}

function safeHttpUrl(rawUrl) {
  try {
    const url = new URL(rawUrl);
    return ['http:', 'https:'].includes(url.protocol) ? url.href : null;
  } catch {
    return null;
  }
}

function buildUrlCell(rawUrl) {
  const displayUrl = sanitize(rawUrl);
  const href = safeHttpUrl(rawUrl);

  if (!href) {
    return displayUrl;
  }

  return `<a href="${_.escape(href)}">${displayUrl}</a>`;
}

export function buildTooltip(bucket, e) {
  // WARNING: XSS risk, make sure to sanitize properly
  // FIXME: Not actually tested against XSS attacks, implementation needs to be verified in tests.
  let inner = label('tooltip.unknownBucketType');

  // if same day, don't show date
  let start = moment(e.timestamp);
  let stop = moment(e.timestamp).add(e.duration, 'seconds');
  if (start.isSame(stop, 'day')) {
    start = start.format('HH:mm:ss');
    stop = stop.format('HH:mm:ss');
  } else {
    start = start.format('YYYY-MM-DD HH:mm:ss');
    stop = stop.format('YYYY-MM-DD HH:mm:ss');
  }

  if (bucket.type == 'currentwindow') {
    inner = `
      <tr><th>${label('tooltip.app')}</th><td>${sanitize(e.data.app)}</td></tr>
      <tr><th>${label('tooltip.title')}</th><td>${sanitize(e.data.title)}</td></tr>
      `;
  } else if (bucket.type == 'web.tab.current') {
    inner = `
      <tr><th>${label('tooltip.title')}</th><td>${sanitize(e.data.title)}</td></tr>
      <tr><th>${label('tooltip.url')}</th><td>${buildUrlCell(e.data.url)}</td></tr>
      `;
  } else if (bucket.type.startsWith('app.editor')) {
    const filename = sanitize(_.last(e.data.file.split('/')));
    inner = `
      <tr><th>${label('tooltip.filename')}</th><td>${filename}</td></tr>
      <tr><th>${label('tooltip.path')}</th><td>${sanitize(e.data.file)}</td></tr>
      <tr><th>${label('tooltip.language')}</th><td>${sanitize(e.data.language)}</td></tr>
      `;
  } else if (bucket.type.startsWith('general.stopwatch')) {
    inner = `
      <tr><th>${label('tooltip.label')}</th><td>${sanitize(e.data.label)}</td></tr>
      `;
  } else {
    inner = `
      <tr><th>${label('tooltip.data')}</th><td>${sanitize(JSON.stringify(e.data))}</td></tr>
      `;
  }
  return `<table>
    <tr></tr>
    <tr><th>${label('tooltip.start')}</th><td>${start}</td></tr>
    <tr><th>${label('tooltip.stop')}</th><td>${stop}</td></tr>
    <tr><th>${label('tooltip.duration')}&nbsp;</th><td>${seconds_to_duration(e.duration)}</td></tr>
    ${inner}
    </table>`;
}
