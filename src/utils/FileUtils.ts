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
}