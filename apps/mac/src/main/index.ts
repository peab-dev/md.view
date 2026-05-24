import { app, BrowserWindow, dialog, shell, ipcMain, Menu, nativeImage } from 'electron';
import { fileURLToPath } from 'node:url';
import { dirname, join } from 'node:path';
import { existsSync, promises as fs } from 'node:fs';
import { renderMarkdown } from '@md-view/core';
import { FileWatcher } from './watcher.js';
import { resolveOpenTarget } from './fileHandler.js';

const __dirname = dirname(fileURLToPath(import.meta.url));
const isDev = !!process.env.VITE_DEV_SERVER_URL;

/**
 * In dev mode Electron shows its own icon in the Dock. Point at the
 * brand asset so `npm run dev:mac` matches the packaged app.
 *
 * Candidates, in order:
 *   - repo `resources/icon.png` (dev: ../../../../resources/icon.png from main/index.cjs)
 *   - packaged `Contents/Resources/icon.png` (electron-builder copies extra
 *     resources here when listed in `extraResources`; harmless if absent)
 */
function resolveBrandIconPath(): string | null {
  const candidates = [
    join(__dirname, '../../../../resources/icon.png'),
    join(process.resourcesPath ?? '', 'icon.png')
  ];
  return candidates.find((p) => p && existsSync(p)) ?? null;
}
const brandIconPath = resolveBrandIconPath();
const brandIcon = brandIconPath ? nativeImage.createFromPath(brandIconPath) : null;
if (isDev && brandIcon && !brandIcon.isEmpty() && app.dock) {
  app.dock.setIcon(brandIcon);
}

let mainWindow: BrowserWindow | null = null;
let currentFile: string | null = null;
const watcher = new FileWatcher();

/**
 * macOS captures `open-file` events before `ready` fires. We stash them
 * here and replay once the window is up.
 */
const pendingFiles: string[] = [];

/**
 * The renderer can't receive IPC until its scripts have loaded. Anything
 * pre-ready gets queued here and flushed on `did-finish-load`.
 */
let rendererReady = false;
const rendererQueue: Array<() => void> = [];
function whenRendererReady(fn: () => void): void {
  if (rendererReady) fn();
  else rendererQueue.push(fn);
}

app.on('open-file', (event, path) => {
  event.preventDefault();
  if (mainWindow) {
    void loadFile(path);
  } else {
    pendingFiles.push(path);
  }
});

async function loadFile(filePath: string): Promise<void> {
  if (!mainWindow) return;
  try {
    const text = await fs.readFile(filePath, 'utf-8');
    const result = await renderMarkdown(text);
    currentFile = filePath;
    app.addRecentDocument(filePath);
    mainWindow.setRepresentedFilename(filePath);
    mainWindow.setTitle(`${result.title} — md.view`);
    // Renderer might not have finished loading yet — queue if so.
    whenRendererReady(() => {
      mainWindow?.webContents.send('file:loaded', { ...result, path: filePath });
    });
    watcher.watch(filePath, async () => {
      if (!mainWindow) return;
      try {
        const next = await fs.readFile(filePath, 'utf-8');
        const nextResult = await renderMarkdown(next);
        mainWindow.webContents.send('file:updated', nextResult);
      } catch (err) {
        mainWindow.webContents.send('file:error', String(err));
      }
    });
  } catch (err) {
    whenRendererReady(() => {
      mainWindow?.webContents.send('file:error', `Could not open ${filePath}: ${err}`);
    });
  }
}

async function pickFile(): Promise<void> {
  if (!mainWindow) return;
  const result = await dialog.showOpenDialog(mainWindow, {
    title: 'Open Markdown',
    properties: ['openFile'],
    filters: [
      { name: 'Markdown', extensions: ['md', 'markdown', 'mdown', 'mkd'] },
      { name: 'All Files', extensions: ['*'] }
    ]
  });
  if (!result.canceled && result.filePaths[0]) {
    await loadFile(result.filePaths[0]);
  }
}

function createWindow(): void {
  mainWindow = new BrowserWindow({
    width: 1100,
    height: 800,
    minWidth: 640,
    minHeight: 400,
    titleBarStyle: 'hiddenInset',
    vibrancy: 'sidebar',
    backgroundColor: '#00000000',
    show: false,
    ...(brandIcon && !brandIcon.isEmpty() ? { icon: brandIcon } : {}),
    webPreferences: {
      // vite-plugin-electron emits the preload as `.js` even when the lib
      // config asks for `.cjs` — match the actual filename.
      preload: join(__dirname, '../preload/index.js'),
      contextIsolation: true,
      nodeIntegration: false,
      sandbox: false
    }
  });

  mainWindow.once('ready-to-show', () => mainWindow?.show());

  // Route external links to the system browser instead of opening
  // them inside our window.
  mainWindow.webContents.setWindowOpenHandler(({ url }) => {
    if (/^https?:\/\//.test(url)) void shell.openExternal(url);
    return { action: 'deny' };
  });

  // Flush queued IPC messages once the renderer's scripts have executed.
  mainWindow.webContents.on('did-finish-load', () => {
    rendererReady = true;
    while (rendererQueue.length) rendererQueue.shift()?.();
  });

  if (isDev && process.env.VITE_DEV_SERVER_URL) {
    void mainWindow.loadURL(process.env.VITE_DEV_SERVER_URL);
    mainWindow.webContents.openDevTools({ mode: 'detach' });
  } else {
    void mainWindow.loadFile(join(__dirname, '../renderer/index.html'));
  }

  mainWindow.on('closed', () => {
    watcher.close();
    mainWindow = null;
    rendererReady = false;
    rendererQueue.length = 0;
  });
}

function buildMenu(): void {
  const template: Electron.MenuItemConstructorOptions[] = [
    { role: 'appMenu' },
    {
      label: 'File',
      submenu: [
        {
          label: 'Open…',
          accelerator: 'CmdOrCtrl+O',
          click: () => void pickFile()
        },
        {
          label: 'Reload Current File',
          accelerator: 'CmdOrCtrl+R',
          click: () => {
            if (currentFile) void loadFile(currentFile);
          }
        },
        { type: 'separator' },
        { role: 'close' }
      ]
    },
    { role: 'editMenu' },
    { role: 'viewMenu' },
    { role: 'windowMenu' }
  ];
  Menu.setApplicationMenu(Menu.buildFromTemplate(template));
}

ipcMain.handle('app:openDialog', () => pickFile());

void app.whenReady().then(async () => {
  buildMenu();
  createWindow();

  // Drain anything macOS handed us via open-file pre-ready.
  for (const f of pendingFiles.splice(0)) {
    await loadFile(f);
  }

  // CLI: `md.view datei.md` — Electron passes argv after `--`.
  const cliFile = resolveOpenTarget(process.argv);
  if (cliFile) {
    await loadFile(cliFile);
  } else if (!currentFile) {
    whenRendererReady(() => {
      mainWindow?.webContents.send('file:none');
    });
  }
});

app.on('window-all-closed', () => {
  if (process.platform !== 'darwin') app.quit();
});

app.on('activate', () => {
  if (BrowserWindow.getAllWindows().length === 0) createWindow();
});

// Single-instance: if a second `open-file` comes in (e.g. user
// double-clicks another .md), focus the existing window.
const gotLock = app.requestSingleInstanceLock();
if (!gotLock) {
  app.quit();
} else {
  app.on('second-instance', (_event, argv) => {
    if (mainWindow) {
      if (mainWindow.isMinimized()) mainWindow.restore();
      mainWindow.focus();
    }
    const file = resolveOpenTarget(argv);
    if (file) void loadFile(file);
  });
}
