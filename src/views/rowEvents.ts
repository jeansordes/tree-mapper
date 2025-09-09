import { App, TFile } from 'obsidian';
import { FileUtils } from '../utils/FileUtils';
import type { RowItem, VirtualTreeLike } from './viewTypes';

export function handleRowDefaultClick(vt: VirtualTreeLike, item: RowItem, idx: number, id: string, setSelectedId: (id: string) => void): void {
  if (item.kind === 'file') {
    vt.selectedIndex = idx;
    setSelectedId(id);
  }
  vt._render();
}

export function handleActionButtonClick(app: App, action: string | null, id: string, vt: VirtualTreeLike): void {
  if (!action) return;
  if (action === 'toggle') {
    vt.expanded.set(id, !(vt.expanded.get(id) ?? false));
    vt._recomputeVisible();
    vt._render();
  } else if (action === 'create-note') {
    FileUtils.createAndOpenNote(app, id);
  } else if (action === 'create-child') {
    FileUtils.createChildNote(app, id);
  }
}

export function handleTitleClick(app: App, kind: string | null, id: string, idx: number, vt: VirtualTreeLike, setSelectedId: (id: string) => void): void {
  if (kind === 'file') {
    const file = app.vault.getAbstractFileByPath(id);
    if (file instanceof TFile) FileUtils.openFile(app, file);
    vt.selectedIndex = idx;
    setSelectedId(id);
  } else {
    vt.focusedIndex = idx;
  }
  vt._render();
}

