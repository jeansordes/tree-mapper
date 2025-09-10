import { App, Menu, TFile, TFolder, Platform } from 'obsidian';
import { FileUtils } from '../utils/FileUtils';
import type { RowItem, VirtualTreeLike } from './viewTypes';
import type { MenuItemKind, MoreMenuItem, MoreMenuItemCommand } from '../types';
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
    // Use the VirtualTree's toggle so selection/focus and scroll are preserved
    try { vt.toggle(id); }
    catch {
      // Fallback to legacy behavior if toggle is unavailable at runtime
      vt.expanded.set(id, !(vt.expanded.get(id) ?? false));
      vt._recomputeVisible();
      vt._render();
    }
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

    let hasAddedBuiltinItems = false;
    let hasAddedSeparator = false;

    for (const it of items) {
      if (!shouldShowFor(it, kind)) continue;
      if (it.type === 'builtin') {
        hasAddedBuiltinItems = true;
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
              .onClick(async () => {
                await app.fileManager.trashFile(file);
              });
            try {
              if (Platform.isMobile) {
                const maybeDom = Reflect.get(mi, 'dom');
                const el = maybeDom instanceof HTMLElement ? maybeDom : undefined;
                if (el) el.classList.add('tappable', 'is-warning');
              }
            } catch { /* ignore */ }
          });
        } else if (it.builtin === 'delete-folder') {
          if (!folder) continue; // only for folders
          menu.addItem((mi) => {
            mi.setTitle(t('menuDeleteFolder'))
              .setIcon(it.icon || 'trash-2')
              .onClick(async () => {
                try {
                  await app.fileManager.trashFile(folder);
                } catch {
                  try { await app.vault.delete(folder, true); } catch { /* ignore */ }
                }
              });
            try {
              if (Platform.isMobile) {
                const maybeDom = Reflect.get(mi, 'dom');
                const el = maybeDom instanceof HTMLElement ? maybeDom : undefined;
                if (el) el.classList.add('tappable', 'is-warning');
              }
            } catch { /* ignore */ }
          });
        } else if (it.builtin === 'open-closest-parent') {
          if (!file) continue; // only for files
          menu.addItem((mi) => {
            mi.setTitle(t('commandOpenClosestParent'))
              .setIcon(it.icon || 'chevron-up')
              .onClick(async () => {
                await FileUtils.openClosestParentNote(app, file);
              });
          });
        }
      } else if (it.type === 'command') {
        // Add separator before first custom command if we have built-in items
        if (hasAddedBuiltinItems && !hasAddedSeparator) {
          menu.addSeparator();
          hasAddedSeparator = true;
        }
        const label = it.label || it.commandId || 'Custom command';
        menu.addItem((mi) => {
          mi.setTitle(label)
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

    // Final section: quick link to customize the menu in settings
    menu.addSeparator();
    menu.addItem((mi) => {
      mi.setTitle(t('settingsAddCustomCommandLink') || 'Customize menu…')
        .onClick(async () => {
          try {
            const plugins = Reflect.get(app, 'plugins');
            const plugin = plugins?.getPlugin?.('dot-navigator');
            if (plugin && typeof plugin === 'object') {
              const settingsTab = Reflect.get(plugin, 'settingTab') ?? Reflect.get(plugin, 'settingsTab');
              if (settingsTab && typeof settingsTab.open === 'function') {
                settingsTab.open();
              } else {
                const settingObj = Reflect.get(app, 'setting');
                if (settingObj && typeof settingObj.open === 'function') {
                  settingObj.open();
                }
              }

              setTimeout(() => {
                const el = document.getElementById('dotnav-more-menu');
                if (el) el.scrollIntoView({ behavior: 'smooth', block: 'start' });
              }, 100);
            }
          } catch { /* ignore */ }
        });
    });

    if (ev instanceof MouseEvent) menu.showAtMouseEvent(ev);
    else if (anchorEl instanceof HTMLElement) {
      const r = anchorEl.getBoundingClientRect();
      menu.showAtPosition({ x: r.left, y: r.bottom });
    }
  }
}

// Intentionally typed to concrete return type for lint correctness
export function getConfiguredMenuItems(app: App): MoreMenuItem[] {
  try {
    // @ts-expect-error - plugins registry exists at runtime
    const plugin = app?.plugins?.getPlugin?.('dot-navigator');
    // New model: builtins order + user items
    const builtinOrder: string[] = Array.isArray(plugin?.settings?.builtinMenuOrder)
      ? plugin.settings.builtinMenuOrder
      : [];
    const userItems: MoreMenuItemCommand[] = Array.isArray(plugin?.settings?.userMenuItems)
      ? plugin.settings.userMenuItems
      : [];

    // Build map of default builtins by id
    const builtinMap = new Map(DEFAULT_MORE_MENU.filter(it => it.type === 'builtin').map(it => [it.id, it] as const));
    // Start with ordered builtins from settings
    const orderedBuiltins: MoreMenuItem[] = [];
    for (const id of builtinOrder) {
      const it = builtinMap.get(id);
      if (it) orderedBuiltins.push(it);
    }
    // Append any new/missing builtins not in order (e.g., after plugin update)
    for (const it of DEFAULT_MORE_MENU) {
      if (it.type !== 'builtin') continue;
      if (!orderedBuiltins.find(x => x.id === it.id)) orderedBuiltins.push(it);
    }

    // If legacy combined list exists and new fields are empty, fallback to it for this session
    const legacyItems: MoreMenuItem[] = Array.isArray(plugin?.settings?.moreMenuItems)
      ? plugin.settings.moreMenuItems
      : [];
    if (!builtinOrder.length && !userItems.length && legacyItems.length > 0) {
      return legacyItems;
    }

    return [...orderedBuiltins, ...userItems];
  } catch {
    return DEFAULT_MORE_MENU;
  }
}

export function shouldShowFor(item: MoreMenuItem, kind: MenuItemKind): boolean {
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
