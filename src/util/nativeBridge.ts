// Bridge to native-only actions in the ActivityWatch Android app.
//
// The app injects `window.awNativeBridge` (an AndroidX WebKit WebMessageListener
// object) only into the main frame of the embedded server's origin, so ordinary
// browsers and older app builds simply have no bridge. The page asks for the
// available actions with a hello/capabilities handshake and shows only those.
// Protocol: aw-android `mobile/src/main/java/net/activitywatch/android/fragments/NativeBridge.kt`.

export const NATIVE_BRIDGE_VERSION = 1;

export const NATIVE_MENU_ACTIONS = [
  { id: 'sync-settings', label: 'nav.syncSettings', icon: 'sync' },
  { id: 'auth-settings', label: 'nav.apiAuthentication', icon: 'key' },
  { id: 'open-in-browser', label: 'nav.openInBrowser', icon: 'external-link-alt' },
];

const KNOWN_ACTIONS = NATIVE_MENU_ACTIONS.map(a => a.id);

interface InjectedBridge {
  postMessage(message: string): void;
  addEventListener(type: 'message', listener: (event: { data: unknown }) => void): void;
  removeEventListener(type: 'message', listener: (event: { data: unknown }) => void): void;
}

export interface NativeBridgeHandlers {
  onCapabilities(actions: string[]): void;
  onCloseMenu(): void;
}

export interface NativeBridge {
  runAction(id: string): void;
  reportMenu(isOpen: boolean): void;
  disconnect(): void;
}

function injectedBridge(): InjectedBridge | null {
  if (typeof window === 'undefined') return null;
  const bridge = (window as any).awNativeBridge;
  if (!bridge || typeof bridge.postMessage !== 'function') return null;
  if (typeof bridge.addEventListener !== 'function') return null;
  return bridge;
}

/** Connect to the Android app's bridge, or return null when there is none. */
export function connectNativeBridge(handlers: NativeBridgeHandlers): NativeBridge | null {
  const bridge = injectedBridge();
  if (!bridge) return null;

  const send = (message: object) => bridge.postMessage(JSON.stringify(message));
  const listener = (event: { data: unknown }) => {
    if (typeof event.data !== 'string') return;
    let message;
    try {
      message = JSON.parse(event.data);
    } catch {
      return;
    }
    if (message?.type === 'capabilities' && message.version === NATIVE_BRIDGE_VERSION) {
      const actions = Array.isArray(message.actions) ? message.actions : [];
      handlers.onCapabilities(actions.filter(a => KNOWN_ACTIONS.includes(a)));
    } else if (message?.type === 'close-menu') {
      handlers.onCloseMenu();
    }
  };

  bridge.addEventListener('message', listener);
  send({ type: 'hello' });

  return {
    runAction: (id: string) => {
      if (KNOWN_ACTIONS.includes(id)) send({ type: 'action', action: id });
    },
    reportMenu: (isOpen: boolean) => send({ type: 'menu', open: isOpen }),
    disconnect: () => bridge.removeEventListener('message', listener),
  };
}
