// Browser globals are provided by Obsidian runtime
import { flattenTree } from '../flatten';
// import { updateInstanceStyles } from '../views/styleSheet';
import { computeWindow } from '../utils';
import {
  Virtualizer as TSVirtualizer,
  elementScroll,
  observeElementOffset,
  observeElementRect,
} from '@tanstack/virtual-core';
import { VirtualTreeBaseItem, VirtualTreeItem, VirtualTreeOptions } from '../types';
import createDebug from 'debug';
const debug = createDebug('dot-navigator:virtual-tree');
const debugError = debug.extend('error');

export class VirtualTree {
  private container: HTMLElement;
  private rowHeight: number;
  private buffer: number;
  private onOpen: (item: VirtualTreeItem) => void;
  private onSelect: (item: VirtualTreeItem) => void;
  private expanded: Map<string, boolean>;
  private focusedIndex: number;
  private selectedIndex: number;
  private virtualizer: HTMLElement;
  private pool: HTMLElement[];
  private visibleCount: number;
  private poolSize: number;
  private data: VirtualTreeBaseItem[];
  private visible: VirtualTreeItem[];
  private total: number;
  private _onScroll: () => void;
  // Store the exact scroll handler we add so we can remove it later
  private _scrollHandler?: () => void;
  private _onKeyDown: (e: KeyboardEvent) => void;

  // Optional external scroll container (e.g., Obsidian view body)
  public scrollContainer?: Element;

  // TanStack Virtualizer instance and unsubscribe
  private _v?: TSVirtualizer<HTMLElement, HTMLElement>;
  private _vunsub?: () => void;
  // Dynamic overscan factor: how many viewport-heights per side
  private _overscanFactor = 2;
  private _rangeExtractor?: (range: { startIndex: number; endIndex: number; count: number }) => number[];

  constructor({ container, data = [], rowHeight = 20, buffer = 100, onOpen, onSelect }: VirtualTreeOptions) {
    this.container = container;
    this.rowHeight = rowHeight;
    this.buffer = buffer;
    this.onOpen = onOpen || (() => { /* no-op */ });
    this.onSelect = onSelect || (() => { /* no-op */ });

    this.expanded = new Map();
    this.focusedIndex = 0;
    this.selectedIndex = -1;
    
    // Set up container attributes
    this.container.setAttribute('tabindex', '0');
    
    // Create a wrapper div to contain all virtualizer content
    // Look for .dotn_view-tree within the provided container first, then globally as fallback
    let viewTree: HTMLElement | null = container.querySelector('.dotn_view-tree');

    // If not found in container, try global search (backward compatibility)
    if (!viewTree) {
      viewTree = document.querySelector('.dotn_view-tree');
    }

    if (!viewTree) {
      debugError('No view tree found - DOM element with class .dotn_view-tree does not exist. Container structure:', {
        container: container,
        containerChildren: Array.from(container.children).map(child => ({
          tagName: child.tagName,
          className: child.className
        }))
      });
      return;
    }
    this.virtualizer = viewTree;
    // Height may be updated later; rely on CSS for positioning
    this.virtualizer.style.height = '0px'; // Will be updated based on content
    
    // Don't append the virtualizer if it's already a child of the container
    // This prevents duplicate appending which can cause issues
    const isAlreadyChild = Array.from(this.container.children).includes(this.virtualizer);
    if (!isAlreadyChild) {
      debug('Appending virtualizer to container');
      this.container.appendChild(this.virtualizer);
    } else {
      debug('Virtualizer is already a child of container, skipping append');
    }

    this.pool = [];
    this.visibleCount = Math.ceil(this.container.clientHeight / this.rowHeight);
    this.poolSize = this.visibleCount + this.buffer * 2;
    for (let i = 0; i < this.poolSize; i++) {
      const row = document.createElement('div');
      row.className = 'row';
      row.dataset.poolIndex = String(i);
      row.addEventListener('click', (e) => this._onRowClick(e, row));
      this.virtualizer.appendChild(row);
      this.pool.push(row);
    }

    this.setData(data);
    this._onScroll = () => {
      try { this._v?.measure(); } catch { /* ignore */ }
    };
    this._onKeyDown = (e: KeyboardEvent) => this._handleKeyDown(e);
    this.container.addEventListener('keydown', this._onKeyDown);

    // Initialize TanStack Virtualizer
    this._initVirtualizer();
  }

