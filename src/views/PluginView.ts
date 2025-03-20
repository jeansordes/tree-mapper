import { ItemView, TFile, TFolder, WorkspaceLeaf } from "obsidian";
import { PLUGIN_VIEW_ID, TREE_VIEW_ICON } from "../types";
import { Tree } from "../utils/Tree";
import { TreeView } from "./TreeView";
import { Csl } from "src/utils/Csl";

export class TreeMapperPluginView extends ItemView {
	private treeView: TreeView;
	private tree: Tree;
	private expandedNodes: Set<string>;

	constructor(leaf: WorkspaceLeaf) {
		super(leaf);
		this.treeView = new TreeView();
		this.expandedNodes = new Set<string>();
	}

	getViewType() {
		return PLUGIN_VIEW_ID;
	}

	getDisplayText() {
		return "Tree Mapper";
	}

	getIcon() {
		return TREE_VIEW_ICON;
	}

	async onOpen() {
        const csl = new Csl(true);

        this.contentEl.empty();
		
		// Get files and folders from the vault
        const files: TFile[] = [];
        const folders: TFolder[] = [];
        for (const file of this.app.vault.getAllLoadedFiles()) {
            if (file instanceof TFile) {
                files.push(file);
            } else if (file instanceof TFolder) {
                folders.push(file);
            }
        }
		
        // Create the tree
		this.tree = new Tree(files, folders);
        csl.log(this.tree.getAllPathsByDepthLevel());

        // Render the tree
		this.contentEl.appendChild(
            this.treeView.renderTree(
                this.tree,
                this.expandedNodes
            )
        );

        // Add event listener to handle click events on tree items
        this.contentEl.addEventListener('click', (event) => {
            let target = (event.target as HTMLElement).closest('.is-clickable');
            if (target instanceof HTMLElement) {
                if (target.classList.contains('collapse-icon')) {
                    // closest parent with data-path attribute
                    const el = target.closest('[data-path]');
                    if (el) {
                        const path = el.getAttribute('data-path');
                        const isCollapsed = el.classList.contains('is-collapsed');
                        if (isCollapsed) {
                            this.expandedNodes.add(path);
                        } else {
                            this.expandedNodes.delete(path);
                        }
                        el.classList.toggle('is-collapsed');
                    } else {
                        console.error('No parent element found when clicking on collapse icon');
                    }
                }
            }
        });
	}

	async onClose() {
		this.contentEl.empty();
	}
}