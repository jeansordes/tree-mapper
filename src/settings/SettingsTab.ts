import { App, ButtonComponent, PluginSettingTab, Setting } from 'obsidian';
import DotNavigatorPlugin from '../main';
import { DEFAULT_MORE_MENU, MoreMenuItem, MoreMenuItemCommand } from '../types';
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
    containerEl.createEl('h3', { text: 'More Menu' });
    containerEl.createEl('p', { text: 'Customize the items shown when clicking the three-dots menu. You can add custom commands from other plugins, remove items, and reorder them.' });

    // Actions row
    const actions = new Setting(containerEl).setName('Manage');
    actions.addButton((btn: ButtonComponent) => {
      btn.setButtonText('Add custom command')
        .setCta()
        .onClick(async () => {
          const list = this.getMenuItems();
          list.push(this.newCommandItem());
          await this.updateMenuItems(list);
        });
    });
    actions.addButton((btn) => {
      btn.setButtonText('Restore defaults')
        .onClick(async () => {
          await this.updateMenuItems(DEFAULT_MORE_MENU.slice());
        });
    });

    const items = this.getMenuItems();

    const listEl = containerEl.createEl('div');

    items.forEach((item, index) => {
      // Card wrapper
      const card = listEl.createEl('div', { cls: 'tm_settings-card' });

      // Header row with move/remove and title
      const header = new Setting(card)
        .setName(`${index + 1}. ${this.describeItem(item)}`);

      header.addExtraButton((btn) => {
        btn.setIcon('arrow-up')
          .setTooltip('Move up')
          .setDisabled(index === 0)
          .onClick(async () => {
            if (index === 0) return;
            const list = this.getMenuItems();
            const tmp = list[index - 1];
            list[index - 1] = list[index];
            list[index] = tmp;
            await this.updateMenuItems(list);
          });
      });
      header.addExtraButton((btn) => {
        btn.setIcon('arrow-down')
          .setTooltip('Move down')
          .setDisabled(index === items.length - 1)
          .onClick(async () => {
            if (index >= items.length - 1) return;
            const list = this.getMenuItems();
            const tmp = list[index + 1];
            list[index + 1] = list[index];
            list[index] = tmp;
            await this.updateMenuItems(list);
          });
      });
      header.addExtraButton((btn) => {
        btn.setIcon('trash')
          .setTooltip('Remove')
          .onClick(async () => {
            const list = this.getMenuItems();
            list.splice(index, 1);
            await this.updateMenuItems(list);
          });
      });

      // Command-specific fields inside the card
      if (item.type === 'command') {
        new Setting(card)
          .setName('Label')
          .setDesc('Text shown in the menu')
          .addText((text) => {
            text.setValue(item.label || '')
              .onChange(async (v) => {
                const list = this.getMenuItems();
                const cur = list[index];
                if (cur.type === 'command') {
                  cur.label = v;
                  await this.updateMenuItems(list, false);
                }
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
            inputEl.style.cursor = 'pointer';
          }

          const openPicker = () => {
            const modal = new CommandSuggestModal(this.app, async (opt) => {
              const list = this.getMenuItems();
              const current = list[index];
              if (current.type === 'command') {
                current.commandId = opt.id;
                if (!current.label) current.label = opt.name;
                await this.updateMenuItems(list, false);
                updateDisplay();
              }
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
                const list = this.getMenuItems();
                const cur = list[index];
                if (cur.type === 'command') {
                  cur.openBeforeExecute = v;
                  await this.updateMenuItems(list, false);
                }
              });
          });
      }
    });
  }

  private describeItem(item: MoreMenuItem): string {
    if (item.type === 'builtin') {
      if (item.builtin === 'create-child') return 'Builtin: Add child note';
      if (item.builtin === 'delete-file') return 'Builtin: Delete file (danger)';
      if (item.builtin === 'delete-folder') return 'Builtin: Delete folder (danger)';
      return 'Builtin';
    }
    return `Command: ${item.label || item.commandId || '(unnamed)'}`;
  }

  private getMenuItems(): MoreMenuItem[] {
    const items = this.plugin?.settings?.moreMenuItems;
    if (Array.isArray(items) && items.length > 0) return items;
    return DEFAULT_MORE_MENU.slice();
  }

  private async updateMenuItems(list: MoreMenuItem[], refreshView: boolean = true): Promise<void> {
    this.plugin.settings.moreMenuItems = list;
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
