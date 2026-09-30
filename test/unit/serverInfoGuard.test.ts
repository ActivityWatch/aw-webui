// Regression guard for the "TypeError: null is not an object (evaluating
// 't.info.version')" crash: useServerStore starts with `info: null` and only
// populates it from App.vue's `mounted` hook, which runs *after* the first
// child render. Any template that dereferences `info` without a null check
// therefore throws on cold load — and permanently when the server is
// unreachable, since getInfo() swallows the error and leaves `info` null.
import fs from 'fs';
import path from 'path';

const SRC = path.resolve(__dirname, '../../src');

// Templates are pug; extract the <template lang="pug"> block so we only inspect
// render-time expressions, not script-side code (which has its own guards).
function template(relPath) {
  const source = fs.readFileSync(path.join(SRC, relPath), 'utf8');
  const match = source.match(/<template[^>]*>([\s\S]*?)<\/template>/);
  if (!match) throw new Error(`no <template> block in ${relPath}`);
  return match[1];
}

const DEREFS_INFO = /\binfo\.(version|hostname|device_id|testing)\b/;
// `v-if="info"`, `v-if="info && ..."`, and `info?.` all establish a guard.
const GUARDS_INFO = /v-if="[^"]*\binfo"|\binfo\s*&&|\binfo\?\./;

// Pug nests by indentation, so a guard on an ancestor line covers its children
// (Footer.vue wraps its `info.hostname` / `info.version` in `span(v-if="info")`).
// Walk the indentation stack and treat a line as safe if it, or any ancestor,
// guards `info`.
function unguardedInfoDerefs(pug) {
  const offenders = [];
  const stack = []; // [{ indent, guarded }]

  for (const line of pug.split('\n')) {
    if (!line.trim()) continue;
    const indent = line.length - line.trimStart().length;

    while (stack.length && stack[stack.length - 1].indent >= indent) stack.pop();

    const inheritedGuard = stack.some(frame => frame.guarded);
    const guarded = inheritedGuard || GUARDS_INFO.test(line);

    if (DEREFS_INFO.test(line) && !guarded) offenders.push(line.trim());

    stack.push({ indent, guarded });
  }
  return offenders;
}

describe('server store info is never dereferenced unguarded in templates', () => {
  test.each([['views/Home.vue'], ['views/Buckets.vue'], ['components/Footer.vue']])(
    '%s guards info before dereferencing',
    relPath => {
      expect(unguardedInfoDerefs(template(relPath))).toEqual([]);
    }
  );

  test('detects the original crashing expression', () => {
    expect(unguardedInfoDerefs(`li(v-if="!info.version.includes('rust')") link`)).toHaveLength(1);
  });

  test('accepts an ancestor guard, as Footer.vue relies on', () => {
    const pug = ['span(v-if="info")', '  small', '    | {{info.version}}'].join('\n');
    expect(unguardedInfoDerefs(pug)).toEqual([]);
  });

  test('does not let a closed guard block cover a later sibling', () => {
    const pug = ['span(v-if="info")', '  | {{info.version}}', 'span', '  | {{info.hostname}}'].join(
      '\n'
    );
    expect(unguardedInfoDerefs(pug)).toHaveLength(1);
  });
});
