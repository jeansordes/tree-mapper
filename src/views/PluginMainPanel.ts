import { ItemView, TFile, WorkspaceLeaf } from 'obsidian';
import { t } from '../i18n';
import { FILE_TREE_VIEW_TYPE, PluginSettings, TREE_VIEW_ICON } from '../types';
import { DendronEventHandler } from '../utils/EventHandler';
import { ComplexVirtualTree } from './VirtualizedTree';
import { ViewLayout } from '../core/ViewLayout';
import { VirtualTreeManager } from '../core/VirtualTreeManager';
import { logger } from '../utils/logger';

// Dendron Tree View class
export default class PluginMainPanel extends ItemView {
    private static instanceCounter = 0;
    private instanceId: number;
    // DOM is managed by ViewLayout and ComplexVirtualTree; no direct container tracking
    private activeFile: TFile | null = null;
    private settings: PluginSettings;

    // Component instances
    private virtualTree: ComplexVirtualTree | null = null;
    private eventHandler: DendronEventHandler;
    private layout: ViewLayout | null = null;
    private vtManager: VirtualTreeManager | null = null;
    // Debounced saver for expanded state persistence
    private _saveTimer: number | null = null;
    // Snapshot of last known expanded paths to survive VT teardown
    private _lastExpandedSnapshot: string[] = [];

    // Track initialization to avoid duplicate onOpen work
    private _onOpenCalled: boolean = false;

    constructor(leaf: WorkspaceLeaf, settings: PluginSettings) {
        super(leaf);
        this.instanceId = ++PluginMainPanel.instanceCounter;
        this.settings = settings;

        // Lower debounce to make updates feel snappier; structural ops still coalesce
        this.eventHandler = new DendronEventHandler(this.app, this.refresh.bind(this), 120);
        // Controls will be initialized in onOpen when container is available
    }

    getViewType(): string {
        return FILE_TREE_VIEW_TYPE;
    }

    getDisplayText(): string {
        return t('viewName');
    }

    getIcon(): string {
        return TREE_VIEW_ICON;
    }

    async onOpen() {
        // Track if onOpen has been called before to detect multiple calls
        if (this._onOpenCalled) {
            logger.log('[DotNavigator] WARNING: onOpen called multiple times!');
            return;
        }
        this._onOpenCalled = true;

        logger.log('[DotNavigator] onOpen called with containerEl:', {
            containerEl: this.containerEl,
            containerClass: this.containerEl?.className,
            containerType: typeof this.containerEl,
            containerId: this.containerEl?.id
        });

        // Wait for the container to be properly initialized
        await this.waitForContainerReady();

        // Use containerEl directly as the root container
        const viewRoot = this.containerEl;
        if (!(viewRoot instanceof HTMLElement)) {
            logger.error('[DotNavigator] Error: containerEl is not an HTMLElement:', { containerEl: this.containerEl });
            return;
        }

        // Set up the view containers via layout helper
        this.layout = new ViewLayout(viewRoot);
        this.layout.init();

        // Wait for CSS to be loaded by checking if the styles are applied
        await this.waitForCSSLoad();

        // Register workspace + vault events
        this._registerEventHandlers();

        // Initialize virtualized tree
        this.vtManager = new VirtualTreeManager(this.app, () => {
            this._syncHeaderToggle();
            this._persistExpandedNodesDebounced();
        });
        this.vtManager.init(viewRoot, this.settings?.expandedNodes);
        // Access internal instance for highlight calls
        this.virtualTree = this.vtManager.getInstance();

        // Header actions
        this.layout.onToggleClick(() => {
            const expandedCount = this.vtManager?.getExpandedPaths().length ?? 0;
            if (expandedCount === 0) this.vtManager?.expandAll();
            else this.vtManager?.collapseAll();
            this._syncHeaderToggle();
        });
        this.layout.onRevealClick(() => {
            const file = this.activeFile ?? this.app.workspace.getActiveFile();
            if (file) this.highlightFile(file);
        });

        // Highlight current file once initial render is ready
        this._highlightInitialActiveFile();

        // Sync header initial state
        this._syncHeaderToggle();
        logger.log('[DotNavigator] onOpen completed successfully');
    }

    /**
     * Debounced persistence of expanded node paths to plugin settings
     */
    private _persistExpandedNodesDebounced(): void {
        if (this._saveTimer) {
            window.clearTimeout(this._saveTimer);
            this._saveTimer = null;
        }
        // Persist after a short idle to coalesce rapid toggles
        this._saveTimer = window.setTimeout(() => {
            this._saveTimer = null;
            this._persistExpandedNodesImmediate();
        }, 250);
    }

    private _persistExpandedNodesImmediate(): void {
        try {
            const expanded = this.getExpandedNodesForSettings();
            this.settings.expandedNodes = expanded;
            this._lastExpandedSnapshot = Array.isArray(expanded) ? [...expanded] : [];
            // Save through the plugin instance if available
            // eslint-disable-next-line @typescript-eslint/no-explicit-any, @typescript-eslint/consistent-type-assertions
            const plugin: any = (this.app as any)?.plugins?.getPlugin?.('dot-navigator');
            if (plugin && typeof plugin.saveSettings === 'function') {
                // Fire and forget; Obsidian handles persistence
                void plugin.saveSettings();
            }
        } catch (e) {
            logger.error('[DotNavigator] Failed to persist expanded nodes', e);
        }
    }

