import { App } from 'obsidian';
import { VirtualTree } from '../virtualTree';
import type { VirtualTreeOptions } from '../types';
import { logger } from '../utils/logger';
import type { VItem } from '../core/virtualData';
import type { RowItem, VirtualTreeLike } from './viewTypes';
import { renderRow } from './rowRender';
import { logRenderWindow, scheduleWidthAdjust } from './renderUtils';
import { computeDendronParentId, expandAllInData, renamePathInPlace } from './treeOps';
import { setupAttachment, attachToViewBodyImpl } from './attachUtils';
import { collapseAll as collapseAllAction, revealPath as revealAction, scrollToIndex as scrollToIndexAction, selectPath as selectPathAction } from './treeActions';
import { bindRowHandlers, onRowClick as handleRowClick, onRowContextMenu as handleRowContextMenu } from './rowHandlers';

export class ComplexVirtualTree extends VirtualTree {
  private app: App;
  private parentMap: Map<string, string | undefined> = new Map();
  private _boundScroll?: () => void;
  private _gap: number = 4;
  private _resizeObs?: ResizeObserver;
  private _onExpansionChange?: () => void;
  private _selectedId?: string;
  private _isAttached: boolean = false;
  // Lazily initialized because base class constructor calls into our _render before fields run
  private _ctxMenuBound?: WeakSet<HTMLElement>;
  // Width management for rows
  private _maxRowWidth: number = 0;
  private _widthAdjustTimer?: number;
  private _lastScrollTop: number = 0;
  // Debug state
  private _dbgLastStart = -1;
  private _dbgLastEnd = -1;
  private _dbgLastScroll = -1;
  private _dbgLastLog = 0;

  // Cast this to access VirtualTree properties with proper typing
  private get virtualTree(): VirtualTreeLike {
    // We need to cast to access VirtualTree properties
    // eslint-disable-next-line @typescript-eslint/consistent-type-assertions
    return this as unknown as VirtualTreeLike;
  }

  constructor(options: { container: HTMLElement; data: VItem[]; rowHeight?: number; buffer?: number; app: App; gap?: number; onExpansionChange?: () => void }) {
    // VirtualTree constructor expects specific parameters, we need to cast to satisfy TypeScript
    const constructorOptions: VirtualTreeOptions = {
      container: options.container,
      data: options.data,
      rowHeight: options.rowHeight ?? 32,
      // Default overscan buffer
      buffer: options.buffer ?? 100,
      // eslint-disable-next-line @typescript-eslint/no-empty-function
      onOpen: () => { },
      // eslint-disable-next-line @typescript-eslint/no-empty-function
      onSelect: () => { }
    };
    super(constructorOptions);
    this.app = options.app;
    if (typeof options.gap === 'number' && options.gap >= 0) this._gap = options.gap;
    this._onExpansionChange = options.onExpansionChange;

    setupAttachment({
      container: options.container,
      isAttached: () => this._isAttached,
      attachToViewBody: (host, viewBody) => this._attachToViewBody(host, viewBody),
      safeRender: (ctx) => this._safeRender(ctx),
      observeResize: (el) => this._observeResize(el)
    });
  }

  private _attachToViewBody(host: HTMLElement, viewBody: HTMLElement): void {
    if (this._isAttached) {
      logger.log('[DotNavigator] Already attached to view body, skipping');
      return;
    }
    // Delegate detailed logic to utility to reduce file size
    const vt = this.virtualTree;
    attachToViewBodyImpl({
      virtualTree: vt,
      host,
      viewBody,
      getLastScrollTop: () => this._lastScrollTop,
      setLastScrollTop: (n: number) => { this._lastScrollTop = n; },
      setAttached: (b: boolean) => { this._isAttached = b; },
      setBoundScroll: (fn: () => void) => { this._boundScroll = fn; }
    });
  }

  private _observeResize(viewBody: HTMLElement): void {
    this._resizeObs = new ResizeObserver(() => this._safeRender('resize observer render'));
    this._resizeObs.observe(viewBody);
  }

  private _safeRender(context: string): void {
    try {
      this.virtualTree._render();
    } catch (error) {
      logger.error(`[DotNavigator] Error in ${context}:`, error);
    }
  }

