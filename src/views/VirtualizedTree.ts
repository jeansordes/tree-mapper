import { App } from 'obsidian';
import { VirtualTree } from '../virtualTree';
import type { VirtualTreeOptions } from '../types';
import createDebug from 'debug';
const debug = createDebug('dot-navigator:views:virtualized-tree');
const debugError = debug.extend('error');
import type { VItem } from '../core/virtualData';
import type { RowItem, VirtualTreeLike } from './viewTypes';
import { renderRow } from './rowRender';
// import { logRenderWindow, scheduleWidthAdjust } from './renderUtils';
import { expandAllInData } from './treeOps';
import { setupAttachment, attachToViewBodyImpl } from './attachUtils';
import { collapseAll as collapseAllAction, revealPath as revealAction, selectPath as selectPathAction } from './treeActions';
import { bindRowHandlers, onRowClick as handleRowClick, onRowContextMenu as handleRowContextMenu } from './rowHandlers';
import { RenameManager } from '../utils/RenameManager';
// import { updateInstanceStyles } from './styleSheet';

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
  // Rename manager
  private _renameManager?: RenameManager;

  // Cast this to access VirtualTree properties with proper typing
  private get virtualTree(): VirtualTreeLike {
    // We need to cast to access VirtualTree properties
    return this as unknown as VirtualTreeLike;
  }

  constructor(options: { container: HTMLElement; data: VItem[]; rowHeight?: number; buffer?: number; app: App; gap?: number; onExpansionChange?: () => void; renameManager?: RenameManager }) {
    // VirtualTree constructor expects specific parameters, we need to cast to satisfy TypeScript
    const constructorOptions: VirtualTreeOptions = {
      container: options.container,
      data: options.data,
      rowHeight: options.rowHeight ?? 32,
      // Default overscan buffer
      buffer: options.buffer ?? 100
    };
    super(constructorOptions);
    this.app = options.app;
    if (typeof options.gap === 'number' && options.gap >= 0) this._gap = options.gap;
    this._onExpansionChange = options.onExpansionChange;
    this._renameManager = options.renameManager;

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
      debug('Already attached to view body, skipping');
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
      debugError(`Error in ${context}:`, error);
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

    // Build maps to compute diffs (by id)
    const buildMap = (items: VItem[]): Map<string, VItem> => {
      const map = new Map<string, VItem>();
      const walk = (arr: VItem[]) => {
        for (const it of arr) {
          map.set(it.id, it);
          if (Array.isArray(it.children) && it.children.length) walk(it.children);
        }
      };
      walk(items);
      return map;
    };
    const oldData = vt.data as unknown as VItem[] | undefined;
    const oldMap = Array.isArray(oldData) ? buildMap(oldData) : new Map<string, VItem>();
    const newMap = buildMap(data);

    // Compute dirty ids where row content must be rebuilt (icon/actions/name changes)
    const dirtyIds = new Set<string>();
    newMap.forEach((n, id) => {
      const o = oldMap.get(id);
      if (!o) return;
      const kindChanged = o.kind !== n.kind;
      const extChanged = (o.extension || '') !== (n.extension || '');
      const nameChanged = o.name !== n.name;
      const titleChanged = o.title !== n.title;
      if (kindChanged || extChanged || nameChanged || titleChanged) dirtyIds.add(id);
    });

    // Swap data and recompute visible rows based on current expansion map
    vt.data = data;
    this.setParentMap(parentMap);
    vt._recomputeVisible();

    // Mark dirty rows for renderer to rebuild row content
    try { (vt as unknown as { dirtyIds?: Set<string> }).dirtyIds = dirtyIds; } catch { /* ignore */ }

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
  public scrollToIndex(index: number): void { super.scrollToIndex(index); }

  // Row rendering (Obsidian-like DOM)
  private _renderRow(row: HTMLElement, item: RowItem, itemIndex: number, startPx?: number): void {
    renderRow(this.virtualTree, row, item, itemIndex, this.app, startPx);
  }

  // Override row click handling to support toggle/create/open
  public _onRowClick(e: MouseEvent, row: HTMLElement): void {
    handleRowClick(this.app, this.virtualTree, e, row, (sid) => { this._selectedId = sid; }, this._renameManager);
  }

  // Forwarders that notify expansion changes so the header button stays in sync
  public toggle(id: string): void {
    super.toggle(id);
    this._reapplySelection();
    // Re-render to reflect selection changes when the selected child becomes hidden
    this.virtualTree._render();
    this._onExpansionChange?.();
  }
  public expand(id: string): void {
    super.expand(id);
    this._reapplySelection();
    this.virtualTree._render();
    this._onExpansionChange?.();
  }
  public collapse(id: string): void {
    super.collapse(id);
    this._reapplySelection();
    this.virtualTree._render();
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
    handleRowContextMenu(this.app, this.virtualTree, e, row, this._renameManager);
  }

  // Override render to use TanStack Virtual items when available
  public _render(): void {
    this._ensurePoolCapacity();
    // Scroll container isn't required here; TanStack Virtual manages scrolling.

    const vItems = this.getVirtualItems?.() ?? [];

    // Ensure our row pool is large enough for the current virtual window
    if (vItems.length > this.virtualTree.poolSize) {
      const start = this.virtualTree.poolSize;
      const end = vItems.length;
      const host = this.virtualTree.virtualizer;
      if (host instanceof HTMLElement) {
        for (let i = start; i < end; i++) {
          const row = document.createElement('div');
          row.className = 'tree-row';
          row.dataset.poolIndex = String(i);
          row.addEventListener('click', (ev) => { if (ev instanceof MouseEvent) this._onRowClick(ev, row); });
          row.addEventListener('contextmenu', (ev) => { if (ev instanceof MouseEvent) this._onRowContextMenu(ev, row); });
          host.appendChild(row);
          this.virtualTree.pool.push(row);
        }
        this.virtualTree.poolSize = end;
      }
    }

    const total: number = this.virtualTree.total;

    const poolSize = this.virtualTree.poolSize;
    for (let i = 0; i < poolSize; i++) {
      const row: HTMLElement = this.virtualTree.pool[i];
      const vRow = vItems[i];
      if (!vRow) {
        row.classList.add('is-hidden');
        continue;
      }
      const itemIndex: number = vRow.index;
      if (itemIndex < 0 || itemIndex >= total) {
        row.classList.add('is-hidden');
        continue;
      }
      const item = this.virtualTree.visible[itemIndex];
      this._renderRow(row, item, itemIndex, vRow.start);
      row.classList.remove('is-hidden');
    }

    // After rendering rows, adjust widths when scrolling is idle to ensure
    // a consistent max width across rows and enable horizontal scroll.
    try {
      const usesTS = (this.virtualTree as unknown as { usesTanstack?: () => boolean }).usesTanstack?.() === true;
      const isScrolling = (this.virtualTree as unknown as { isScrolling?: () => boolean }).isScrolling?.() === true;
      if (usesTS && !isScrolling) this._adjustWidthDebounced();
    } catch { /* non-fatal */ }
  }

  private _adjustWidthDebounced(): void {
    if (this._widthAdjustTimer) window.clearTimeout(this._widthAdjustTimer);
    this._widthAdjustTimer = window.setTimeout(() => {
      this._widthAdjustTimer = undefined as unknown as number;
      this._adjustWidthNow();
    }, 80);
  }

  private _adjustWidthNow(): void {
    try {
      const vt = this.virtualTree;
      const rows = vt.pool.filter(r => !r.classList.contains('is-hidden'));
      if (rows.length === 0) return;

      // Read widths first (minimize write/read thrash)
      let max = 0;
      for (const row of rows) {
        // Use offsetWidth; CSS uses width:max-content so this reflects content width
        const w = Math.ceil(row.offsetWidth);
        if (w > max) max = w;
      }

      const sc = (vt.scrollContainer instanceof HTMLElement ? vt.scrollContainer : vt.container);
      const minPanelWidth = sc.clientWidth || 0;
      const finalWidth = Math.max(max, minPanelWidth);
      if (finalWidth <= 0 || finalWidth === this._maxRowWidth) return;

      const widthPx = `${finalWidth}px`;
      // Write widths
      for (const row of rows) row.style.width = widthPx;
      const vz = vt.virtualizer;
      if (vz instanceof HTMLElement) vz.style.width = widthPx;
      this._maxRowWidth = finalWidth;
    } catch { /* ignore */ }
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
