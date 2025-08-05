
class Logger {
    private enabled: boolean = false;
    private memoryLogs: Map<string, string[]> = new Map();
    private maxMemoryLogEntries = 100;

    constructor() {
        // No file system initialization needed
    }

    enable() {
        this.enabled = true;
        this.log('system', 'Logging started');
    }

    disable() {
        if (this.enabled) {
            this.log('system', 'Logging stopped');
            this.enabled = false;
        }
    }

    private addToMemoryLog(logName: string, message: string) {
        if (!this.memoryLogs.has(logName)) {
            this.memoryLogs.set(logName, []);
        }
        
        const logs = this.memoryLogs.get(logName)!;
        logs.push(message);
        
        // Keep logs under the maximum size
        if (logs.length > this.maxMemoryLogEntries) {
            logs.shift();
        }
    }

    logToConsole(...args: unknown[]) {
        // eslint-disable-next-line no-console
        console.log(...args);
    }

    log(logName: string, ...args: unknown[]) {
        this.logToConsole(...args);

        // If enabled, also store in memory
        if (this.enabled) {
            const timestamp = new Date().toISOString();
            const logMessage = `[${timestamp}] ${args.map(arg =>
                typeof arg === 'object' ? JSON.stringify(arg, null, 2) : String(arg)
            ).join(' ')}`;

            this.addToMemoryLog(logName, logMessage);
        }
    }

    error(logName: string, ...args: unknown[]) {
        // eslint-disable-next-line no-console
        console.error(...args);

        // If enabled, also store in memory
        if (this.enabled) {
            const timestamp = new Date().toISOString();
            const logMessage = `[${timestamp}] ERROR: ${args.map(arg =>
                typeof arg === 'object' ? JSON.stringify(arg, null, 2) : String(arg)
            ).join(' ')}`;

            this.addToMemoryLog(logName, logMessage);
        }
    }

    getMemoryLogs(logName: string): string[] {
        return this.memoryLogs.get(logName) || [];
    }

    getAllLogNames(): string[] {
        return Array.from(this.memoryLogs.keys());
    }

    isEnabled(): boolean {
        return this.enabled;
    }
}

// Create a singleton instance
export const logger = new Logger(); 