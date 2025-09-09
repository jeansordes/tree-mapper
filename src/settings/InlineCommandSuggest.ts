import { App } from 'obsidian';

export interface CommandEntry { id: string; name: string }

export class InlineCommandSuggest {
  private app: App;
  private input: HTMLInputElement;
  private container: HTMLElement;
  private onSelect: (opt: CommandEntry) => void;
  private items: CommandEntry[] = [];
  private listEl?: HTMLElement;
  private selectedIndex: number = -1;

  constructor(app: App, input: HTMLInputElement, onSelect: (opt: CommandEntry) => void) {
    this.app = app;
    this.input = input;
    this.container = input.parentElement ?? input;
    this.onSelect = onSelect;
    this.items = this.collectCommands();
    this.bind();
  }

  private collectCommands(): CommandEntry[] {
    const anyApp = this.app as any;
    const res: CommandEntry[] = [];
    try {
      const list = anyApp?.commands?.listCommands?.();
      if (Array.isArray(list)) {
        for (const c of list) if (c?.id && c?.name) res.push({ id: c.id, name: c.name });
        return res;
      }
    } catch {}
    try {
      const map = anyApp?.commands?.commands;
      if (map && typeof map === 'object') {
        for (const k of Object.keys(map)) {
          const c = map[k];
          if (c?.id && c?.name) res.push({ id: c.id, name: c.name });
        }
      }
    } catch {}
    return res;
  }

  private bind(): void {
    this.input.addEventListener('focus', () => this.show());
    this.input.addEventListener('input', () => this.show());
    this.input.addEventListener('keydown', (ev) => this.onKey(ev));
    this.input.addEventListener('blur', () => setTimeout(() => this.hide(), 150));
  }

  private onKey(ev: KeyboardEvent): void {
    const list = this.currentMatches();
    if (!this.listEl || list.length === 0) return;
    if (ev.key === 'ArrowDown') { ev.preventDefault(); this.move(1); }
    else if (ev.key === 'ArrowUp') { ev.preventDefault(); this.move(-1); }
    else if (ev.key === 'Enter') { ev.preventDefault(); if (this.selectedIndex >= 0) this.pick(list[this.selectedIndex]); }
  }

  private move(delta: number): void {
    const list = this.currentMatches();
    this.selectedIndex = Math.max(0, Math.min(list.length - 1, this.selectedIndex + delta));
    this.renderList(list);
  }

  private currentMatches(): CommandEntry[] {
    const q = (this.input.value || '').toLowerCase().trim();
    if (!q) return this.items.slice(0, 8);
    const scored = this.items.filter(it => (it.id + ' ' + it.name).toLowerCase().includes(q));
    return scored.slice(0, 8);
  }

  private ensureList(): HTMLElement {
    if (!this.listEl) {
      const el = document.createElement('div');
      el.className = 'tm_cmd-suggest';
      this.container.appendChild(el);
      this.listEl = el;
    }
    return this.listEl;
  }

  private renderList(options: CommandEntry[]): void {
    const el = this.ensureList();
    el.empty();
    options.forEach((opt, idx) => {
      const row = document.createElement('div');
      row.className = 'tm_cmd-suggest-item' + (idx === this.selectedIndex ? ' is-selected' : '');
      row.textContent = `${opt.name} (${opt.id})`;
      row.addEventListener('mousedown', (e) => { e.preventDefault(); this.pick(opt); });
      el.appendChild(row);
    });
    el.style.display = options.length ? 'block' : 'none';
  }

  private pick(opt: CommandEntry): void {
    this.input.value = opt.id;
    this.hide();
    this.onSelect(opt);
  }

  public show(): void {
    this.selectedIndex = -1;
    this.renderList(this.currentMatches());
  }

  public hide(): void {
    if (this.listEl) this.listEl.style.display = 'none';
  }
}

