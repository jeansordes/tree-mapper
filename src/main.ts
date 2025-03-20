import { Plugin } from 'obsidian';
import { DEFAULT_SETTINGS, PLUGIN_VIEW_ID, TREE_VIEW_ICON, PluginSettings } from './types';
import { TreeMapperPluginView } from './views/PluginView';
import { Csl } from './utils/Csl';

export default class TreeMapperPlugin extends Plugin {
    settings: PluginSettings;

    async onload() {
        // Clear the console when in development mode
        new Csl(true).clear();

        // Load settings
        await this.loadSettings();

        // Register the view type
        this.registerView(PLUGIN_VIEW_ID, (leaf) => new TreeMapperPluginView(leaf));
        this.openTreeMapperView();

        // Add a ribbon icon to re-open the view later if it is closed
        this.addRibbonIcon(TREE_VIEW_ICON, 'Open Tree Mapper', () => {
            this.openTreeMapperView();
        });
    }

    async openTreeMapperView() {
        // Check if we already have the view open
        const leaves = this.app.workspace.getLeavesOfType(PLUGIN_VIEW_ID);
        if (leaves.length > 0) {
            // If view exists, just reveal it
            this.app.workspace.revealLeaf(leaves[0]);
            return;
        }

        // Create a new view on the left side
        await this.app.workspace.getLeftLeaf(false).setViewState({
            type: PLUGIN_VIEW_ID,
            active: true,
        });
    }

    async loadSettings() {
        this.settings = Object.assign({}, DEFAULT_SETTINGS, await this.loadData());
    }

    async saveSettings() {
        await this.saveData(this.settings);
    }

    onunload() {
        // Clean up our custom view
        this.app.workspace.detachLeavesOfType(PLUGIN_VIEW_ID);
    }
}