import { App, TFile, TFolder } from 'obsidian';

// Create helper functions for tests
export function createMockFile(path: string, name?: string, parent: TFolder | null = null): TFile {
    const file = new TFile();
    file.path = path;
    file.name = name || path.split('/').pop() || '';
    file.parent = parent;
    return file;
}

export function createMockFolder(path: string, name?: string, parent: TFolder | null = null): TFolder {
    const folder = new TFolder();
    folder.path = path;
    folder.name = name || path.split('/').pop() || '';
    folder.parent = parent;
    return folder;
}

export function createMockApp(): App {
    return new App();
}

// Add custom matchers if needed
expect.extend({
    // Add custom matchers here if needed in the future
}); 