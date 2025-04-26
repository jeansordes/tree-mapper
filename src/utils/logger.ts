import { writeFileSync, appendFileSync, existsSync, mkdirSync, readdirSync, unlinkSync } from 'fs';
import { join } from 'path';

class Logger {
    private logsDir: string;
    private enabled: boolean = false;
    private activeLogFiles: Set<string> = new Set();

    constructor(logsDir: string = __dirname + '/../../logs') {
        this.logsDir = logsDir;
    }

    enable() {
        this.enabled = true;

        // Create logs directory if it doesn't exist
        if (!existsSync(this.logsDir)) {
            mkdirSync(this.logsDir, { recursive: true });
        } else {
            // Clear all existing log files
            const files = readdirSync(this.logsDir);
            for (const file of files) {
                unlinkSync(join(this.logsDir, file));
            }
            // eslint-disable-next-line no-console
            console.clear();
        }

        this.log('system', 'Logging started');
    }

    disable() {
        if (this.enabled) {
            this.log('system', 'Logging stopped');
            this.enabled = false;
        }
    }

    private ensureLogFile(logName: string): string {
        const logFile = join(this.logsDir, `${logName}.log`);

        if (!this.activeLogFiles.has(logFile)) {
            // Create the file if it doesn't exist
            if (!existsSync(logFile)) {
                writeFileSync(logFile, '');
            }
            this.activeLogFiles.add(logFile);
        }

        return logFile;
    }

    logToConsole(...args: unknown[]) {
        if (process.env.NODE_ENV === 'development') {
            // eslint-disable-next-line no-console
            console.log(...args);
        }
    }

    log(logName: string, ...args: unknown[]) {
        this.logToConsole(...args);

        // If enabled, also log to file
        if (this.enabled) {
            const logFile = this.ensureLogFile(logName);
            const timestamp = new Date().toISOString();
            const logMessage = `[${timestamp}] ${args.map(arg =>
                typeof arg === 'object' ? JSON.stringify(arg, null, 2) : String(arg)
            ).join(' ')}`;

            try {
                appendFileSync(logFile, logMessage + '\n');
            } catch (error) {
                console.error('Failed to write to log file:', error);
            }
        }
    }

    error(logName: string, ...args: unknown[]) {
        this.logToConsole(...args);

        // If enabled, also log to file
        if (this.enabled) {
            const logFile = this.ensureLogFile(logName);
            const timestamp = new Date().toISOString();
            const logMessage = `[${timestamp}] ERROR: ${args.map(arg =>
                typeof arg === 'object' ? JSON.stringify(arg, null, 2) : String(arg)
            ).join(' ')}`;

            try {
                appendFileSync(logFile, logMessage + '\n');
            } catch (error) {
                console.error('Failed to write to log file:', error);
            }
        }
    }

    getLogsDir(): string {
        return this.logsDir;
    }

    isEnabled(): boolean {
        return this.enabled;
    }
}

// Create a singleton instance
export const logger = new Logger(); 