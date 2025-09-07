import { Platform, setIcon } from 'obsidian';
import { t } from '../i18n';
import { logger } from '../utils/logger';

export class ViewLayout {
  private root: HTMLElement;
  private headerEl: HTMLElement | null = null;
  private treeContainer: HTMLElement | null = null;

  constructor(root: HTMLElement) {
    this.root = root;
  }

  init(): { header: HTMLElement; tree: HTMLElement } {
    const container = this.root;
    container.addClass('tm_view');
    if (Platform.isMobile) container.addClass('tm_view-mobile');

    // Reuse if already present
    let header: HTMLElement | null = container.querySelector('.tm_view-header') as HTMLElement | null;
    let body: HTMLElement | null = container.querySelector('.tm_view-body') as HTMLElement | null;

    if (!(header instanceof HTMLElement) || !(body instanceof HTMLElement)) {
      container.empty();
      header = document.createElement('div');
      header.className = 'tm_view-header';
      container.appendChild(header as HTMLElement);

      body = document.createElement('div');
      body.className = 'tm_view-body';
      container.appendChild(body as HTMLElement);
    }

    // Ensure tree container exists under body
    let tree = body.querySelector('.tm_view-tree');
    if (!(tree instanceof HTMLElement)) {
      tree = document.createElement('div');
      tree.className = 'tm_view-tree';
      (body as HTMLElement).appendChild(tree);
    }

    // Narrow types after potential creation
    const headerEl = header as HTMLElement;
    const treeEl = tree as HTMLElement;

    // Ensure header controls exist
    this.ensureHeaderControls(headerEl);

    this.headerEl = headerEl;
    this.treeContainer = treeEl;
    return { header: headerEl, tree: treeEl };
  }

  onToggleClick(handler: () => void): void {
    const header = this.headerEl;
    const btn = header?.querySelector('.tm_tree-toggle-button');
    if (btn instanceof HTMLElement) {
      const cloned = btn.cloneNode(true);
      if (cloned instanceof HTMLElement) {
        btn.replaceWith(cloned);
        cloned.addEventListener('click', () => handler());
      }
    }
  }

  onRevealClick(handler: () => void): void {
    const header = this.headerEl;
    const btn = header?.querySelector('.tm_reveal-active');
    if (btn instanceof HTMLElement) {
      const cloned = btn.cloneNode(true);
      if (cloned instanceof HTMLElement) {
        btn.replaceWith(cloned);
        cloned.addEventListener('click', () => handler());
      }
    }
  }

  updateToggleDisplay(anyExpanded: boolean): void {
    const header = this.headerEl;
    const toggleButton: HTMLElement | null = header?.querySelector('.tm_tree-toggle-button') || null;
    const iconContainer: HTMLElement | null = toggleButton?.querySelector('.tm_tree-toggle-icon') || null;
    if (!toggleButton || !iconContainer) return;

    try {
      if (!anyExpanded) {
        setIcon(iconContainer, 'chevrons-up-down');
        toggleButton.setAttribute('title', t('tooltipExpandAll'));
      } else {
        setIcon(iconContainer, 'chevrons-down-up');
        toggleButton.setAttribute('title', t('tooltipCollapseAll'));
      }
    } catch (error) {
      logger.error('[TreeMapper] Error updating header toggle icon:', error);
    }
  }

  getTreeContainer(): HTMLElement | null { return this.treeContainer; }

  private ensureHeaderControls(header: HTMLElement): void {
    // Toggle button
    if (!header.querySelector('.tm_tree-toggle-button')) {
      const toggleButton = document.createElement('div');
      toggleButton.className = 'tm_tree-toggle-button';
      const iconContainer = document.createElement('div');
      iconContainer.className = 'tm_tree-toggle-icon tm_button-icon';
      toggleButton.appendChild(iconContainer);
      header.appendChild(toggleButton);
      // initial state
      setIcon(iconContainer, 'chevrons-up-down');
      toggleButton.setAttribute('title', t('tooltipExpandAll'));
    }

    // Reveal active button
    if (!header.querySelector('.tm_reveal-active')) {
      const revealBtn = document.createElement('div');
      revealBtn.className = 'tm_button-icon tm_reveal-active';
      setIcon(revealBtn, 'locate-fixed');
      revealBtn.setAttribute('title', t('tooltipRevealActiveFile'));
      header.appendChild(revealBtn);
    }
  }
}
