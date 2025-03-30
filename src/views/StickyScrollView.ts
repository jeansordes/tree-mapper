import { ExpandedNodesManager } from './ExpandedNodesManager';
import { FileUtils } from '../utils/FileUtils';

export class StickyScrollView {
    private container: HTMLElement;
    private expandedNodesManager: ExpandedNodesManager;
    private scrollThreshold: number;
    private throttleInterval: number;
    private lastExecutionTime: number = 0;
    private stickyElement: HTMLElement;
    private lastScrollTop: number = 0;
    private isScrollingDown: boolean = true;
    private scrollTimeout: number | null = null;
    private readonly SCROLL_STOP_DELAY: number = 100; // ms to wait before considering scroll stopped

    constructor(
        container: HTMLElement,
        expandedNodesManager: ExpandedNodesManager,
        scrollThreshold: number = 0,
        throttleInterval: number = 100
    ) {
        this.container = container;
        this.expandedNodesManager = expandedNodesManager;
        this.scrollThreshold = scrollThreshold;
        this.throttleInterval = throttleInterval;

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
     * Set a new throttle interval
     */
    setThrottleInterval(interval: number): void {
        this.throttleInterval = interval;
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
     * Throttled logging function
     */
    private throttledLog(scrollContainer: HTMLElement): void {
        const now = Date.now();
        if (now - this.lastExecutionTime >= this.throttleInterval) {
            this.updateScrollDirection(scrollContainer);
            this.logClosestVisibleElement();
            this.lastExecutionTime = now;
        }
    }

    /**
     * Find and log the closest visible element to the threshold
     */
    private logClosestVisibleElement(): void {
        // Get all tree items that are expanded
        const expandedItems = Array.from(this.container.querySelectorAll('.tm_tree-item-container:not(.is-collapsed)'));

        // Get the line height of a tree item
        const lineHeight = expandedItems[0].querySelector('.tm_tree-item-self')?.getBoundingClientRect().height ?? 0;

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
            return relativeTop + (this.isScrollingDown ? 0 : lineHeight) >= this.scrollThreshold;
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

                // Create the breadcrumb stack, by getting parent path
                const breadcrumbStack = closestElement.querySelector('.tm_breadcrumb-stack');
                if (breadcrumbStack) {
                    this.stickyElement.appendChild(breadcrumbStack);
                }


                console.log('Closest visible element:', {
                    path,
                    element: closestElement,
                    stackSize,
                    threshold: this.scrollThreshold,
                    isScrollingDown: this.isScrollingDown
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
            this.throttledLog(scrollContainer);

            // Clear any existing timeout
            if (this.scrollTimeout !== null) {
                window.clearTimeout(this.scrollTimeout);
            }

            // Set a new timeout to detect when scrolling stops
            this.scrollTimeout = window.setTimeout(() => {
                this.logClosestVisibleElement();
                this.scrollTimeout = null;
            }, this.SCROLL_STOP_DELAY);
        });
    }
}