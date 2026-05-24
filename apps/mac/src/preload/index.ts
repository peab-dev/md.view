import { contextBridge, ipcRenderer } from 'electron';

/**
 * Tiny bridge — keeps `nodeIntegration: false` while letting the
 * renderer subscribe to file events from the main process.
 */
const api = {
  onFileLoaded: (cb: (data: { html: string; toc: unknown[]; title: string; path: string }) => void) => {
    ipcRenderer.on('file:loaded', (_e, data) => cb(data));
  },
  onFileUpdated: (cb: (data: { html: string; toc: unknown[]; title: string }) => void) => {
    ipcRenderer.on('file:updated', (_e, data) => cb(data));
  },
  onFileError: (cb: (msg: string) => void) => {
    ipcRenderer.on('file:error', (_e, msg) => cb(msg));
  },
  onFileNone: (cb: () => void) => {
    ipcRenderer.on('file:none', () => cb());
  },
  openDialog: () => ipcRenderer.invoke('app:openDialog')
};

contextBridge.exposeInMainWorld('mdView', api);

export type MdViewApi = typeof api;
