import { app, BrowserWindow, protocol, shell, Menu, MenuItem } from 'electron';
import * as path from 'path';
import { registerIpc } from './ipc';
import { registerMediaProtocol } from './media-protocol';
import { getCacheSizeBytes, clearCache, formatBytes, setOnCacheChanged } from './cache';

if (process.env.VT_USER_DATA) {
  app.setPath('userData', process.env.VT_USER_DATA);
}

protocol.registerSchemesAsPrivileged([
  {
    scheme: 'media',
    privileges: {
      standard: true,
      secure: true,
      supportFetchAPI: true,
      stream: true,
    },
  },
]);

let mainWindow: BrowserWindow | null = null;
let clearCacheMenuItem: MenuItem | null = null;

function refreshCacheLabel() {
  if (!clearCacheMenuItem) return;
  clearCacheMenuItem.label = `Очистить кэш (${formatBytes(getCacheSizeBytes())})`;
}

function buildMenu() {
  const template: Electron.MenuItemConstructorOptions[] = [
    ...(process.platform === 'darwin'
      ? ([{ role: 'appMenu' }] as Electron.MenuItemConstructorOptions[])
      : []),
    {
      label: 'Файл',
      submenu: [
        {
          label: 'Очистить кэш',
          click: () => {
            clearCache();
            refreshCacheLabel();
          },
        },
        { type: 'separator' },
        { role: 'quit' },
      ],
    },
    { role: 'editMenu' },
    { role: 'viewMenu' },
    { role: 'windowMenu' },
  ];

  const menu = Menu.buildFromTemplate(template);
  for (const top of menu.items) {
    for (const item of top.submenu?.items ?? []) {
      if (item.label?.startsWith('Очистить кэш')) {
        clearCacheMenuItem = item;
      }
    }
  }
  Menu.setApplicationMenu(menu);
  refreshCacheLabel();
}

function createWindow() {
  mainWindow = new BrowserWindow({
    width: 1280,
    height: 800,
    webPreferences: {
      preload: path.join(__dirname, 'preload.js'),
      nodeIntegration: false,
      contextIsolation: true,
      webSecurity: true,
    },
  });

  const devUrl = process.env.VITE_DEV_SERVER_URL;
  if (devUrl) {
    mainWindow.loadURL(devUrl);
  } else {
    mainWindow.loadFile(path.join(__dirname, '../../../dist/index.html'));
  }

  mainWindow.webContents.setWindowOpenHandler(({ url }) => {
    shell.openExternal(url);
    return { action: 'deny' };
  });
}

app.whenReady().then(() => {
  registerMediaProtocol();
  registerIpc();
  buildMenu();
  setOnCacheChanged(refreshCacheLabel);
  createWindow();

  app.on('activate', () => {
    if (BrowserWindow.getAllWindows().length === 0) createWindow();
  });
});

app.on('window-all-closed', () => {
  if (process.platform !== 'darwin') {
    app.quit();
  }
});

app.on('will-quit', () => {
  clearCache();
});
