import moment from 'moment';
import { seconds_to_duration } from './time';
import DOMPurify from 'dompurify';
import _ from 'lodash';

const sanitize = DOMPurify.sanitize;

export function buildTooltip(bucket, e) {
  // WARNING: XSS risk, make sure to sanitize properly
  // FIXME: Not actually tested against XSS attacks, implementation needs to be verified in tests.
  let inner = 'Unknown bucket type';

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
      <tr><th>App</th><td>${sanitize(e.data.app)}</td></tr>
      <tr><th>Title</th><td>${sanitize(e.data.title)}</td></tr>
      `;
  } else if (bucket.type == 'web.tab.current') {
    inner = `
      <tr><th>Title</th><td>${sanitize(e.data.title)}</td></tr>
      <tr><th>URL</th><td><a href=${sanitize(e.data.url)}>${sanitize(e.data.url)}</a></td></tr>
      `;
  } else if (bucket.type.startsWith('app.editor')) {
    inner = `
      <tr><th>Filename</th><td>${sanitize(_.last(e.data.file.split('/')))}</td></tr>
      <tr><th>Path</th><td>${sanitize(e.data.file)}</td></tr>
      <tr><th>Language</th><td>${sanitize(e.data.language)}</td></tr>
      `;
  } else if (bucket.type.startsWith('general.stopwatch')) {
    inner = `
      <tr><th>Label</th><td>${sanitize(e.data.label)}</td></tr>
      `;
  } else {
    inner = `
      <tr><th>Data</th><td>${sanitize(JSON.stringify(e.data))}</td></tr>
      `;
  }
  return `<table>
    <tr></tr>
    <tr><th>Start</th><td>${start}</td></tr>
    <tr><th>Stop</th><td>${stop}</td></tr>
    <tr><th>Duration&nbsp;</th><td>${seconds_to_duration(e.duration)}</td></tr>
    ${inner}
    </table>`;
}
