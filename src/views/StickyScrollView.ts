import { ExpandedNodesManager } from './ExpandedNodesManager';
import { FileUtils } from '../utils/FileUtils';
import { StickyScrollManager } from '../utils/StickyScrollManager';
import { App, setIcon } from 'obsidian';

export class StickyScrollView {
    private container: HTMLElement;
    private expandedNodesManager: ExpandedNodesManager;
    private scrollThreshold: number = 0;
    private stickyElement: HTMLElement;
    private lastScrollTop: number = 0;
    private isScrollingDown: boolean = true;
    private app: App;
    private lastUpdateTime: number = 0;
    private readonly THROTTLE_INTERVAL: number = 16; // ~60fps

    constructor(
        container: HTMLElement,
        expandedNodesManager: ExpandedNodesManager,
        app: App,
    ) {
        this.container = container;
        this.expandedNodesManager = expandedNodesManager;
        this.app = app;

        // Create and setup the sticky element
        this.stickyElement = this.createStickyElement();
    }

    /**
     * Get the sticky element
     */
    public getElement(): HTMLElement {
        return this.stickyElement;
    }

    /**
     * Create the sticky element
     */
    private createStickyElement(): HTMLElement {
        const element = document.createElement('div');
        element.className = 'tm_sticky-scroll-element';
        return element;
    }

    /**
     * Set a new scroll threshold
     */
    setScrollThreshold(threshold: number): void {
        this.scrollThreshold = threshold;
    }

    /**
     * Detect scroll direction
     */
    private updateScrollDirection(scrollContainer: HTMLElement): void {
        const currentScrollTop = scrollContainer.scrollTop;
        this.isScrollingDown = currentScrollTop > this.lastScrollTop;
        this.lastScrollTop = currentScrollTop;
    }

    /**
     * Throttled update function
     */
    private throttledUpdate(scrollContainer: HTMLElement): void {
        const now = Date.now();
        if (now - this.lastUpdateTime >= this.THROTTLE_INTERVAL) {
            this.updateScrollDirection(scrollContainer);
            this.logClosestVisibleElement();
            this.lastUpdateTime = now;
        }
    }

    /**
     * Find and log the closest visible element to the threshold
     */
    public logClosestVisibleElement(): void {
        // Get all tree items that are expanded
        const expandedItems = Array.from(this.container.querySelectorAll('.tm_tree-item-container:not(.is-collapsed)'));
        
        // If there are no expanded items, return early
        if (expandedItems.length === 0) {
            return;
        }

        // Get the line height of a tree item with a default value
        const firstItem = expandedItems[0];
        const itemSelf = firstItem.querySelector('.tm_tree-item-self');
        const buttonIcon = firstItem.querySelector('.tm_button-icon');
        
        const lineHeight = itemSelf?.getBoundingClientRect().height ?? 24; // Default to 24px if not found
        const buttonWidth = buttonIcon?.getBoundingClientRect().width ?? 24; // Default to 24px if not found
        
        // Get the padding of the tree view with a default value
        const treeView = document.querySelector('.tm_view-tree') as HTMLElement;
        const padding = treeView?.style.paddingLeft ?? '0';

        const closestElement = expandedItems.find(item => {
            if (!item) {
                return false;
            }
            const rect = item.getBoundingClientRect();
            const containerRect = this.container.getBoundingClientRect();

            // Calculate the element's position relative to the container
            const relativeTop = rect.top - containerRect.top;

            // When scrolling down, check if the TOP of the element is above the threshold
            // When scrolling up, check if the BOTTOM of the element is above the threshold
            return relativeTop + (this.isScrollingDown ? 0 : lineHeight) + 1 >= this.scrollThreshold;
        });

        if (closestElement) {
            const path = closestElement.getAttribute('data-path');
            if (path) {
                // Update the stack size based on the path depth
                const stackSize = FileUtils.getPathDepth(path);
                this.stickyElement.setAttribute('data-stack-size', stackSize.toString());

                const lineHeight = closestElement.querySelector('.tm_tree-item-self')?.getBoundingClientRect().height ?? 0;
                this.stickyElement.style.height = `calc(${lineHeight}px * ${stackSize})`;

                // Update the scroll threshold to be the bottom of the sticky element
                const stickyRect = this.stickyElement.getBoundingClientRect();
                const containerRect = this.container.getBoundingClientRect();
                this.scrollThreshold = stickyRect.bottom - containerRect.top;

                // Clean the breadcrumb stack
                this.stickyElement.innerHTML = '';

                // Create the breadcrumb stack
                const ancestorPaths = StickyScrollManager.getAncestorPaths(path);
                // For each ancestor path, create a breadcrumb element
                ancestorPaths.forEach(path => {
                    const stickyHeaderContainer = document.createElement('div');
                    stickyHeaderContainer.className = 'tm_sticky-header-container';

                    const leftSpacing = (FileUtils.getPathDepth(path) * buttonWidth);
                    const spacer = document.createElement('div');
                    spacer.style.display = 'inline-block';
                    spacer.className = 'tm_sticky-spacer';
                    spacer.style.width = `${leftSpacing}px`;

                    const headerContent = document.createElement('span');
                    headerContent.className = 'tm_sticky-header';
                    headerContent.textContent = FileUtils.basename(path).match(/([^.]+)\.[^.]+$/)?.[1] || FileUtils.basename(path);
                    
                    stickyHeaderContainer.appendChild(spacer);
                    // If the path is a folder, add a folder icon
                    if (FileUtils.isFolder(this.app, path)) {
                        const folderIcon = document.createElement('span');
                        folderIcon.className = 'tm_icon tm_sticky-icon';
                        folderIcon.style.width = '16px';
                        folderIcon.setAttribute('data-icon-name', 'folder');
                        setIcon(folderIcon, 'folder');
                        stickyHeaderContainer.appendChild(folderIcon);
                    }
                    stickyHeaderContainer.appendChild(headerContent);
                    this.stickyElement.appendChild(stickyHeaderContainer);
                });
            }
        }
    }

    /**
     * Start monitoring scroll events
     */
    public startScrollMonitoring(scrollContainer: HTMLElement): void {
        // Initialize lastScrollTop
        this.lastScrollTop = scrollContainer.scrollTop;

        scrollContainer.addEventListener('scroll', () => {
            this.throttledUpdate(scrollContainer);
        });
    }
}