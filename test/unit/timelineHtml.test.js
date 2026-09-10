import { buildTooltip } from '~/util/tooltip';
import { getSwimlane } from '~/util/swimlane';
import { FilterXSS } from 'xss';

const event = data => ({ timestamp: '2026-09-10T10:00:00Z', duration: 60, data });
function parse(html) {
  const el = document.createElement('div');
  el.innerHTML = html;
  return el;
}
const attack = '<img src=x onerror=alert(1)><b>text</b>';

test.each([
  'javascript:alert(1)',
  'data:text/html,<script>alert(1)</script>',
  '',
  undefined,
  'not a url',
])('unsafe or invalid URL %s is plain text', url => {
  const el = parse(buildTooltip({ type: 'web.tab.current' }, event({ url, title: attack })));
  expect(el.querySelector('a')).toBeNull();
  expect(el.querySelector('img,script,b')).toBeNull();
  expect(el.textContent).toContain(attack);
});

test.each([
  'https://example.test/ onmouseover=alert(1)',
  'https://example.test/?q="hello"&x=<b>',
  'http://example.test/path',
])('keeps HTTP URL %s in one safe attribute', url => {
  const el = parse(buildTooltip({ type: 'web.tab.current' }, event({ url, title: 'Title' })));
  const link = el.querySelector('a');
  expect(link.getAttributeNames()).toEqual(['href']);
  expect(link.href).toBe(new URL(url).href);
  expect(link.textContent).toBe(url);
});

test.each([
  ['currentwindow', { app: attack, title: attack }],
  ['app.editor.activity', { file: attack, language: attack }],
  ['general.stopwatch', { label: attack }],
  ['unknown', { arbitrary: attack }],
])('renders %s event fields as text', (type, data) => {
  const el = parse(buildTooltip({ type }, event(data)));
  expect(el.querySelector('img,script,b')).toBeNull();
  expect(el.textContent).toContain(attack);
});

test.each(['currentwindow', 'app.editor.activity', 'general.stopwatch'])(
  'escapes %s swimlane labels',
  type => {
    const el = parse(
      getSwimlane(
        { type },
        null,
        'bucketType',
        event({ app: attack, language: attack, label: attack })
      )
    );
    expect(el.children).toHaveLength(0);
    expect(el.textContent).toBe(attack);
  }
);

test('escapes category labels and tolerates malformed or missing browser URLs', () => {
  expect(parse(getSwimlane({}, attack, 'category', event({}))).textContent).toBe(attack);
  for (const url of [undefined, '', 'invalid', 'javascript:alert(1)']) {
    expect(getSwimlane({ type: 'web.tab.current' }, null, 'bucketType', event({ url }))).toBe(
      'unknown'
    );
  }
  expect(
    getSwimlane(
      { type: 'web.tab.current' },
      null,
      'bucketType',
      event({ url: 'https://www.example.test/path' })
    )
  ).toBe('example.test');
  expect(() => buildTooltip({ type: 'app.editor.activity' }, event({}))).not.toThrow();
});

// A bucket with no type, or an event with no data, previously threw and took
// the whole timeline render down.
describe('malformed input tolerance', () => {
  test.each([
    ['no bucket type', {}, { app: 'a' }],
    ['no data', { type: 'currentwindow' }, undefined],
    ['no data on a web bucket', { type: 'web.tab.current' }, undefined],
    ['no data on an editor bucket', { type: 'app.editor.activity' }, undefined],
  ])('buildTooltip survives %s', (_label, bucket, data) => {
    let html;
    expect(() => {
      html = buildTooltip(bucket, { timestamp: '2026-09-10T10:00:00Z', duration: 60, data });
    }).not.toThrow();
    expect(parse(html).querySelector('table')).not.toBeNull();
  });

  test.each([
    ['no bucket type', {}],
    ['no data', { type: 'currentwindow' }],
  ])('getSwimlane survives %s', (_label, bucket) => {
    expect(() =>
      getSwimlane(bucket, 'c', 'bucketType', { timestamp: 't', duration: 1, data: undefined })
    ).not.toThrow();
  });
});

// Grouping keys must stay distinct: escaping is reversible, so two different
// values cannot collapse onto one subgroup.
describe('swimlane grouping keys stay distinct', () => {
  const lane = app =>
    getSwimlane({ type: 'currentwindow' }, 'c', 'bucketType', {
      timestamp: 't',
      duration: 1,
      data: { app },
    });

  test('values differing only inside markup do not collide', () => {
    expect(lane('<b>one</b>')).not.toBe(lane('<b>two</b>'));
    expect(lane('<i>x</i>')).not.toBe(lane('<b>x</b>'));
  });

  test('ordinary names are unchanged', () => {
    expect(lane('Firefox')).toBe('Firefox');
  });
});

// The tooltip string is handed to vis-timeline as an item `title`, which the
// library runs through its own filter: the esnext build constructs
// `new FilterXSS()` with the xss library's defaults and defaults the option to
// `xss: { disabled: false }`. `xss` ships as a vis-timeline peer dependency,
// so this exercises the real downstream sink.
//
// Documented finding for the FIXMEs this replaces: that filter DID mitigate
// the old builder's defects end-to-end. Given the previous unquoted
// `<a href=${url}>` it stripped an injected `onmouseover`, emptied a
// `javascript:` href, and reduced `<img src=x onerror=alert(1)>` in a text
// field to `<img src>`. The builder output was unsafe on its own but not
// exploitable through this sink; the fix removes the reliance on that second
// line of defence, and these tests assert both layers now agree.
describe('output at the vis-timeline sink', () => {
  const downstream = new FilterXSS();
  const afterSink = html => parse(downstream.process(html));
  const handlerAttrs = el =>
    Array.from(el.querySelectorAll('*'))
      .flatMap(n => Array.from(n.attributes).map(a => a.name))
      .filter(n => n.startsWith('on'));

  test('a benign link survives the downstream filter intact', () => {
    const el = afterSink(
      buildTooltip(
        { type: 'web.tab.current' },
        event({ title: 'T', url: 'https://example.test/?a=1&b=2' })
      )
    );
    expect(el.querySelector('a').getAttribute('href')).toBe('https://example.test/?a=1&b=2');
  });

  test('markup in a text field reaches the sink as text', () => {
    const el = afterSink(
      buildTooltip({ type: 'currentwindow' }, event({ app: attack, title: attack }))
    );
    expect(handlerAttrs(el)).toEqual([]);
    expect(el.querySelector('img,script')).toBeNull();
  });

  test('whitespace injection reaches the sink with only an href', () => {
    const el = afterSink(
      buildTooltip(
        { type: 'web.tab.current' },
        event({ title: 'T', url: 'https://example.test/ onmouseover=alert(1)' })
      )
    );
    expect(Array.from(el.querySelector('a').attributes).map(a => a.name)).toEqual(['href']);
  });

  test.each(['javascript:alert(1)', 'data:text/html,<script>alert(1)</script>'])(
    'the unsafe scheme %s never becomes an href',
    url => {
      const el = afterSink(buildTooltip({ type: 'web.tab.current' }, event({ title: 'T', url })));
      expect(el.querySelector('a')).toBeNull();
      expect(handlerAttrs(el)).toEqual([]);
    }
  );
});
