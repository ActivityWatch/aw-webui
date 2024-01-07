import DOMPurify from 'dompurify';

const sanitize = DOMPurify.sanitize;

export function getSwimlane(bucket, color, groupBy, e) {
  // WARNING: XSS risk, make sure to sanitize properly
  // FIXME: Not actually tested against XSS attacks, implementation needs to be verified in tests.
  let subgroup = 'unknown';

  if (groupBy == 'category') {
    subgroup = sanitize(color);
  } else if (groupBy == 'bucketType') {
    if (bucket.type == 'currentwindow') {
      subgroup = sanitize(e.data.app);
    } else if (bucket.type == 'web.tab.current') {
      subgroup = sanitize((new URL(e.data.url)).hostname.replace('www.', ''));
    } else if (bucket.type.startsWith('app.editor')) {
      subgroup = sanitize(e.data.language);
    } else if (bucket.type.startsWith('general.stopwatch')) {
      subgroup = sanitize(e.data.label);
    }
  }

  return subgroup;
}
