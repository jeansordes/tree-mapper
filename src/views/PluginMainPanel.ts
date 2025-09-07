import { ItemView, Platform, TFile, WorkspaceLeaf, setIcon } from 'obsidian';
import { t } from '../i18n';
import { FILE_TREE_VIEW_TYPE, PluginSettings, TREE_VIEW_ICON, TreeNode } from '../types';
import { DendronEventHandler } from '../utils/EventHandler';
import { TreeBuilder } from '../utils/TreeBuilder';
import { ExpandedNodesManager } from './ExpandedNodesManager';
import { TreeRenderer } from './TreeRenderer';
import { buildVirtualizedData, ComplexVirtualTree } from './VirtualizedTree';
import { logger } from '../utils/logger';

// Dendron Tree View class
export default class PluginMainPanel extends ItemView {
    private static instanceCounter = 0;
    private instanceId: number;
    private lastBuiltTree: TreeNode | null = null;
    private container: HTMLElement | null = null;
    private activeFile: TFile | null = null;
    private fileItemsMap: Map<string, HTMLElement> = new Map();
    private nodePathMap: Map<string, TreeNode> = new Map();
    private expandedNodes: Set<string> = new Set();
    private settings: PluginSettings;

    // Component instances
    private nodeRenderer: TreeRenderer;
    private virtualTree: ComplexVirtualTree | null = null;
    private eventHandler: DendronEventHandler;
    private controls: ExpandedNodesManager;

    // Internal state for tracking initialization
    private _onOpenCalled: boolean = false;

