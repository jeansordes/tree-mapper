// Mock Obsidian's API for testing

export class TFile {
    path: string = '';
    name: string = '';
    parent: TFolder | null = null;
    basename: string = '';
    extension: string = '';

    constructor(path: string = '', name: string = '', parent: TFolder | null = null) {
        this.path = path;
        this.name = name || path.split('/').pop() || '';
        this.parent = parent;
        
        // Set basename and extension
        const nameParts = this.name.split('.');
        this.extension = nameParts.pop() || '';
        this.basename = nameParts.join('.');
        
        // If no basename was set (i.e., file had no extension), use the whole name
        if (!this.basename) {
            this.basename = this.name;
        }
    }
}

export class TFolder {
    path: string = '';
    name: string = '';
    parent: TFolder | null = null;

    constructor(path: string = '', name: string = '', parent: TFolder | null = null) {
        this.path = path;
        this.name = name;
        this.parent = parent;
    }
}

export class Notice {
    constructor(/* message: string */) {
        // Mock implementation
    }
}

export class App {
    vault: Vault;
    workspace: Workspace;

    constructor() {
        this.vault = new Vault();
        this.workspace = new Workspace();
    }
}

export class Vault {
    private files: TFile[] = [];
    private folders: TFolder[] = [];

    getFiles(): TFile[] {
        return this.files;
    }

    getAllFolders(): TFolder[] {
        return this.folders;
    }

    getAbstractFileByPath(path: string): TFile | TFolder | null {
        return this.files.find(f => f.path === path) || this.folders.find(f => f.path === path) || null;
    }

    async create(path: string, __data: string): Promise<TFile> {
        const file = new TFile(path, path.split('/').pop() || '');
        this.files.push(file);
        return file;
    }

    // Add methods to help with testing
    _addFile(file: TFile) {
        this.files.push(file);
    }

    _addFolder(folder: TFolder) {
        this.folders.push(folder);
    }
}

export class Workspace {
    private leaves: WorkspaceLeaf[] = [];
    private activeLeaf: WorkspaceLeaf | null = null;

    getLeaf(__active: boolean): WorkspaceLeaf | null {
        return this.activeLeaf;
    }

    getActiveFile(): TFile | null {
        return this.activeLeaf?.view?.file || null;
    }

    // Event handlers
    on(/* event: string, callback: (file: TFile) => void */): void { /* no-op */ }
    off(/* event: string, callback: (file: TFile) => void */): void { /* no-op */ }
}

export class WorkspaceLeaf {
    view: ItemView | null = null;

    async openFile(__file: TFile): Promise<void> {
        // Mock implementation
    }
}

export class ItemView {
    leaf: WorkspaceLeaf;
    file: TFile | null = null;

    constructor(leaf: WorkspaceLeaf) {
        this.leaf = leaf;
    }
}

export class Platform {
    static isMobile: boolean = false;
}

export function setIcon(__element: HTMLElement, __icon: string): void {
    // Mock implementation
}

export const moment = {
    locale: () => 'en'
}; 