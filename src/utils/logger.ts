
declare const __TM_DEV__: boolean;

class Logger {
  private enabled = false; // memory capture flag
  private memoryLogs: Map<string, string[]> = new Map();
  private maxMemoryLogEntries = 100;
  private readonly isDev: boolean;

  constructor() {
    // __TM_DEV__ is injected by esbuild (see esbuild.config.mjs)
    // Fallback to NODE_ENV if not defined
    // eslint-disable-next-line @typescript-eslint/ban-ts-comment
    // @ts-ignore
    this.isDev = typeof __TM_DEV__ !== 'undefined' ? __TM_DEV__ : (typeof process !== 'undefined' ? process.env?.NODE_ENV !== 'production' : false);
  }

  enable() {
    this.enabled = this.isDev; // only capture memory logs during dev
    if (this.isDev) {
      // eslint-disable-next-line no-console
      try { console.clear(); } catch { /* ignore */ }
      this.info('[TreeMapper] Logging started');
    }
  }

  disable() {
    if (this.enabled) {
      this.enabled = false;
      if (this.isDev) this.info('[TreeMapper] Logging stopped');
    }
  }

  private addToMemoryLog(logName: string, message: string) {
    if (!this.memoryLogs.has(logName)) this.memoryLogs.set(logName, []);
    const logs = this.memoryLogs.get(logName)!;
    logs.push(message);
    if (logs.length > this.maxMemoryLogEntries) logs.shift();
  }

  private formatArgs(args: unknown[]): unknown[] {
    // Avoid emitting meaningless logs (null/undefined only)
    const meaningful = args.filter(a => a !== null && a !== undefined);
    if (meaningful.length === 0) return [];
    return meaningful;
  }

  // Info-level: visible only in dev builds
  info(...args: unknown[]) {
    if (!this.isDev) return; // hide info in production builds
    const out = this.formatArgs(args);
    if (out.length > 0) {
      // eslint-disable-next-line no-console
      console.log(...out);
    }
    if (this.enabled) {
      const ts = new Date().toISOString();
      const msg = `[${ts}] ${args.map(a => typeof a === 'object' ? JSON.stringify(a) : String(a)).join(' ')}`;
      this.addToMemoryLog('info', msg);
    }
  }

  // Backward-compat alias for existing calls
  log(...args: unknown[]) {
    this.info(...args);
  }

  // Legacy API used in tests; route to info
  logToConsole(...args: unknown[]) {
    this.info(...args);
  }

  // Error-level: always visible
  error(...args: unknown[]) {
    const out = this.formatArgs(args);
    if (out.length > 0) {
      // eslint-disable-next-line no-console
      console.error(...out);
    }
    if (this.enabled) {
      const ts = new Date().toISOString();
      const msg = `[${ts}] ERROR ${args.map(a => typeof a === 'object' ? JSON.stringify(a) : String(a)).join(' ')}`;
      this.addToMemoryLog('error', msg);
    }
  }

  getMemoryLogs(logName: string): string[] { return this.memoryLogs.get(logName) || []; }
  getAllLogNames(): string[] { return Array.from(this.memoryLogs.keys()); }
  isEnabled(): boolean { return this.enabled; }
}

export const logger = new Logger();
