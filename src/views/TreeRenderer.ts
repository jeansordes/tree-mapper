import { App, setIcon, TFile } from 'obsidian';
import { t } from '../i18n';
import { TreeNode, TreeNodeType } from '../types';
import { FileUtils } from '../utils/FileUtils';
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
        this.expandedNodes = expandedNodes; // Store expandedNodes for use in event handler
        // Use DocumentFragment for batch DOM operations
        const fragment = document.createDocumentFragment();

        // Sort children by name and render each one
        Array.from(node.children.entries())
            .sort(([aKey], [bKey]) => aKey.localeCompare(bKey))
            .forEach(([name, childNode]) => {
                const isFolder = childNode.nodeType === TreeNodeType.FOLDER;
                const isFile = childNode.nodeType === TreeNodeType.FILE;
                const isMarkdownFile = childNode.path.endsWith('.md');
                const hasChildren = childNode.children.size > 0;

                // Create tree item structure
                const item = this.createElement('div', {
                    className: `tm_tree-item-container${!expandedNodes.has(name) ? ' is-collapsed' : ''}`,
                    attributes: { 'data-path': name }
                });

                const itemSelf = this.createElement('div', {
                    className: [
                        'tm_tree-item-self',
                        hasChildren ? ' mod-collapsible' : '',
                        isFolder ? ' mod-folder' : ''
                    ].filter(Boolean).join(' '),
                });
                item.appendChild(itemSelf);

                // Add components to the tree item
                if (hasChildren) {
                    this.addToggleButton(itemSelf, item);
                }

                // Add icon to the tree item
                if (!isMarkdownFile) {
                    const iconName = this.getNodeIconName(childNode);
                    const icon = this.createElement('div', {
                        className: 'tm_icon',
                        attributes: {
                            'data-icon-name': iconName
                        }
                    });
                    setIcon(icon, iconName);
                    itemSelf.appendChild(icon);
                }

                this.addNode(itemSelf, childNode);
                // Add extension to the tree item
                if (isFile && !isMarkdownFile) {
                    const extension = childNode.path.split('.').pop() || '';
                    const extensionEl = this.createElement('div', {
                        className: 'tm_extension',
                        textContent: extension
                    });
                    itemSelf.appendChild(extensionEl);
                }
                this.addActionButtons(itemSelf, childNode, name);

                // Recursively render children
                if (hasChildren) {
                    const childrenContainer = this.createElement('div', { className: 'tm_tree-item-children' });
                    item.appendChild(childrenContainer);
                    this.renderDendronNode(childNode, childrenContainer, expandedNodes);
                }

                fragment.appendChild(item);
            });

        parentEl.appendChild(fragment);
    }

    /**
     * Create an HTML element with specified options
     */
    private createElement(tag: string, options?: {
        className?: string,
        textContent?: string,
        attributes?: Record<string, string>,
        title?: string
    }): HTMLElement {
        const element = document.createElement(tag);

        if (options?.className) element.className = options.className;
        if (options?.textContent) element.textContent = options.textContent;
        if (options?.title) element.setAttribute('title', options.title);

        if (options?.attributes) {
            Object.entries(options.attributes).forEach(([key, value]) => {
                element.setAttribute(key, value);
            });
        }

        return element;
    }

    /**
     * Add toggle button or spacer for tree items
     */
    private addToggleButton(parent: HTMLElement, item: HTMLElement): void {
        const toggleBtn = this.createElement('div', {
            className: 'tm_button-icon',
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
            'tm_tree-item-title',
            node.nodeType === TreeNodeType.VIRTUAL ? 'mod-create-new' : '',
            isFile ? 'is-clickable' : ''
        ].filter(Boolean).join(' ');

        // Create and append the name element
        const nameEl = this.createElement('div', {
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
        if (node.nodeType === TreeNodeType.FOLDER) {
            return FileUtils.basename(node.path);
        }
        return FileUtils.basename(node.path).match(/([^.]+)\.[^.]+$/)?.[1] || FileUtils.basename(node.path);
    }

    private getNodeIconName(node: TreeNode): string {
        if (node.nodeType === TreeNodeType.FOLDER) {
            return 'folder';
        }
        const extension = node.path.split('.').pop() || '';
        switch (extension) {
            case 'md':
                return 'file-markdown';
            case 'canvas':
                return 'layout-dashboard';
            case 'pdf':
                return 'file-scan';
            case 'jpg':
            case 'jpeg':
            case 'png':
            case 'gif':
            case 'webp':
            case 'heic':
            case 'heif':
            case 'svg':
                return 'file-image';
            case 'mp3':
            case 'm4a':
            case 'wav':
            case 'ogg':
            case 'webm':
                return 'file-audio';
            case 'mp4':
            case 'mov':
            case 'avi':
                return 'file-video';
            case 'zip':
            case 'rar':
            case 'tar':
            case 'gz':
                return 'file-zip';
            default:
                return 'file-question';
        }
    }

    /**
     * Add event handler to an element
     */
    private addEventHandler(element: HTMLElement, event: string, handler: (event: Event) => void): void {
        element.addEventListener(event, handler);
    }

    /**
     * Add action buttons to a node
     */
    private addActionButtons(parent: HTMLElement, node: TreeNode, name: string): void {
        // Add "create note" button for virtual nodes
        if (node.nodeType === TreeNodeType.VIRTUAL) {
            const createNoteBtn = this.createActionButton({
                icon: 'square-pen',
                title: t('tooltipCreateNote', { path: node.path }),
                attributes: {
                    'data-action': 'create-note',
                    'data-path': node.path
                }
            });
            parent.appendChild(createNoteBtn);
        }

        // Add "create child note" button for all nodes
        const createChildBtn = this.createActionButton({
            icon: 'rotate-cw-square',
            title: t('tooltipCreateChildNote', { path: FileUtils.getChildPath(node.path) }),
            className: 'rotate-180deg',
            attributes: {
                'data-action': 'create-child',
                'data-path': node.path
            }
        });
        parent.appendChild(createChildBtn);
    }

    /**
     * Create an action button with icon
     */
    private createActionButton(options: {
        icon: string,
        title: string,
        className?: string,
        attributes?: Record<string, string>
    }): HTMLElement {
        const btn = this.createElement('div', {
            className: `tm_button-icon ${options.className || ''}`,
            title: options.title,
            attributes: options.attributes || {}
        });

        setIcon(btn, options.icon);
        return btn;
    }

    /**
     * Add the main event handler to the tree container
     */
    public addTreeEventHandler(treeContainer: HTMLElement): void {
        treeContainer.addEventListener('click', async (event) => {
            // Find the closest clickable element
            const target = event.target as HTMLElement;
            const clickableElement = target.closest('.is-clickable, .tm_button-icon');

            if (!clickableElement) return;

            // Handle toggle button clicks
            if (clickableElement.classList.contains('tm_button-icon')) {
                const action = clickableElement.getAttribute('data-action');
                const path = clickableElement.getAttribute('data-path');

                if (!path) return;

                event.stopPropagation();

                switch (action) {
                    case 'toggle':
                        const item = clickableElement.closest('.tm_tree-item-container');
                        if (item) {
                            const isCollapsed = item.classList.toggle('is-collapsed');
                            isCollapsed ? this.expandedNodes.delete(path) : this.expandedNodes.add(path);

                            const triangle = clickableElement.querySelector('.right-triangle');
                            if (triangle) triangle.classList.toggle('is-collapsed');
                        }
                        return;
                    case 'create-note':
                        await FileUtils.createAndOpenNote(this.app, path);
                        break;
                    case 'create-child':
                        await FileUtils.createChildNote(this.app, path);
                        break;
                }
                return;
            }

            // Handle file clicks
            if (clickableElement.classList.contains('tm_tree-item-title')) {
                const nodeType = clickableElement.getAttribute('data-node-type');
                const path = clickableElement.getAttribute('data-path');

                if (!path) return;

                if (nodeType === TreeNodeType.FILE) {
                    const file = this.app.vault.getAbstractFileByPath(path);
                    if (file instanceof TFile) {
                        await FileUtils.openFile(this.app, file);
                    }
                }
            }
        });
    }
}
