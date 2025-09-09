import { TFile, TFolder } from 'obsidian';

// Define the view type for our tree view
export const FILE_TREE_VIEW_TYPE = 'tree-mapper-view';
export const TREE_VIEW_ICON = 'folder-git-2';

export interface PluginSettings {
    mySetting: string;
    expandedNodes?: string[]; // Array of node paths that are expanded
}

export const DEFAULT_SETTINGS: PluginSettings = {
    mySetting: 'default',
    expandedNodes: []
}

export enum TreeNodeType {
    FILE = 'file',
    FOLDER = 'folder',
    VIRTUAL = 'virtual'
}

export interface TreeNode {
    path: string;
    nodeType: TreeNodeType;
    obsidianResource?: TFile | TFolder;
    children: Map<string, TreeNode>;
}

// Types for the virtual tree component
// Base item shape for input data (no computed fields)
export interface VirtualTreeBaseItem {
    id: string;
    name: string;
    kind: 'file' | 'folder' | 'virtual';
    children?: VirtualTreeBaseItem[];
    expanded?: boolean;
}

// Flattened item shape used by the renderer
export interface VirtualTreeItem extends VirtualTreeBaseItem {
    level: number;
    hasChildren?: boolean;
}

export interface VirtualTreeOptions {
    container: HTMLElement;
    data?: VirtualTreeBaseItem[];
    rowHeight?: number;
    buffer?: number;
    onOpen?: (item: VirtualTreeItem) => void;
    onSelect?: (item: VirtualTreeItem) => void;
}

export interface WindowResult {
    startIndex: number;
    endIndex: number;
    poolSize: number;
}
