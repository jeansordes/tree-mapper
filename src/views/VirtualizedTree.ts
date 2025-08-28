import { App, TFile, setIcon } from 'obsidian';
import { VirtualTree } from '../virtualTree.js';
import { FileUtils } from '../utils/FileUtils';
import { TreeNode, TreeNodeType } from '../types';
import { logger } from '../utils/logger';

type Kind = 'folder' | 'file' | 'virtual';

interface VItem {
  id: string;            // full path used as unique id
  name: string;          // display name
  kind: Kind;            // node kind
  extension?: string;    // file extension (e.g., md, pdf)
  children?: VItem[];    // nested items
}

function nodeKind(node: TreeNode): Kind {
  // Preserve actual type; files remain files even if they have children.
  switch (node.nodeType) {
    case TreeNodeType.FOLDER: return 'folder';
    case TreeNodeType.FILE: return 'file';
    case TreeNodeType.VIRTUAL: return 'virtual';
  }
  return 'virtual';
}

function displayName(node: TreeNode): string {
  // Mirror TreeRenderer.getNodeName
  const base = FileUtils.basename(node.path);
  if (node.nodeType === TreeNodeType.FOLDER) return base.replace(/ \(\d+\)$/, '');
  const matched = base.match(/([^.]+)\.[^.]+$/);
  return (matched ? matched[1] : base).replace(/ \(\d+\)$/, '');
}

function extOf(path: string): string | undefined {
  const idx = path.lastIndexOf('.');
  return idx > -1 ? path.slice(idx + 1) : undefined;
}

export interface VirtualizedData {
  data: VItem[];
  parentMap: Map<string, string | undefined>;
}

// Shape of items after flattening, as consumed by the virtual renderer
type RowItem = VItem & { level: number; hasChildren?: boolean };

// Interface for the VirtualTree parent class properties we need to access
interface VirtualTreeInterface {
  expanded: Map<string, boolean>;
  data: VItem[];
  visible: RowItem[];
  total: number;
  virtualizer: Element;
  scrollContainer?: Element;
  focusedIndex: number;
  selectedIndex: number;
  rowHeight: number;
  container: HTMLElement;
  buffer: number;
  pool: HTMLElement[];
  poolSize: number;
  _render: () => void;
  _recomputeVisible: () => void;
  _onScroll: () => void;
  scrollToIndex: (index: number) => void;
}

export function buildVirtualizedData(root: TreeNode): VirtualizedData {
  const parentMap = new Map<string, string | undefined>();

  function build(node: TreeNode, parentId?: string): VItem {
    parentMap.set(node.path, parentId);
    const item: VItem = {
      id: node.path,
      name: displayName(node),
      kind: nodeKind(node),
    };

    if (node.nodeType === TreeNodeType.FILE) {
      const e = extOf(node.path);
      if (e) item.extension = e;
    }

    if (node.children && node.children.size > 0) {
      const children: VItem[] = [];
      // Keep same ordering as TreeRenderer
      Array.from(node.children.entries())
        .sort(([aKey], [bKey]) => aKey.localeCompare(bKey))
        .forEach(([, child]) => {
          children.push(build(child, node.path));
        });
      item.children = children;
    }

    return item;
  }

  // We render the root's children as top-level
  const data: VItem[] = [];
  Array.from(root.children.entries())
    .sort(([aKey], [bKey]) => aKey.localeCompare(bKey))
    .forEach(([, child]) => data.push(build(child, root.path)));

  return { data, parentMap };
}

export class ComplexVirtualTree extends VirtualTree {
  private app: App;
  private parentMap: Map<string, string | undefined> = new Map();
  private _boundScroll?: () => void;
  private _gap: number = 4;
  private _resizeObs?: ResizeObserver;
  private _onExpansionChange?: () => void;
  private _selectedId?: string;

  // Cast this to access VirtualTree properties with proper typing
  private get virtualTree(): VirtualTreeInterface {
    return this as unknown as VirtualTreeInterface;
  }

