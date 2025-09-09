import { TFile, TFolder } from 'obsidian';

// Define the view type for our tree view
export const FILE_TREE_VIEW_TYPE = 'tree-mapper-view';
export const TREE_VIEW_ICON = 'folder-git-2';

export interface PluginSettings {
    mySetting: string;
    expandedNodes?: string[]; // Array of node paths that are expanded
    moreMenuItems?: MoreMenuItem[];
}

export const DEFAULT_SETTINGS: PluginSettings = {
    mySetting: 'default',
    expandedNodes: [],
    moreMenuItems: undefined
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

// More menu customization
export type MenuItemKind = 'file' | 'folder' | 'virtual';

export interface MoreMenuItemBase {
    id: string; // unique id
    label?: string; // display label override (commands must set; builtins can omit)
    icon?: string; // lucide icon name
    section?: 'default' | 'danger';
    showFor?: MenuItemKind[]; // defaults vary by type
}

export interface MoreMenuItemBuiltin extends MoreMenuItemBase {
    type: 'builtin';
    builtin: 'create-child' | 'delete-file';
}

export interface MoreMenuItemCommand extends MoreMenuItemBase {
    type: 'command';
    commandId: string; // e.g. 'rename-wizard:rename-current-file'
    openBeforeExecute?: boolean; // open clicked file before executing
}

export type MoreMenuItem = MoreMenuItemBuiltin | MoreMenuItemCommand;

export const DEFAULT_MORE_MENU: MoreMenuItem[] = [
    {
        id: 'builtin-create-child',
        type: 'builtin',
        builtin: 'create-child',
        icon: 'rotate-cw-square',
        showFor: ['file', 'folder', 'virtual']
    },
    {
        id: 'builtin-delete-file',
        type: 'builtin',
        builtin: 'delete-file',
        icon: 'trash-2',
        section: 'danger',
        showFor: ['file']
    }
];
