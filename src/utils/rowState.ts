/**
 * Utility functions for row state management and improved scrolling behavior
 */

/**
 * Sets dynamic indentation using CSS custom properties
 * Works with the CSS rule: padding-left: calc(var(--dotn_view-padding) + var(--dotn_gap) + (var(--row-indent, 0) * 20px))
 */
export function setRowIndentation(row: HTMLElement, level: number): void {
  row.style.setProperty('--row-indent', String(level));
}

/**
 * Unified scrolling system that handles all scroll scenarios in the application
 */

export interface UnifiedScrollOptions {
  /** Element to scroll into view (for element-based scrolling) */
  target?: HTMLElement;
  /** Container to scroll within */
  container?: HTMLElement;
  /** Row index to scroll to (for virtual tree scrolling) */
  rowIndex?: number;
  /** Row height for virtual tree calculations */
  rowHeight?: number;
  /** Total number of rows in virtual tree */
  totalRows?: number;
  /** Padding around the target (in pixels or CSS var name) */
  padding?: number | string;
  /** Whether to use smooth scrolling */
  smooth?: boolean;
  /** Vertical alignment: 'start' | 'center' | 'end' | 'auto' */
  blockAlign?: 'start' | 'center' | 'end' | 'auto';
  /** Horizontal alignment: 'start' | 'center' | 'end' | 'auto' */
  inlineAlign?: 'start' | 'center' | 'end' | 'auto';
  /** Number of buffer rows for virtual scrolling (default: 3) */
  bufferRows?: number;
}

/**
 * Unified scroll function that handles all scrolling scenarios:
 * - Virtual tree row scrolling with index
 * - Element-based scrolling with target
 * - Both horizontal and vertical scrolling
 * - Proper padding with CSS variable support
 */
export function scrollIntoView(options: UnifiedScrollOptions): void {
  const {
    target,
    container,
    rowIndex,
    rowHeight,
    totalRows,
    padding = 'var(--dotn_view-padding, 16px)',
    smooth = true,
    blockAlign = 'auto',
    inlineAlign = 'auto',
    bufferRows = 3
  } = options;

  // Resolve padding value (support CSS variables)
  const getPaddingValue = (): number => {
    if (typeof padding === 'number') return padding;
    if (typeof padding === 'string' && padding.startsWith('var(')) {
      // Try to extract default value from CSS variable
      const defaultMatch = padding.match(/var\([^,]+,\s*([^)]+)\)/);
      if (defaultMatch) {
        const defaultValue = defaultMatch[1].trim();
        return parseFloat(defaultValue) || 16;
      }
      // Fallback to a reasonable default
      return 16;
    }
    return parseFloat(padding) || 16;
  };

  const paddingPx = getPaddingValue();

  // Find the scroll container
  let scrollContainer = container;
  if (!scrollContainer) {
    if (target) {
      let parent = target.offsetParent;
      while (parent && parent instanceof HTMLElement) {
        const style = getComputedStyle(parent);
        if (style.overflow !== 'visible' || style.overflowY !== 'visible' || style.overflowX !== 'visible') {
          scrollContainer = parent;
          break;
        }
        parent = parent.offsetParent;
      }
      scrollContainer = scrollContainer || document.documentElement;
    } else {
      // No target element, can't determine container
      return;
    }
  }

  if (!(scrollContainer instanceof HTMLElement)) return;

  const currentScrollTop = scrollContainer.scrollTop;
  const currentScrollLeft = scrollContainer.scrollLeft;
  let newScrollTop = currentScrollTop;
  let newScrollLeft = currentScrollLeft;

  // Handle virtual tree row scrolling
  if (typeof rowIndex === 'number' && typeof rowHeight === 'number') {
    if (rowIndex < 0 || (typeof totalRows === 'number' && rowIndex >= totalRows)) return;

    const rowTop = rowIndex * rowHeight;
    const rowBottom = rowTop + rowHeight;
    const viewTop = currentScrollTop;
    const viewBottom = viewTop + scrollContainer.clientHeight;
    
    // Check if row is already visible with padding
    const visibleTop = viewTop + paddingPx;
    const visibleBottom = viewBottom - paddingPx;
    
    if (rowTop >= visibleTop && rowBottom <= visibleBottom) {
      // Row is already visible, no need to scroll
      return;
    }

    // Calculate scroll position with buffer
    if (blockAlign === 'center') {
      const centerY = rowTop + (rowHeight / 2) - (scrollContainer.clientHeight / 2);
      newScrollTop = Math.max(0, centerY);
    } else if (blockAlign === 'end' || (blockAlign === 'auto' && rowBottom > visibleBottom)) {
      newScrollTop = Math.max(0, rowBottom - scrollContainer.clientHeight + paddingPx);
    } else {
      // 'start' or 'auto' when row is above viewport
      newScrollTop = Math.max(0, (rowIndex - bufferRows) * rowHeight);
    }

    // Clamp to valid scroll range
    if (typeof totalRows === 'number') {
      const maxScrollTop = Math.max(0, totalRows * rowHeight - scrollContainer.clientHeight);
      newScrollTop = Math.min(newScrollTop, maxScrollTop);
    }
  }

  // Handle element-based scrolling
  if (target) {
    const targetRect = target.getBoundingClientRect();
    const containerRect = scrollContainer.getBoundingClientRect();
    
    // Calculate target position relative to scroll container
    const targetTop = targetRect.top - containerRect.top + currentScrollTop;
    const targetLeft = targetRect.left - containerRect.left + currentScrollLeft;
    const targetBottom = targetTop + targetRect.height;

    // Calculate visible area with padding
    const visibleTop = currentScrollTop + paddingPx;
    const visibleLeft = currentScrollLeft + paddingPx;
    const visibleBottom = currentScrollTop + scrollContainer.clientHeight - paddingPx;
    
    // Vertical scrolling (only if not already handled by rowIndex)
    if (typeof rowIndex !== 'number') {
      if (blockAlign === 'start' || (blockAlign === 'auto' && targetTop < visibleTop)) {
        newScrollTop = Math.max(0, targetTop - paddingPx);
      } else if (blockAlign === 'end' || (blockAlign === 'auto' && targetBottom > visibleBottom)) {
        newScrollTop = Math.max(0, targetBottom - scrollContainer.clientHeight + paddingPx);
      } else if (blockAlign === 'center') {
        const centerY = targetTop + (targetRect.height / 2) - (scrollContainer.clientHeight / 2);
        newScrollTop = Math.max(0, centerY);
      }
    }
    
    // Horizontal scrolling (always handled by element)
    if (inlineAlign === 'start' || (inlineAlign === 'auto' && targetLeft < visibleLeft)) {
      newScrollLeft = Math.max(0, targetLeft - paddingPx);
    } else if (inlineAlign === 'center') {
      const centerX = targetLeft + (targetRect.width / 2) - (scrollContainer.clientWidth / 2);
      newScrollLeft = Math.max(0, centerX);
    }
  }

  // Apply the scroll if needed
  if (newScrollTop !== currentScrollTop || newScrollLeft !== currentScrollLeft) {
    if (smooth && 'scrollTo' in scrollContainer) {
      try {
        scrollContainer.scrollTo({
          top: newScrollTop,
          left: newScrollLeft,
          behavior: 'smooth'
        });
      } catch {
        // Fallback for browsers that don't support smooth scrolling
        scrollContainer.scrollTop = newScrollTop;
        scrollContainer.scrollLeft = newScrollLeft;
      }
    } else {
      scrollContainer.scrollTop = newScrollTop;
      scrollContainer.scrollLeft = newScrollLeft;
    }
  }
}