  constructor(options: { container: HTMLElement; data: VItem[]; rowHeight?: number; buffer?: number; app: App; gap?: number; onExpansionChange?: () => void }) {
    super({ container: options.container, data: options.data as any, rowHeight: options.rowHeight ?? 32, buffer: options.buffer ?? 10 } as any);
    this.app = options.app;
    if (typeof options.gap === 'number' && options.gap >= 0) this._gap = options.gap;
    this._onExpansionChange = options.onExpansionChange;

    // Use the scrollable view body inside the container
    const viewBody = options.container.querySelector('.tm_view-body');
    if (viewBody) {
      // Move virtualizer to view body
      try { 
        options.container.removeChild(this.virtualTree.virtualizer); 
      } catch (error) { 
        logger.log('[TreeMapper] Error removing virtualizer:', error);
      }
      viewBody.appendChild(this.virtualTree.virtualizer);

      // Rebind scroll to view body
      options.container.removeEventListener('scroll', this.virtualTree._onScroll);
      this._boundScroll = () => requestAnimationFrame(() => this.virtualTree._onScroll());
      viewBody.addEventListener('scroll', this._boundScroll);
      // Store reference for later cleanup
      this.virtualTree.scrollContainer = viewBody;
    }
    // First render with correct scroll container and pool sizing
    try { 
      this.virtualTree._render(); 
    } catch (error) { 
      logger.log('[TreeMapper] Error in first render:', error);
    }
    // Defer another render to ensure clientHeight is settled
    requestAnimationFrame(() => { 
      try { 
        this.virtualTree._render(); 
      } catch (error) { 
        logger.log('[TreeMapper] Error in deferred render:', error);
      } 
    });
    // React to container resize so pool grows when the panel opens/resizes
    if (viewBody && 'ResizeObserver' in window) {
      this._resizeObs = new ResizeObserver(() => { 
        try { 
          this.virtualTree._render(); 
        } catch (error) { 
          logger.log('[TreeMapper] Error in resize observer render:', error);
        } 
      });
      this._resizeObs.observe(viewBody);
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

  public expandAll(): void {
    // Expand every folder/virtual item present in visible data by id.
    // We iterate over flattened visible source (not just current visible window)
    const data = this.virtualTree.data;
    const expanded = this.virtualTree.expanded;
    function walk(items: VItem[]) {
      for (const it of items) {
        const hasChildren = Array.isArray(it.children) && it.children.length > 0;
        if (hasChildren) expanded.set(it.id, true);
        if (it.children) walk(it.children);
      }
    }
    walk(data);
    this.virtualTree._recomputeVisible();
    this._reapplySelection();
    this.virtualTree._render();
    this._onExpansionChange?.();
  }

  public collapseAll(): void {
    this.virtualTree.expanded.clear();
    this.virtualTree._recomputeVisible();
    this._reapplySelection();
    this.virtualTree._render();
    this._onExpansionChange?.();
  }

  public async revealPath(path: string): Promise<void> {
    // Expand ancestors
    const expanded = this.virtualTree.expanded;
    let cur: string | undefined = path;
    const guard = new Set<string>();
    while (cur && !guard.has(cur)) {
      guard.add(cur);
      const parent = this.parentMap.get(cur);
      if (parent) expanded.set(parent, true);
      cur = parent;
    }
    this.virtualTree._recomputeVisible();

    // Scroll to item index if present
    const list = this.virtualTree.visible;
    const idx = list.findIndex(it => it.id === path);
    if (idx >= 0) {
      this.virtualTree.focusedIndex = idx;
      this.virtualTree.selectedIndex = idx;
      this._selectedId = path;
      this.virtualTree.scrollToIndex(idx);
      this.virtualTree._render();
    }
    this._onExpansionChange?.();
  }

  // Ensure correct container gets scrolled when jumping to an index
  public scrollToIndex(index: number): void {
    const sc: HTMLElement = (this.virtualTree.scrollContainer as HTMLElement) || (this.virtualTree.container as HTMLElement);
    const total: number = this.virtualTree.total;
    if (index < 0 || index >= total) return;
    const rowHeight: number = this.virtualTree.rowHeight;
    const offsetRows = 3; // keep 3 rows above when scrolling into view
    const maxScrollTop = Math.max(0, total * rowHeight - sc.clientHeight);
    let targetScrollTop = Math.max(0, (index - offsetRows) * rowHeight);
    targetScrollTop = Math.min(targetScrollTop, maxScrollTop);
    try {
      sc.scrollTo({ top: targetScrollTop, behavior: 'smooth' });
    } catch {
      sc.scrollTop = targetScrollTop;
    }
  }

  // Row rendering (Obsidian-like DOM)
  private _renderRow(row: HTMLElement, item: RowItem, itemIndex: number): void {
    const isFocused = itemIndex === this.virtualTree.focusedIndex;
    const isSelected = itemIndex === this.virtualTree.selectedIndex;
    const isExpanded = this.virtualTree.expanded.get(item.id) ?? false;
    const hasChildren = !!item.hasChildren;

    row.style.display = 'flex';
    row.style.position = 'absolute';
    row.style.transform = `translateY(${itemIndex * this.virtualTree.rowHeight}px)`;
    // Content height equals CSS var(--tm_button-size); extra space is the row gap.
    row.style.height = 'var(--tm_button-size)';
    row.style.lineHeight = 'var(--tm_button-size)';
    // Keep a visual gap using the CSS variable directly
    row.style.setProperty('padding-bottom', 'var(--tm_gap)');
    // Add an extra gap between the rightmost guide and the node content
    row.style.paddingLeft = `calc(${item.level * 20 + 8}px + var(--tm_gap))`;
    row.className = 'tree-row';

    // Track collapsed for CSS (triangle rotation) when item has children
    if (hasChildren && !isExpanded) {
      row.classList.add('collapsed');
    } else {
      row.classList.remove('collapsed');
    }

    row.innerHTML = ''; // Clear previous content
    row.appendChild(this._createRowContent(item, isExpanded));

    // Highlight selected file's title using is-active class for CSS styling
    const titleEl = row.querySelector('.tm_tree-item-title');
    if (titleEl) {
      if (isSelected) titleEl.classList.add('is-active');
      else titleEl.classList.remove('is-active');
    }

    row.dataset.id = item.id;
    row.dataset.index = String(itemIndex);
    row.setAttribute('role', 'treeitem');
    row.setAttribute('aria-level', String(item.level + 1));
    row.setAttribute('tabindex', isFocused ? '0' : '-1');
    row.setAttribute('aria-selected', String(isSelected));
    if (hasChildren) row.setAttribute('aria-expanded', String(isExpanded));
  }

  private _createRowContent(item: RowItem, _isExpanded: boolean): HTMLElement {
    const rowContent = document.createElement('div');
    rowContent.style.display = 'flex';
    rowContent.style.alignItems = 'center';
    
    const hasChildren: boolean = !!item.hasChildren;
    
    // Indent guides (visual hierarchy): one vertical line per level.
    // The rightmost column has a clickable overlay that toggles the parent node.
    if (item.level && item.level > 0) {
      const indent = document.createElement('div');
      indent.className = 'tm_indent';
      indent.style.width = `${item.level * 20}px`;
      
      for (let i = 0; i < item.level; i++) {
        const col = document.createElement('span');
        col.className = 'tm_indent-col';
        indent.appendChild(col);
      }
      rowContent.appendChild(indent);
    }
    
    // Toggle button for any node that has children; spacer removed for leaf
    if (hasChildren) {
      const toggleBtn = document.createElement('div');
      toggleBtn.className = 'tm_button-icon';
      toggleBtn.setAttribute('data-action', 'toggle');
      toggleBtn.title = 'Toggle';
      setIcon(toggleBtn, 'right-triangle');
      // Add right-triangle class to the SVG element for CSS styling
      const svg = toggleBtn.querySelector('svg');
      if (svg) svg.classList.add('right-triangle');
      rowContent.appendChild(toggleBtn);
    }

    if (item.kind === 'folder') {
      const icon = document.createElement('div');
      icon.className = 'tm_icon';
      icon.setAttribute('aria-hidden', 'true');
      setIcon(icon, 'folder');
      rowContent.appendChild(icon);
    }

    const titleClass = item.kind === 'virtual' ? 'tm_tree-item-title mod-create-new' : 
                      item.kind === 'file' ? 'tm_tree-item-title is-clickable' : 
                      'tm_tree-item-title';
    const title = document.createElement('div');
    title.className = titleClass;
    title.title = item.id;
    title.setAttribute('data-node-kind', item.kind);
    title.setAttribute('data-path', item.id);
    title.textContent = item.name;
    rowContent.appendChild(title);

    if (item.kind === 'file' && item.extension) {
      const extension = document.createElement('span');
      extension.className = 'tm_extension';
      extension.textContent = item.extension;
      rowContent.appendChild(extension);
    }

    const actionButtons = this._createActionButtons(item);
    rowContent.appendChild(actionButtons);
    
    return rowContent;
  }

  private _createActionButtons(item: VItem): HTMLElement {
    const container = document.createElement('div');
    container.className = 'tm_action-buttons-container';
    
    if (item.kind === 'virtual') {
      const createNoteBtn = document.createElement('div');
      createNoteBtn.className = 'tm_button-icon';
      createNoteBtn.title = 'Create note';
      createNoteBtn.setAttribute('data-action', 'create-note');
      setIcon(createNoteBtn, 'square-pen');
      container.appendChild(createNoteBtn);
    }
    
    const createChildBtn = document.createElement('div');
    createChildBtn.className = 'tm_button-icon';
    createChildBtn.title = 'Create child';
    createChildBtn.setAttribute('data-action', 'create-child');
    setIcon(createChildBtn, 'rotate-cw-square');
    container.appendChild(createChildBtn);
    
    return container;
  }

  // Override row click handling to support toggle/create/open
  public _onRowClick(e: MouseEvent, row: HTMLElement): void {
    const id = row.dataset.id!;
    const idx = Number(row.dataset.index!);
    const item: RowItem = this.virtualTree.visible[idx];

    this.virtualTree.focusedIndex = idx;
    this.virtualTree.container.focus();

    const target = e.target as Element | null;
    const clickable = target ? target.closest('.tm_button-icon, .tm_tree-item-title') : null;
    if (!clickable) {
      // Default behavior: only select files; do not toggle folders/virtuals
      if (item.kind === 'file') {
        this.virtualTree.selectedIndex = idx;
        this._selectedId = id;
      }
      this.virtualTree._render();
      return;
    }

    if (clickable.classList.contains('tm_button-icon')) {
      const action = clickable.getAttribute('data-action');
      if (action === 'toggle') {
        this.toggle(id);
        this.virtualTree._render();
        return;
      } else if (action === 'create-note') {
        // Only meaningful for virtual nodes
        FileUtils.createAndOpenNote(this.app, id);
        return;
      } else if (action === 'create-child') {
        FileUtils.createChildNote(this.app, id);
        return;
      }
    }

    

    if (clickable.classList.contains('tm_tree-item-title')) {
      const kind = clickable.getAttribute('data-node-kind');
      if (kind === 'file') {
        const file = this.app.vault.getAbstractFileByPath(id);
        if (file instanceof TFile) {
          FileUtils.openFile(this.app, file);
        }
        this.virtualTree.selectedIndex = idx;
        this._selectedId = id;
      } else {
        // Clicking a folder/virtual title should not toggle; just focus the row
        this.virtualTree.focusedIndex = idx;
      }
      this.virtualTree._render();
    }
  }

  // Forwarders that notify expansion changes so the header button stays in sync
  public toggle(id: string): void {
    (VirtualTree as any).prototype.toggle.call(this, id);
    this._reapplySelection();
    this._onExpansionChange?.();
  }
  public expand(id: string): void {
    (VirtualTree as any).prototype.expand.call(this, id);
    this._reapplySelection();
    this._onExpansionChange?.();
  }
  public collapse(id: string): void {
    (VirtualTree as any).prototype.collapse.call(this, id);
    this._reapplySelection();
    this._onExpansionChange?.();
  }

  // Ensure we have enough pooled rows to fill the viewport plus buffer
  private _ensurePoolCapacity(): void {
    const sc: HTMLElement = (this.virtualTree.scrollContainer as HTMLElement) || (this.virtualTree.container as HTMLElement);
    const rowHeight: number = this.virtualTree.rowHeight;
    const buffer: number = this.virtualTree.buffer;
    const pool: HTMLElement[] = this.virtualTree.pool;
    const poolSize: number = this.virtualTree.poolSize;

    const visibleCount = Math.max(1, Math.ceil(sc.clientHeight / rowHeight));
    const desired = visibleCount + buffer * 2;
    if (desired > poolSize) {
      const virt: HTMLElement = this.virtualTree.virtualizer as HTMLElement;
      for (let i = poolSize; i < desired; i++) {
        const row = document.createElement('div');
        row.className = 'tree-row';
        row.dataset.poolIndex = String(i);
        row.addEventListener('click', (ev) => this._onRowClick(ev as MouseEvent, row));
        virt.appendChild(row);
        pool.push(row);
      }
      this.virtualTree.poolSize = desired;
    }
  }

  // Override render to use the correct scroll container and windowing math
  public _render(): void {
    this._ensurePoolCapacity();
    const sc: HTMLElement = (this.virtualTree.scrollContainer as HTMLElement) || (this.virtualTree.container as HTMLElement);
    const scrollTop = sc.scrollTop;
    const rowHeight: number = this.virtualTree.rowHeight;
    const buffer: number = this.virtualTree.buffer;
    const total: number = this.virtualTree.total;
    const poolSize: number = this.virtualTree.poolSize;

    const startIndex = Math.max(Math.floor(scrollTop / rowHeight) - buffer, 0);
    const endIndex = Math.min(startIndex + poolSize, total);

    for (let i = 0; i < poolSize; i++) {
      const itemIndex = startIndex + i;
      const row: HTMLElement = this.virtualTree.pool[i];
      if (itemIndex >= endIndex || itemIndex >= total) {
        row.style.display = 'none';
        continue;
      }
      const item = this.virtualTree.visible[itemIndex];
      this._renderRow(row, item, itemIndex);
    }
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
    const sc: HTMLElement | undefined = this.virtualTree.scrollContainer as HTMLElement;
    if (sc && this._boundScroll) sc.removeEventListener('scroll', this._boundScroll);
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
