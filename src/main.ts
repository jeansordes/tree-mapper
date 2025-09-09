import { Plugin, TFile, WorkspaceLeaf } from 'obsidian';
import { t } from './i18n';
import { DEFAULT_SETTINGS, FILE_TREE_VIEW_TYPE, PluginSettings, TREE_VIEW_ICON, MoreMenuItemCommand } from './types';
import { FileUtils } from './utils/FileUtils';
import PluginMainPanel from './views/PluginMainPanel';
import { logger } from './utils/logger';
import { DotNavigatorSettingTab } from './settings/SettingsTab';

export default class DotNavigatorPlugin extends Plugin {
    settings: PluginSettings;
    private pluginMainPanel: PluginMainPanel | null = null;

    async onload() {
        logger.enable();
        logger.log("[DotNavigator] Plugin loading");

        // Force Obsidian to detach our previous views which should clean up attached event handlers
        logger.log("[DotNavigator] Detaching any existing tree views");
        try {
            // This ensures any existing views are properly closed, triggering onClose() for cleanup
            this.app.workspace.detachLeavesOfType(FILE_TREE_VIEW_TYPE);
        } catch {
            // This is normal if it's the first load
            logger.log("[DotNavigator] No existing views to detach");
        }
        
        await this.loadSettings();

        // Settings tab
        this.addSettingTab(new DotNavigatorSettingTab(this.app, this));

        // Register the file tree view
        this.registerView(
            FILE_TREE_VIEW_TYPE,
            (leaf) => {
                this.pluginMainPanel = new PluginMainPanel(leaf, this.settings);
                return this.pluginMainPanel;
            }
        );

        this.addRibbonIcon(TREE_VIEW_ICON, t('ribbonTooltip'), (/* evt: MouseEvent */) => {
            this.activateView();
        });

        this.registerCommands();

        // Use Obsidian's workspace.onLayoutReady for proper initialization
        this.app.workspace.onLayoutReady(() => {
            this.activateView();
        });
    }

    private registerCommands() {
        // This adds a simple command that can be triggered anywhere
        this.addCommand({
            id: 'open-file-tree-view',
            name: t('commandOpenTree'),
            callback: () => {
                this.activateView();
            }
        });

        // Add a command to show the current file in the Dot Navigator View
        this.addCommand({
            id: 'show-file-in-dendron-tree',
            name: t('commandShowFile'),
            checkCallback: (checking: boolean) => {
                // Only enable the command if there's an active file
                const activeFile = this.app.workspace.getActiveFile();
                if (!activeFile) return false;

                if (!checking) {
                    this.showFileInDendronTree(activeFile);
                }

                return true;
            }
        });

        // Add a command to collapse all nodes
        this.addCommand({
            id: 'collapse-all-dendron-tree',
            name: t('commandCollapseAll'),
            callback: () => {
                if (this.pluginMainPanel) {
                    this.pluginMainPanel.collapseAllNodes();
                }
            }
        });

        // Add a command to expand all nodes
        this.addCommand({
            id: 'expand-all-dendron-tree',
            name: t('commandExpandAll'),
            callback: () => {
                if (this.pluginMainPanel) {
                    this.pluginMainPanel.expandAllNodes();
                }
            }
        });

        // Add a command to create a child note to the current note
        this.addCommand({
            id: 'create-child-note',
            name: t('commandCreateChildNote'),
            checkCallback: (checking: boolean) => {
                // Only enable the command if there's an active file
                const activeFile = this.app.workspace.getActiveFile();
                if (!activeFile) return false;

                if (!checking) {
                    FileUtils.createChildNote(this.app, activeFile.path);
                }

                return true;
            }
        });

        // Add a command to open the closest existing parent note
        this.addCommand({
            id: 'open-closest-parent-note',
            name: t('commandOpenClosestParent'),
            checkCallback: (checking: boolean) => {
                const activeFile = this.app.workspace.getActiveFile();
                if (!activeFile) return false;

                if (!checking) {
                    FileUtils.openClosestParentNote(this.app, activeFile);
                }
                return true;
            }
        });
    }


