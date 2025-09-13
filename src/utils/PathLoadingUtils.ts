/**
 * Utility functions for loading path data from the vault
 */

import { App, TFile, TFolder } from 'obsidian';

/**
 * Load all directories from the vault for autocomplete suggestions
 */
export function loadDirectories(app: App): string[] {
    // Get all directories in the vault for autocomplete
    const folders = app.vault.getAllFolders();
    const folderPaths = folders.map((folder: TFolder) => folder.path);

    // Also collect hierarchical prefixes from existing files
    const files = app.vault.getFiles();
    const hierarchicalPaths = new Set<string>();

    files.forEach((file: TFile) => {
        const pathWithoutExt = file.path.replace(/\.[^/.]+$/, '');
        const parts = pathWithoutExt.split('.');

        // Generate all prefixes for hierarchical paths
        for (let i = 1; i < parts.length; i++) {
            const prefix = parts.slice(0, i).join('.');
            if (prefix.length > 0) {
                hierarchicalPaths.add(prefix);
            }
        }
    });

    return [...folderPaths, ...Array.from(hierarchicalPaths)].sort();
}
