import { App, TFile, setIcon } from 'obsidian';
import { VirtualTree } from '../virtualTree';
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
  private _isAttached: boolean = false;

  // Cast this to access VirtualTree properties with proper typing
  private get virtualTree(): VirtualTreeInterface {
    // We need to cast to access VirtualTree properties
    // eslint-disable-next-line @typescript-eslint/consistent-type-assertions
    return this as unknown as VirtualTreeInterface;
  }

  constructor(options: { container: HTMLElement; data: VItem[]; rowHeight?: number; buffer?: number; app: App; gap?: number; onExpansionChange?: () => void }) {
    // VirtualTree constructor expects specific parameters, we need to cast to satisfy TypeScript
    const constructorOptions = {
      container: options.container,
      data: options.data,
      rowHeight: options.rowHeight ?? 32,
      buffer: options.buffer ?? 10,
      // eslint-disable-next-line @typescript-eslint/no-empty-function
      onOpen: () => { },
      // eslint-disable-next-line @typescript-eslint/no-empty-function
      onSelect: () => { }
    };
    // eslint-disable-next-line @typescript-eslint/consistent-type-assertions
    super(constructorOptions as any);
    this.app = options.app;
    if (typeof options.gap === 'number' && options.gap >= 0) this._gap = options.gap;
    this._onExpansionChange = options.onExpansionChange;

    // Try to find the view body, but be more resilient if it's not ready yet
    const findAndAttachViewBody = () => {
      // Log container structure for debugging
      logger.log('[TreeMapper] Looking for view body in container:', {
        containerClass: options.container.className,
        children: Array.from(options.container.children).map(child => ({
          tagName: child.tagName,
          className: child.className
        }))
      });
      
      // First check if we're directly in the view-content element
      if (options.container.classList.contains('view-content')) {
        // We need to check if our tm_view-body exists
        const viewBody = options.container.querySelector('.tm_view-body');
        if (viewBody instanceof HTMLElement && !this._isAttached) {
          logger.log('[TreeMapper] View body found in view-content, attaching now');
          this._attachToViewBody(options.container, viewBody);
          this._safeRender('first render');
          requestAnimationFrame(() => this._safeRender('deferred render'));
          if ('ResizeObserver' in window) this._observeResize(viewBody);
          return true;
        }
      }
      
      // Fall back to standard search
      const viewBody = options.container.querySelector('.tm_view-body');
      if (viewBody instanceof HTMLElement && !this._isAttached) {
        logger.log('[TreeMapper] View body found, attaching now');
        this._attachToViewBody(options.container, viewBody);
        this._safeRender('first render');
        requestAnimationFrame(() => this._safeRender('deferred render'));
        if ('ResizeObserver' in window) this._observeResize(viewBody);
        return true;
      }
      return false;
    };

    // Try immediately first
    if (!findAndAttachViewBody()) {
      // If not found, set up a single retry mechanism
      let retryCount = 0;
      const maxRetries = 20;
      const retryInterval = 100; // 100ms

      const retry = () => {
        retryCount++;
        if (retryCount >= maxRetries) {
          logger.error('[TreeMapper] Error: Could not find .tm_view-body after maximum retries. Container structure:', {
            container: options.container,
            containerClass: options.container.className,
            children: Array.from(options.container.children).map(child => ({
              tagName: child.tagName,
              className: child.className,
              innerHTML: child.innerHTML?.substring(0, 100) + '...'
            }))
          });
          return;
        }

        if (!findAndAttachViewBody()) {
          setTimeout(retry, retryInterval);
        }
      };

      setTimeout(retry, retryInterval);
    }
  }

  private _attachToViewBody(host: HTMLElement, viewBody: HTMLElement): void {
    if (this._isAttached) {
      logger.log('[TreeMapper] Already attached to view body, skipping');
      return;
    }

    // Log the current structure for debugging
    logger.log('[TreeMapper] Attaching to view body, current structure:', {
      hostClass: host.className,
      viewBodyClass: viewBody.className,
      hostChildren: Array.from(host.children).map(c => c.className),
      viewBodyChildren: Array.from(viewBody.children).map(c => c.className),
      virtualizerExists: !!this.virtualTree.virtualizer
    });

    // Move virtualizer to view body
    try {
      // First check if the virtualizer is actually a child of the host
      const isChildOfHost = Array.from(host.children).includes(this.virtualTree.virtualizer);
      
      if (isChildOfHost) {
        logger.log('[TreeMapper] Removing virtualizer from host');
        host.removeChild(this.virtualTree.virtualizer);
      } else {
        logger.log('[TreeMapper] Virtualizer is not a child of host, skipping removal');
      }
    } catch (error) {
      logger.error('[TreeMapper] Error removing virtualizer:', error);
    }
    
    // Check if the virtualizer is already a child of the view body
    const isChildOfViewBody = Array.from(viewBody.children).includes(this.virtualTree.virtualizer);
    
    if (!isChildOfViewBody) {
      logger.log('[TreeMapper] Appending virtualizer to view body');
      
      // Clear any existing content in the view body
      // This is important to prevent duplicate or stale content
      const treeContainer = viewBody.querySelector('.tm_view-tree');
      if (treeContainer instanceof HTMLElement) {
        logger.log('[TreeMapper] Found existing tm_view-tree, using it as target');
        
        // Empty the tree container before adding our virtualizer
        while (treeContainer.firstChild) {
          treeContainer.removeChild(treeContainer.firstChild);
        }
        
        // Append our virtualizer to the tree container
        treeContainer.appendChild(this.virtualTree.virtualizer);
      } else {
        // If no tree container, append directly to view body
        viewBody.appendChild(this.virtualTree.virtualizer);
      }
    } else {
      logger.log('[TreeMapper] Virtualizer is already a child of view body, skipping append');
    }

    // Rebind scroll to view body
    host.removeEventListener('scroll', this.virtualTree._onScroll);
    this._boundScroll = () => requestAnimationFrame(() => this.virtualTree._onScroll());
    viewBody.addEventListener('scroll', this._boundScroll);

    this._isAttached = true;
    // Store reference for later cleanup
    this.virtualTree.scrollContainer = viewBody;
    
    // Force a render after attachment
    setTimeout(() => {
      logger.log('[TreeMapper] Forcing render after attachment');
      this._safeRender('post-attachment render');
    }, 100);
  }

  private _observeResize(viewBody: HTMLElement): void {
    this._resizeObs = new ResizeObserver(() => this._safeRender('resize observer render'));
    this._resizeObs.observe(viewBody);
  }

  private _safeRender(context: string): void {
    try {
      this.virtualTree._render();
    } catch (error) {
      logger.error(`[TreeMapper] Error in ${context}:`, error);
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
    const host = (scrollContainer instanceof HTMLElement ? scrollContainer : vt.container) as HTMLElement;
    const prevScrollTop = host.scrollTop;
    const prevTotalPx = vt.total * vt.rowHeight;

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
    if (!oldPath || !newPath || oldPath === newPath) return true;

    const dirname = (p: string) => p.includes('/') ? p.slice(0, p.lastIndexOf('/')) : '';
    const sameParent = dirname(oldPath) === dirname(newPath);
    if (!sameParent) return false; // moving across parents is more complex; let caller rebuild

    const vt = this.virtualTree;
    const scrollContainer = vt.scrollContainer;
    const host = (scrollContainer instanceof HTMLElement ? scrollContainer : vt.container) as HTMLElement;
    const prevScrollTop = host.scrollTop;

    // Helper to walk and find item + parent list
    const findIn = (arr: VItem[], target: string): { list: VItem[]; index: number } | null => {
      for (let i = 0; i < arr.length; i++) {
        const it = arr[i];
        if (it.id === target) return { list: arr, index: i };
        if (it.children && it.children.length) {
          const found = findIn(it.children, target);
          if (found) return found;
        }
      }
      return null;
    };

    const loc = findIn(vt.data, oldPath);
    if (!loc) return false;

    // Update expanded set by prefix replacement
    const newExpanded = new Map<string, boolean>();
    vt.expanded.forEach((v, k) => {
      if (!v) return;
      if (k === oldPath || k.startsWith(oldPath + '/')) {
        const replaced = newPath + k.slice(oldPath.length);
        newExpanded.set(replaced, true);
      } else {
        newExpanded.set(k, true);
      }
    });
    vt.expanded = newExpanded;

    // Update item id/name and descendants' ids
    const updateIds = (node: VItem) => {
      if (node.id === oldPath) {
        node.id = newPath;
        const base = FileUtils.basename(newPath);
        if (node.kind === 'folder') node.name = base.replace(/ \(\d+\)$/, '');
        else {
          const matched = base.match(/([^.]+)\.[^.]+$/);
          node.name = (matched ? matched[1] : base).replace(/ \(\d+\)$/, '');
        }
      } else if (node.id.startsWith(oldPath + '/')) {
        node.id = newPath + node.id.slice(oldPath.length);
      }
      // Names of descendants do not change on path rename
      if (node.children) node.children.forEach(updateIds);
    };
    updateIds(loc.list[loc.index]);

    // Re-sort siblings by name (localeCompare) to keep ordering consistent
    loc.list.sort((a, b) => a.name.localeCompare(b.name));

    // Rebuild parent map from current data
    const newParentMap = new Map<string, string | undefined>();
    const walk = (items: VItem[], parent?: string) => {
      for (const it of items) {
        newParentMap.set(it.id, parent);
        if (it.children && it.children.length) walk(it.children, it.id);
      }
    };
    walk(vt.data, (vt as any).rootId || undefined);
    this.setParentMap(newParentMap);

    // Maintain selection id if it was under the renamed subtree
    if (this._selectedId) {
      if (this._selectedId === oldPath || this._selectedId.startsWith(oldPath + '/')) {
        this._selectedId = newPath + this._selectedId.slice(oldPath.length);
      }
    }

    // Recompute and render; preserve scrollTop
    vt._recomputeVisible();
    this._reapplySelection();
    vt._render();
    host.scrollTop = prevScrollTop;
    this._onExpansionChange?.();
    return true;
  }

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

  // Select a path without scrolling or expanding; useful on rename/update
  public selectPath(path: string, options?: { reveal?: boolean }): void {
    if (options?.reveal) {
      // Delegate to revealPath when explicit reveal is requested
      void this.revealPath(path);
      return;
    }
    this._selectedId = path;
    const list = this.virtualTree.visible;
    const idx = list.findIndex(it => it.id === path);
    if (idx >= 0) {
      this.virtualTree.selectedIndex = idx;
      // do not change focusedIndex or scroll; just re-render
      this.virtualTree._render();
    }
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
    const sc1 = this.virtualTree.scrollContainer;
    const sc2 = this.virtualTree.container;
    if (sc1 instanceof HTMLElement || sc2 instanceof HTMLElement) {
      const sc = sc1 || sc2;
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
    
    // Calculate the full content width to ensure rows stretch across the entire scrollable area
    const container = this.virtualTree.container;
    const viewBody = container.closest('.tm_view-body');
    
    // Get the actual width of .tm_view-tree
    let contentWidth = viewBody?.clientWidth ?? 0;
    
    // Ensure minimum width for proper display and add buffer for content
    contentWidth = Math.max(contentWidth, 800);
    
    row.style.width = `${contentWidth}px`;
    
    row.className = 'tree-row';

    // Track collapsed for CSS (triangle rotation) when item has children
    if (hasChildren && !isExpanded) {
      row.classList.add('collapsed');
    } else {
      row.classList.remove('collapsed');
    }

    row.innerHTML = '';
    this._createRowContent(item, row);

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

  private _createRowContent(item: RowItem, rowEl: HTMLElement): HTMLElement {
    const hasChildren: boolean = !!item.hasChildren;

    if (item.level && item.level > 0) rowEl.appendChild(this._createIndentGuides(item.level));
    if (hasChildren) rowEl.appendChild(this._createToggleButton());
    if (item.kind === 'folder') rowEl.appendChild(this._createFolderIcon());

    rowEl.appendChild(this._createTitleElement(item));
    const extEl = this._maybeCreateExtension(item);
    if (extEl) rowEl.appendChild(extEl);

    rowEl.appendChild(this._createActionButtons(item));
    return rowEl;
  }

  private _createIndentGuides(level: number): HTMLElement {
    const indent = document.createElement('div');
    indent.className = 'tm_indent';
    indent.style.width = `${level * 20}px`;
    for (let i = 0; i < level; i++) {
      const col = document.createElement('span');
      col.className = 'tm_indent-col';
      indent.appendChild(col);
    }
    return indent;
  }

  private _createToggleButton(): HTMLElement {
    const toggleBtn = document.createElement('div');
    toggleBtn.className = 'tm_button-icon';
    toggleBtn.setAttribute('data-action', 'toggle');
    toggleBtn.title = 'Toggle';
    setIcon(toggleBtn, 'right-triangle');
    const svg = toggleBtn.querySelector('svg');
    if (svg) svg.classList.add('right-triangle');
    return toggleBtn;
  }

  private _createFolderIcon(): HTMLElement {
    const icon = document.createElement('div');
    icon.className = 'tm_icon';
    icon.setAttribute('aria-hidden', 'true');
    setIcon(icon, 'folder');
    return icon;
  }

  private _createTitleElement(item: RowItem): HTMLElement {
    const titleClass = item.kind === 'virtual'
      ? 'tm_tree-item-title mod-create-new'
      : item.kind === 'file'
        ? 'tm_tree-item-title is-clickable'
        : 'tm_tree-item-title';
    const title = document.createElement('div');
    title.className = titleClass;
    title.title = item.id;
    title.setAttribute('data-node-kind', item.kind);
    title.setAttribute('data-path', item.id);
    title.textContent = item.name;
    return title;
  }

  private _maybeCreateExtension(item: RowItem): HTMLElement | null {
    if (!(item.kind === 'file' && item.extension)) return null;
    const extension = document.createElement('span');
    extension.className = 'tm_extension';
    extension.textContent = item.extension;
    return extension;
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
    createChildBtn.className = 'tm_button-icon rotate-180deg';
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

    const target = e.target;
    if (target instanceof Element) {
      const clickable = target.closest('.tm_button-icon, .tm_tree-item-title');
      if (!clickable) {
        this._handleRowDefaultClick(item, idx, id);
        return;
      }

      if (clickable.classList.contains('tm_button-icon')) {
        const action = clickable.getAttribute('data-action');
        if (action) this._handleActionButtonClick(action, id);
        return;
      }

      if (clickable.classList.contains('tm_tree-item-title')) {
        const kind = clickable.getAttribute('data-node-kind');
        if (kind) this._handleTitleClick(kind, id, idx);
      }
    } else {
      logger.error('[TreeMapper] Error handling row click:', e);
    }
  }

  private _handleRowDefaultClick(item: RowItem, idx: number, id: string): void {
    if (item.kind === 'file') {
      this.virtualTree.selectedIndex = idx;
      this._selectedId = id;
    }
    this.virtualTree._render();
  }

  private _handleActionButtonClick(action: string | null, id: string): void {
    if (!action) return;
    if (action === 'toggle') {
      this.toggle(id);
      this.virtualTree._render();
    } else if (action === 'create-note') {
      FileUtils.createAndOpenNote(this.app, id);
    } else if (action === 'create-child') {
      FileUtils.createChildNote(this.app, id);
    }
  }

  private _handleTitleClick(kind: string | null, id: string, idx: number): void {
    if (kind === 'file') {
      const file = this.app.vault.getAbstractFileByPath(id);
      if (file instanceof TFile) FileUtils.openFile(this.app, file);
      this.virtualTree.selectedIndex = idx;
      this._selectedId = id;
    } else {
      this.virtualTree.focusedIndex = idx;
    }
    this.virtualTree._render();
  }

  // Forwarders that notify expansion changes so the header button stays in sync
  public toggle(id: string): void {
    // eslint-disable-next-line @typescript-eslint/consistent-type-assertions
    const virtualTreePrototype = VirtualTree.prototype as any;
    virtualTreePrototype.toggle.call(this, id);
    this._reapplySelection();
    this._onExpansionChange?.();
  }
  public expand(id: string): void {
    // eslint-disable-next-line @typescript-eslint/consistent-type-assertions
    const virtualTreePrototype = VirtualTree.prototype as any;
    virtualTreePrototype.expand.call(this, id);
    this._reapplySelection();
    this._onExpansionChange?.();
  }
  public collapse(id: string): void {
    // eslint-disable-next-line @typescript-eslint/consistent-type-assertions
    const virtualTreePrototype = VirtualTree.prototype as any;
    virtualTreePrototype.collapse.call(this, id);
    this._reapplySelection();
    this._onExpansionChange?.();
  }

  // Ensure we have enough pooled rows to fill the viewport plus buffer
  private _ensurePoolCapacity(): void {
    const scrollContainer = this.virtualTree.scrollContainer;
    const container = this.virtualTree.container;
    const sc = scrollContainer instanceof HTMLElement ? scrollContainer : container;
    const rowHeight: number = this.virtualTree.rowHeight;
    const buffer: number = this.virtualTree.buffer;
    const pool: HTMLElement[] = this.virtualTree.pool;
    const poolSize: number = this.virtualTree.poolSize;

    const visibleCount = Math.max(1, Math.ceil(sc.clientHeight / rowHeight));
    const desired = visibleCount + buffer * 2;
    if (desired > poolSize) {
      const virtualizer = this.virtualTree.virtualizer;
      if (virtualizer instanceof HTMLElement) {
        for (let i = poolSize; i < desired; i++) {
          const row = document.createElement('div');
          row.className = 'tree-row';
          row.dataset.poolIndex = String(i);
          row.addEventListener('click', (ev) => {
            if (ev instanceof MouseEvent) {
              this._onRowClick(ev, row);
            }
          });
          virtualizer.appendChild(row);
          pool.push(row);
        }
        this.virtualTree.poolSize = desired;
      }
    }
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
