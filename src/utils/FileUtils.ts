import { TFile } from "obsidian";

import { App, Notice } from "obsidian";
import { t } from "src/i18n";
export class FileUtils {
    public static basename(path: string): string {
        const normalizedPath = path.replace(/\\/g, '/');
        const parts = normalizedPath.split('/');
        return parts[parts.length - 1] || '';
    }
    
    public static getChildPath(path: string, app?: App): string {
        const extension = path.split('.').pop() || 'md';
        const basePath = path.replace(/\.[^.]+$/, '');
        const untitledBase = t('untitledPath');
        
        if (!app) {
            return `${basePath}.${untitledBase}.${extension}`;
        }
        
        // Check if untitled file already exists and increment number
        let suffix = '';
        let index = 0;
        let candidatePath = `${basePath}.${untitledBase}${suffix}.${extension}`;
        
        while (app.vault.getAbstractFileByPath(candidatePath)) {
            index++;
            suffix = `.${index}`;
            candidatePath = `${basePath}.${untitledBase}${suffix}.${extension}`;
        }
        
        return candidatePath;
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
        await this.createAndOpenNote(app, this.getChildPath(path, app));
    }
    
    public static async openFile(app: App, file: TFile): Promise<void> {
        const leaf = app.workspace.getLeaf(false);
        if (leaf) {
            await leaf.openFile(file);
        }
    }
}