    constructor(leaf: WorkspaceLeaf, settings: PluginSettings) {
        super(leaf);
        this.instanceId = ++PluginMainPanel.instanceCounter;
        this.settings = settings;

        // Initialize components
        this.nodeRenderer = new TreeRenderer(this.app, this.fileItemsMap);
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
        if (viewRoot instanceof HTMLElement) {
            // Set up the view containers
            this._setupViewContainers(viewRoot);

            // Wait for CSS to be loaded by checking if the styles are applied
            await this.waitForCSSLoad();

            // Register workspace + vault events
            this._registerEventHandlers();

            // Build the dendron tree and initialize the virtualized view
            await this.buildVirtualizedDendronTree(viewRoot);

            // Highlight current file once initial render is ready
            this._highlightInitialActiveFile();

            logger.log('[TreeMapper] onOpen completed successfully');
        } else {
            logger.error('[TreeMapper] Error: containerEl is not an HTMLElement:', {
                containerEl: this.containerEl,
                type: typeof this.containerEl
            });
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
     * No longer needed - we've unified the tree building approach
     * and don't need to watch for container changes
     */
    private _setupContainerWatcher(): void {
        // This method is kept as a no-op to avoid changing all the call sites
        // We don't need to watch the container anymore since we've unified the tree building approach
    }

    /**
     * No longer needed - we've unified the tree building approach
     * and don't need to restore the view
     */
    private async _restoreViewIfNeeded(): Promise<void> {
        // This method is kept as a no-op to avoid changing all the call sites
        // We don't need to restore the view anymore since we've unified the tree building approach
    }

    /**
     * No longer needed - we've unified the tree building approach
     * and don't need restoration tracking
     */
    private _resetRestorationTracking(): void {
        // This method is kept as a no-op to avoid changing all the call sites
        // We don't need restoration tracking anymore
    }

    /**
     * No longer needed - we've unified the tree building approach
     * and don't need stability checks
     */
    private _setupStabilityCheck(): void {
        // This method is kept as a no-op to avoid changing all the call sites
        // We don't need stability checks anymore
    }

    /**
     * No longer needed - we've unified the tree building approach
     * and don't need stability check timers
     */
    private _clearStabilityCheckTimers(): void {
        // This method is kept as a no-op to avoid changing all the call sites
        // We don't need stability check timers anymore
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
        logger.log('[TreeMapper] Setting up view containers for:', {
            container,
            containerClass: container.className,
            initialChildrenCount: container.children.length
        });

        // Check if our structure already exists
        const existingHeader = container.querySelector('.tm_view-header');
        const existingBody = container.querySelector('.tm_view-body');
        
        if (existingHeader && existingBody) {
            logger.log('[TreeMapper] View structure already exists, preserving it');
            // Structure already exists, just update classes
            container.addClass('tm_view');
            if (Platform.isMobile) container.addClass('tm_view-mobile');
            
            // Find existing tree container
            const existingTreeContainer = existingBody.querySelector('.tm_view-tree');
            if (existingTreeContainer instanceof HTMLElement) {
                this.container = existingTreeContainer;
            } else {
                // Create tree container if it doesn't exist
                const treeContainer = document.createElement('div');
                treeContainer.className = 'tm_view-tree';
                existingBody.appendChild(treeContainer);
                this.container = treeContainer;
            }
            
            // Add controls to existing header
            this.controls = new ExpandedNodesManager(this.containerEl, this.expandedNodes);
            if (existingHeader instanceof HTMLElement) {
                this.controls.addControlButtons(existingHeader);
                
                // Add reveal button to existing header
                this._addRevealActiveButton(existingHeader);
            }
            
            return;
        }
        
        // If our structure doesn't exist, create it from scratch
        container.empty(); // This is necessary to avoid duplicate elements
        
        container.addClass('tm_view');
        if (Platform.isMobile) container.addClass('tm_view-mobile');

        // Header
        const header = document.createElement('div');
        header.className = 'tm_view-header';
        container.appendChild(header);

        // Scrollable body
        const scrollContainer = document.createElement('div');
        scrollContainer.className = 'tm_view-body';
        container.appendChild(scrollContainer);

        // Legacy tree container (DOM-based renderer)
        const treeContainer = document.createElement('div');
        treeContainer.className = 'tm_view-tree';
        scrollContainer.appendChild(treeContainer);
        this.container = treeContainer;

        // Controls manager + buttons in header
        this.controls = new ExpandedNodesManager(this.containerEl, this.expandedNodes);
        this.controls.addControlButtons(header);

        // Reveal active file button
        this._addRevealActiveButton(header);

        logger.log('[TreeMapper] View containers setup complete:', {
            containerChildrenCount: container.children.length,
            containerClass: container.className,
            hasHeader: !!container.querySelector('.tm_view-header'),
            hasBody: !!container.querySelector('.tm_view-body'),
            hasTree: !!container.querySelector('.tm_view-tree')
        });
    }

    private _addRevealActiveButton(header: HTMLElement): void {
        // Avoid duplicates when header is re-initialized
        if (header.querySelector('.tm_reveal-active')) return;

        const revealBtn = document.createElement('div');
        revealBtn.className = 'tm_button-icon tm_reveal-active';
        setIcon(revealBtn, 'locate-fixed');
        revealBtn.setAttribute('title', t('tooltipRevealActiveFile'));
        header.appendChild(revealBtn);
        revealBtn.addEventListener('click', () => {
            const file = this.activeFile ?? this.app.workspace.getActiveFile();
            if (!file) return;
            this.activeFile = file;
            this.highlightActiveFile();
        });
    }

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

        // If virtual tree is active, reveal the path there
        if (this.virtualTree) {
            this.virtualTree.revealPath(this.activeFile.path);
            return;
        }

        this._highlightInLegacyTree();
    }

    private _highlightInLegacyTree(): void {
        if (!this.container || !this.activeFile) return;

        // Clear previous
        const previousActive = this.container.querySelector('.tm_tree-item-title.is-active');
        if (previousActive) previousActive.removeClass('is-active');

        // Find and mark current
        const fileItem = this.fileItemsMap.get(this.activeFile.path);
        if (!fileItem) return;

        fileItem.addClass('is-active');
        setTimeout(() => fileItem.scrollIntoView({ behavior: 'smooth', block: 'center' }), 50);

        // Ensure all parent folders are expanded
        let parent = fileItem.closest('.tm_tree-item-container');
        while (parent) {
            if (parent.hasClass('is-collapsed')) {
                parent.removeClass('is-collapsed');
                const path = parent.getAttribute('data-path');
                if (path) this.expandedNodes.add(path);
            }
            const parentElement = parent.parentElement;
            parent = parentElement ? parentElement.closest('.tm_tree-item-container') : null;
        }
    }

    /**
     * Save the expanded state of nodes
     */
    private saveExpandedState(): void {
        this.expandedNodes.clear();
        if (this.container) {
            const expandedItems = this.container.querySelectorAll('.tm_tree-item-container:not(.is-collapsed)');
            expandedItems.forEach(item => {
                const path = item.getAttribute('data-path');
                if (path) {
                    this.expandedNodes.add(path);
                }
            });
        }
    }

    /**
     * Restore the expanded state of nodes
     */
    private restoreExpandedState(): void {
        if (this.container) {
            this.expandedNodes.forEach(path => {
                const item = this.container?.querySelector(`.tm_tree-item-container[data-path="${path}"]`);
                if (item) {
                    item.removeClass('is-collapsed');
                    const triangle = item.querySelector('.right-triangle');
                    if (triangle) {
                        triangle.addClass('is-collapsed');
                    }
                }
            });
        }
    }

    async refresh(changedPath?: string, forceFullRefresh: boolean = false, oldPath?: string) {
        if (!this.container) return;

        // Prefer in-place virtualized update to avoid flicker and scroll jumps
        if (await this._rebuildVirtualIfActive(changedPath, oldPath)) return;

        // Try incremental update first unless forced (legacy path)
        if (changedPath && !forceFullRefresh && this._tryIncrementalRefresh(changedPath)) return;

        // Fallback to full refresh (legacy path)
        await this._fullRefresh();
        // Do NOT auto-scroll here. Scrolling is reserved for file-open events.
    }

    private async _rebuildVirtualIfActive(newPath?: string, oldPath?: string): Promise<boolean> {
        // If we already have a virtual tree, update its data in place
        if (!this.virtualTree) return false;

        // If this is a rename within the same parent, try an in-place rename
        if (oldPath && newPath) {
            try {
                const didRename = this.virtualTree.renamePath(oldPath, newPath);
                if (didRename) {
                    // Maintain selection to new path if active file still points there
                    if (this.activeFile) this.virtualTree.selectPath(this.activeFile.path, { reveal: false });
                    this.updateHeaderToggleIcon();
                    return true;
                }
            } catch (e) {
            logger.error('[TreeMapper] Error attempting in-place rename, will fall back to data update:', e);
            }
        }

        // Rebuild data model from vault
        const folders = this.app.vault.getAllFolders();
        const files = this.app.vault.getFiles();
        const treeBuilder = new TreeBuilder();
        const rootNode = treeBuilder.buildDendronStructure(folders, files);
        this.lastBuiltTree = rootNode;

        const { data, parentMap } = buildVirtualizedData(rootNode);
        try {
            this.virtualTree.updateData(data, parentMap);
            // Re-select active file without scrolling (handles rename path changes)
            if (this.activeFile) {
                this.virtualTree.selectPath(this.activeFile.path, { reveal: false });
            }
            // Keep header icon state in sync with expansion set
            this.updateHeaderToggleIcon();
        } catch (e) {
            logger.error('[TreeMapper] Error updating virtual tree data in-place, falling back to rebuild:', e);
            if (this.containerEl instanceof HTMLElement) await this.buildVirtualizedDendronTree(this.containerEl);
        }
        // Do NOT reveal/scroll here; only scroll on file-open events
        return true;
    }

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

    private async _fullRefresh(): Promise<void> {
        // Save expanded state for restoration later
        this.saveExpandedState();
        
        // Instead of emptying the container and rebuilding the DOM tree,
        // use the same virtualized tree building approach as the initial render
        if (this.containerEl) {
            // Use the same method as initial render
            await this.buildVirtualizedDendronTree(this.containerEl);
            
            // Restore expanded state
            this.restoreExpandedState();
        } else {
            logger.error('[TreeMapper] Error: Cannot refresh, containerEl is null');
        }
    }

    async buildDendronTree(container: HTMLElement) {
        // Get all markdown files and folders
        const folders = this.app.vault.getAllFolders();
        const files = this.app.vault.getFiles();

        // Build the dendron structure
        const treeBuilder = new TreeBuilder();
        const rootNode = treeBuilder.buildDendronStructure(folders, files);
        this.lastBuiltTree = rootNode;

        // Build the node path map for quick lookups
        this.nodePathMap.clear();
        this.buildNodePathMap(rootNode);

        // Render the tree using the node renderer
        await this.nodeRenderer.renderDendronNode(rootNode, container, this.expandedNodes);
    }

    /**
     * Build the Dendron structure and initialize (or refresh) the virtualized tree view.
     */
    private async buildVirtualizedDendronTree(rootContainer: HTMLElement): Promise<void> {
        // First, ensure our view structure exists
        this._ensureViewStructureExists(rootContainer);
        
        // Build dendron structure
        const folders = this.app.vault.getAllFolders();
        const files = this.app.vault.getFiles();
        const treeBuilder = new TreeBuilder();
        const rootNode = treeBuilder.buildDendronStructure(folders, files);
        this.lastBuiltTree = rootNode;

        // Convert to virtualized data and remember parent relationships
        const { data, parentMap } = buildVirtualizedData(rootNode);

        // Always destroy and recreate the virtual tree for now
        // This is safer until we can fix the type compatibility issues
        if (this.virtualTree) {
            try {
                this.virtualTree.destroy();
            } catch (destroyError) {
                logger.error('[TreeMapper] Error destroying virtual tree:', destroyError);
            }
            this.virtualTree = null;
        }

        // Create a new virtual tree
        logger.log('[TreeMapper] Creating new virtual tree');
        
        // Determine row height from current CSS so spacing matches visuals
        const gap = this.computeGap(rootContainer) ?? 4;
        const rowHeight = this.computeRowHeight(rootContainer) || (24 + gap); // total = content + gap

        // Initialize virtual tree anchored on the tm_view container (so it can find .tm_view-body)
        this.virtualTree = new ComplexVirtualTree({
            container: rootContainer,
            data,
            rowHeight,
            buffer: 10,
            app: this.app,
            gap,
            onExpansionChange: () => this.updateHeaderToggleIcon(),
        });
        this.virtualTree.setParentMap(parentMap);

        // Restore expanded nodes if any
        if (this.settings?.expandedNodes && this.settings.expandedNodes.length > 0) {
            this.virtualTree.setExpanded(this.settings.expandedNodes);
        } else {
            try {
                logger.log('[TreeMapper] No saved expanded nodes. All collapsed initially.');
            } catch (error) {
                logger.error('[TreeMapper] Error logging expanded nodes status:', error);
            }
        }

        // Update header toggle icon state based on expanded set via a tiny async tick
        setTimeout(() => {
            // Reuse existing header button if present; ExpandedNodesManager manages icon/title
            // but here we only keep visual up-to-date, actions are wired on click below.
            this.updateHeaderToggleIcon();
        }, 0);

        // Wire header toggle to expand/collapse all for virtual view.
        // Replace the existing element to remove any previous listeners from ExpandedNodesManager.
        const existingToggle: HTMLElement | null = rootContainer.querySelector('.tm_tree-toggle-button');
        if (existingToggle) {
            const replacement = existingToggle.cloneNode(true);
            if (replacement instanceof HTMLElement) {
                existingToggle.replaceWith(replacement);
                replacement.addEventListener('click', () => {
                    const expandedCount = this.virtualTree?.getExpandedPaths().length ?? 0;
                    if (expandedCount === 0) this.virtualTree?.expandAll();
                    else this.virtualTree?.collapseAll();
                    this.updateHeaderToggleIcon();
                });
                // Ensure icon/title reflect current expansion state after build
                this.updateHeaderToggleIcon();
                // Override any late icon updates coming from legacy manager
                setTimeout(() => this.updateHeaderToggleIcon(), 1200);
            }
        }
    }

    private updateHeaderToggleIcon(): void {
        const rootContainer = this.containerEl;
        if (rootContainer instanceof HTMLElement) {
            const toggleButton: HTMLElement | null = rootContainer.querySelector('.tm_tree-toggle-button');
            const iconContainer: HTMLElement | null = toggleButton?.querySelector('.tm_tree-toggle-icon') || null;
            if (!toggleButton || !iconContainer) return;
            const expandedCount = this.virtualTree?.getExpandedPaths().length ?? 0;
            const anyExpanded = expandedCount > 0;
            // Mirror ExpandedNodesManager behavior
            if (!anyExpanded) {
                // All collapsed -> show expand all icon
                try {
                    setIcon(iconContainer, 'chevrons-up-down');
                } catch (error) {
                    logger.error('[TreeMapper] Error setting expand icon:', error);
                }
                toggleButton.setAttribute('title', t('tooltipExpandAll'));
            } else {
                try {
                    setIcon(iconContainer, 'chevrons-down-up');
                } catch (error) {
                    logger.error('[TreeMapper] Error setting collapse icon:', error);
                }
                toggleButton.setAttribute('title', t('tooltipCollapseAll'));
            }
        }
    }

    /**
     * Compute row height based on the current CSS variables.
     * This avoids vertical gaps by matching the virtual row height with the
     * actual rendered controls/title height from styles.css (var(--tm_button-size)).
     */
    private computeRowHeight(rootContainer: HTMLElement): number | null {
        try {
            const viewBody = rootContainer.querySelector('.tm_view-body');
            const host = viewBody ?? rootContainer;

            // Measure CSS variables to px by applying them as heights
            const toPx = (cssVar: string): number => {
                const probe = document.createElement('div');
                probe.style.position = 'absolute';
                probe.style.visibility = 'hidden';
                probe.style.pointerEvents = 'none';
                probe.style.height = cssVar;
                host.appendChild(probe);
                const h = Math.round(probe.getBoundingClientRect().height);
                probe.remove();
                return Number.isFinite(h) ? h : 0;
            };

            const btnH = toPx('var(--tm_button-size)');
            const gapH = toPx('var(--tm_gap)');
            const total = btnH + gapH;
            // Guard against underestimation; fall back to 28 if too small
            if (total < 26) return 28;
            if (total > 0) return total;
        } catch (error) {
            logger.error('[TreeMapper] Error computing row height:', error);
        }
        return null;
    }

    private computeGap(rootContainer: HTMLElement): number | null {
        try {
            const viewBody = rootContainer.querySelector('.tm_view-body');
            const host = viewBody ?? rootContainer;
            const probe = document.createElement('div');
            probe.style.position = 'absolute';
            probe.style.visibility = 'hidden';
            probe.style.pointerEvents = 'none';
            probe.style.height = 'var(--tm_gap)';
            host.appendChild(probe);
            const h = Math.round(probe.getBoundingClientRect().height);
            probe.remove();
            if (Number.isFinite(h) && h >= 0) return h;
        } catch (error) {
            logger.error('[TreeMapper] Error computing gap:', error);
        }
        return null;
    }

    /**
     * Build a map of paths to nodes for quick lookups
     */
    private buildNodePathMap(node: TreeNode): void {
        for (const [name, childNode] of node.children.entries()) {
            const path = name;
            this.nodePathMap.set(path, childNode);
            this.buildNodePathMap(childNode);
        }
    }

    /**
     * Get expanded nodes for saving in settings
     */
    public getExpandedNodesForSettings(): string[] {
        if (this.virtualTree) return this.virtualTree.getExpandedPaths();
        return this.controls ? this.controls.getExpandedNodesForSettings() : Array.from(this.expandedNodes);
    }

    /**
     * Restore expanded nodes from settings
     */
    public restoreExpandedNodesFromSettings(nodes: string[]): void {
        this.expandedNodes = new Set(nodes);
        if (this.virtualTree) {
            this.virtualTree.setExpanded(nodes);
        }
        if (this.controls) {
            this.controls.restoreExpandedNodesFromSettings(nodes);
        }
    }

    /**
     * Collapse all nodes in the tree
     */
    public collapseAllNodes(): void {
        if (this.virtualTree) this.virtualTree.collapseAll();
        if (this.controls) this.controls.collapseAllNodes();
    }

    /**
     * Expand all nodes in the tree
     */
    public expandAllNodes(): void {
        if (this.virtualTree) this.virtualTree.expandAll();
        if (this.controls) this.controls.expandAllNodes();
    }

    /**
     * Clean up resources when the view is closed
     */
    async onClose() {
        logger.log('[TreeMapper] onClose called, cleaning up resources');

        // Save expanded state before closing
        this.saveExpandedState();

        // Remove all event listeners through the event handler
        if (this.eventHandler) {
            // The eventHandler will handle cleaning up its own event listeners
            this.eventHandler.unregisterFileEvents();
        }

        // No observers or timers to clean up anymore

        // Clear references
        this.container = null;
        this.lastBuiltTree = null;
        this.fileItemsMap.clear();
        this.activeFile = null;

        logger.log('[TreeMapper] onClose cleanup completed');
    }
} 
