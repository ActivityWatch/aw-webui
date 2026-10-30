import { createLocalVue, mount } from '@vue/test-utils';
import CategoryTree from '~/visualizations/CategoryTree.vue';

const localVue = createLocalVue();
localVue.filter('friendlyduration', duration => `${duration}s`);

const event = (name: string[], duration: number) => ({
  timestamp: '2026-01-01T00:00:00Z',
  duration,
  data: { $category: name },
});

describe('CategoryTree structural identity', () => {
  let wrapper;

  function render(events) {
    wrapper = mount(CategoryTree, {
      localVue,
      propsData: { events },
      stubs: { icon: true, 'b-checkbox': true },
    });
    return wrapper;
  }

  const rows = () => wrapper.findAll('.category-row').wrappers;
  const row = title => rows().find(r => r.find('.category-title').text() === title);
  const titles = () => rows().map(r => r.find('.category-title').text());
  const icon = title => row(title).find('icon-stub').attributes('name');

  afterEach(() => wrapper?.destroy());

  test('includes implicit parents, reconciles duration and preserves readable labels and input', async () => {
    const events = [event(['Work>Code'], 60), event(['Work', 'Code', 'Review'], 120)];
    const before = JSON.parse(JSON.stringify(events));
    render(events);

    expect(wrapper.vm.total_duration).toBe(180);
    expect(titles()).toEqual(['Work', 'Work>Code']);
    expect(row('Work').find('.category-value').text()).toBe('120s');
    await row('Work').trigger('click');
    await row('Code').trigger('click');
    expect(titles()).toEqual(['Work', 'Code', 'Review', 'Work>Code']);
    expect(events).toEqual(before);
  });

  test('expands colliding flat and nested paths independently, including icons and ancestors', async () => {
    render([
      event(['Work'], 1),
      event(['Work', 'Code'], 2),
      event(['Work', 'Code', 'Child'], 3),
      event(['Work>Code'], 4),
      event(['Work>Code', 'Flat child'], 5),
    ]);
    await row('Work').trigger('click');
    expect(icon('Code')).toBe('regular/plus-square');
    await row('Work>Code').trigger('click');
    expect(titles()).toContain('Flat child');
    expect(titles()).not.toContain('Child');
    expect(icon('Work>Code')).toBe('regular/minus-square');
    expect(icon('Code')).toBe('regular/plus-square');

    await row('Code').trigger('click');
    expect(titles()).toContain('Child');
    expect(icon('Code')).toBe('regular/minus-square');
    await row('Work>Code').trigger('click');
    expect(titles()).not.toContain('Flat child');
    expect(titles()).toContain('Child');
    expect(icon('Code')).toBe('regular/minus-square');

    await row('Work').trigger('click');
    expect(titles()).not.toContain('Code');
    expect(titles()).not.toContain('Child');
    await row('Work').trigger('click');
    expect(titles()).toContain('Child');
    expect(titles()).not.toContain('Flat child');
  });

  test('counts repeated category events once each rather than duplicating tree rows', () => {
    render([
      event(['Work'], 10),
      event(['Work'], 20),
      event(['Work', 'Code'], 30),
      event(['Work', 'Code'], 40),
      event(['Leisure'], 50),
    ]);
    expect(wrapper.vm.total_duration).toBe(150);
    expect(titles()).toEqual(['Work', 'Leisure']);
    expect(wrapper.vm.category_hierarchy.map(c => c.name)).toEqual([
      ['Work'],
      ['Work', 'Code'],
      ['Leisure'],
    ]);
  });

  test('keeps structurally identical expansion state across event updates', async () => {
    render([event(['Work', 'Code'], 10), event(['Leisure'], 20)]);
    await row('Work').trigger('click');
    await wrapper.setProps({
      events: [event(['Work', 'Code'], 30), event(['Leisure'], 5)],
    });
    expect(wrapper.vm.total_duration).toBe(35);
    expect(titles()).toEqual(['Work', 'Code', 'Leisure']);
    expect(icon('Work')).toBe('regular/minus-square');
  });
});
