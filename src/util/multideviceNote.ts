// The multi-device note shows on every multi-device Activity view; once
// dismissed it stays dismissed (localStorage, like the supporter nudge on Home).
const DISMISSED_KEY = 'aw-multidevice-note-dismissed';

export function isMultideviceNoteDismissed(): boolean {
  try {
    return localStorage.getItem(DISMISSED_KEY) === 'true';
  } catch (e) {
    return false;
  }
}

export function persistMultideviceNoteDismissed(): void {
  try {
    localStorage.setItem(DISMISSED_KEY, 'true');
  } catch (e) {
    // Storage unavailable: the note stays hidden for this page view only.
  }
}
