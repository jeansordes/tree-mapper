import { App, TFile, TAbstractFile } from 'obsidian';
import { TreeNode } from '../types';

export class DendronEventHandler {
    private app: App;
    private refreshCallback: (path?: string, forceFullRefresh?: boolean, oldPath?: string) => void;
    private refreshDebounceTimeout: number | null = null;
    // Default debounce time of 500ms for better performance
    private debounceWaitTime = 500;
    // Track paths and flags for debounced updates
    private pendingChanges: Map<string, boolean> = new Map(); // path -> forceFullRefresh
    // Short grace period after construction to avoid racing with initial setup
    private readonly initAt = Date.now();
    private readonly graceMs = 300; // keep very small to reduce perceived lag

    constructor(app: App, refreshCallback: (path?: string, forceFullRefresh?: boolean, oldPath?: string) => void, debounceTime?: number) {
        this.app = app;
        this.refreshCallback = refreshCallback;
        if (debounceTime !== undefined) {
            this.debounceWaitTime = debounceTime;
        }
    }

    /**
     * Register file system events
     */
    registerFileEvents(): void {
        // Clear any existing event handlers to prevent duplicates
        this.unregisterFileEvents();
        
        // Register event handlers using bound methods to maintain 'this' context
        this.app.vault.on('create', this.handleFileCreate);
        this.app.vault.on('modify', this.handleFileModify);
        this.app.vault.on('delete', this.handleFileDelete);
        this.app.vault.on('rename', this.handleFileRename);
    }
    
    /**
     * Unregister all file system events to prevent duplicates
     */
    unregisterFileEvents(): void {
        this.app.vault.off('create', this.handleFileCreate);
        this.app.vault.off('modify', this.handleFileModify);
        this.app.vault.off('delete', this.handleFileDelete);
        this.app.vault.off('rename', this.handleFileRename);
    }
    
    // Bound event handlers to ensure 'this' is preserved
    private handleFileCreate = (file: TAbstractFile) => {
        // Full rebuild safest for structural add; allow small debounce
        this.queueRefresh(file?.path, true, false);
    };
    
    private handleFileModify = (_file: TAbstractFile) => {
        // Skip refreshes on file modifications as they don't affect the tree structure
        // Only create, delete, and rename events should trigger tree refreshes
        return;
    };
    
    private handleFileDelete = (file: TAbstractFile) => {
        // Full rebuild safest for structural delete; allow small debounce
        this.queueRefresh(file?.path, true, false);
    };

    private handleFileRename = (file: TAbstractFile, oldPath: string) => {
        // Renames should feel instant; bypass queue and notify with oldPath
        try {
            const newPath = file?.path;
            this.refreshCallback(newPath, false, oldPath);
        } catch {
            // Fallback to queued refresh
            this.queueRefresh(file?.path, false, true);
        }
    };
    
    /**
     * Queue a refresh with debouncing, tracking all affected paths
     */
    private queueRefresh(path?: string, forceFullRefresh: boolean = false, immediate: boolean = false): void {
        const now = Date.now();
        const withinGrace = now - this.initAt < this.graceMs;

        const enqueue = () => {
            if (forceFullRefresh) {
                this.pendingChanges.clear();
                this.pendingChanges.set('', true);
            } else if (path && !this.pendingChanges.has('')) {
                this.pendingChanges.set(path, false);
            }
            this.debounceRefresh(immediate ? 0 : undefined);
        };

        // Only defer during the very first moments after init
        if (withinGrace) {
            const delay = this.graceMs - (now - this.initAt);
            window.setTimeout(enqueue, delay);
        } else {
            enqueue();
        }
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
     * This improves performance by preventing rapid UI updates when multiple
     * file events occur close together (e.g., during sync or bulk operations)
     */
    private debounceRefresh(waitOverride?: number): void {
        if (this.refreshDebounceTimeout) {
            window.clearTimeout(this.refreshDebounceTimeout);
        }
        
        const wait = typeof waitOverride === 'number' ? waitOverride : this.debounceWaitTime;
        this.refreshDebounceTimeout = window.setTimeout(() => {
            // Check if we have a full refresh pending
            const hasFullRefresh = this.pendingChanges.has('') && this.pendingChanges.get('');
            
            if (hasFullRefresh) {
                // Do a full refresh
                this.refreshCallback(undefined, true);
            } else if (this.pendingChanges.size === 1) {
                // Do a single path refresh
                const [path] = this.pendingChanges.keys();
                this.refreshCallback(path, false);
            } else if (this.pendingChanges.size > 1) {
                // Multiple paths changed, do a full refresh
                this.refreshCallback(undefined, true);
            }
            
            // Reset state
            this.pendingChanges.clear();
            this.refreshDebounceTimeout = null;
        }, wait);
    }

    /**
     * Try to update the tree incrementally based on the changed path
     */
    tryIncrementalUpdate(
        changedPath: string,
        container: HTMLElement,
        lastBuiltTree: TreeNode | null,
        nodePathMap: Map<string, TreeNode>,
        renderCallback: (node: TreeNode, container: HTMLElement) => void
    ): boolean {
        if (!container || !lastBuiltTree) return false;
        
        try {
            // Convert file path to dendron path format - replace slashes with dots and keep the extension for proper lookup
            const dendronPath = changedPath.replace(/\//g, '.');
            
            // Find the parent path that needs updating
            const pathParts = dendronPath.split('.');
            let parentPath = '';
            
            // Try to find the highest level parent that exists in the tree
            for (let i = 0; i < pathParts.length; i++) {
                const testPath = pathParts.slice(0, i + 1).join('.');
                if (nodePathMap.has(testPath)) {
                    parentPath = testPath;
                }
            }
            
            // If we can't find a parent path, we need a full rebuild
            if (!parentPath) {
                return false;
            }
            
            // Find the DOM element for this path
            const parentElement: HTMLElement | null = container.querySelector(`.tm_tree-item-container[data-path="${parentPath}"]`);
            if (!parentElement) {
                return false;
            }
            
            // Find the children container
            const childrenContainer: HTMLElement | null = parentElement.querySelector('.tm_tree-item-children');
            if (!childrenContainer) {
                return false;
            }
            
            // Get the node from the path map
            const node = nodePathMap.get(parentPath);
            if (!node) {
                return false;
            }
            
            // Clear the children container
            childrenContainer.empty();
            
            // Re-render just this subtree
            renderCallback(node, childrenContainer);
            
            return true;
        } catch {
            // If any error occurs, fall back to full rebuild
            return false;
        }
    }
}
