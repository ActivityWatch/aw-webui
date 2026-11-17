import moment from 'moment';
import { createPinia, setActivePinia } from 'pinia';
import sunburst from '~/visualizations/sunburst-clock';
import { IEvent } from '~/util/interfaces';

const turn = 2 * Math.PI;
const hour = turn / 24;

type ClockNode = { data: IEvent; x0: number; x1: number };

function render(start: moment.Moment, timestamp: string, duration = 1800) {
  const el = document.createElement('div');
  el.innerHTML = '<div class="legend"></div><div class="sequence"></div>';
  sunburst.create(el);
  sunburst.update(
    el,
    {
      timestamp: start.toISOString(),
      duration: start.clone().add(1, 'day').diff(start, 'seconds'),
      data: {},
      children: [{ timestamp, duration, data: { app: 'fixture' } }],
    },
    start
  );
  const paths = Array.from(el.querySelectorAll<SVGPathElement>('#container path')).filter(
    path => (path as SVGPathElement & { __data__: ClockNode }).__data__.data.data.app === 'fixture'
  );
  return {
    el,
    paths,
    nodes: paths.map(path => (path as SVGPathElement & { __data__: ClockNode }).__data__),
  };
}

function expectSpan(node: ClockNode, from: number, to: number) {
  expect(node.x0).toBeCloseTo(from * hour, 9);
  expect(node.x1).toBeCloseTo(to * hour, 9);
}

describe('sunburst clock wall-clock geometry', () => {
  beforeEach(() => setActivePinia(createPinia()));
  test.each(['00:00', '04:00', '04:30'])('aligns 06:00 with fixed ticks from %s', start => {
    const { el, nodes, paths } = render(moment(`2026-10-29T${start}:00`), '2026-10-29T06:00:00');
    expect(nodes).toHaveLength(1);
    expectSpan(nodes[0], 6, 6.5);
    // Check actual SVG geometry as well as D3's bound angles.
    expect(paths[0].getAttribute('d')).toMatch(/^M[\d.]+,0A/);
    const six = Array.from(el.querySelectorAll('text')).find(t => t.textContent === '06:00');
    expect(Number(six.getAttribute('x'))).toBeCloseTo(130, 9);
    expect(Number(six.getAttribute('y'))).toBeCloseTo(5, 9);
    if (start !== '00:00') {
      const boundary = Array.from(el.querySelectorAll('text')).find(
        t => t.textContent === `${start} ☀`
      );
      const angle = (Number(start.slice(0, 2)) + Number(start.slice(3)) / 60) * hour;
      expect(Number(boundary.getAttribute('x'))).toBeCloseTo(130 * Math.sin(angle), 9);
      expect(Number(boundary.getAttribute('y'))).toBeCloseTo(5 - 140 * Math.cos(angle), 9);
    }
  });

  test('places next-calendar-day events before an offset boundary at their clock time', () => {
    const { nodes } = render(moment('2026-10-29T04:30:00'), '2026-10-30T02:00:00');
    expect(nodes).toHaveLength(1);
    expectSpan(nodes[0], 2, 2.5);
  });

  test('draws an arc continuously across calendar midnight without a full-circle wedge', () => {
    const { nodes } = render(moment('2026-10-29T04:00:00'), '2026-10-29T23:30:00', 3600);
    expect(nodes).toHaveLength(1);
    expectSpan(nodes[0], 23.5, 24.5);
  });

  test.each([
    ['2026-10-29T04:00:00', 3600, 4.5, 5],
    ['2026-10-30T04:00:00', 3600, 4, 4.5],
  ])('clips %s at the actual displayed-period bounds', (timestamp, duration, from, to) => {
    const { nodes } = render(moment('2026-10-29T04:30:00'), timestamp, duration);
    expect(nodes).toHaveLength(1);
    expectSpan(nodes[0], from, to);
  });

  test('hover retains the parent ring and fades unrelated events without mutating input', () => {
    const start = moment('2026-10-29T04:30:00');
    const event = {
      timestamp: '2026-10-29T06:00:00',
      duration: 1800,
      data: { app: 'hovered' },
    };
    const root = {
      timestamp: start.toISOString(),
      duration: 86400,
      data: {},
      children: [
        {
          timestamp: start.toISOString(),
          duration: 86400,
          data: { status: 'not-afk' },
          children: [event],
        },
        { timestamp: '2026-10-29T08:00:00', duration: 1800, data: { status: 'afk' }, children: [] },
      ],
    };
    const original = JSON.stringify(root);
    const el = document.createElement('div');
    el.innerHTML = '<div class="legend"></div><div class="sequence"></div>';
    document.body.appendChild(el);
    sunburst.create(el);
    sunburst.update(el, root, start);
    const paths = Array.from(el.querySelectorAll<SVGPathElement>('#container path'));
    const pathFor = data =>
      paths.find(p => (p as SVGPathElement & { __data__: ClockNode }).__data__.data === data);
    pathFor(event).dispatchEvent(new MouseEvent('mouseover', { bubbles: true }));
    expect(pathFor(event).style.opacity).toBe('1');
    expect(pathFor(root.children[0]).style.opacity).toBe('1');
    expect(pathFor(root.children[1]).style.opacity).toBe('0.5');
    expect(JSON.stringify(root)).toBe(original);
    el.remove();
  });

  test.each(['2026-10-29T03:00:00', '2026-10-30T04:30:00'])('omits outside event %s', timestamp => {
    expect(render(moment('2026-10-29T04:30:00'), timestamp).nodes).toHaveLength(0);
  });
});

