export {};

declare global {
  interface Window {
    electronAPI: {
      dbExec: (sql: string, params?: unknown[]) => Promise<unknown>;
      dbGet: (sql: string, params?: unknown[]) => Promise<unknown>;
      dbAll: (sql: string, params?: unknown[]) => Promise<unknown>;
    };
  }
}
