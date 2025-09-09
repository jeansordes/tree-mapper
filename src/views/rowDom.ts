import { App, setIcon } from 'obsidian';
import { t } from '../i18n';
import { FileUtils } from '../utils/FileUtils';
import type { RowItem } from './viewTypes';
import type { VItem } from '../core/virtualData';

export function createIndentGuides(level: number): HTMLElement {
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

export function createToggleButton(): HTMLElement {
  const toggleBtn = document.createElement('div');
  toggleBtn.className = 'tm_button-icon';
  toggleBtn.setAttribute('data-action', 'toggle');
  toggleBtn.title = 'Toggle';
  setIcon(toggleBtn, 'right-triangle');
  const svg = toggleBtn.querySelector('svg');
  if (svg) svg.classList.add('right-triangle');
  return toggleBtn;
}

export function createFolderIcon(): HTMLElement {
  const icon = document.createElement('div');
  icon.className = 'tm_icon';
  icon.setAttribute('aria-hidden', 'true');
  setIcon(icon, 'folder');
  return icon;
}

export function createTitleElement(item: RowItem): HTMLElement {
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

export function maybeCreateExtension(item: RowItem): HTMLElement | null {
  if (!(item.kind === 'file' && item.extension)) return null;
  const extension = document.createElement('span');
  extension.className = 'tm_extension';
  extension.textContent = item.extension;
  return extension;
}

export function createActionButtons(item: VItem, app: App): HTMLElement {
  const container = document.createElement('div');
  container.className = 'tm_action-buttons-container';

  if (item.kind === 'virtual') {
    const createNoteBtn = document.createElement('div');
    createNoteBtn.className = 'tm_button-icon';
    createNoteBtn.title = t('tooltipCreateNote', { path: item.id });
    createNoteBtn.setAttribute('data-action', 'create-note');
    setIcon(createNoteBtn, 'square-pen');
    container.appendChild(createNoteBtn);
  }

  // Replace the single child button with a "more" menu trigger
  const moreBtn = document.createElement('div');
  moreBtn.className = 'tm_button-icon';
  moreBtn.title = t('tooltipMoreActions');
  moreBtn.setAttribute('data-action', 'more');
  setIcon(moreBtn, 'more-vertical');
  container.appendChild(moreBtn);

  return container;
}
