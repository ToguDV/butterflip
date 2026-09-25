import { contextBridge, ipcRenderer } from 'electron';

contextBridge.exposeInMainWorld('electronAPI', {
  dbExec: (sql: string, params?: unknown[]) => ipcRenderer.invoke('db:exec', sql, params),
  dbGet: (sql: string, params?: unknown[]) => ipcRenderer.invoke('db:get', sql, params),
  dbAll: (sql: string, params?: unknown[]) => ipcRenderer.invoke('db:all', sql, params),
});

export type ElectronAPI = {
  dbExec: (sql: string, params?: unknown[]) => Promise<unknown>;
  dbGet: (sql: string, params?: unknown[]) => Promise<unknown>;
  dbAll: (sql: string, params?: unknown[]) => Promise<unknown>;
};

declare global {
  interface Window {
    electronAPI: ElectronAPI;
  }
}