  private _getScrollElement(): HTMLElement | null {
    const sc = this.scrollContainer;
    if (sc instanceof HTMLElement) return sc;
    return this.container;
  }

  private _initVirtualizer(): void {
    try {
      // Clean up any previous instance
      if (this._vunsub) { try { this._vunsub(); } catch { /* ignore */ } this._vunsub = undefined; }
      // Build a stable dynamic range extractor that overscans by N view-heights per side
      this._rangeExtractor = (range) => {
        try {
          const height = this._v?.scrollRect?.height ?? this._getScrollElement()?.clientHeight ?? 0;
          const visible = height > 0 ? Math.ceil(height / this.rowHeight) : Math.max(1, this.visibleCount);
          const extra = Math.max(visible * this._overscanFactor, visible); // per-side overscan
          const start = Math.max(range.startIndex - extra, 0);
          const end = Math.min(range.endIndex + extra, range.count - 1);
          const out: number[] = [];
          for (let i = start; i <= end; i++) out.push(i);
          return out;
        } catch {
          // Fallback to simple range if anything goes wrong
          const out: number[] = [];
          for (let i = range.startIndex; i <= range.endIndex; i++) out.push(i);
          return out;
        }
      };

      // Create the virtualizer
      this._v = new TSVirtualizer<HTMLElement, HTMLElement>({
        count: this.total ?? 0,
        getScrollElement: () => this._getScrollElement(),
        estimateSize: () => this.rowHeight,
        overscan: 0, // we use a dynamic rangeExtractor instead
        scrollToFn: elementScroll,
        observeElementRect,
        observeElementOffset,
        onChange: () => {
          try { this._render(); } catch { /* ignore */ }
        },
        rangeExtractor: this._rangeExtractor,
        // We position items with transform translateY ; the container uses absolute children
        indexAttribute: 'data-index',
      });
      // Attach listeners and observers
      this._v._willUpdate();
      this._vunsub = this._v._didMount();
      // Kick initial measure
      this._v.measure();
    } catch {
      // If tanstack fails to init, rendering still falls back to legacy logic
    }
  }

  setData(data: VirtualTreeBaseItem[]): void {
    this.data = data || [];
    this._recomputeVisible();
    // Reset scroll position when setting new data
    this.container.scrollTop = 0;
    this.focusedIndex = 0;
    this.selectedIndex = -1;
    // Update virtualizer with new count
    if (this._v) this._v.setOptions({
      ...this._v.options,
      count: this.total,
      estimateSize: () => this.rowHeight,
      overscan: 0,
      rangeExtractor: this._rangeExtractor,
    });
    // Ensure observers are bound to the current scroll element
    this._v?._willUpdate();
    this._render();
  }

  toggle(id: string): void { 
    const wasExpanded = this.expanded.get(id);

    // Save scroll state and current focus/selection by id before toggling
    const oldScrollTop = this.container.scrollTop;
    const oldVisible = this.visible.slice();
    const prevSelectedId = this.selectedIndex >= 0 ? oldVisible[this.selectedIndex]?.id : undefined;
    const prevFocusedId = this.focusedIndex >= 0 ? oldVisible[this.focusedIndex]?.id : undefined;

    // Toggle expansion and recompute visible list
    this.expanded.set(id, !wasExpanded);
    this._recomputeVisible();

    // Re-map selection and focus to their items' new indices
    if (prevSelectedId) {
      let newSel = this.visible.findIndex(it => it.id === prevSelectedId);
      if (newSel < 0) {
        // If selection became hidden due to collapsing the toggled branch,
        // move selection to the toggled folder itself if visible
        newSel = this.visible.findIndex(it => it.id === id);
      }
      this.selectedIndex = newSel;
    }
    if (prevFocusedId) {
      let newFocus = this.visible.findIndex(it => it.id === prevFocusedId);
      if (newFocus < 0) newFocus = this.visible.findIndex(it => it.id === id);
      this.focusedIndex = newFocus;
      this._clampFocus();
    }

    // Try to maintain scroll position relative to focused item
    this._maintainScrollPosition(oldVisible, oldScrollTop);
    this._render();
  }

