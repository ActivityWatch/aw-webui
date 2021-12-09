// Tray icon for the Electron version of ActivityWatch.
//
// Inspired by: https://moinism.medium.com/how-to-keep-an-electron-app-running-in-the-background-f6a7c0e1ee4f
// Docs: https://www.electronjs.org/docs/latest/api/tray
//
declare const __static: string;

import { createWindow } from '../background';
import { app, Menu, Tray, MenuItemConstructorOptions } from 'electron';
import path from 'path';

import { manager } from './manager';

export function createTray() {
  let tray = null;
  app.whenReady().then(() => {
    // FIXME: Why is this set to `./public/` despite override?
    console.log(__static);

    const icon = path.join(path.join(__static, '../static'), 'logo.png');
    tray = new Tray(icon);
    tray.setToolTip('ActivityWatch');

    const moduleMenu: MenuItemConstructorOptions[] = [
      // list servers first
      manager.modules
        .filter(m => m.name.includes('aw-server'))
        .map((m): MenuItemConstructorOptions => {
          // TODO: Make `checked` work correctly
          return { label: m.name, type: 'checkbox', checked: false, click: m.toggle };
        }),
      // then other modules
      manager.modules
        .filter(m => !m.name.includes('aw-server'))
        .map((m): MenuItemConstructorOptions => {
          return { label: m.name, type: 'checkbox', checked: false, click: m.toggle };
        }),
    ].flat();
    console.log(moduleMenu);

    const contextMenu = Menu.buildFromTemplate([
      { label: 'Running in testing mode' },
      { type: 'separator' },
      { label: 'Open UI', click: () => createWindow() },
      { type: 'separator' },
      {
        label: 'Modules',
        submenu: moduleMenu,
      },
      { type: 'separator' },
      {
        label: 'Quit ActivityWatch',
        click: () => {
          app.quit();
        },
      },
    ]);
    tray.on('double-click', () => createWindow());
    tray.setContextMenu(contextMenu);
  });

  return tray;
}
