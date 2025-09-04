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
export interface VirtualTreeItem {
    id: string;
    name: string;
    kind: 'file' | 'folder';
    level: number;
    hasChildren?: boolean;
    children?: VirtualTreeItem[];
    expanded?: boolean;
}

export interface VirtualTreeOptions {
    container: HTMLElement;
    data?: VirtualTreeItem[];
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
