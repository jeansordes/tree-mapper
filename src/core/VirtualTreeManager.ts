import { App, TFile } from 'obsidian';
import { ComplexVirtualTree } from '../views/VirtualizedTree';
import { TreeBuilder } from '../utils/TreeBuilder';
import { buildVirtualizedData } from './virtualData';
import { logger } from '../utils/logger';
import { computeGap, computeRowHeight } from '../utils/measure';

export class VirtualTreeManager {
  private app: App;
  private vt: ComplexVirtualTree | null = null;
  private onExpansionChange?: () => void;
  private rootContainer?: HTMLElement;

  constructor(app: App, onExpansionChange?: () => void) {
    this.app = app;
    this.onExpansionChange = onExpansionChange;
  }

  init(rootContainer: HTMLElement, expanded?: string[]): void {
    this.rootContainer = rootContainer;
    const folders = this.app.vault.getAllFolders();
    const files = this.app.vault.getFiles();
    const tb = new TreeBuilder();
    const root = tb.buildDendronStructure(folders, files);
    const { data, parentMap } = buildVirtualizedData(root);

    const gap = computeGap(rootContainer) ?? 4;
    const rowHeight = computeRowHeight(rootContainer) || (24 + gap);

    if (this.vt) {
      try { this.vt.destroy(); } catch (e) { logger.error('[TreeMapper] Error destroying previous VT:', e); }
      this.vt = null;
    }

    this.vt = new ComplexVirtualTree({
      container: rootContainer,
      data,
      rowHeight,
      buffer: 10,
      app: this.app,
      gap,
      onExpansionChange: () => this.onExpansionChange?.(),
    });
    this.vt.setParentMap(parentMap);
    if (expanded && expanded.length) this.vt.setExpanded(expanded);
  }

  updateOnVaultChange(newPath?: string, oldPath?: string): void {
    if (!this.vt) return;
    if (oldPath && newPath) {
      try {
        const didRename = this.vt.renamePath(oldPath, newPath);
        if (didRename) {
          this.onExpansionChange?.();
          return;
        }
      } catch (e) {
        logger.error('[TreeMapper] In-place rename failed, will rebuild data:', e);
      }
    }

    const folders = this.app.vault.getAllFolders();
    const files = this.app.vault.getFiles();
    const tb = new TreeBuilder();
    const root = tb.buildDendronStructure(folders, files);
    const { data, parentMap } = buildVirtualizedData(root);
    try {
      this.vt.updateData(data, parentMap);
      this.onExpansionChange?.();
    } catch (e) {
      logger.error('[TreeMapper] Error updating VT data, rebuilding fully:', e);
      if (this.rootContainer) this.init(this.rootContainer, this.getExpandedPaths());
    }
  }

  revealPath(path: string): void { this.vt?.revealPath(path); }
  selectPath(path: string): void { this.vt?.selectPath(path, { reveal: false }); }
  expandAll(): void { this.vt?.expandAll(); this.onExpansionChange?.(); }
  collapseAll(): void { this.vt?.collapseAll(); this.onExpansionChange?.(); }
  getExpandedPaths(): string[] { return this.vt?.getExpandedPaths() ?? []; }
  setExpandedPaths(paths: string[]): void { this.vt?.setExpanded(paths); this.onExpansionChange?.(); }
  destroy(): void { try { this.vt?.destroy(); } catch { /* ignore */ } this.vt = null; }
}
