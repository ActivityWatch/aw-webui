import { buildTooltip } from '~/util/tooltip';

function buildWebTooltip(url) {
  return buildTooltip(
    { type: 'web.tab.current' },
    {
      timestamp: '2024-01-01T12:00:00Z',
      duration: 60,
      data: {
        title: 'Example',
        url,
      },
    }
  );
}

function parseTooltip(html) {
  const container = document.createElement('div');
  container.innerHTML = html;
  return container;
}

describe('buildTooltip', () => {
  test('does not allow web URLs to inject attributes', () => {
    const tooltip = parseTooltip(buildWebTooltip('https://example.com/" onclick="alert(1)'));
    const anchor = tooltip.querySelector('a');

    expect(anchor).not.toBeNull();
    expect(anchor.getAttribute('onclick')).toBeNull();
  });

  test('does not render javascript URLs as clickable links', () => {
    const tooltip = parseTooltip(buildWebTooltip('javascript:alert(1)'));
    const anchor = tooltip.querySelector('a');

    expect(anchor).toBeNull();
    expect(tooltip.textContent).toContain('javascript:alert(1)');
  });
});