// Run this suite in a separate process with TZ=Europe/Stockholm. Jest's jsdom
// workers inherit TZ at launch; changing process.env.TZ inside a test is unreliable.
const stockholm = Intl.DateTimeFormat().resolvedOptions().timeZone === 'Europe/Stockholm';
(stockholm ? describe : describe.skip)('sunburst clock DST wall-clock policy', () => {
  test.each(['2026-03-29', '2026-10-25'])('keeps 06:00 fixed on the short/long day %s', day => {
    const { nodes } = render(moment(`${day}T00:00:00`), `${day}T06:00:00`);
    expectSpan(nodes[0], 6, 6.5);
  });

  test('spring-forward leaves a missing-hour gap instead of stretching elapsed activity', () => {
    const { nodes } = render(moment('2026-03-29T00:00:00'), '2026-03-29T01:30:00+01:00', 3600);
    expect(nodes).toHaveLength(2);
    expectSpan(nodes[0], 1.5, 2);
    expectSpan(nodes[1], 3, 3.5);
    expect(nodes.reduce((sum, n) => sum + n.x1 - n.x0, 0)).toBeCloseTo(hour, 9);
  });

  test.each([
    ['2026-03-29', '2026-03-29T01:59:50+01:00', 2, 3],
    ['2026-10-25', '2026-10-25T02:59:50+02:00', 3, 2],
  ])(
    'retains both fragments of a visible short event across DST on %s',
    (day, timestamp, before, after) => {
      const { nodes, paths } = render(moment(`${day}T00:00:00`), timestamp, 20);
      expect(nodes).toHaveLength(2);
      expectSpan(nodes[0], before - 10 / 3600, before);
      expectSpan(nodes[1], after, after + 10 / 3600);
      expect(paths.every(path => !!path.getAttribute('d'))).toBe(true);
      expect(nodes[0].data).toBe(nodes[1].data);
      expect(nodes[0].data.duration).toBe(20);
      // Whole events below the cutoff still stay hidden, split or not.
      expect(render(moment(`${day}T00:00:00`), timestamp, 12).nodes).toHaveLength(0);
      expect(render(moment(`${day}T00:00:00`), `${day}T06:00:00`, 12).nodes).toHaveLength(0);
      // Visibility is based on the clipped interval, not the source duration.
      expect(render(moment(`${day}T00:00:00`), `${day}T23:59:50`, 60).nodes).toHaveLength(0);
    }
  );

  test('fall-back draws both elapsed occurrences on the same wall-clock sector', () => {
    const { nodes } = render(moment('2026-10-25T00:00:00'), '2026-10-25T02:00:00+02:00', 7200);
    expect(nodes).toHaveLength(2);
    expectSpan(nodes[0], 2, 3);
    expectSpan(nodes[1], 2, 3);
    expect(nodes[0].data).toBe(nodes[1].data);
    expect(nodes[0].data.duration).toBe(7200);
    expect(nodes.reduce((sum, n) => sum + n.x1 - n.x0, 0)).toBeCloseTo(2 * hour, 9);
  });

  test.each(['2026-03-28T04:30:00', '2026-10-24T04:30:00'])(
    'retains calendar-day clipping across DST from %s',
    start => {
      const begin = moment(start);
      const end = begin.clone().add(1, 'day');
      const { nodes } = render(begin, end.clone().subtract(30, 'minutes').toISOString(), 3600);
      expect(nodes).toHaveLength(1);
      expectSpan(nodes[0], 4, 4.5);
    }
  );
});
