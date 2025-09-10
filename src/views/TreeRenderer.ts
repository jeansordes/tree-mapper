import { App, setIcon, TFile } from 'obsidian';
import { t } from '../i18n';
import { TreeNode, TreeNodeType } from '../types';
import { buildMoreMenu } from './menuUtils';
import { FileUtils } from '../utils/FileUtils';
import { createActionButton, createElement } from './domUtils';

export class TreeRenderer {
    private fileItemsMap: Map<string, HTMLElement>;
    private app: App;
    private expandedNodes: Set<string>;

    constructor(app: App, fileItemsMap: Map<string, HTMLElement>) {
        this.app = app;
        this.fileItemsMap = fileItemsMap;
    }

    /**
     * Render a node in the tree
     */
    public renderDendronNode(node: TreeNode, parentEl: HTMLElement, expandedNodes: Set<string>) {
        this.expandedNodes = expandedNodes;
        const fragment = document.createDocumentFragment();

        Array.from(node.children.entries())
            .sort(([aKey], [bKey]) => aKey.localeCompare(bKey))
            .forEach(([name, childNode]) => {
                const el = this.renderChildNode(name, childNode, expandedNodes);
                fragment.appendChild(el);
            });

        parentEl.appendChild(fragment);
    }

    private renderChildNode(name: string, childNode: TreeNode, expandedNodes: Set<string>): HTMLElement {
        const isFolder = childNode.nodeType === TreeNodeType.FOLDER;
        const isMarkdownFile = childNode.path.endsWith('.md');
        const hasChildren = childNode.children.size > 0;

        const item = createElement('div', {
            className: `dotn_tree-item-container${!expandedNodes.has(name) ? ' is-collapsed' : ''}`,
            attributes: { 'data-path': name }
        });

        const itemSelf = createElement('div', {
            className: [
                'dotn_tree-item-self',
                hasChildren ? ' mod-collapsible' : '',
                isFolder ? ' mod-folder' : ''
            ].filter(Boolean).join(' '),
        });
        item.appendChild(itemSelf);

        if (hasChildren) this.addToggleButton(itemSelf, item);

        if (!isMarkdownFile) {
            const iconName = this.getNodeIconName(childNode);
            if (iconName) {
                const icon = createElement('div', {
                    className: 'dotn_icon',
                    attributes: { 'data-icon-name': iconName }
                });
                setIcon(icon, iconName);
                itemSelf.appendChild(icon);
            } else {
                const ext = childNode.path.split('.').pop() || '';
                const badge = createElement('div', {
                    className: 'dotn_file-badge',
                    textContent: ext.slice(0, 4).toUpperCase()
                });
                itemSelf.appendChild(badge);
            }
        }

        this.addNode(itemSelf, childNode);

        // trailing extension label removed; we now show an icon/badge before the title
        this.addActionButtons(itemSelf, childNode);

        if (hasChildren) {
            const childrenContainer = createElement('div', { className: 'dotn_tree-item-children' });
            item.appendChild(childrenContainer);
            this.renderDendronNode(childNode, childrenContainer, expandedNodes);
        }

        return item;
    }

    /**
     * Create an HTML element with specified options
     */
    /**
     * Add toggle button or spacer for tree items
     */
    private addToggleButton(parent: HTMLElement, item: HTMLElement): void {
        const toggleBtn = createElement('div', {
            className: 'dotn_button-icon',
            attributes: {
                'data-action': 'toggle',
                'data-path': item.getAttribute('data-path') || ''
            }
        });
        parent.appendChild(toggleBtn);
        setIcon(toggleBtn, 'right-triangle');
    }

    /**
     * Add node with appropriate styling
     */
    private addNode(parent: HTMLElement, node: TreeNode): void {
        const isFile = node.nodeType === TreeNodeType.FILE;

        // Build class name and determine tooltip
        const className = [
            'dotn_tree-item-title',
            node.nodeType === TreeNodeType.VIRTUAL ? 'mod-create-new' : '',
            isFile ? 'is-clickable' : ''
        ].filter(Boolean).join(' ');

        // Create and append the name element
        const nameEl = createElement('div', {
            className,
            textContent: this.getNodeName(node),
            title: node.path,
            attributes: {
                'data-node-type': node.nodeType,
                'data-path': node.path,
            }
        });

        parent.appendChild(nameEl);

        // Store reference for file items
        if (isFile && node.obsidianResource && node.obsidianResource instanceof TFile) {
            this.fileItemsMap.set(node.obsidianResource.path, nameEl);
        }
    }

    private getNodeName(node: TreeNode): string {
        let name;
        if (node.nodeType === TreeNodeType.FOLDER) {
            name = FileUtils.basename(node.path);
        } else {
            name = FileUtils.basename(node.path).match(/([^.]+)\.[^.]+$/)?.[1] || FileUtils.basename(node.path);
        }
        // Strip out the counter suffix if present
        return name.replace(/ \(\d+\)$/, '');
    }

