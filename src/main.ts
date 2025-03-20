import { Plugin } from 'obsidian';
import { DEFAULT_SETTINGS, PLUGIN_VIEW_ID, PluginSettings } from './types';
export default class TreeMapperPlugin extends Plugin {
	settings: PluginSettings;

	async onload() {
		await this.loadSettings();

		// Always unregister the view type first to ensure clean registration
		try {
			this.app.workspace.detachLeavesOfType(PLUGIN_VIEW_ID);
		} catch (e) {
			// This is normal if it's the first load
		}

        // TODO: registerCommands
        // TODO: registerView
        // TODO: registerRibbonIcon
        // TODO: registerEventHandlers
	}

	async loadSettings() {
		this.settings = Object.assign({}, DEFAULT_SETTINGS, await this.loadData());
	}

    async saveSettings() {
        // TODO: Save expanded nodes state if available
        
        // TODO: Save settings before unloading
        this.saveData(this.settings);
    }
    
    onunload() {
        this.saveSettings();
    }
}