import { App, Menu, TFile, TFolder, Platform } from 'obsidian';
import { t } from '../i18n';
import { FileUtils } from '../utils/FileUtils';
import type { MoreMenuItem } from '../types';
import { DEFAULT_MORE_MENU } from '../types';

export function buildMoreMenu(app: App, path: string, items?: MoreMenuItem[]): Menu {
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
      } else if (it.builtin === 'delete-file') {
        if (!(af instanceof TFile)) continue;
        menu.addItem((mi) => {
          mi.setTitle(t('menuDeleteFile'))
            .setIcon(it.icon || 'trash-2')
            .onClick(async () => { await app.fileManager.trashFile(af); });
          try {
            if (Platform.isMobile) {
              const maybeDom = Reflect.get(mi, 'dom');
              const el = maybeDom instanceof HTMLElement ? maybeDom : undefined;
              if (el) el.classList.add('tappable', 'is-warning');
            }
          } catch { /* ignore */ }
        });
      } else if (it.builtin === 'delete-folder') {
        if (!(af instanceof TFolder)) continue;
        menu.addItem((mi) => {
          mi.setTitle(t('menuDeleteFolder'))
            .setIcon(it.icon || 'trash-2')
            .onClick(async () => {
              try { await app.vault.trash(af, true); }
              catch { try { await app.vault.delete(af, true); } catch { /* ignore */ } }
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
          const plugins = Reflect.get(app, 'plugins');
          const plugin = plugins?.getPlugin?.('dot-navigator');
          if (plugin && typeof plugin === 'object') {
            const settingsTab = Reflect.get(plugin, 'settingTab') ?? Reflect.get(plugin, 'settingsTab');
            if (settingsTab && typeof settingsTab.open === 'function') {
              settingsTab.open();
            } else {
              const settingObj = Reflect.get(app, 'setting');
              if (settingObj && typeof settingObj.open === 'function') settingObj.open();
            }
            setTimeout(() => {
              const el = document.getElementById('dotnav-more-menu');
              if (el) el.scrollIntoView({ behavior: 'smooth', block: 'start' });
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
    if (item?.type === 'builtin') return item.builtin === 'create-child' ? true : kind === 'file';
    return kind === 'file';
  }
  return show.includes(kind);
}