    private getNodeIconName(node: TreeNode): string | null {
        if (node.nodeType === TreeNodeType.FOLDER) return 'folder';
        const extension = node.path.split('.').pop() || '';
        const map: Record<string, string | null> = {
            md: null,
            canvas: 'layout-dashboard',
            pdf: 'file-scan',
            jpg: 'file-image', jpeg: 'file-image', png: 'file-image', gif: 'file-image', webp: 'file-image', heic: 'file-image', heif: 'file-image', svg: 'file-image', bmp: 'file-image', tif: 'file-image', tiff: 'file-image', avif: 'file-image',
            mp3: 'file-audio', m4a: 'file-audio', wav: 'file-audio', ogg: 'file-audio', flac: 'file-audio', aac: 'file-audio', aiff: 'file-audio',
            mp4: 'file-video', mov: 'file-video', avi: 'file-video', mkv: 'file-video', webm: 'file-video',
            excalidraw: 'pen-tool',
            zip: 'file-zip', rar: 'file-zip', tar: 'file-zip', gz: 'file-zip',
        };
        return extension in map ? map[extension] : null;
    }

    /**
     * Add action buttons to a node
     */
    private addActionButtons(parent: HTMLElement, node: TreeNode): void {
        // Create a container for the action buttons
        const actionButtonsContainer = createElement('div', {
            className: 'dotn_action-buttons-container'
        });
        parent.appendChild(actionButtonsContainer);

        // Add "create note" button for virtual nodes
        if (node.nodeType === TreeNodeType.VIRTUAL) {
            const createNoteBtn = createActionButton({
                icon: 'square-pen',
                title: t('tooltipCreateNote', { path: node.path }),
                attributes: {
                    'data-action': 'create-note',
                    'data-path': node.path
                }
            });
            actionButtonsContainer.appendChild(createNoteBtn);
        }

        // Replace with a single "more" button that opens a native menu
        const moreBtn = createActionButton({
            icon: 'more-vertical',
            title: t('tooltipMoreActions'),
            attributes: {
                'data-action': 'more',
                'data-path': node.path
            }
        });
        actionButtonsContainer.appendChild(moreBtn);
    }

    /**
     * Add the main event handler to the tree container
     * Uses event delegation for better performance - one event listener for the entire tree
     * instead of attaching individual listeners to each element.
     * This significantly reduces memory usage and improves rendering performance.
     */
    public addTreeEventHandler(treeContainer: HTMLElement): void {
        // First remove any existing handlers to prevent duplicates
        treeContainer.removeEventListener('click', this.handleTreeClick);
        treeContainer.removeEventListener('mousemove', this.handleTreeMouseMove);
        treeContainer.removeEventListener('mouseleave', this.handleTreeMouseLeave);
        treeContainer.removeEventListener('contextmenu', this.handleTreeContextMenu);

        // Then add our event handlers
        treeContainer.addEventListener('click', this.handleTreeClick);
        treeContainer.addEventListener('mousemove', this.handleTreeMouseMove);
        treeContainer.addEventListener('mouseleave', this.handleTreeMouseLeave);
        treeContainer.addEventListener('contextmenu', this.handleTreeContextMenu);
    }

    /**
     * Handle mouse movement for vertical line hover effects
     */
    private handleTreeMouseMove = (event: MouseEvent) => {
        const target = event.target;

        if (target instanceof HTMLElement && target.classList.contains('dotn_tree-item-children')) {
            const rect = target.getBoundingClientRect();
            const isOverLine = event.clientX - rect.left <= 10;

            if (isOverLine) {
                // Add hover class only to the specific element
                target.classList.add('dotn_line-hover');
            } else {
                // Remove hover class when not over the line
                target.classList.remove('dotn_line-hover');
            }
        }

        // Remove hover class from all other elements
        const allChildren = document.querySelectorAll('.dotn_tree-item-children.dotn_line-hover');
        allChildren.forEach(el => {
            if (el !== target) {
                el.classList.remove('dotn_line-hover');
            }
        });
    };

    /**
     * Handle mouse leave to clean up hover states
     */
    private handleTreeMouseLeave = () => {
        // Remove all hover classes when mouse leaves the tree
        const allChildren = document.querySelectorAll('.dotn_tree-item-children.dotn_line-hover');
        allChildren.forEach(el => {
            el.classList.remove('dotn_line-hover');
        });
    };