  expand(id: string): void { 
    // Preserve scroll/selection/focus across expansion
    const oldScrollTop = this.container.scrollTop;
    const oldVisible = this.visible.slice();
    const prevSelectedId = this.selectedIndex >= 0 ? oldVisible[this.selectedIndex]?.id : undefined;
    const prevFocusedId = this.focusedIndex >= 0 ? oldVisible[this.focusedIndex]?.id : undefined;

    this.expanded.set(id, true);
    this._recomputeVisible();

    if (prevSelectedId) {
      const newSel = this.visible.findIndex(it => it.id === prevSelectedId);
      this.selectedIndex = newSel;
    }
    if (prevFocusedId) {
      const newFocus = this.visible.findIndex(it => it.id === prevFocusedId);
      this.focusedIndex = newFocus;
      this._clampFocus();
    }

    this._maintainScrollPosition(oldVisible, oldScrollTop);
    this._render();
  }

  collapse(id: string): void { 
    // Preserve scroll/selection/focus across collapse
    const oldScrollTop = this.container.scrollTop;
    const oldVisible = this.visible.slice();
    const prevSelectedId = this.selectedIndex >= 0 ? oldVisible[this.selectedIndex]?.id : undefined;
    const prevFocusedId = this.focusedIndex >= 0 ? oldVisible[this.focusedIndex]?.id : undefined;

    this.expanded.set(id, false);
    this._recomputeVisible();

    if (prevSelectedId) {
      let newSel = this.visible.findIndex(it => it.id === prevSelectedId);
      if (newSel < 0) newSel = this.visible.findIndex(it => it.id === id);
      this.selectedIndex = newSel;
    }
    if (prevFocusedId) {
      let newFocus = this.visible.findIndex(it => it.id === prevFocusedId);
      if (newFocus < 0) newFocus = this.visible.findIndex(it => it.id === id);
      this.focusedIndex = newFocus;
      this._clampFocus();
    }

    this._maintainScrollPosition(oldVisible, oldScrollTop);
    this._render();
  }

  // legacy scrollToIndex implementation removed; see public scrollToIndex below

  private _clampFocus(): void {
    this.focusedIndex = Math.max(0, Math.min(this.focusedIndex, this.total - 1));
  }

  private _maintainScrollPosition(oldVisible: VirtualTreeItem[], oldScrollTop: number): void {
    if (oldVisible.length === 0 || this.visible.length === 0) return;
    
    // Find a reference item that's likely to still be visible
    const oldIndex = Math.floor(oldScrollTop / this.rowHeight);
    const referenceItem = oldVisible[Math.min(oldIndex, oldVisible.length - 1)];
    
    if (!referenceItem) return;
    
    // Find where this item moved to in the new list
    const newIndex = this.visible.findIndex(item => item.id === referenceItem.id);
    
    if (newIndex >= 0) {
      // Adjust scroll to keep the reference item in roughly the same position
      const newScrollTop = newIndex * this.rowHeight;
      const scrollDelta = newScrollTop - oldIndex * this.rowHeight;
      this.container.scrollTop = oldScrollTop + scrollDelta;
    }
  }

  private _recomputeVisible(): void {
    this.visible = flattenTree(this.data, this.expanded);
    this.total = this.visible.length;
    // Set the virtualizer height to create scrollable area
    if (this.virtualizer) {
      this.virtualizer.style.height = `${this.total * this.rowHeight}px`;
    }
    // Sync TanStack virtualizer count if present
    if (this._v) this._v.setOptions({
      ...this._v.options,
      count: this.total,
      rangeExtractor: this._rangeExtractor,
    });
    this._v?._willUpdate();
  }

