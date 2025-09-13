import type { App } from 'obsidian';
import type { RowItem, VirtualTreeLike } from './viewTypes';
import { handleActionButtonClick, handleTitleClick } from './rowEvents';
import { RenameManager } from '../utils/RenameManager';
import createDebug from 'debug';
const debugError = createDebug('dot-navigator:views:row-handlers:error');

export function bindRowHandlers(
  vt: VirtualTreeLike,
  onRowClick: (ev: MouseEvent, row: HTMLElement) => void,
  onRowContextMenu: (ev: MouseEvent, row: HTMLElement) => void,
  boundSet?: WeakSet<HTMLElement>
): WeakSet<HTMLElement> {
  const set = boundSet ?? new WeakSet<HTMLElement>();
  for (const row of vt.pool) {
    if (!set.has(row)) {
      row.addEventListener('contextmenu', (ev) => {
        if (ev instanceof MouseEvent) onRowContextMenu(ev, row);
      });
      set.add(row);
    }
  }
  return set;
}

export function onRowClick(
  app: App,
  vt: VirtualTreeLike,
  e: MouseEvent,
  row: HTMLElement,
  setSelectedId: (id: string) => void,
  renameManager?: RenameManager
): void {
  const id = row.dataset.id!;
  const idx = Number(row.dataset.index!);
  const item: RowItem = vt.visible[idx];

  vt.focusedIndex = idx;
  vt.container.focus();

  const target = e.target;
  if (!(target instanceof Element)) {
    debugError('Error handling row click:', e);
    return;
  }

  const buttonEl = target.closest('.dotn_button-icon');
  if (buttonEl) {
    const action = buttonEl.getAttribute('data-action');
    if (action && buttonEl instanceof HTMLElement) handleActionButtonClick(app, action, id, item.kind, vt, buttonEl, e, renameManager);
    return;
  }

  const titleEl = target.closest('.dotn_tree-item-title');
  if (!titleEl) return;

  const kind = titleEl.getAttribute('data-node-kind');
  if (kind) handleTitleClick(app, kind, id, idx, vt, setSelectedId);
}

export function onRowContextMenu(app: App, vt: VirtualTreeLike, e: MouseEvent, row: HTMLElement, renameManager?: RenameManager): void {
  e.preventDefault();
  e.stopPropagation();
  const id = row.dataset.id!;
  const idx = Number(row.dataset.index!);
  const item: RowItem = vt.visible[idx];

  vt.focusedIndex = idx;
  vt.container.focus();

  handleActionButtonClick(app, 'more', id, item.kind, vt, row, e, renameManager);
}
