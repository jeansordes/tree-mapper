/* eslint-env browser */
/* global document, requestAnimationFrame */
import { flattenTree } from './flatten';
import { computeWindow } from './utils';
import { VirtualTreeItem, VirtualTreeOptions } from './types';
import { logger } from './utils/logger';

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
  private data: VirtualTreeItem[];
  private visible: VirtualTreeItem[];
  private total: number;
  private _onScroll: () => void;
  // Store the exact scroll handler we add so we can remove it later
  private _scrollHandler?: () => void;
  private _onKeyDown: (e: KeyboardEvent) => void;

  constructor({ container, data = [], rowHeight = 20, buffer = 10, onOpen, onSelect }: VirtualTreeOptions) {
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
    this.container.setAttribute('role', 'tree');
    this.container.style.outline = 'none';
    
    // Create a wrapper div to contain all virtualizer content
    // Look for .tm_view-tree within the provided container first, then globally as fallback
    let viewTree: HTMLElement | null = container.querySelector('.tm_view-tree');

    // If not found in container, try global search (backward compatibility)
    if (!viewTree) {
      viewTree = document.querySelector('.tm_view-tree');
    }

    if (!viewTree) {
      logger.error('[TreeMapper] No view tree found - DOM element with class .tm_view-tree does not exist. Container structure:', {
        container: container,
        containerChildren: Array.from(container.children).map(child => ({
          tagName: child.tagName,
          className: child.className
        }))
      });
      return;
    }
    this.virtualizer = viewTree;
    this.virtualizer.style.position = 'relative';
    this.virtualizer.style.height = '0px'; // Will be updated based on content
    
    // Don't append the virtualizer if it's already a child of the container
    // This prevents duplicate appending which can cause issues
    const isAlreadyChild = Array.from(this.container.children).includes(this.virtualizer);
    if (!isAlreadyChild) {
      logger.log('[TreeMapper] Appending virtualizer to container');
      this.container.appendChild(this.virtualizer);
    } else {
      logger.log('[TreeMapper] Virtualizer is already a child of container, skipping append');
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
    this._onScroll = () => this._render();
    this._onKeyDown = (e: KeyboardEvent) => this._handleKeyDown(e);
    // Keep a stable reference to the wrapper we actually attach
    this._scrollHandler = () => requestAnimationFrame(this._onScroll);
    this.container.addEventListener('scroll', this._scrollHandler);
    this.container.addEventListener('keydown', this._onKeyDown);
  }

  setData(data: VirtualTreeItem[]): void {
    this.data = data || [];
    this._recomputeVisible();
    // Reset scroll position when setting new data
    this.container.scrollTop = 0;
    this.focusedIndex = 0;
    this.selectedIndex = -1;
    this._render();
  }

  toggle(id: string): void { 
    const wasExpanded = this.expanded.get(id);
    
    // Save scroll state before toggling
    const oldScrollTop = this.container.scrollTop;
    const oldVisible = this.visible.slice();
    
    this.expanded.set(id, !wasExpanded); 
    this._recomputeVisible(); 
    
    // Try to maintain scroll position relative to focused item
    this._maintainScrollPosition(oldVisible, oldScrollTop);
    this._render(); 
  }

  expand(id: string): void { 
    this.expanded.set(id, true); 
    this._recomputeVisible(); 
    this._render(); 
  }

  collapse(id: string): void { 
    this.expanded.set(id, false); 
    this._recomputeVisible(); 
    this._render(); 
  }

  scrollToIndex(index: number): void {
    if (index < 0 || index >= this.total) return;
    const targetScrollTop = index * this.rowHeight;
    this.container.scrollTop = targetScrollTop;
  }

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
    const { scrollTop, clientHeight } = this.container;
    const { startIndex, endIndex } = computeWindow(scrollTop, this.rowHeight, this.buffer, clientHeight, this.total, this.poolSize);

    for (let i = 0; i < this.poolSize; i++) {
      const itemIndex = startIndex + i;
      const row = this.pool[i];
      if (itemIndex >= endIndex) { 
        row.style.display = 'none'; 
        row.removeAttribute('tabindex');
        continue; 
      }
      
      const item = this.visible[itemIndex];
      row.style.display = 'block';
      row.style.transform = `translateY(${itemIndex * this.rowHeight}px)`;
      row.style.paddingLeft = `${item.level * 20 + 8}px`;
      
      // Create icon and text content
      if (item.kind === 'folder') {
        const isExpanded = this.expanded.get(item.id) ?? false;
        const icon = isExpanded ? '📂' : '📁';
        row.innerHTML = `<span class="icon">${icon}</span>${item.name}`;
      } else {
        row.innerHTML = `<span class="icon">📄</span>${item.name}`;
      }
      row.dataset.id = item.id;
      row.dataset.index = String(itemIndex);
      
      // Accessibility attributes
      row.setAttribute('role', 'treeitem');
      row.setAttribute('aria-level', String(item.level + 1));
      if (item.kind === 'folder') {
        const isExpanded = this.expanded.get(item.id) ?? false;
        row.setAttribute('aria-expanded', String(isExpanded));
      } else {
        row.removeAttribute('aria-expanded');
      }
      
      // Focus and selection states
      const isFocused = itemIndex === this.focusedIndex;
      const isSelected = itemIndex === this.selectedIndex;
      
      row.setAttribute('tabindex', isFocused ? '0' : '-1');
      row.setAttribute('aria-selected', String(isSelected));
      row.style.backgroundColor = isSelected ? '#e3f2fd' : 
                                   isFocused ? '#f5f5f5' : 'transparent';
      row.style.outline = isFocused ? '2px solid #2196f3' : 'none';
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
    // Only clear our own rows; do not wipe the whole view container
    if (this.virtualizer) {
      this.virtualizer.innerHTML = '';
    }
  }
}
