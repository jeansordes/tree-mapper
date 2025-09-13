import { App, ButtonComponent, PluginSettingTab, Setting } from 'obsidian';
import DotNavigatorPlugin from '../main';
import { DEFAULT_MORE_MENU, MoreMenuItem, MoreMenuItemCommand, MoreMenuItemBuiltin } from '../types';
import { CommandSuggestModal } from './CommandSuggest';

export class DotNavigatorSettingTab extends PluginSettingTab {
  plugin: DotNavigatorPlugin;

  constructor(app: App, plugin: DotNavigatorPlugin) {
    super(app, plugin);
    this.plugin = plugin;
  }

  display(): void {
    const { containerEl } = this;
    containerEl.empty();

    containerEl.createEl('h2', { text: 'Dot Navigator Settings' });

    // More menu section
    const moreMenuHeader = containerEl.createEl('h3', { text: 'More Menu' });
    moreMenuHeader.id = 'dotnav-more-menu';
    containerEl.createEl('p', { text: 'Customize the three-dots menu. Built-in items cannot be removed; you can reorder them. You can add, remove, and reorder custom commands.' });

    // Built-in items ordering
    containerEl.createEl('h4', { text: 'Built-in Items' });
    const builtinList = this.getBuiltinItems();
    const builtinOrder = this.getBuiltinOrder();
    const builtinWrap = containerEl.createEl('div');
    builtinOrder.forEach((id, index) => {
      const item = builtinList.find((x) => x.id === id) || builtinList[index];
      const card = builtinWrap.createEl('div', { cls: 'dotn_settings-card' });
      const header = new Setting(card);
      
      // Manually create the name element with badge
      const nameEl = header.nameEl;
      nameEl.empty();
      nameEl.createSpan({ text: `${index + 1}. ` });
      
      if (item.type === 'builtin') {
        nameEl.createSpan({
          cls: 'dotn_builtin-badge',
          text: 'Built-in'
        });
        nameEl.createSpan({ text: ` ${this.getBuiltinDisplayName(item)}` });
      } else {
        nameEl.createSpan({ text: this.describeItem(item) });
      }
      
      header.addExtraButton((btn) => {
        btn.setIcon('arrow-up')
          .setTooltip('Move up')
          .setDisabled(index === 0)
          .onClick(async () => {
            if (index === 0) return;
            const order = this.getBuiltinOrder();
            const tmp = order[index - 1];
            order[index - 1] = order[index];
            order[index] = tmp;
            await this.updateBuiltinOrder(order);
          });
      });
      header.addExtraButton((btn) => {
        btn.setIcon('arrow-down')
          .setTooltip('Move down')
          .setDisabled(index === builtinOrder.length - 1)
          .onClick(async () => {
            if (index >= builtinOrder.length - 1) return;
            const order = this.getBuiltinOrder();
            const tmp = order[index + 1];
            order[index + 1] = order[index];
            order[index] = tmp;
            await this.updateBuiltinOrder(order);
          });
      });
      // No delete button for builtins
    });

    // Custom commands
    containerEl.createEl('h4', { text: 'Custom Commands' });
    const customItems = this.getUserItems();
    const customWrap = containerEl.createEl('div');
    customItems.forEach((item, index) => {
      const card = customWrap.createEl('div', { cls: 'dotn_settings-card' });
      const header = new Setting(card)
        .setName(`${index + 1}. ${this.describeItem(item)}`);

      header.addExtraButton((btn) => {
        btn.setIcon('arrow-up')
          .setTooltip('Move up')
          .setDisabled(index === 0)
          .onClick(async () => {
            if (index === 0) return;
            const list = this.getUserItems();
            const tmp = list[index - 1];
            list[index - 1] = list[index];
            list[index] = tmp;
            await this.updateUserItems(list);
          });
      });
      header.addExtraButton((btn) => {
        btn.setIcon('arrow-down')
          .setTooltip('Move down')
          .setDisabled(index === customItems.length - 1)
          .onClick(async () => {
            if (index >= customItems.length - 1) return;
            const list = this.getUserItems();
            const tmp = list[index + 1];
            list[index + 1] = list[index];
            list[index] = tmp;
            await this.updateUserItems(list);
          });
      });
      header.addExtraButton((btn) => {
        btn.setIcon('trash')
          .setTooltip('Remove')
          .onClick(async () => {
            const list = this.getUserItems();
            list.splice(index, 1);
            await this.updateUserItems(list);
          });
      });

      // Fields for command item
      new Setting(card)
        .setName('Label')
        .setDesc('Text shown in the menu')
        .addText((text) => {
          text.setValue(item.label || '')
            .onChange(async (v) => {
              const list = this.getUserItems();
              const cur = list[index];
              cur.label = v;
              await this.updateUserItems(list, false);
            });
        });
      const cmdSetting = new Setting(card)
        .setName('Command')
        .setDesc('Pick a command from the palette');
      cmdSetting.addText((text) => {
        const updateDisplay = () => {
          const value = item.commandId ? `${item.label || ''} (${item.commandId})` : '';
          text.setValue(value);
        };
        updateDisplay();
        const inputEl = text.inputEl;
        if (inputEl instanceof HTMLInputElement) {
          inputEl.readOnly = true;
          inputEl.placeholder = 'Select command…';
          inputEl.classList.add('dotn_cursor-pointer');
        }
        const openPicker = () => {
          const modal = new CommandSuggestModal(this.app, async (opt) => {
            const list = this.getUserItems();
            const current = list[index];
            current.commandId = opt.id;
            if (!current.label) current.label = opt.name;
            await this.updateUserItems(list, false);
            updateDisplay();
          });
          modal.open();
        };
        const el = text.inputEl;
        el.addEventListener('click', openPicker);
        el.addEventListener('focus', (e) => {
          const tgt = e.target;
          if (tgt instanceof HTMLInputElement) tgt.blur();
          openPicker();
        });
      });
      new Setting(card)
        .setName('Open file before executing')
        .setDesc('Opens the clicked file before running the command (recommended)')
        .addToggle((tg) => {
          tg.setValue(item.openBeforeExecute !== false)
            .onChange(async (v) => {
              const list = this.getUserItems();
              const cur = list[index];
              cur.openBeforeExecute = v;
              await this.updateUserItems(list, false);
            });
        });
    });

    // Actions row
    const actions = new Setting(containerEl);
    actions.addButton((btn: ButtonComponent) => {
      btn.setButtonText('Add custom command')
        .setCta()
        .onClick(async () => {
          const list = this.getUserItems();
          list.push(this.newCommandItem());
          await this.updateUserItems(list);
        });
    });
    actions.addButton((btn) => {
      btn.setButtonText('Restore defaults')
        .onClick(async () => {
          await this.updateBuiltinOrder(DEFAULT_MORE_MENU.filter(i => i.type === 'builtin').map(i => i.id));
          await this.updateUserItems([]);
          this.display();
        });
    });
  }