  // Allow restoring a known expanded set
  public setExpanded(paths: string[]): void {
    this.virtualTree.expanded = new Map(paths.map(p => [p, true]));
    this.virtualTree._recomputeVisible();
    this._reapplySelection();
    this.virtualTree._render();
    this._onExpansionChange?.();
  }

  public getExpandedPaths(): string[] {
    const res: string[] = [];
    this.virtualTree.expanded.forEach((v, k) => { if (v) res.push(k); });
    return res;
  }

  public setParentMap(map: Map<string, string | undefined>): void { this.parentMap = map; }

  // Update underlying data without recreating the tree to avoid flicker/scroll jumps
  public updateData(data: VItem[], parentMap: Map<string, string | undefined>): void {
    const vt = this.virtualTree;
    const scrollContainer = vt.scrollContainer;
    const host = scrollContainer instanceof HTMLElement ? scrollContainer : vt.container;
    const prevScrollTop = host.scrollTop;

    // Swap data and recompute visible rows based on current expansion map
    vt.data = data;
    this.setParentMap(parentMap);
    vt._recomputeVisible();

    // Reapply selection by id if any
    this._reapplySelection();

    // Keep focus index within bounds
    if (vt.focusedIndex >= vt.total) {
      vt.focusedIndex = Math.max(0, vt.total - 1);
    }

    // Preserve scrollTop where possible; clamp if new content is shorter
    const newTotalPx = vt.total * vt.rowHeight;
    const maxScrollTop = Math.max(0, newTotalPx - host.clientHeight);
    if (prevScrollTop > maxScrollTop) {
      host.scrollTop = maxScrollTop; // only set when it actually changes
    }
    // Render with updated data
    vt._render();
    this._onExpansionChange?.();
  }

  // Attempt to rename a single path in-place (only supports same-parent renames).
  // Returns true if applied in place; false if caller should rebuild.
  public renamePath(oldPath: string, newPath: string): boolean {
    const vt = this.virtualTree;
    const scrollContainer = vt.scrollContainer;
    const host = scrollContainer instanceof HTMLElement ? scrollContainer : vt.container;
    const prevScrollTop = host.scrollTop;

    const { applied, parentMap, mapSelected } = renamePathInPlace(vt, this.parentMap, oldPath, newPath);
    if (!applied) return false;

    this.setParentMap(parentMap);
    this._selectedId = mapSelected(this._selectedId);

    vt._recomputeVisible();
    this._reapplySelection();
    vt._render();
    host.scrollTop = prevScrollTop;
    this._onExpansionChange?.();
    return true;
  }

  // Compute the Dendron-style parent id for a given path.
  // For files with dotted names (a.b.md), parent is a.md (under same folder).
  // For single-segment files (a.md), parent is the containing folder.
  // For folders, parent is the filesystem parent folder (or '/' for root).
  private _computeDendronParentId(path: string, kind: 'folder' | 'file' | 'virtual'): string { return computeDendronParentId(path, kind); }

  public expandAll(): void {
    // Expand every folder/virtual item present in visible data by id.
    // We iterate over flattened visible source (not just current visible window)
    expandAllInData(this.virtualTree.data, this.virtualTree.expanded);
    this.virtualTree._recomputeVisible();
    this._reapplySelection();
    this.virtualTree._render();
    this._onExpansionChange?.();
  }

  // Select a path without scrolling or expanding; useful on rename/update
  public selectPath(path: string, options?: { reveal?: boolean }): void {
    if (options?.reveal) {
      // Delegate to revealPath when explicit reveal is requested
      void this.revealPath(path);
      return;
    }
    this._selectedId = path;
    selectPathAction(this.virtualTree, path);
  }

  public collapseAll(): void {
    collapseAllAction(this.virtualTree);
    this._reapplySelection();
    this._onExpansionChange?.();
  }

  public async revealPath(path: string): Promise<void> {
    const idx = await revealAction(this.virtualTree, this.parentMap, path);
    if (idx != null) this._selectedId = path;
    this._onExpansionChange?.();
  }

  // Ensure correct container gets scrolled when jumping to an index
  public scrollToIndex(index: number): void { scrollToIndexAction(this.virtualTree, index); }

  // Row rendering (Obsidian-like DOM)
  private _renderRow(row: HTMLElement, item: RowItem, itemIndex: number): void { renderRow(this.virtualTree, row, item, itemIndex, this.app); }

