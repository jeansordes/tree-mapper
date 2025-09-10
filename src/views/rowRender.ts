import type { App } from 'obsidian';
import type { RowItem, VirtualTreeLike } from './viewTypes';
import { createActionButtons, createFolderIcon, createIndentGuides, createTitleElement, createToggleButton, maybeCreateExtension, createFileIconOrBadge } from './rowDom';

export function renderRow(vt: VirtualTreeLike, row: HTMLElement, item: RowItem, itemIndex: number, app: App): void {
  const isFocused = itemIndex === vt.focusedIndex;
  const isSelected = itemIndex === vt.selectedIndex;
  const isExpanded = vt.expanded.get(item.id) ?? false;
  const hasChildren = !!item.hasChildren;

  row.style.display = 'flex';
  row.style.position = 'absolute';
  row.style.transform = `translateY(${itemIndex * vt.rowHeight}px)`;
  row.style.height = 'var(--dotn_button-size)';
  row.style.lineHeight = 'var(--dotn_button-size)';
  row.style.setProperty('padding-bottom', 'var(--dotn_gap)');
  row.style.paddingLeft = `calc(${item.level * 20 + 8}px + var(--dotn_gap))`;

  row.className = 'tree-row';

  if (hasChildren && !isExpanded) {
    row.classList.add('collapsed');
  } else {
    row.classList.remove('collapsed');
  }

  row.innerHTML = '';
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