  private describeItem(item: MoreMenuItem): string {
    if (item.type === 'builtin') {
      return this.getBuiltinDisplayName(item);
    }
    return `Command: ${item.label || item.commandId || '(unnamed)'}`;
  }

  private getBuiltinDisplayName(item: MoreMenuItemBuiltin): string {
    if (item.builtin === 'create-child') return 'Add child note';
    if (item.builtin === 'rename') return 'Rename';
    if (item.builtin === 'delete') return 'Delete';
    if (item.builtin === 'open-closest-parent') return 'Open closest parent note';
    return 'Unknown';
  }

  private getBuiltinItems(): MoreMenuItem[] {
    // Always current builtins from code
    return DEFAULT_MORE_MENU.filter(i => i.type === 'builtin');
  }

  private getBuiltinOrder(): string[] {
    const order = this.plugin?.settings?.builtinMenuOrder;
    if (Array.isArray(order) && order.length > 0) return order.slice();
    return this.getBuiltinItems().map(i => i.id);
  }

  private async updateBuiltinOrder(order: string[]): Promise<void> {
    this.plugin.settings.builtinMenuOrder = order;
    await this.plugin.saveSettings();
    this.display();
  }

  private getUserItems(): MoreMenuItemCommand[] {
    const list = this.plugin?.settings?.userMenuItems;
    if (Array.isArray(list)) return list.slice();
    // Migration fallback if older combined list exists
    const legacy = this.plugin?.settings?.moreMenuItems;
    if (Array.isArray(legacy) && legacy.length > 0) {
      return legacy.filter((x): x is MoreMenuItemCommand => x.type === 'command');
    }
    return [];
  }

  private async updateUserItems(list: MoreMenuItemCommand[], refreshView: boolean = true): Promise<void> {
    this.plugin.settings.userMenuItems = list;
    await this.plugin.saveSettings();
    if (refreshView) this.display();
  }

  private newCommandItem(): MoreMenuItemCommand {
    return {
      id: `cmd-${Date.now()}`,
      type: 'command',
      label: 'Custom command',
      commandId: '',
      openBeforeExecute: true,
      icon: 'dot',
      showFor: ['file']
    };
  }
}
