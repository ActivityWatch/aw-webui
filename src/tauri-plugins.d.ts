/**
 * Type declarations for Tauri plugins used via dynamic import.
 * These modules are only available at runtime inside a Tauri webview.
 */

declare module '@tauri-apps/plugin-dialog' {
  interface SaveDialogOptions {
    title?: string;
    defaultPath?: string;
    filters?: Array<{ name: string; extensions: string[] }>;
  }
  export function save(options?: SaveDialogOptions): Promise<string | null>;
}

declare module '@tauri-apps/plugin-fs' {
  export function writeTextFile(path: string, contents: string): Promise<void>;
}
