/**
 * Cross-platform file download utility.
 *
 * In a regular browser, uses the standard <a download> pattern.
 * In a Tauri webview, uses the dialog + fs plugins to show a native
 * save dialog and write the file directly (webviews don't support
 * the <a download> pattern).
 *
 * See: https://github.com/ActivityWatch/aw-tauri/issues/199
 */

import Papa from 'papaparse';

import { IEvent } from './interfaces';

/**
 * Cells a spreadsheet would evaluate as a formula: a leading `=`, `+`, `-` or
 * `@`, also after leading whitespace (Excel and LibreOffice trim it, so
 * " =1+1" executes). Window titles come from web pages and other apps, so an
 * exported title must never run when the CSV is opened. Matches the
 * neutralization in aw-server-rust and aw-server's `/export/csv` endpoint.
 */
export const CSV_FORMULA_PATTERN = /^[ \t\r\n]*[=+\-@]/;

/** Prefix a formula-like CSV cell with `'` so spreadsheets show it as text. */
export function neutralizeCsvFormula(value: string): string {
  return CSV_FORMULA_PATTERN.test(value) ? `'${value}` : value;
}

/**
 * CSV for the Report view's events: a header row, then one row per event.
 * PapaParse ignores the `columns` option for array rows, so the header has to
 * be passed as `fields`.
 */
export function reportEventsCsv(events: IEvent[]): string {
  return Papa.unparse(
    {
      fields: ['timestamp', 'duration', 'category', 'app', 'title'],
      data: events.map(e => [
        e.timestamp,
        e.duration,
        // PapaParse checks strings before coercing arrays to comma-separated text.
        String(e.data['$category'] ?? ''),
        e.data['app'],
        e.data['title'],
      ]),
    },
    { escapeFormulae: CSV_FORMULA_PATTERN }
  );
}

interface FileFilter {
  name: string;
  extensions: string[];
}

function isTauri(): boolean {
  return '__TAURI__' in window;
}

/**
 * Download/save a file with the given content.
 *
 * @param filename - Default filename for the download
 * @param content - File content as a string
 * @param mimeType - MIME type (e.g. 'application/json', 'text/csv')
 */
export async function downloadFile(
  filename: string,
  content: string,
  mimeType: string
): Promise<void> {
  if (isTauri()) {
    await downloadFileTauri(filename, content, mimeType);
  } else {
    downloadFileBrowser(filename, content, mimeType);
  }
}

function getFilters(mimeType: string): FileFilter[] {
  if (mimeType.includes('json')) {
    return [{ name: 'JSON', extensions: ['json'] }];
  } else if (mimeType.includes('csv')) {
    return [{ name: 'CSV', extensions: ['csv'] }];
  }
  return [];
}

async function downloadFileTauri(
  filename: string,
  content: string,
  mimeType: string
): Promise<void> {
  try {
    // These modules are only available in the Tauri runtime (injected by aw-tauri).
    // Using new Function() to bypass static analysis by webpack and rollup,
    // which would otherwise fail to resolve these packages at build time.
    // eslint-disable-next-line no-new-func
    const dynamicImport = new Function('m', 'return import(m)') as (m: string) => Promise<unknown>;
    const { save } = (await dynamicImport('@tauri-apps/plugin-dialog')) as {
      save: (opts: object) => Promise<string | null>;
    };
    const { writeTextFile } = (await dynamicImport('@tauri-apps/plugin-fs')) as {
      writeTextFile: (path: string, contents: string) => Promise<void>;
    };

    const path = await save({
      title: 'Save export',
      defaultPath: filename,
      filters: getFilters(mimeType),
    });

    if (path) {
      await writeTextFile(path, content);
    }
  } catch (e) {
    console.warn('Tauri save failed, falling back to browser download:', e);
    // Fall back to browser method if Tauri plugins aren't available
    downloadFileBrowser(filename, content, mimeType);
  }
}

function downloadFileBrowser(filename: string, content: string, mimeType: string): void {
  downloadBlobBrowser(filename, new Blob([content], { type: mimeType }));
}

function downloadBlobBrowser(filename: string, blob: Blob): void {
  const url = URL.createObjectURL(blob);
  const link = document.createElement('a');
  link.href = url;
  link.download = filename;
  link.style.display = 'none';
  document.body.appendChild(link);
  link.click();
  document.body.removeChild(link);
  URL.revokeObjectURL(url);
}

/**
 * Save a Blob without JSON.parse/stringify. Large bucket exports must not be
 * inflated into a JS object graph in a WebView.
 */
export async function downloadBlob(filename: string, blob: Blob, mimeType: string): Promise<void> {
  if (isTauri()) {
    await downloadFile(filename, await blob.text(), mimeType);
    return;
  }
  downloadBlobBrowser(filename, blob);
}

/**
 * Android WebView bridge: stream the export URL natively instead of buffering
 * it in JS. Returns false when the bridge is absent (desktop/browser).
 */
export function androidExportFromUrl(url: string, filename: string): boolean {
  const bridge = typeof window === 'undefined' ? undefined : window.Android;
  if (!bridge || typeof bridge.exportFromUrl !== 'function') {
    return false;
  }
  bridge.exportFromUrl(url, filename);
  return true;
}
