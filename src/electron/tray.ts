// Tray icon for the Electron version of ActivityWatch.
//
// Inspired by: https://moinism.medium.com/how-to-keep-an-electron-app-running-in-the-background-f6a7c0e1ee4f
// Docs: https://www.electronjs.org/docs/latest/api/tray
//
declare const __static: string;

import { createWindow } from '../background';
import { app, Menu, Tray, MenuItemConstructorOptions } from 'electron';
import path from 'path';

import { manager, Module } from './manager';

function buildModulesMenu(modules: Module[]): MenuItemConstructorOptions[] {
  return [
    // list servers first
    modules
      .filter(m => m.name.includes('aw-server'))
      .map((m): MenuItemConstructorOptions => {
        // TODO: Make `checked` work correctly
        return { label: m.name, type: 'checkbox', checked: false, click: m.toggle };
      }),
    // then other modules
    modules
      .filter(m => !m.name.includes('aw-server'))
      .map((m): MenuItemConstructorOptions => {
        return { label: m.name, type: 'checkbox', checked: false, click: m.toggle };
      }),
  ].flat();
}

export function createTray() {
  let tray = null;
  app.whenReady().then(() => {
    // FIXME: Why is this set to `./public/` despite override?
    //console.log(__static);

    const icon = path.join(path.join(__static, '../static'), 'logo.png');
    tray = new Tray(icon);
    tray.setToolTip('ActivityWatch');

    const contextMenu = Menu.buildFromTemplate([
      { label: 'Running in testing mode' },
      { type: 'separator' },
      { label: 'Open UI', click: () => createWindow() },
      { type: 'separator' },
      {
        label: 'Modules',
        submenu: [
          { label: 'Bundled' },
          ...buildModulesMenu(manager.modules.filter(m => m.type == 'bundled')),
          { type: 'separator' },
          { label: 'System' },
          ...buildModulesMenu(manager.modules.filter(m => m.type == 'system')),
        ],
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
