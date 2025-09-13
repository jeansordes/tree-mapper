import { App, Menu, TFile, TFolder, Platform } from 'obsidian';

interface ObsidianInternalApp extends App {
  setting?: {
    open(): Promise<void>;
    openTabById(id: string): void;
  };
}
import { t } from '../i18n';
import { FileUtils } from '../utils/FileUtils';
import type { MoreMenuItem } from '../types';
import { DEFAULT_MORE_MENU } from '../types';
import { scrollIntoView } from '../utils/rowState';
import { RenameManager } from '../utils/RenameManager';

export function buildMoreMenu(app: App, path: string, items?: MoreMenuItem[], renameManager?: RenameManager): Menu {
  const menu = new Menu();
  const af = app.vault.getAbstractFileByPath(path);
  const kind = af instanceof TFile ? 'file' : (af ? 'folder' : 'virtual');
  const list: MoreMenuItem[] = Array.isArray(items) ? items : getConfiguredMenuItems(app);

  let hasAddedBuiltinItems = false;
  let hasAddedSeparator = false;

  for (const it of list) {
    if (!shouldShowFor(it, kind)) continue;
    if (it.type === 'builtin') {
      hasAddedBuiltinItems = true;
      if (it.builtin === 'create-child') {
        menu.addItem((mi) => {
          mi.setTitle(t('commandCreateChildNote'))
            .setIcon(it.icon || 'rotate-cw-square')
            .onClick(async () => { await FileUtils.createChildNote(app, path); });
        });
      } else if (it.builtin === 'delete') {
        if (!(af instanceof TFile) && !(af instanceof TFolder)) continue;
        const isFile = af instanceof TFile;
        const title = isFile ? t('menuDeleteFile') : t('menuDeleteFolder');
        
        menu.addItem((mi) => {
          mi.setTitle(title)
            .setIcon(it.icon || 'trash-2')
            .onClick(async () => {
              if (isFile) {
                await app.fileManager.trashFile(af);
              } else {
                try { 
                  await app.fileManager.trashFile(af); 
                } catch { 
                  try { 
                    await app.vault.delete(af, true); 
                  } catch { /* ignore */ } 
                }
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
      } else if (it.builtin === 'rename') {
        menu.addItem((mi) => {
          mi.setTitle(t('menuRename'))
            .setIcon(it.icon || 'edit-3')
            .onClick(async () => {
              if (renameManager) {
                await renameManager.showRenameDialog(path, kind);
              }
            });
        });
      } else if (it.builtin === 'open-closest-parent') {
        if (!(af instanceof TFile)) continue;
        menu.addItem((mi) => {
          mi.setTitle(t('commandOpenClosestParent'))
            .setIcon(it.icon || 'chevron-up')
            .onClick(async () => { await FileUtils.openClosestParentNote(app, af); });
        });
      }
    } else if (it.type === 'command') {
      if (hasAddedBuiltinItems && !hasAddedSeparator) {
        menu.addSeparator();
        hasAddedSeparator = true;
      }
      const label = it.label || it.commandId || 'Custom command';
      menu.addItem((mi) => {
        mi.setTitle(label)
          .onClick(async () => {
            try {
              if (it.openBeforeExecute !== false && af instanceof TFile) {
                await FileUtils.openFile(app, af);
              }
              await FileUtils.executeAppCommand(app, it.commandId);
            } catch { /* ignore */ }
          });
      });
    }
  }

  menu.addSeparator();
  menu.addItem((mi) => {
    mi.setTitle(t('settingsAddCustomCommandLink') || 'Customize menu…')
      .onClick(async () => {
        try {
          // Use the proper Obsidian API to open settings and navigate to plugin tab
          const setting = (app as ObsidianInternalApp).setting;
          if (setting && typeof setting.open === 'function') {
            await setting.open();
            if (typeof setting.openTabById === 'function') {
              setting.openTabById('dot-navigator');
            }

            setTimeout(() => {
              const el = document.getElementById('dotnav-more-menu');
              if (el) {
                scrollIntoView({
                  target: el,
                  padding: 'var(--dotn_view-padding, 16px)',
                  smooth: true,
                  blockAlign: 'start'
                });
              }
            }, 100);
          }
        } catch { /* ignore */ }
      });
  });

  return menu;
}

export function getConfiguredMenuItems(app: App): MoreMenuItem[] {
  try {
    // @ts-expect-error - plugins registry exists at runtime
    const plugin = app?.plugins?.getPlugin?.('dot-navigator');
    const builtinOrder: string[] = Array.isArray(plugin?.settings?.builtinMenuOrder) ? plugin.settings.builtinMenuOrder : [];
    const userItems: MoreMenuItem[] = Array.isArray(plugin?.settings?.userMenuItems) ? plugin.settings.userMenuItems : [];
    const builtinMap = new Map(DEFAULT_MORE_MENU.filter(it => it.type === 'builtin').map(it => [it.id, it] as const));
    const orderedBuiltins: MoreMenuItem[] = [];
    for (const id of builtinOrder) {
      const it = builtinMap.get(id);
      if (it) orderedBuiltins.push(it);
    }
    for (const it of DEFAULT_MORE_MENU) {
      if (it.type !== 'builtin') continue;
      if (!orderedBuiltins.find(x => x.id === it.id)) orderedBuiltins.push(it);
    }
    const legacy = plugin?.settings?.moreMenuItems;
    if ((!builtinOrder?.length && !(userItems?.length)) && Array.isArray(legacy) && legacy.length > 0) {
      return legacy;
    }
    return [...orderedBuiltins, ...userItems];
  } catch {
    return DEFAULT_MORE_MENU;
  }
}

export function shouldShowFor(item: MoreMenuItem, kind: 'file' | 'folder' | 'virtual'): boolean {
  const show = item?.showFor && item.showFor.length > 0 ? item.showFor : undefined;
  if (!show) {
    if (item?.type === 'builtin') {
      return item.builtin === 'create-child' || item.builtin === 'delete' ? true : kind === 'file';
    }
    return kind === 'file';
  }
  return show.includes(kind);
}