    /**
     * Wait for the container to be properly initialized
     */
    private waitForContainerReady(): Promise<void> {
        return new Promise((resolve) => {
            const checkContainer = () => {
                // Check if containerEl exists and is an HTMLElement
                if (this.containerEl && this.containerEl instanceof HTMLElement) {
                    resolve();
                    return;
                }

                // If not ready, check again in a short while
                setTimeout(checkContainer, 10);
            };
            checkContainer();
        });
    }

    /**
     * Wait for CSS to be loaded by checking if the styles are applied
     */
    private waitForCSSLoad(): Promise<void> {
        return new Promise((resolve) => {
            const checkCSS = () => {
                // Check if the main container has the tm_view class and CSS is loaded
                if (this.containerEl && this.containerEl.classList.contains('tm_view')) {
                    const computedStyle = window.getComputedStyle(this.containerEl);
                    if (computedStyle.getPropertyValue('--tm_css-is-loaded')) {
                        resolve();
                        return;
                    }
                }

                // If not ready, check again in a short while
                setTimeout(checkCSS, 10);
            };
            checkCSS();
        });
    }

    // Header/body containers are handled by ViewLayout

    private _addRevealActiveButton(_header: HTMLElement): void { /* handled by ViewLayout */ }

    private _registerEventHandlers(): void {
        this.eventHandler.registerFileEvents();
        this.eventHandler.registerActiveFileEvents((file) => {
            this.activeFile = file;
            this.highlightActiveFile();
        });
    }

    private _highlightInitialActiveFile(): void {
        const activeFile = this.app.workspace.getActiveFile();
        if (!activeFile) return;
        this.activeFile = activeFile;
        setTimeout(() => this.highlightActiveFile(), 500);
    }

    /**
     * Public method to highlight a specific file in the tree view
     * This can be called from the main plugin
     */
    public highlightFile(file: TFile): void {
        this.activeFile = file;
        this.highlightActiveFile();
    }

    /**
     * Highlight the active file in the tree view and scroll it into view
     */
    private highlightActiveFile(): void {
        const file = this.activeFile ?? this.app.workspace.getActiveFile();
        if (!file) return;

        // Prefer going through the manager (stable API)
        try {
            if (this.vtManager) { this.vtManager.revealPath(file.path); return; }
            if (this.virtualTree) { this.virtualTree.revealPath(file.path); return; }
        } catch (e) {
            // Never let highlight errors break the app; just log
            logger.error('[DotNavigator] highlightActiveFile failed:', e);
        }
    }

    // Legacy highlighter removed

    // Expanded state persistence handled by VirtualTreeManager

    async refresh(changedPath?: string, _forceFullRefresh: boolean = false, oldPath?: string) {
        if (!this.containerEl) return;
        if (this.vtManager) {
            this.vtManager.updateOnVaultChange(changedPath, oldPath);
            // After data updates, ensure the current active file is highlighted
            if (this.activeFile) {
                this.vtManager.revealPath(this.activeFile.path);
            }
        }
    }

    // Incremental refresh and legacy rebuild paths removed; manager handles updates

    // Legacy full refresh/tree builders removed in favor of VirtualTreeManager

    private _syncHeaderToggle(): void {
        if (!this.layout) return;
        const expandedCount = this.vtManager?.getExpandedPaths().length ?? 0;
        this.layout.updateToggleDisplay(expandedCount > 0);
    }

    // computeRowHeight/computeGap live in src/utils/measure.ts

    /**
     * Get expanded nodes for saving in settings
     */
    public getExpandedNodesForSettings(): string[] {
        try {
            // Prefer live data when VT is active
            if (this.vtManager?.isActive()) {
                return this.vtManager.getExpandedPaths();
            }
            if (this.virtualTree) return this.virtualTree.getExpandedPaths();
        } catch {
            // ignore and fall through to snapshot/settings
        }
        // Fallback to the last known snapshot or settings
        if (this._lastExpandedSnapshot && this._lastExpandedSnapshot.length >= 0) return this._lastExpandedSnapshot;
        return this.settings?.expandedNodes ?? [];
    }

    /**
     * Restore expanded nodes from settings
     */
    public restoreExpandedNodesFromSettings(nodes: string[]): void {
        if (this.vtManager) this.vtManager.setExpandedPaths(nodes);
        else if (this.virtualTree) this.virtualTree.setExpanded(nodes);
    }

    /**
     * Collapse all nodes in the tree
     */
    public collapseAllNodes(): void {
        if (this.vtManager) this.vtManager.collapseAll();
        else if (this.virtualTree) this.virtualTree.collapseAll();
    }

    /**
     * Expand all nodes in the tree
     */
    public expandAllNodes(): void {
        if (this.vtManager) this.vtManager.expandAll();
        else if (this.virtualTree) this.virtualTree.expandAll();
    }

    /**
     * Clean up resources when the view is closed
     */
    async onClose() {
        logger.log('[DotNavigator] onClose called, cleaning up resources');

        // Remove all event listeners through the event handler
        if (this.eventHandler) {
            // The eventHandler will handle cleaning up its own event listeners
            this.eventHandler.unregisterFileEvents();
        }

        // No observers or timers to clean up anymore

        // Persist expanded nodes immediately before teardown
        this._persistExpandedNodesImmediate();

        // Clear references
        if (this.vtManager) this.vtManager.destroy();
        this.activeFile = null;

        logger.log('[DotNavigator] onClose cleanup completed');
    }
} 
