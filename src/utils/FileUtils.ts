import { TFile } from "obsidian";

import { App, Notice } from "obsidian";
import { t } from "src/i18n";
export class FileUtils {
    public static basename(path: string): string {
        const normalizedPath = path.replace(/\\/g, '/');
        const parts = normalizedPath.split('/');
        return parts[parts.length - 1] || '';
    }
    
    public static getChildPath(path: string): string {
        const extension = path.split('.').pop() || 'md';
        return path.replace(/\.[^\.]+$/, '.' + t('untitledPath') + '.' + extension);
    }
    
    /**
     * Create and open a note at the specified path
     */
    public static async createAndOpenNote(app: App, path: string): Promise<void> {
        let note = app.vault.getAbstractFileByPath(path);
    
        if (!note) {
            try {
                note = await app.vault.create(path, '');
                new Notice(t('noticeCreatedNote', { path }));
            } catch (error) {
                new Notice(t('noticeFailedCreateNote', { path }));
                return;
            }
        }
    
        if (note instanceof TFile) {
            await this.openFile(app, note);
        }
    }

    public static async createChildNote(app: App, path: string): Promise<void> {
        await this.createAndOpenNote(app, this.getChildPath(path));
    }
    
    public static async openFile(app: App, file: TFile): Promise<void> {
        const leaf = app.workspace.getLeaf(false);
        if (leaf) {
            await leaf.openFile(file);
        }
    }

    public static getPathDepth(path: string): number {
        const parts = path.split('/');
        const filename = parts.pop() || '';
        return (parts.length) + Math.max(0, filename.split('.').length - 2);
    }

    /**
     * Get all ancestor paths for a given path
     * Handles both folder-style paths (with /) and Dendron-style paths (with .)
     */
    public static getAncestorPaths(path: string): string[] {
        const ancestors: string[] = [];
        const parts = path.split(/[/.]/);
        let currentPath = '';

        // Skip the first part if it's empty (leading slash)
        for (let i = 0; i < parts.length; i++) {
            const part = parts[i];
            if (!part) continue;

            currentPath = currentPath ? `${currentPath}${path.includes('/') ? '/' : '.'}${part}` : part;
            if (i < parts.length - 1) { // Don't add the current item itself
                ancestors.push(currentPath);
            }
        }

        return ancestors;
    }

    public static isFolder(app: App, path: string): boolean {
        const allFolders = app.vault.getAllFolders();
        return allFolders.some(folder => folder.path === path);
    }
}