    /**
     * The main click event handler for the tree
     * Using a class method so we can easily remove it later
     */
    private handleTreeClick = async (event: MouseEvent) => {
        const target = event.target;

        if (target instanceof HTMLElement && target.classList.contains('dotn_tree-item-children')) {
            if (this.handleCollapseViaGuideClick(event, target)) return;
        }

        const clickableElement: Element | null = target instanceof Element ? target.closest('.is-clickable, .dotn_button-icon') : null;
        if (!clickableElement) return;

        if (clickableElement.classList.contains('dotn_button-icon') && clickableElement instanceof HTMLElement) {
            await this.handleActionButtonClick(event, clickableElement);
            return;
        }
        
        if (clickableElement.classList.contains('dotn_tree-item-title') && clickableElement instanceof HTMLElement) {
            await this.handleTitleClick(clickableElement);
            return;
        }
    };

    /**
     * Open the "more" menu on right-click anywhere on a row (desktop)
     */
    private handleTreeContextMenu = async (event: MouseEvent) => {
        const target = event.target;
        if (!(target instanceof Element)) return;
        // Limit to actual row content, not the children container area
        const self = target.closest('.dotn_tree-item-self');
        if (!self) return;
        const container = self.closest('.dotn_tree-item-container');
        const path = container instanceof HTMLElement ? container.getAttribute('data-path') : null;
        if (!path) return;
        event.preventDefault();
        event.stopPropagation();

        // Reuse the existing button handler by faking a "more" button element
        const fakeBtn = document.createElement('div');
        fakeBtn.setAttribute('data-action', 'more');
        fakeBtn.setAttribute('data-path', path);
        await this.handleActionButtonClick(event, fakeBtn);
    };

    private handleCollapseViaGuideClick(event: MouseEvent, target: HTMLElement): boolean {
        const rect = target.getBoundingClientRect();
        if (event.clientX - rect.left > 10) return false;
        const parent = target.parentElement;
        if (!parent?.classList.contains('dotn_tree-item-container')) return false;

        const path = parent.getAttribute('data-path');
        const isCollapsed = parent.classList.toggle('is-collapsed');

        const toggleBtn = parent.querySelector('.dotn_button-icon[data-action="toggle"]');
        const triangle = toggleBtn?.querySelector('.right-triangle');
        if (triangle) triangle.classList.toggle('is-collapsed');

        if (path) {
            if (isCollapsed) {
                this.expandedNodes.delete(path);
                const btn = parent.querySelector('.dotn_button-icon[data-action="toggle"]');
                if (btn instanceof HTMLElement) this.highlightLastCollapsed(btn);
            } else {
                this.expandedNodes.add(path);
            }
        }
        event.stopPropagation();
        return true;
    }

    private async handleActionButtonClick(event: MouseEvent, btn: HTMLElement): Promise<void> {
        const action = btn.getAttribute('data-action');
        const path = btn.getAttribute('data-path');
        if (!path) return;
        event.stopPropagation();
        switch (action) {
            case 'toggle': {
                const item = btn.closest('.dotn_tree-item-container');
                if (item instanceof HTMLElement) {
                    const isCollapsed = item.classList.toggle('is-collapsed');
                    if (isCollapsed) {
                        this.expandedNodes.delete(path);
                        this.highlightLastCollapsed(btn);
                    } else {
                        this.expandedNodes.add(path);
                    }
                    const triangle = btn.querySelector('.right-triangle');
                    if (triangle) triangle.classList.toggle('is-collapsed');
                }
                return;
            }
            case 'create-note':
                await FileUtils.createAndOpenNote(this.app, path);
                return;
            case 'create-child':
                await FileUtils.createChildNote(this.app, path);
                return;
            case 'more': {
                const menu = buildMoreMenu(this.app, path);
                menu.showAtMouseEvent(event);
                return;
            }
        }
    }

    private async handleTitleClick(el: HTMLElement): Promise<void> {
        const nodeType = el.getAttribute('data-node-type');
        const path = el.getAttribute('data-path');
        if (!path) return;
        if (nodeType === TreeNodeType.FILE) {
            const file = this.app.vault.getAbstractFileByPath(path);
            if (file instanceof TFile) await FileUtils.openFile(this.app, file);
        }
    }

    /**
     * Highlight the most recently collapsed toggle button
     */
    private highlightLastCollapsed(toggleButton: HTMLElement): void {
        // Remove highlight from any previously highlighted toggle
        const previousHighlighted = document.querySelector('.dotn_button-icon[data-action="toggle"].dotn_last-collapsed');
        if (previousHighlighted) {
            previousHighlighted.classList.remove('dotn_last-collapsed');
        }

        // Add highlight to the current toggle button
        toggleButton.classList.add('dotn_last-collapsed');

        // Remove the highlight after 3 seconds
        setTimeout(() => {
            toggleButton.classList.remove('dotn_last-collapsed');
        }, 10 * 1000);
    }

    // Rename/delete are handled via native File Explorer commands triggered in the menu handlers above.

    // Menu configuration helpers moved to menuUtils.ts
}
