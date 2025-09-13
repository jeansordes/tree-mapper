import { setIcon } from 'obsidian';
import type { App } from 'obsidian';
import { t } from '../i18n';
import type { RowItem } from './viewTypes';
import type { VItem } from '../core/virtualData';

export function createIndentGuides(level: number): HTMLElement {
  const indent = document.createElement('div');
  indent.className = 'dotn_indent';
  indent.style.width = `${level * 20}px`;
  for (let i = 0; i < level; i++) {
    const col = document.createElement('span');
    col.className = 'dotn_indent-col';
    indent.appendChild(col);
  }
  return indent;
}

export function createToggleButton(): HTMLElement {
  const toggleBtn = document.createElement('div');
  toggleBtn.className = 'dotn_button-icon';
  toggleBtn.setAttribute('data-action', 'toggle');
  toggleBtn.title = 'Toggle';
  setIcon(toggleBtn, 'right-triangle');
  const svg = toggleBtn.querySelector('svg');
  if (svg) svg.classList.add('right-triangle');
  return toggleBtn;
}

export function createFolderIcon(): HTMLElement {
  const icon = document.createElement('div');
  icon.className = 'dotn_icon';
  setIcon(icon, 'folder');
  return icon;
}

export function createFileIconOrBadge(item: RowItem): HTMLElement | null {
  if (item.kind !== 'file') return null;
  const ext = (item.extension || '').toLowerCase();
  if (!ext || (ext === 'md' && !item.name.endsWith('excalidraw'))) return null; // markdown has no icon

  const imageExts = new Set(['png', 'jpg', 'jpeg', 'gif', 'svg', 'webp', 'bmp', 'tif', 'tiff', 'avif', 'heic', 'heif']);
  const audioExts = new Set(['mp3', 'wav', 'ogg', 'flac', 'm4a', 'aac', 'aiff']);
  const videoExts = new Set(['mp4', 'mov', 'avi', 'mkv', 'webm']);

  let iconName: string | null = null;
  if (imageExts.has(ext)) iconName = 'file-image';
  else if (audioExts.has(ext)) iconName = 'file-audio';
  else if (videoExts.has(ext)) iconName = 'file-video';
  else if (ext === 'excalidraw' || item.name.endsWith('excalidraw')) iconName = 'pen-tool';
  else if (ext === 'canvas') iconName = 'layout-dashboard';

  if (iconName) {
    const icon = document.createElement('div');
    icon.className = 'dotn_icon';
    icon.setAttribute('data-icon-name', iconName);
    setIcon(icon, iconName);
    return icon;
  }

  // Unknown extension: show a small badge in the icon slot
  const badge = document.createElement('div');
  badge.className = 'dotn_file-badge';
  badge.textContent = (ext || '?').slice(0, 4).toUpperCase();
  return badge;
}

export function createTitleElement(item: RowItem): HTMLElement {
  const titleClass = item.kind === 'virtual'
    ? 'dotn_tree-item-title mod-create-new'
    : item.kind === 'file'
      ? 'dotn_tree-item-title is-clickable'
      : 'dotn_tree-item-title';
  const title = document.createElement('div');
  title.className = titleClass;
  title.title = item.id;
  title.setAttribute('data-node-kind', item.kind);
  title.setAttribute('data-path', item.id);

  // Check for YAML custom title
  if (item.title) {
    // Create custom title span
    const customTitle = document.createElement('span');
    customTitle.textContent = item.title;
    customTitle.className = 'yaml-custom-title';

    // Create separator dot with spacing
    const separator = document.createElement('span');
    separator.textContent = '·';
    separator.className = 'yaml-filename mx-2';

    // Create filename span with slight transparency and italic style
    const filename = document.createElement('span');
    filename.textContent = item.name;
    filename.className = 'yaml-filename font-italic';

    title.appendChild(customTitle);
    title.appendChild(separator);
    title.appendChild(filename);
  } else {
    // Use original filename display
    title.textContent = item.name;
  }

  return title;
}

export function maybeCreateExtension(_item: RowItem): HTMLElement | null {
  // Extension labels are no longer shown as trailing text; we use icons/badges instead.
  return null;
}

export function createActionButtons(item: VItem, _app: App): HTMLElement {
  const container = document.createElement('div');
  container.className = 'dotn_action-buttons-container';

  if (item.kind === 'virtual') {
    const createNoteBtn = document.createElement('div');
    createNoteBtn.className = 'dotn_button-icon';
    createNoteBtn.title = t('tooltipCreateNote', { path: item.id });
    createNoteBtn.setAttribute('data-action', 'create-note');
    setIcon(createNoteBtn, 'square-pen');
    container.appendChild(createNoteBtn);
  }

  // Replace the single child button with a "more" menu trigger
  const moreBtn = document.createElement('div');
  moreBtn.className = 'dotn_button-icon';
  moreBtn.title = t('tooltipMoreActions');
  moreBtn.setAttribute('data-action', 'more');
  setIcon(moreBtn, 'more-vertical');
  container.appendChild(moreBtn);

  return container;
}
