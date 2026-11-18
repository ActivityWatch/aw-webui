import { buildTooltip } from '~/util/tooltip';

describe('buildTooltip', () => {
  const timestamp = '2024-06-15T12:00:00Z';

  test('renders currentwindow app and title', () => {
    const html = buildTooltip(
      { type: 'currentwindow' },
      {
        timestamp,
        duration: 5,
        data: { app: 'Firefox', title: 'ActivityWatch' },
      }
    );
    expect(html).toContain('Firefox');
    expect(html).toContain('ActivityWatch');
    expect(html).toContain('Start');
    expect(html).toContain('Duration');
  });

  test('renders web tab title and url', () => {
    const html = buildTooltip(
      { type: 'web.tab.current' },
      {
        timestamp,
        duration: 12,
        data: { title: 'Inbox', url: 'https://mail.example.com' },
      }
    );
    expect(html).toContain('Inbox');
    expect(html).toContain('https://mail.example.com');
  });

  test('falls back to JSON data for unknown bucket types', () => {
    const html = buildTooltip(
      { type: 'unknown.bucket' },
      {
        timestamp,
        duration: 1,
        data: { custom: 'payload' },
      }
    );
    expect(html).toContain('payload');
  });

  describe('time format', () => {
    const event = { timestamp: '2024-06-15T13:05:09', duration: 60, data: {} };

    test('shows 24-hour times by default', () => {
      const html = buildTooltip({ type: 'test' }, event);
      expect(html).toContain('<td>13:05:09</td>');
      expect(html).toContain('<td>13:06:09</td>');
    });

    test('shows 12-hour times when asked', () => {
      const html = buildTooltip({ type: 'test' }, event, '12h');
      expect(html).toContain('<td>1:05:09 PM</td>');
      expect(html).toContain('<td>1:06:09 PM</td>');
    });

    test('keeps the date on events spanning midnight', () => {
      const html = buildTooltip(
        { type: 'test' },
        { timestamp: '2024-06-15T23:30:00', duration: 3600, data: {} },
        '12h'
      );
      expect(html).toContain('<td>2024-06-15 11:30:00 PM</td>');
      expect(html).toContain('<td>2024-06-16 12:30:00 AM</td>');
    });
  });
});
