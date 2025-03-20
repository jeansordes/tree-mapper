import { setIcon } from "obsidian";
import { basename } from "path";
import { t } from "src/i18n";
import { NodeType } from "src/types";
import { Tree } from "src/utils/Tree";

export class TreeView {
    private iconSize = 24;

    renderTree(tree: Tree, expandedNodes: Set<string>): DocumentFragment {
        // Use DocumentFragment for batch DOM operations
        let fragment = document.createDocumentFragment();

        // Root element
        const rootEl = document.createElement('div');
        rootEl.classList.add('tree-item', 'tree-item-root');
        rootEl.setAttribute('data-path', '/');
        const rootItemEl = document.createElement('div');
        rootItemEl.classList.add('tree-item-children');
        rootEl.appendChild(rootItemEl);
        fragment.appendChild(rootEl);

        // SVG Sprite Sheets
        fragment.appendChild(this.getSvgSprites([
            'right-triangle',
            'chevrons-up-down',
            'chevrons-down-up',
            'square-pen',
            'rotate-cw-square',
            'folder',
        ]));

        // Icon elements
        const icons = {
            spacer: '<div class="tree-item-icon-spacer"></div>',
            collapse: '<div class="tree-item-icon is-clickable" data-icon="right-triangle">'
                + this.getIconSVGinnerHTML('right-triangle')
                + '</div>',
            folder: '<div class="tree-item-icon" data-icon="folder">'
                + this.getIconSVGinnerHTML('folder')
                + '</div>',
            collapseAll: '<div class="tree-item-icon is-clickable" data-icon="chevrons-up-down">'
                + this.getIconSVGinnerHTML('chevrons-up-down')
                + '</div>',
            expandAll: '<div class="tree-item-icon is-clickable" data-icon="chevrons-down-up">'
                + this.getIconSVGinnerHTML('chevrons-down-up')
                + '</div>',
            createNote: (path: string) => '<div class="tree-item-icon is-clickable" '
                + 'data-icon="square-pen" title="'
                + t('tooltipCreateNote', { path })
                + '">'
                + this.getIconSVGinnerHTML('square-pen')
                + '</div>',
            createChildNote: (path: string) => '<div class="tree-item-icon is-clickable" '
                + 'data-icon="rotate-cw-square" title="'
                + t('tooltipCreateChildNote', { path })
                + '">'
                + this.getIconSVGinnerHTML('rotate-cw-square')
                + '</div>',
        }

        for (const [depth, paths] of tree.getAllPathsByDepthLevel().entries()) {
            for (const path of paths) {
                const isFile = tree.getNodeType(path) === NodeType.FILE;
                const isFolder = tree.getNodeType(path) === NodeType.FOLDER;
                const isVirtual = tree.getNodeType(path) === NodeType.VIRTUAL;
                const isCollapsed = !expandedNodes.has(path);
                const hasChildren = tree.getChildrenAmount(path) > 0;
                
                const el = document.createElement('div');
                el.classList.add('tree-item', isCollapsed ? 'is-collapsed' : '');
                el.setAttribute('data-path', path);
                el.innerHTML = `
                    <div class="tree-item-self ${hasChildren ? 'mod-collapsed' : ''}">
                        <div class="tree-item-content">
                            ${hasChildren ? icons.collapse : icons.spacer}
                            ${isFolder ? icons.folder : ''}
                            <div
                                class="tree-item-inner ${isFile ? 'is-clickable' : ''}"
                                ${isFile ? `title="${path}"` : ''}
                            >
                                ${basename(path)}
                            </div>
                        </div>
                        <div class="tree-item-buttons">
                            ${isVirtual ? icons.createNote(path) : ''}
                            ${icons.createChildNote(path)}
                        </div>
                    </div>
                    ${hasChildren ? '<div class="tree-item-children"></div>' : ''}
                `;
                
                // TODO: Append element to parentEl.tree-item-children
            }
        }
        return fragment;
    }

    private getSvgSprites(icons: string[]) {
        const svgSprites = document.createElement('svg');
        svgSprites.style.display = 'none';
        for (const icon of icons) {
            const svg = document.createElement('div');
            setIcon(svg, icon);
            const symbol = document.createElement('symbol');
            symbol.setAttribute('id', `icon-${icon}`);
            symbol.setAttribute('viewBox', `0 0 ${this.iconSize} ${this.iconSize}`);
            symbol.innerHTML = svg.querySelector('svg').innerHTML;
            svgSprites.appendChild(symbol);
        }
        return svgSprites;
    }

    private setIcon(el: HTMLElement, iconName: string) {
        /**
         * <svg width="24" height="24">
         *     <use href="#icon-${iconName}"></use>
         * </svg>
         */
        const svg = document.createElement('svg');
        svg.setAttribute('width', this.iconSize.toString());
        svg.setAttribute('height', this.iconSize.toString());
        svg.setAttribute('data-icon', iconName);
        svg.innerHTML = `<use href="#icon-${iconName}"></use>`;
        el.appendChild(svg);
    }

    private getIconSVGinnerHTML(iconName: string) {
        return `<svg width="24" height="24"><use href="#icon-${iconName}"></use></svg>`;
    }

    // collapseAllNodes
    // expandAllNodes

    // restoreExpandedNodesFromSettings
    // getExpandedNodesForSettings

    // highlightFile

    // newNoteEventHandler
    // removeNoteEventHandler
}