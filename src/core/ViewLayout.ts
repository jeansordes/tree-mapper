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
    container.addClass('dotn_view');
    if (Platform.isMobile) container.addClass('dotn_view-mobile');

    // Prepare or create header and body elements without type assertions
    const existingHeader = container.querySelector('.dotn_view-header');
    const existingBody = container.querySelector('.dotn_view-body');
    let headerEl: HTMLElement;
    let bodyEl: HTMLElement;

    if (existingHeader instanceof HTMLElement && existingBody instanceof HTMLElement) {
      headerEl = existingHeader;
      bodyEl = existingBody;
    } else {
      container.empty();
      headerEl = document.createElement('div');
      headerEl.className = 'dotn_view-header';
      container.appendChild(headerEl);

      bodyEl = document.createElement('div');
      bodyEl.className = 'dotn_view-body';
      container.appendChild(bodyEl);
    }

    // Ensure tree container exists under body
    const existingTree = bodyEl.querySelector('.dotn_view-tree');
    let treeEl: HTMLElement;
    if (existingTree instanceof HTMLElement) {
      treeEl = existingTree;
    } else {
      treeEl = document.createElement('div');
      treeEl.className = 'dotn_view-tree';
      bodyEl.appendChild(treeEl);
    }

    // Ensure header controls exist
    this.ensureHeaderControls(headerEl);

    this.headerEl = headerEl;
    this.treeContainer = treeEl;
    return { header: headerEl, tree: treeEl };
  }

  onToggleClick(handler: () => void): void {
    const header = this.headerEl;
    const btn = header?.querySelector('.dotn_tree-toggle-button');
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
    const btn = header?.querySelector('.dotn_reveal-active');
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
    const toggleButton: HTMLElement | null = header?.querySelector('.dotn_tree-toggle-button') || null;
    const iconContainer: HTMLElement | null = toggleButton?.querySelector('.dotn_tree-toggle-icon') || null;
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
      logger.error('[DotNavigator] Error updating header toggle icon:', error);
    }
  }

  getTreeContainer(): HTMLElement | null { return this.treeContainer; }

  private ensureHeaderControls(header: HTMLElement): void {
    // Toggle button
    if (!header.querySelector('.dotn_tree-toggle-button')) {
      const toggleButton = document.createElement('div');
      toggleButton.className = 'dotn_tree-toggle-button';
      const iconContainer = document.createElement('div');
      iconContainer.className = 'dotn_tree-toggle-icon dotn_button-icon';
      toggleButton.appendChild(iconContainer);
      header.appendChild(toggleButton);
      // initial state
      setIcon(iconContainer, 'chevrons-up-down');
      toggleButton.setAttribute('title', t('tooltipExpandAll'));
    }

    // Reveal active button
    if (!header.querySelector('.dotn_reveal-active')) {
      const revealBtn = document.createElement('div');
      revealBtn.className = 'dotn_button-icon dotn_reveal-active';
      setIcon(revealBtn, 'locate-fixed');
      revealBtn.setAttribute('title', t('tooltipRevealActiveFile'));
      header.appendChild(revealBtn);
    }
  }
}