  private _handleKeyDown(e: KeyboardEvent): void {
    if (this.total === 0) return;
    
    let handled = true;
    const oldIndex = this.focusedIndex;
    
    switch (e.key) {
      case 'ArrowDown':
        this.focusedIndex = Math.min(this.focusedIndex + 1, this.total - 1);
        break;
      case 'ArrowUp':
        this.focusedIndex = Math.max(this.focusedIndex - 1, 0);
        break;
      case 'Home':
        this.focusedIndex = 0;
        break;
      case 'End':
        this.focusedIndex = this.total - 1;
        break;
      case 'PageDown':
        this.focusedIndex = Math.min(this.focusedIndex + this.visibleCount, this.total - 1);
        break;
      case 'PageUp':
        this.focusedIndex = Math.max(this.focusedIndex - this.visibleCount, 0);
        break;
      case 'ArrowRight':
        if (this.focusedIndex >= 0 && this.focusedIndex < this.total) {
          const item = this.visible[this.focusedIndex];
          if (item.kind === 'folder' && !this.expanded.get(item.id)) {
            this.expand(item.id);
            this.onOpen(item);
          }
        }
        break;
      case 'ArrowLeft':
        if (this.focusedIndex >= 0 && this.focusedIndex < this.total) {
          const item = this.visible[this.focusedIndex];
          if (item.kind === 'folder' && this.expanded.get(item.id)) {
            this.collapse(item.id);
          }
        }
        break;
      case 'Enter':
      case ' ':
        if (this.focusedIndex >= 0 && this.focusedIndex < this.total) {
          const item = this.visible[this.focusedIndex];
          if (item.kind === 'folder') {
            this.toggle(item.id);
            this.onOpen(item);
          } else {
            this.selectedIndex = this.focusedIndex;
            this.onSelect(item);
          }
        }
        break;
      default:
        handled = false;
        break;
    }
    
    if (handled) {
      e.preventDefault();
      e.stopPropagation();
      
      if (this.focusedIndex !== oldIndex) {
        // Ensure focused item is visible
        this._ensureFocusVisible();
        this._render();
      }
    }
  }

  private _ensureFocusVisible(): void {
    const focusTop = this.focusedIndex * this.rowHeight;
    const focusBottom = focusTop + this.rowHeight;
    const viewTop = this.container.scrollTop;
    const viewBottom = viewTop + this.container.clientHeight;
    
    if (focusTop < viewTop) {
      this.container.scrollTop = focusTop;
    } else if (focusBottom > viewBottom) {
      this.container.scrollTop = focusBottom - this.container.clientHeight;
    }
  }

  protected _render(): void {
    const v = this._v;
    if (v) {
      const vItems = v.getVirtualItems();
      // Ensure container height matches virtualized total
      const totalSize = v.getTotalSize();
      if (this.virtualizer) this.virtualizer.style.height = `${totalSize}px`;

      // Grow pool if needed
      if (vItems.length > this.poolSize) {
        for (let i = this.poolSize; i < vItems.length; i++) {
          const row = document.createElement('div');
          row.className = 'row';
          row.dataset.poolIndex = String(i);
          row.addEventListener('click', (e) => this._onRowClick(e, row));
          this.virtualizer.appendChild(row);
          this.pool.push(row);
        }
        this.poolSize = vItems.length;
      }

      // Render visible items
      for (let i = 0; i < this.poolSize; i++) {
        const row = this.pool[i];
        if (i >= vItems.length) {
          row.classList.add('is-hidden');
          row.removeAttribute('tabindex');
          continue;
        }
        const vItem = vItems[i];
        const itemIndex = vItem.index;
        const item = this.visible[itemIndex];

        row.classList.remove('is-hidden');
        // Position using TanStack's computed start offset
        row.style.transform = `translateY(${vItem.start}px)`;
        // Normalize previous level classes
        for (const cls of Array.from(row.classList)) {
          if (cls.startsWith('dotn_level-')) row.classList.remove(cls);
        }
        row.classList.add(`dotn_level-${item.level}`);

        // Minimal data attributes for interactions
        row.dataset.id = item.id;
        row.dataset.index = String(itemIndex);

        // Focus and selection states (visual only)
        const isFocused = itemIndex === this.focusedIndex;
        const isSelected = itemIndex === this.selectedIndex;

        row.setAttribute('tabindex', isFocused ? '0' : '-1');
        row.setAttribute('aria-selected', String(isSelected));
        // Toggle CSS classes instead of inline styles
        if (isSelected) row.classList.add('is-selected'); else row.classList.remove('is-selected');
        if (isFocused) row.classList.add('is-focused'); else row.classList.remove('is-focused');
      }
      return;
    }

    // Fallback legacy rendering if virtualizer is not available
    const { scrollTop, clientHeight } = this.container;
    const { startIndex, endIndex } = computeWindow(scrollTop, this.rowHeight, this.buffer, clientHeight, this.total, this.poolSize);

    for (let i = 0; i < this.poolSize; i++) {
      const itemIndex = startIndex + i;
      const row = this.pool[i];
      if (itemIndex >= endIndex) {
        row.classList.add('is-hidden');
        row.removeAttribute('tabindex');
        continue;
      }
      
      const item = this.visible[itemIndex];
      row.classList.remove('is-hidden');
      row.style.transform = `translateY(${itemIndex * this.rowHeight}px)`;
      for (const cls of Array.from(row.classList)) {
        if (cls.startsWith('dotn_level-')) row.classList.remove(cls);
      }
      row.classList.add(`dotn_level-${item.level}`);
      row.dataset.id = item.id;
      row.dataset.index = String(itemIndex);
      const isFocused = itemIndex === this.focusedIndex;
      const isSelected = itemIndex === this.selectedIndex;
      row.setAttribute('tabindex', isFocused ? '0' : '-1');
      row.setAttribute('aria-selected', String(isSelected));
      if (isSelected) row.classList.add('is-selected'); else row.classList.remove('is-selected');
      if (isFocused) row.classList.add('is-focused'); else row.classList.remove('is-focused');
    }
  }

