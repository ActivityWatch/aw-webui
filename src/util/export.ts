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
  const blob = new Blob([content], { type: mimeType });
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
