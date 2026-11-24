import fs from 'fs';
import path from 'path';
import Icon from 'vue-awesome/components/Icon.vue';
import '~/views/Report.vue';

jest.mock('vue-chartjs/legacy', () => ({ Bar: { render: h => h('div') } }));
jest.mock('chart.js/auto', () => ({}));

// Icons are registered globally on import, so a view that only works after another
// view was visited renders `undefined.paths` errors when opened directly (#/report).
test('Report registers every icon its template uses', () => {
  const template = fs.readFileSync(path.join(__dirname, '../../src/views/Report.vue'), 'utf8');
  const used = [...template.matchAll(/icon\(name="([a-z0-9-]+)"/g)].map(m => m[1]);
  expect(used).toContain('save');
  const registered = Object.keys((Icon as any).icons);
  expect(used.filter(name => !registered.includes(name))).toEqual([]);
});