  // Override row click handling to support toggle/create/open
  public _onRowClick(e: MouseEvent, row: HTMLElement): void {
    handleRowClick(this.app, this.virtualTree, e, row, (sid) => { this._selectedId = sid; });
  }

  // Forwarders that notify expansion changes so the header button stays in sync
  public toggle(id: string): void {
    super.toggle(id);
    this._reapplySelection();
    this._onExpansionChange?.();
  }
  public expand(id: string): void {
    super.expand(id);
    this._reapplySelection();
    this._onExpansionChange?.();
  }
  public collapse(id: string): void {
    super.collapse(id);
    this._reapplySelection();
    this._onExpansionChange?.();
  }

  // Ensure we have enough pooled rows to fill the viewport plus buffer
  private _ensurePoolCapacity(): void {
    this._ctxMenuBound = bindRowHandlers(
      this.virtualTree,
      (ev, row) => this._onRowClick(ev, row),
      (ev, row) => this._onRowContextMenu(ev, row),
      this._ctxMenuBound
    );
  }

  // Right-click handler: open the More menu for the row
  private _onRowContextMenu(e: MouseEvent, row: HTMLElement): void {
    handleRowContextMenu(this.app, this.virtualTree, e, row);
  }

  // Override render to use the correct scroll container and windowing math
  public _render(): void {
    this._ensurePoolCapacity();
    const scrollContainer = this.virtualTree.scrollContainer;
    const container = this.virtualTree.container;
    const sc = scrollContainer instanceof HTMLElement ? scrollContainer : container;
    const scrollTop = sc.scrollTop;
    const rowHeight: number = this.virtualTree.rowHeight;
    const buffer: number = this.virtualTree.buffer;
    const total: number = this.virtualTree.total;
    const poolSize: number = this.virtualTree.poolSize;

    const startIndex = Math.max(Math.floor(scrollTop / rowHeight) - buffer, 0);
    const endIndex = Math.min(startIndex + poolSize, total);

    // Debug: log window movement and coverage
    logRenderWindow(this.virtualTree, sc, startIndex, endIndex, scrollTop);

    // Determine minimum width as current panel width
    const minPanelWidth = sc.clientWidth || 0;
    const appliedWidth = Math.max(this._maxRowWidth || 0, minPanelWidth);
    const appliedWidthPx = appliedWidth > 0 ? `${appliedWidth}px` : '';

    for (let i = 0; i < poolSize; i++) {
      const itemIndex = startIndex + i;
      const row: HTMLElement = this.virtualTree.pool[i];
      if (itemIndex >= endIndex || itemIndex >= total) {
        row.style.display = 'none';
        continue;
      }
      const item = this.virtualTree.visible[itemIndex];
      this._renderRow(row, item, itemIndex);
      // Apply cached width immediately for smooth scrolling
      if (appliedWidthPx) row.style.width = appliedWidthPx;
      else row.style.removeProperty('width');
    }

    // Defer width adjustment until scroll settles
    scheduleWidthAdjust(this.virtualTree, {
      getTimer: () => this._widthAdjustTimer,
      setTimer: (n) => { this._widthAdjustTimer = n; },
      getMaxWidth: () => this._maxRowWidth,
      setMaxWidth: (n) => { this._maxRowWidth = n; }
    });
  }

  // Reapply selection by id after the visible list changes so highlight stays on the same item.
  private _reapplySelection(): void {
    if (!this._selectedId) return;
    const list = this.virtualTree.visible;
    const idx = list.findIndex(it => it.id === this._selectedId);
    this.virtualTree.selectedIndex = idx;
  }

  // No-op placeholder kept for potential future use (do not scroll on expand/collapse)
  public ensureSelectedVisible(): void { /* intentionally empty */ }

  public destroy(): void {
    const scrollContainer = this.virtualTree.scrollContainer;
    if (scrollContainer instanceof HTMLElement && this._boundScroll) {
      scrollContainer.removeEventListener('scroll', this._boundScroll);
    }
    if (this._resizeObs) {
      try {
        this._resizeObs.disconnect();
      } catch {
        // Ignore disconnect errors
      }
    }
    super.destroy();
  }
}