    async initLeaf(): Promise<WorkspaceLeaf | null> {
        // Always create the view in the left panel
        const leaf = this.app.workspace.getLeftLeaf(false);
        if (!leaf) return null;

        // Set the view state
        await leaf.setViewState({
            type: FILE_TREE_VIEW_TYPE,
            active: false // Set to false to avoid automatically focusing the view
        });

        return leaf;
    }

    async activateView() {
        this.app.workspace.onLayoutReady(async () => {
            // If the view is already open, reveal it
            const existing = this.app.workspace.getLeavesOfType(FILE_TREE_VIEW_TYPE);

            if (existing.length > 0) {
                this.app.workspace.revealLeaf(existing[0]);
                return;
            }

            // Otherwise, create a new leaf in the left sidebar
            const leaf = this.app.workspace.getLeftLeaf(false);
            if (leaf) {
                await leaf.setViewState({
                    type: FILE_TREE_VIEW_TYPE,
                    active: true
                });
                this.app.workspace.revealLeaf(leaf);
            }
        });
    }

    /**
     * Show the current file in the Dot Navigator View
     */
    private async showFileInDendronTree(file: TFile): Promise<void> {
        // First, make sure the view is open
        await this.activateView();

        // Get the Dot Navigator View instance
        const leaves = this.app.workspace.getLeavesOfType(FILE_TREE_VIEW_TYPE);
        if (leaves.length === 0) return;

        const dendronView = leaves[0].view;
        
        // Check if the view is our PluginMainPanel type
        if (dendronView instanceof PluginMainPanel && typeof dendronView.highlightFile === 'function') {
            dendronView.highlightFile(file);
        }
    }

    async loadSettings() {
        this.settings = Object.assign({}, DEFAULT_SETTINGS, await this.loadData());

        // Migrate legacy moreMenuItems (combined list) to separate builtin order + user items
        try {
            const legacy = this.settings.moreMenuItems;
            const hasNewFields = Array.isArray(this.settings.builtinMenuOrder) || Array.isArray(this.settings.userMenuItems);
            if (Array.isArray(legacy) && legacy.length > 0 && !hasNewFields) {
                const builtinOrder = legacy.filter(i => i.type === 'builtin').map(i => i.id);
                const userItems = legacy.filter((i): i is MoreMenuItemCommand => i.type === 'command');
                this.settings.builtinMenuOrder = builtinOrder;
                this.settings.userMenuItems = userItems;
                // Clear legacy field so future loads prefer the new structure
                this.settings.moreMenuItems = undefined;
                await this.saveData(this.settings);
            }
            // Ensure builtin order exists at least with defaults
            if (!Array.isArray(this.settings.builtinMenuOrder) || this.settings.builtinMenuOrder.length === 0) {
                // Import at runtime to avoid cycle
                const { DEFAULT_MORE_MENU } = await import('./types');
                this.settings.builtinMenuOrder = DEFAULT_MORE_MENU.filter(i => i.type === 'builtin').map(i => i.id);
            }
        } catch {
            logger.log("[DotNavigator] Settings migration failed; proceeding with defaults");
        }

        // Restore expanded nodes if available
        if (this.pluginMainPanel && this.settings.expandedNodes) {
            this.pluginMainPanel.restoreExpandedNodesFromSettings(this.settings.expandedNodes);
        }
    }

    async saveSettings() {
        // Save expanded nodes state if available
        if (this.pluginMainPanel) {
            this.settings.expandedNodes = this.pluginMainPanel.getExpandedNodesForSettings();
        }

        await this.saveData(this.settings);
    }

    onunload() {
        logger.log("[DotNavigator] Plugin unloading, cleaning up resources");
        
        // Save settings before unloading
        this.saveSettings();
        
        // Clean up plugin panel resources
        if (this.pluginMainPanel) {
            logger.log("[DotNavigator] Cleaning up pluginMainPanel resources");
            this.pluginMainPanel = null;
        }
    }
}
