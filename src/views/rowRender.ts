import type { App } from 'obsidian';
import type { RowItem, VirtualTreeLike } from './viewTypes';
import { createActionButtons, createFolderIcon, createIndentGuides, createTitleElement, createToggleButton, maybeCreateExtension, createFileIconOrBadge } from './rowDom';
import { setRowIndentation } from '../utils/rowState';

export function renderRow(vt: VirtualTreeLike, row: HTMLElement, item: RowItem, itemIndex: number, app: App, startPx?: number): void {
  const isFocused = itemIndex === vt.focusedIndex;
  const isSelected = itemIndex === vt.selectedIndex;
  const isExpanded = vt.expanded.get(item.id) ?? false;
  const hasChildren = !!item.hasChildren;

  // Only set transform in JS; all other styling comes from CSS classes
  const y = typeof startPx === 'number' ? startPx : (itemIndex * vt.rowHeight);
  row.style.transform = `translateY(${y}px)`;

  // Fast path: if same item id and not marked dirty, avoid rebuilding children; just update state
  const isDirty = vt.dirtyIds?.has(item.id) === true;
  if (!isDirty && row.dataset.id === item.id) {
    // Update dynamic indentation if changed
    setRowIndentation(row, item.level);
    if (hasChildren && !isExpanded) row.classList.add('collapsed'); else row.classList.remove('collapsed');

    // Ensure presence/absence of the toggle button matches hasChildren
    const existingToggle = row.querySelector('[data-action="toggle"]');
    if (hasChildren) {
      if (!existingToggle) {
        const toggle = createToggleButton();
        const indent = row.querySelector('.dotn_indent');
        if (indent && indent.parentElement === row) {
          row.insertBefore(toggle, indent.nextSibling);
        } else {
          row.insertBefore(toggle, row.firstChild);
        }
      }
      row.setAttribute('aria-expanded', String(isExpanded));
    } else {
      if (existingToggle instanceof HTMLElement) existingToggle.remove();
      row.removeAttribute('aria-expanded');
    }
    const titleEl = row.querySelector('.dotn_tree-item-title');
    if (titleEl) {
      if (isSelected) titleEl.classList.add('is-active'); else titleEl.classList.remove('is-active');
    }
    row.dataset.index = String(itemIndex);
    row.setAttribute('tabindex', isFocused ? '0' : '-1');
    row.setAttribute('aria-selected', String(isSelected));
    // aria-expanded handled above together with toggle button sync
    return;
  }

  // Full (re)build for a new or dirty item
  row.classList.remove('row');
  row.classList.add('tree-row');
  setRowIndentation(row, item.level);

  if (hasChildren && !isExpanded) row.classList.add('collapsed'); else row.classList.remove('collapsed');

  while (row.firstChild) row.removeChild(row.firstChild);
  if (item.level && item.level > 0) row.appendChild(createIndentGuides(item.level));
  if (hasChildren) row.appendChild(createToggleButton());
  if (item.kind === 'folder') row.appendChild(createFolderIcon());
  else if (item.kind === 'file') {
    const ic = createFileIconOrBadge(item);
    if (ic) row.appendChild(ic);
  }
  row.appendChild(createTitleElement(item));
  const extEl = maybeCreateExtension(item);
  if (extEl) row.appendChild(extEl);
  row.appendChild(createActionButtons(item, app));

  const titleEl = row.querySelector('.dotn_tree-item-title');
  if (titleEl) {
    if (isSelected) titleEl.classList.add('is-active'); else titleEl.classList.remove('is-active');
  }

  row.dataset.id = item.id;
  row.dataset.index = String(itemIndex);
  row.setAttribute('role', 'treeitem');
  row.setAttribute('aria-level', String(item.level + 1));
  row.setAttribute('tabindex', isFocused ? '0' : '-1');
  row.setAttribute('aria-selected', String(isSelected));
  if (hasChildren) row.setAttribute('aria-expanded', String(isExpanded));
}
