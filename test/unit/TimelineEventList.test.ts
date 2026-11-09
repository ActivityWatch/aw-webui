import { mount } from '@vue/test-utils';
import { createPinia, setActivePinia } from 'pinia';
import TimelineEventList from '~/visualizations/TimelineEventList.vue';

function windowBucket(id: string, count: number, offset = 0) {
  return {
    id,
    hostname: 'host-a',
    type: 'currentwindow',
    events: Array.from({ length: count }, (_, i) => ({
      timestamp: new Date(Date.UTC(2026, 0, 1, 0, 0, i + offset)).toISOString(),
      duration: 90,
      data: { app: `app${i}`, title: `title${i}` },
    })),
  };
}

describe('TimelineEventList', () => {
  beforeEach(() => setActivePinia(createPinia()));

  const mountList = (buckets: object[]) =>
    mount(TimelineEventList, {
      propsData: { buckets },
      stubs: { 'b-button': { template: '<button @click="$emit(\'click\')"><slot /></button>' } },
    });

  test('shows start, computed end, duration, bucket/host and title', () => {
    const wrapper = mountList([windowBucket('aw-watcher-window_host-a', 1)]);
    const cells = wrapper.findAll('tbody tr').at(0).findAll('td');
    const start = new Date(Date.UTC(2026, 0, 1, 0, 0, 0));
    const pad = (n: number) => String(n).padStart(2, '0');
    const fmt = (d: Date) =>
      `${d.getFullYear()}-${pad(d.getMonth() + 1)}-${pad(d.getDate())} ${pad(d.getHours())}:${pad(
        d.getMinutes()
      )}:${pad(d.getSeconds())}`;
    expect(cells.at(0).text()).toBe(fmt(start));
    expect(cells.at(1).text()).toBe(fmt(new Date(start.getTime() + 90 * 1000)));
    expect(cells.at(2).text()).toBe('1m 30s');
    expect(cells.at(3).text()).toContain('aw-watcher-window_host-a');
    expect(cells.at(3).text()).toContain('(host-a)');
    expect(cells.at(4).text()).toBe('app0 — title0');
  });

  test('marks start/end/duration clipped at the queried range edges', () => {
    const wrapper = mount(TimelineEventList, {
      propsData: {
        buckets: [windowBucket('w', 1)],
        range: ['2026-01-01T00:00:00Z', '2026-01-01T00:01:00Z'],
      },
    });
    const cells = wrapper.findAll('tbody tr').at(0).findAll('td');
    expect(cells.at(0).text().startsWith('≤ ')).toBe(true);
    expect(cells.at(1).text().startsWith('≥ ')).toBe(true);
    expect(cells.at(2).text()).toBe('≥ 1m 30s');
  });

  test('pages past 100 rows instead of silently stopping', async () => {
    const wrapper = mountList([windowBucket('w', 250)]);
    expect(wrapper.findAll('tbody tr')).toHaveLength(100);
    expect(wrapper.text()).toContain('Showing 100 of 250 events');

    await wrapper.find('button').trigger('click');
    expect(wrapper.findAll('tbody tr')).toHaveLength(200);
    await wrapper.find('button').trigger('click');
    expect(wrapper.findAll('tbody tr')).toHaveLength(250);
    expect(wrapper.find('button').exists()).toBe(false);
  });

  test('returns to the first page when the filtered buckets change', async () => {
    const wrapper = mountList([windowBucket('w', 250)]);
    await wrapper.find('button').trigger('click');
    expect(wrapper.findAll('tbody tr')).toHaveLength(200);

    await wrapper.setProps({ buckets: [windowBucket('w', 150, 5)] });
    expect(wrapper.findAll('tbody tr')).toHaveLength(100);
    expect(wrapper.text()).toContain('Showing 100 of 150 events');
  });
});
