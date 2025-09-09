import { App, Menu, TFile, TFolder } from 'obsidian';
import { FileUtils } from '../utils/FileUtils';
import type { RowItem, VirtualTreeLike } from './viewTypes';
import type { MenuItemKind, MoreMenuItem } from '../types';
import { DEFAULT_MORE_MENU } from '../types';
import { t } from '../i18n';

export function handleRowDefaultClick(vt: VirtualTreeLike, item: RowItem, idx: number, id: string, setSelectedId: (id: string) => void): void {
  if (item.kind === 'file') {
    vt.selectedIndex = idx;
    setSelectedId(id);
  }
  vt._render();
}

export function handleActionButtonClick(app: App, action: string | null, id: string, kind: MenuItemKind, vt: VirtualTreeLike, anchorEl?: HTMLElement, ev?: MouseEvent): void {
  if (!action) return;
  if (action === 'toggle') {
    vt.expanded.set(id, !(vt.expanded.get(id) ?? false));
    vt._recomputeVisible();
    vt._render();
  } else if (action === 'create-note') {
    FileUtils.createAndOpenNote(app, id);
  } else if (action === 'create-child') {
    FileUtils.createChildNote(app, id);
  } else if (action === 'more') {
    const menu = new Menu();

    const items = getConfiguredMenuItems(app);
    const fileOrFolder = app.vault.getAbstractFileByPath(id);
    const file = fileOrFolder instanceof TFile ? fileOrFolder : null;
    const folder = fileOrFolder instanceof TFolder ? fileOrFolder : null;

    for (const it of items) {
      if (!shouldShowFor(it, kind)) continue;
      if (it.type === 'builtin') {
        if (it.builtin === 'create-child') {
          menu.addItem((mi) => {
            mi.setTitle(t('commandCreateChildNote'))
              .setIcon(it.icon || 'rotate-cw-square')
              .onClick(async () => {
                await FileUtils.createChildNote(app, id);
              });
          });
        } else if (it.builtin === 'delete-file') {
          if (!file) continue; // only for files
          menu.addItem((mi) => {
            mi.setTitle(t('menuDeleteFile'))
              .setIcon(it.icon || 'trash-2')
              .setSection(it.section === 'danger' ? 'danger' : 'default')
              .onClick(async () => {
                await app.fileManager.trashFile(file);
              });
          });
        } else if (it.builtin === 'delete-folder') {
          if (!folder) continue; // only for folders
          menu.addItem((mi) => {
            mi.setTitle(t('menuDeleteFolder'))
              .setIcon(it.icon || 'trash-2')
              .setSection(it.section === 'danger' ? 'danger' : 'default')
              .onClick(async () => {
                try {
                  // @ts-expect-error - older/newer Obsidian versions may expose trash API
                  if (typeof app.vault.trash === 'function') {
                    // @ts-expect-error - see above
                    await app.vault.trash(folder, true);
                  } else {
                    await app.vault.delete(folder, true);
                  }
                } catch {
                  // ignore
                }
              });
          });
        }
      } else if (it.type === 'command') {
        const label = it.label || it.commandId || 'Custom command';
        menu.addItem((mi) => {
          mi.setTitle(label)
            .setIcon(it.icon || 'dot')
            .onClick(async () => {
              try {
                if (it.openBeforeExecute !== false && file) {
                  await FileUtils.openFile(app, file);
                }
                // Run the app command directly so editor commands work
                await FileUtils.executeAppCommand(app, it.commandId);
              } catch {
                // Ignore failures to keep UX responsive
              }
            });
        });
      }
    }

    if (ev instanceof MouseEvent) menu.showAtMouseEvent(ev);
    else if (anchorEl instanceof HTMLElement) {
      const r = anchorEl.getBoundingClientRect();
      menu.showAtPosition({ x: r.left, y: r.bottom });
    }
  }
}

// Intentionally loose typing here due to runtime plugin API shape variations
// eslint-disable-next-line @typescript-eslint/explicit-module-boundary-types
function getConfiguredMenuItems(app: App) {
  try {
    // @ts-expect-error - plugins registry exists at runtime
    const plugin = app?.plugins?.getPlugin?.('tree-mapper');
    const list = plugin?.settings?.moreMenuItems;
    if (Array.isArray(list) && list.length > 0) return list;
    return DEFAULT_MORE_MENU;
  } catch {
    return DEFAULT_MORE_MENU;
  }
}

function shouldShowFor(item: MoreMenuItem, kind: MenuItemKind): boolean {
  const show = item.showFor && item.showFor.length > 0 ? item.showFor : undefined;
  if (!show) {
    // Defaults: builtin delete => files only; builtin create-child => all; command => files only
    if (item.type === 'builtin') return item.builtin === 'create-child' ? true : kind === 'file';
    return kind === 'file';
  }
  return show.includes(kind);
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

// Native rename/delete are executed via File Explorer commands through FileUtils.
