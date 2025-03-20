import { setIcon } from "obsidian";
import { basename } from "path";
import { t } from "src/i18n";
import { NodeType } from "src/types";
import { Tree } from "src/utils/Tree";

export class TreeView {
    private iconSize = 24;

    public renderTree(tree: Tree, expandedNodes: Set<string>): DocumentFragment {
        // Use DocumentFragment for batch DOM operations
        let fragment = document.createDocumentFragment();

        // SVG Sprite Sheets - Add this FIRST to ensure icons are available when referenced
        const svgSprites = this.buildSVGsprite([
            'right-triangle sw4px',
            'chevrons-up-down',
            'chevrons-down-up',
            'square-pen',
            'rotate-cw-square r180deg',
            'folder',
        ]);
        fragment.appendChild(svgSprites);

        // Root element
        const rootEl = document.createElement('div');
        rootEl.classList.add('tm_tree-item', 'tm_tree-item-root');
        rootEl.setAttribute('data-path', '/');
        const rootItemEl = document.createElement('div');
        rootItemEl.classList.add('tm_tree-item-children', 'tm_root-children');
        rootEl.appendChild(rootItemEl);
        fragment.appendChild(rootEl);

        // Icon elements
        const icons = {
            spacer: '<div class="tm_tree-item-icon-spacer"></div>',
            collapse: '<div class="tm_tree-item-icon is-clickable collapse-icon" data-icon="right-triangle">'
                + this.setIcon('right-triangle')
                + '</div>',
            folder: '<div class="tm_tree-item-icon" data-icon="folder">'
                + this.setIcon('folder')
                + '</div>',
            collapseAll: '<div class="tm_tree-item-icon is-clickable" data-icon="chevrons-up-down">'
                + this.setIcon('chevrons-up-down')
                + '</div>',
            expandAll: '<div class="tm_tree-item-icon is-clickable" data-icon="chevrons-down-up">'
                + this.setIcon('chevrons-down-up')
                + '</div>',
            createNote: (path: string) => '<div class="tm_tree-item-icon is-clickable create-note-icon" '
                + 'data-icon="square-pen" title="'
                + t('tooltipCreateNote', { path })
                + '">'
                + this.setIcon('square-pen')
                + '</div>',
            createChildNote: (path: string) => '<div class="tm_tree-item-icon is-clickable create-child-note-icon" '
                + 'data-icon="rotate-cw-square" title="'
                + t('tooltipCreateChildNote', { path: tree.getNewNotePath(path) })
                + '">'
                + this.setIcon('rotate-cw-square')
                + '</div>',
        }

        for (let i = 1; i < tree.getAllPathsByDepthLevel().size; i++) {
            const paths = tree.getAllPathsByDepthLevel().get(i);
            for (const path of paths) {
                const isFile = tree.getNodeType(path) === NodeType.FILE;
                const isFolder = tree.getNodeType(path) === NodeType.FOLDER;
                const isVirtual = tree.getNodeType(path) === NodeType.VIRTUAL;
                const isCollapsed = !expandedNodes.has(path);
                const hasChildren = tree.getChildrenAmount(path) > 0;
                
                const el = document.createElement('div');
                el.classList.add('tm_tree-item', isCollapsed ? 'is-collapsed' : '');
                el.setAttribute('data-path', path);
                el.innerHTML = `
                    <div class="tm_tree-item-self ${hasChildren ? 'mod-collapsed' : ''}">
                        <div class="tm_tree-item-content">
                            ${hasChildren ? icons.collapse : icons.spacer}
                            ${isFolder ? icons.folder : ''}
                            <div
                                class="tm_tree-item-inner ${isFile ? 'is-clickable' : ''}"
                                ${isFile ? `title="${path}"` : ''}
                            >
                                ${basename(path)}
                            </div>
                        </div>
                        <div class="tm_tree-item-buttons">
                            ${isVirtual ? icons.createNote(path) : ''}
                            ${icons.createChildNote(path)}
                        </div>
                    </div>
                    ${hasChildren ? '<div class="tm_tree-item-children"></div>' : ''}
                `;
                
                const parentEl = fragment.querySelector('[data-path="' + tree.getParentPath(path) + '"] .tm_tree-item-children');
                parentEl.appendChild(el);
            }
        }
        return fragment;
    }

    private buildSVGsprite(icons: string[]): SVGSVGElement {
        const svgSprites = document.createElementNS('http://www.w3.org/2000/svg', 'svg');
        svgSprites.style.display = 'none';
        
        for (let icon of icons) {
            let rotationAngle = 0;
            let strokeWidth = 2;
            const iconParts = icon.split(' ');
            if (iconParts.length > 1) {
                icon = iconParts[0];
                for (let i = 1; i < iconParts.length; i++) {
                    const part = iconParts[i];
                    if (part.match(/r(\d+)deg/)) {
                        rotationAngle = parseInt(part.match(/r(\d+)deg/)[1]);
                    } else if (part.match(/sw(\d+)px/)) {
                        strokeWidth = parseInt(part.match(/sw(\d+)px/)[1]);
                    }
                }
            }
            const svg = document.createElement('div');
            setIcon(svg, icon);
            if (!svg.querySelector('svg')) {
                console.error(`Icon ${icon} not found`);
                continue;
            }
            
            const symbol = document.createElementNS('http://www.w3.org/2000/svg', 'symbol');
            symbol.setAttribute('id', `icon-${icon}`);
            symbol.setAttribute('viewBox', `0 0 ${this.iconSize} ${this.iconSize}`);
            symbol.setAttribute('fill', 'none');
            symbol.setAttribute('stroke', 'currentColor');
            symbol.setAttribute('stroke-width', strokeWidth.toString());
            symbol.setAttribute('stroke-linecap', 'round');
            symbol.setAttribute('stroke-linejoin', 'round');
            symbol.setAttribute('class', 'svg-icon');
            symbol.innerHTML = svg.querySelector('svg').innerHTML; 

            // Add a transform group around the content to apply rotation
            if (rotationAngle !== 0) {
                const originalContent = symbol.innerHTML;
                symbol.innerHTML = `<g transform="rotate(${rotationAngle} ${this.iconSize/2} ${this.iconSize/2})">${originalContent}</g>`;
            }

            svgSprites.appendChild(symbol);
        }
        return svgSprites;
    }

    private setIcon(iconName: string) {
        return `<svg class="svg-icon"><use xlink:href="#icon-${iconName}"></use></svg>`;
    }

    // collapseAllNodes
    // expandAllNodes

    // restoreExpandedNodesFromSettings
    // getExpandedNodesForSettings

    // highlightFile

    // newNoteEventHandler
    // removeNoteEventHandler
}