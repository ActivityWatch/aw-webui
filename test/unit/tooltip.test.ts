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
});
