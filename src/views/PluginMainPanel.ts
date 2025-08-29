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

    constructor(leaf: WorkspaceLeaf, settings: PluginSettings) {
        super(leaf);
        this.instanceId = ++PluginMainPanel.instanceCounter;
        this.settings = settings;
        
        // Initialize components
        this.nodeRenderer = new TreeRenderer(this.app, this.fileItemsMap);
        // Use 500ms debounce time for better performance when files change
        this.eventHandler = new DendronEventHandler(this.app, this.refresh.bind(this), 500);
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
        const container = this.containerEl.children[1];
        container.empty();
        
        // Set the main container to be a flex container with column direction
        container.addClass('tm_view');
        // If on mobile, add the mobile class
        if (Platform.isMobile) {
            container.addClass('tm_view-mobile');
        }

        // Create a fixed header with controls
        const header = document.createElement('div');
        header.className = 'tm_view-header';
        container.appendChild(header);
        
        // Create a scrollable container for the dendron tree
        const scrollContainer = document.createElement('div');
        scrollContainer.className = 'tm_view-body';
        container.appendChild(scrollContainer);
        
        // Create the actual tree container inside the scroll container (kept for legacy rendering)
        const treeContainer = document.createElement('div');
        treeContainer.className = 'tm_view-tree';
        scrollContainer.appendChild(treeContainer);
        this.container = treeContainer;
        
        // Initialize controls with the container
        this.controls = new ExpandedNodesManager(this.containerEl, this.expandedNodes);
        
        // Add control buttons to the header
        this.controls.addControlButtons(header);

        // Add a button to reveal the current/active file in the tree
        const revealBtn = document.createElement('div');
        revealBtn.className = 'tm_button-icon';
        setIcon(revealBtn, 'locate-fixed');
        revealBtn.setAttribute('title', t('tooltipRevealActiveFile'));
        header.appendChild(revealBtn);
        revealBtn.addEventListener('click', () => {
            // Prefer the tracked activeFile, fallback to workspace active file
            const file = this.activeFile ?? this.app.workspace.getActiveFile();
            if (file) {
                this.activeFile = file;
                this.highlightActiveFile();
            }
        });

        // Wait for CSS to be loaded by checking if the styles are applied
        await this.waitForCSSLoad();

        // Register file system events
        this.eventHandler.registerFileEvents();

        // Register event for active file change
        this.eventHandler.registerActiveFileEvents((file) => {
            this.activeFile = file;
            this.highlightActiveFile();
        });

        // Build the dendron tree and initialize the virtualized view
        await this.buildVirtualizedDendronTree(container as HTMLElement);

        // Get the active file when the view is first opened
        const activeFile = this.app.workspace.getActiveFile();
        if (activeFile) {
            this.activeFile = activeFile;
            // Use a small timeout to ensure the tree is fully rendered
            setTimeout(() => {
                this.highlightActiveFile();
            }, 500);
        }
    }

    /**
     * Wait for CSS to be loaded by checking if the styles are applied
     */
    private waitForCSSLoad(): Promise<void> {
        return new Promise((resolve) => {
            const checkCSS = () => {
                if (!this.container) {
                    setTimeout(checkCSS, 10);
                    return;
                }
                
                // Check if the styles are applied by looking for a specific CSS variable
                const computedStyle = window.getComputedStyle(this.container);
                if (computedStyle.getPropertyValue('--tm_css-is-loaded')) {
                    resolve();
                } else {
                    // If styles are not loaded yet, check again in a short while
                    setTimeout(checkCSS, 10);
                }
            };
            checkCSS();
        });
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

        if (!this.container) return;

        // Clear previous active file highlighting
        const previousActive = this.container.querySelector('.tm_tree-item-title.is-active');
        if (previousActive) {
            previousActive.removeClass('is-active');
        }

        // Find the element for the active file
        const filePath = this.activeFile.path;
        const fileItem = this.fileItemsMap.get(filePath);

        if (fileItem) {
            // Add active class
            fileItem.addClass('is-active');
            
            // Scroll into view with a small delay to ensure DOM is updated
            setTimeout(() => {
                fileItem.scrollIntoView({ behavior: 'smooth', block: 'center' });
            }, 50);
            
            // Ensure all parent folders are expanded
            let parent = fileItem.closest('.tm_tree-item-container');
            while (parent) {
                if (parent.hasClass('is-collapsed')) {
                    parent.removeClass('is-collapsed');
                    
                    // Update expanded nodes set
                    const path = parent.getAttribute('data-path');
                    if (path) {
                        this.expandedNodes.add(path);
                    }
                }
                const parentElement = parent.parentElement;
                parent = parentElement ? parentElement.closest('.tm_tree-item-container') : null;
            }
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
    
    async refresh(changedPath?: string, forceFullRefresh: boolean = false) {
        if (!this.container) {
            return;
        }

        // If using virtualized tree, rebuild virtual data outright on changes
        if (this.virtualTree) {
            await this.buildVirtualizedDendronTree(this.containerEl.children[1] as HTMLElement);
            if (this.activeFile) this.virtualTree.revealPath(this.activeFile.path);
            return;
        }

        // Don't attempt incremental update if forceFullRefresh is true
        if (changedPath && !forceFullRefresh) {
            // Try incremental update
            const incrementalSuccess = this.eventHandler.tryIncrementalUpdate(
                changedPath, 
                this.container, 
                this.lastBuiltTree, 
                this.nodePathMap,
                (node, container) => this.nodeRenderer.renderDendronNode(node, container, this.expandedNodes)
            );
            
            if (incrementalSuccess) {
                this.highlightActiveFile();
                return;
            }
        }

        // Save expanded state before refresh
        this.saveExpandedState();
        
        // Clear the container and maps
        this.container.empty();
        this.fileItemsMap.clear();
        
        // Build the dendron tree
        await this.buildDendronTree(this.container);
        
        // Restore expanded state
        this.restoreExpandedState();
        
        // Highlight active file
        this.highlightActiveFile();
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
        // Build dendron structure
        const folders = this.app.vault.getAllFolders();
        const files = this.app.vault.getFiles();
        const treeBuilder = new TreeBuilder();
        const rootNode = treeBuilder.buildDendronStructure(folders, files);
        this.lastBuiltTree = rootNode;

        // Convert to virtualized data and remember parent relationships
        const { data, parentMap } = buildVirtualizedData(rootNode);

        // Tear down previous
        if (this.virtualTree) {
            this.virtualTree.destroy();
            this.virtualTree = null;
        } 

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
                logger.log('[TreeMapper] Error logging expanded nodes status:', error);
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
            const replacement = existingToggle.cloneNode(true) as HTMLElement;
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

    private updateHeaderToggleIcon(): void {
        const rootContainer = this.containerEl.children[1] as HTMLElement;
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
                logger.log('[TreeMapper] Error setting expand icon:', error);
            }
            toggleButton.setAttribute('title', t('tooltipExpandAll'));
        } else {
            try { 
                setIcon(iconContainer, 'chevrons-down-up'); 
            } catch (error) {
                logger.log('[TreeMapper] Error setting collapse icon:', error);
            }
            toggleButton.setAttribute('title', t('tooltipCollapseAll'));
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
            logger.log('[TreeMapper] Error computing row height:', error);
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
            logger.log('[TreeMapper] Error computing gap:', error);
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
        // Save expanded state before closing
        this.saveExpandedState();
        
        // Remove all event listeners through the event handler
        if (this.eventHandler) {
            // The eventHandler will handle cleaning up its own event listeners
            this.eventHandler.unregisterFileEvents();
        }
        
        // Clear references
        this.container = null;
        this.lastBuiltTree = null;
        this.fileItemsMap.clear();
        this.activeFile = null;
    }
} 
