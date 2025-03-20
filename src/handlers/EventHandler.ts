import { App, TFile } from 'obsidian';

export class EventHandler {
    private app: App;
    private refreshCallback: (path?: string, forceFullRefresh?: boolean) => void;
    private refreshDebounceTimeout: NodeJS.Timeout | null = null;

    constructor(app: App, refreshCallback: (path?: string, forceFullRefresh?: boolean) => void) {
        this.app = app;
        this.refreshCallback = refreshCallback;
    }

    /**
     * Register file system events
     */
    registerFileEvents(): void {
        // Create a debounced refresh handler
        const debouncedRefresh = (path?: string, forceFullRefresh: boolean = false) => {
            this.debounceRefresh(() => {
                this.refreshCallback(path, forceFullRefresh);
            }, 300);
        };
        
        // Register individual events to avoid type issues
        this.app.vault.on('create', (file) => {
            // Force full refresh for file creation
            debouncedRefresh(undefined, true);
        });

        this.app.vault.on('delete', (file) => {
            // Force full refresh for file deletion
            debouncedRefresh(undefined, true);
        });

        this.app.vault.on('rename', (file, oldPath) => {
            // Force full refresh for file renaming
            debouncedRefresh(undefined, true);
        });
    }

    /**
     * Register events for active file changes
     */
    registerActiveFileEvents(callback: (file: TFile) => void): void {
        this.app.workspace.on('file-open', (file) => {
            if (file) {
                callback(file);
            }
        });
    }

    /**
     * Debounce refresh calls to prevent multiple refreshes in quick succession
     */
    private debounceRefresh(callback: Function, wait: number): void {
        if (this.refreshDebounceTimeout) {
            clearTimeout(this.refreshDebounceTimeout);
        }
        this.refreshDebounceTimeout = setTimeout(() => {
            callback();
            this.refreshDebounceTimeout = null;
        }, wait);
    }
} 