import { App, FuzzySuggestModal } from 'obsidian';

export interface CommandOption {
  id: string;
  name: string;
}

export class CommandSuggestModal extends FuzzySuggestModal<CommandOption> {
  private appRef: App;
  private onPick: (cmd: CommandOption) => void;
  private items: CommandOption[] = [];

  constructor(app: App, onPick: (cmd: CommandOption) => void) {
    super(app);
    this.appRef = app;
    this.onPick = onPick;
    this.setPlaceholder('Search commands…');
    this.items = this.collectCommands();
  }

  private collectCommands(): CommandOption[] {
    const anyApp = this.appRef as any;
    const cmds: CommandOption[] = [];
    try {
      const list = anyApp?.commands?.listCommands?.();
      if (Array.isArray(list)) {
        for (const c of list) {
          if (c?.id && c?.name) cmds.push({ id: c.id, name: c.name });
        }
        return cmds;
      }
    } catch {
      // ignore and try fallback
    }
    try {
      const map = anyApp?.commands?.commands;
      if (map && typeof map === 'object') {
        for (const k of Object.keys(map)) {
          const c = map[k];
          if (c?.id && c?.name) cmds.push({ id: c.id, name: c.name });
        }
      }
    } catch {
      // ignore
    }
    // As a last resort return empty list
    return cmds;
  }

  getItems(): CommandOption[] {
    return this.items;
  }

  getItemText(item: CommandOption): string {
    return `${item.name} (${item.id})`;
  }

  onChooseItem(item: CommandOption): void {
    this.onPick(item);
  }
}

