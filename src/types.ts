import { TFile, TFolder } from 'obsidian';

// Define the view type for our tree view
export const PLUGIN_VIEW_ID = 'tree-mapper-view';
export const TREE_VIEW_ICON = 'folder-git-2';

export interface PluginSettings {
    expandedNodes?: string[]; // Array of node paths that are expanded
}

export const DEFAULT_SETTINGS: PluginSettings = {
    expandedNodes: []
}

export enum NodeType {
    FILE = 'file',
    FOLDER = 'folder',
    VIRTUAL = 'virtual'
}