  protected _onRowClick(e: MouseEvent, row: HTMLElement): void {
    const id = row.dataset.id;
    const idx = Number(row.dataset.index);
    if (!id || isNaN(idx)) return;
    const item = this.visible[idx];
    
    // Update focus to clicked item
    this.focusedIndex = idx;
    this.container.focus();
    
    if (item.kind === 'folder') {
      this.toggle(id);
      this.onOpen(item);
    } else {
      this.selectedIndex = idx;
      this.onSelect(item);
    }
    
    this._render();
  }

  destroy(): void {
    // Remove listeners using the same references that were added
    if (this._scrollHandler) {
      this.container.removeEventListener('scroll', this._scrollHandler);
      this._scrollHandler = undefined;
    }
    if (this._onKeyDown) {
      this.container.removeEventListener('keydown', this._onKeyDown);
    }
    if (this._vunsub) {
      try { this._vunsub(); } catch { /* ignore */ }
      this._vunsub = undefined;
    }
    this._v = undefined;
    // Only clear our own rows; do not wipe the whole view container
    if (this.virtualizer) {
      while (this.virtualizer.firstChild) this.virtualizer.removeChild(this.virtualizer.firstChild);
    }
  }

  // Expose TanStack virtual items for external renderers
  public getVirtualItems(): Array<{ index: number; start: number; size: number; key: number | string | bigint; lane: number }>
    | undefined {
    try { return this._v?.getVirtualItems(); } catch { return undefined; }
  }

  // Sync observers to the current scroll element (e.g., after attachment/mount changes)
  public syncScrollElement(): void {
    try { this._v?._willUpdate(); this._v?.measure(); } catch { /* ignore */ }
  }

  public usesTanstack(): boolean { return !!this._v; }

  public isScrolling(): boolean { return !!this._v?.isScrolling; }

  // Scroll to index via TanStack virtualizer when available
  public scrollToIndex(index: number): void {
    if (index < 0 || index >= this.total) return;
    if (this._v) {
      try { this._v.scrollToIndex(index, { align: 'auto' }); return; } catch { /* fallthrough */ }
    }
    const rowTop = index * this.rowHeight;
    const rowBottom = rowTop + this.rowHeight;
    const viewTop = this.container.scrollTop;
    const viewBottom = viewTop + this.container.clientHeight;
    if (rowTop >= viewTop && rowBottom <= viewBottom) return;
    this.container.scrollTop = rowTop;
  }
}
