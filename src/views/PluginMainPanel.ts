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
    private container: HTMLElement | null = null;
    private activeFile: TFile | null = null;
    private settings: PluginSettings;

    // Component instances
    private virtualTree: ComplexVirtualTree | null = null;
    private eventHandler: DendronEventHandler;
    private layout: ViewLayout | null = null;
    private vtManager: VirtualTreeManager | null = null;

    // Internal state for tracking initialization
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
            logger.log('[TreeMapper] WARNING: onOpen called multiple times!');
            return;
        }
        this._onOpenCalled = true;

        logger.log('[TreeMapper] onOpen called with containerEl:', {
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
            logger.error('[TreeMapper] Error: containerEl is not an HTMLElement:', { containerEl: this.containerEl });
            return;
        }

        // Set up the view containers via layout helper
        this.layout = new ViewLayout(viewRoot);
        const { tree } = this.layout.init();
        this.container = tree;

        // Wait for CSS to be loaded by checking if the styles are applied
        await this.waitForCSSLoad();

        // Register workspace + vault events
        this._registerEventHandlers();

        // Initialize virtualized tree
        this.vtManager = new VirtualTreeManager(this.app, () => this._syncHeaderToggle());
        this.vtManager.init(viewRoot, this.settings?.expandedNodes);
        // Access internal instance for highlight calls
        this.virtualTree = (this.vtManager as unknown as { vt?: ComplexVirtualTree }).vt ?? null;

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
        logger.log('[TreeMapper] onOpen completed successfully');
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
     * No longer needed - we've unified the tree building approach
     * and don't need to watch for container changes
     */
    private _setupContainerWatcher(): void { /* no-op */ }

    /**
     * No longer needed - we've unified the tree building approach
     * and don't need to restore the view
     */
    private async _restoreViewIfNeeded(): Promise<void> { /* no-op */ }

    /**
     * No longer needed - we've unified the tree building approach
     * and don't need restoration tracking
     */
    private _resetRestorationTracking(): void { /* no-op */ }

    /**
     * No longer needed - we've unified the tree building approach
     * and don't need stability checks
     */
    private _setupStabilityCheck(): void { /* no-op */ }

    /**
     * No longer needed - we've unified the tree building approach
     * and don't need stability check timers
     */
    private _clearStabilityCheckTimers(): void { /* no-op */ }

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

    /**
     * Prepare the header/body containers and baseline controls.
     */
    /**
     * Ensures the view structure exists in the container.
     * This is a helper method that can be called before any operation that requires
     * the view structure to be in place.
     */
    private _ensureViewStructureExists(container: HTMLElement): void {
        // Just use the standard setup method - simpler and more reliable
        this._setupViewContainers(container);
    }

    private _setupViewContainers(container: HTMLElement): void {
        // Minimal compatibility: ensure a tree container exists
        const existingBody = container.querySelector('.tm_view-body');
        const body = existingBody instanceof HTMLElement ? existingBody : container;
        const existingTree = body.querySelector('.tm_view-tree');
        if (existingTree instanceof HTMLElement) {
            this.container = existingTree;
            return;
        }
        const tree = document.createElement('div');
        tree.className = 'tm_view-tree';
        body.appendChild(tree);
        this.container = tree;
    }

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
        if (!this.activeFile) return;

        if (this.virtualTree) { this.virtualTree.revealPath(this.activeFile.path); return; }
    }

    private _highlightInLegacyTree(): void { /* legacy renderer removed */ }

    /**
     * Save the expanded state of nodes
     */
    private saveExpandedState(): void { /* handled by vtManager */ }

    /**
     * Restore the expanded state of nodes
     */
    private restoreExpandedState(): void { /* handled by vtManager */ }

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

    private async _rebuildVirtualIfActive(_newPath?: string, _oldPath?: string): Promise<boolean> { return false; }

    private _tryIncrementalRefresh(_changedPath: string): boolean {
        // For consistency, we're going to avoid incremental updates
        // and always use the full virtualized tree rebuild approach
        // This ensures we always use the same rendering method
        return false;
        
        /* Original incremental update code kept for reference
        const success = this.eventHandler.tryIncrementalUpdate(
            changedPath,
            this.container!,
            this.lastBuiltTree,
            this.nodePathMap,
            (node, container) => this.nodeRenderer.renderDendronNode(node, container, this.expandedNodes)
        );
        if (success) this.highlightActiveFile();
        return success;
        */
    }

    private async _fullRefresh(): Promise<void> { /* handled by vtManager */ }

    async buildDendronTree(_container: HTMLElement) { /* legacy renderer removed */ }

    /**
     * Build the Dendron structure and initialize (or refresh) the virtualized tree view.
     */
    private async buildVirtualizedDendronTree(_rootContainer: HTMLElement): Promise<void> { /* superseded by VirtualTreeManager */ }

    private _syncHeaderToggle(): void {
        if (!this.layout) return;
        const expandedCount = this.vtManager?.getExpandedPaths().length ?? 0;
        this.layout.updateToggleDisplay(expandedCount > 0);
    }

    // computeRowHeight/computeGap moved to src/utils/measure.ts

    /**
     * Build a map of paths to nodes for quick lookups
     */
    private buildNodePathMap(_node: unknown): void { /* legacy no-op */ }

    /**
     * Get expanded nodes for saving in settings
     */
    public getExpandedNodesForSettings(): string[] {
        if (this.vtManager) return this.vtManager.getExpandedPaths();
        if (this.virtualTree) return this.virtualTree.getExpandedPaths();
        return [];
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
        logger.log('[TreeMapper] onClose called, cleaning up resources');

        // Remove all event listeners through the event handler
        if (this.eventHandler) {
            // The eventHandler will handle cleaning up its own event listeners
            this.eventHandler.unregisterFileEvents();
        }

        // No observers or timers to clean up anymore

        // Clear references
        this.container = null;
        if (this.vtManager) this.vtManager.destroy();
        this.activeFile = null;

        logger.log('[TreeMapper] onClose cleanup completed');
    }
} 
