import { ItemView, Platform, TFile, WorkspaceLeaf } from 'obsidian';
import { t } from '../i18n';
import { FILE_TREE_VIEW_TYPE, PluginSettings, TREE_VIEW_ICON, TreeNode } from '../types';
import { DendronEventHandler } from '../utils/EventHandler';
import { TreeBuilder } from '../utils/TreeBuilder';
import { ExpandedNodesManager } from './ExpandedNodesManager';
import { TreeRenderer } from './TreeRenderer';

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
        
        // Create the actual tree container inside the scroll container
        const treeContainer = document.createElement('div');
        treeContainer.className = 'tm_view-tree';
        scrollContainer.appendChild(treeContainer);
        this.container = treeContainer;
        
        // Initialize controls with the container
        this.controls = new ExpandedNodesManager(this.containerEl, this.expandedNodes);
        
        // Add control buttons to the header
        this.controls.addControlButtons(header);

        // Wait for CSS to be loaded by checking if the styles are applied
        await this.waitForCSSLoad();

        // Register file system events
        this.eventHandler.registerFileEvents();

        // Register event for active file change
        this.eventHandler.registerActiveFileEvents((file) => {
            this.activeFile = file;
            this.highlightActiveFile();
        });

        // Build the dendron tree
        await this.buildDendronTree(treeContainer);

        // Add the main event handler to the tree container
        this.nodeRenderer.addTreeEventHandler(treeContainer);

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
        if (!this.activeFile || !this.container) return;

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
        return this.controls ? this.controls.getExpandedNodesForSettings() : Array.from(this.expandedNodes);
    }

    /**
     * Restore expanded nodes from settings
     */
    public restoreExpandedNodesFromSettings(nodes: string[]): void {
        this.expandedNodes = new Set(nodes);
        if (this.controls) {
            this.controls.restoreExpandedNodesFromSettings(nodes);
        }
    }

    /**
     * Collapse all nodes in the tree
     */
    public collapseAllNodes(): void {
        if (this.controls) {
            this.controls.collapseAllNodes();
        }
    }

    /**
     * Expand all nodes in the tree
     */
    public expandAllNodes(): void {
        if (this.controls) {
            this.controls.expandAllNodes();
        }
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