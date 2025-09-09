import { App, TFile, TFolder } from "obsidian";
import { Notice } from "obsidian";
import { t } from "src/i18n";
export class FileUtils {
    public static basename(path: string): string {
        const normalizedPath = path.replace(/\\/g, '/');
        const parts = normalizedPath.split('/');
        return parts[parts.length - 1] || '';
    }
    
    public static getChildPath(path: string, app?: App): string {
        // Normalize path separators and strip trailing slash (except root '/')
        const normalized = path.replace(/\\/g, '/');
        const trimmed = normalized !== '/' ? normalized.replace(/\/+$/g, '') : normalized;
        const basename = this.basename(trimmed);
        const untitledBase = t('untitledPath');

        // Helper to build a candidate under a folder
        const buildInFolder = (folderPath: string, suffix: string) => {
            const prefix = folderPath === '/' || folderPath === '' ? '' : folderPath + '/';
            return `${prefix}${untitledBase}${suffix}.md`;
        };

        // Note: dotted child naming is handled inline where needed

        // Decide whether target is a folder or file/virtual
        let isFolder = false;
        if (app) {
            const af = app.vault.getAbstractFileByPath(trimmed);
            if (af && af instanceof TFolder) isFolder = true;
        }

        // Fallback classification when we can't resolve via vault
        if (!isFolder) {
            if (trimmed === '/' || (!basename.includes('.') && !basename.toLowerCase().endsWith('.md'))) {
                isFolder = true;
            }
        }

        // Compute base (without extension) and target extension for dotted children
        let baseNoExt = trimmed;
        let targetExt = 'md';
        if (!isFolder) {
            const lastDot = basename.lastIndexOf('.');
            const hasDot = lastDot > -1;
            if (app) {
                const af = app.vault.getAbstractFileByPath(trimmed);
                if (af instanceof TFile) {
                    // Real file on disk: preserve its extension (md or others)
                    targetExt = basename.slice(lastDot + 1) || 'md';
                    baseNoExt = trimmed.replace(/\.[^/.]+$/, '');
                } else {
                    // Virtual node or non-existing path: default to md and do not strip
                    targetExt = 'md';
                    baseNoExt = trimmed.replace(/\.[Mm][Dd]$/, '');
                }
            } else if (hasDot) {
                // No app available: best-effort guess using the apparent extension
                targetExt = basename.slice(lastDot + 1) || 'md';
                baseNoExt = trimmed.replace(/\.[^/.]+$/, '');
            } else {
                targetExt = 'md';
            }
        }

        // Generate a unique candidate path
        let index = 0;
        let suffix = '';
        let candidatePath = isFolder
            ? buildInFolder(trimmed, suffix)
            : `${baseNoExt}.${untitledBase}${suffix}.${targetExt}`;

        if (!app) return candidatePath;

        while (app.vault.getAbstractFileByPath(candidatePath)) {
            index++;
            suffix = `.${index}`;
            candidatePath = isFolder
                ? buildInFolder(trimmed, suffix)
                : `${baseNoExt}.${untitledBase}${suffix}.${targetExt}`;
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
            } catch {
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

    /**
     * Best-effort: reveal and select a file in the core File Explorer so native commands act on it.
     */
    public static async selectInFileExplorer(app: App, file: TFile): Promise<boolean> {
        try {
            const leaves = app.workspace.getLeavesOfType('file-explorer');
            if (!leaves || leaves.length === 0) return false;
            const view = leaves[0].view;
            if (!view) return false;
            // Reveal in tree if API available
            // Use safe optional calls across versions
            // @ts-expect-error - historical APIs may be present at runtime
            if (typeof view.revealFile === 'function') await view.revealFile(file);
            // Try various selection APIs used across Obsidian versions
            // @ts-expect-error - historical APIs may be present at runtime
            if (typeof view.setSelection === 'function') view.setSelection([file], true, true);
            // @ts-expect-error - historical APIs may be present at runtime
            else if (typeof view.setSelectedFile === 'function') view.setSelectedFile(file);
            // @ts-expect-error - historical APIs may be present at runtime
            else if (typeof view.selectFile === 'function') view.selectFile(file);
            return true;
        } catch {
            return false;
        }
    }

    /** Execute a File Explorer command after selecting a specific file. */
    public static async executeExplorerCommand(app: App, cmdId: string, file?: TFile): Promise<boolean> {
        if (file) await this.selectInFileExplorer(app, file);
        try {
            // Prefer official API name if available; fallback to ById
            const cmdsUnknown = Reflect.get(app, 'commands');
            if (typeof cmdsUnknown === 'object' && cmdsUnknown !== null && typeof Reflect.get(cmdsUnknown, 'executeCommand') === 'function') {
                const fn = Reflect.get(cmdsUnknown, 'executeCommand');
                const res = await Reflect.apply(fn, cmdsUnknown, [cmdId]);
                return !!res;
            }
            if (typeof cmdsUnknown === 'object' && cmdsUnknown !== null && typeof Reflect.get(cmdsUnknown, 'executeCommandById') === 'function') {
                const fn = Reflect.get(cmdsUnknown, 'executeCommandById');
                return !!Reflect.apply(fn, cmdsUnknown, [cmdId]);
            }
            return false;
        } catch {
            return false;
        }
    }

    /** Execute an app command by id without changing focus/selection (better for editor commands). */
    public static async executeAppCommand(app: App, cmdId: string): Promise<boolean> {
        try {
            const cmdsUnknown = Reflect.get(app, 'commands');
            if (typeof cmdsUnknown === 'object' && cmdsUnknown !== null && typeof Reflect.get(cmdsUnknown, 'executeCommandById') === 'function') {
                const fn = Reflect.get(cmdsUnknown, 'executeCommandById');
                return !!Reflect.apply(fn, cmdsUnknown, [cmdId]);
            }
            if (typeof cmdsUnknown === 'object' && cmdsUnknown !== null && typeof Reflect.get(cmdsUnknown, 'executeCommand') === 'function') {
                const fn = Reflect.get(cmdsUnknown, 'executeCommand');
                const res = await Reflect.apply(fn, cmdsUnknown, [cmdId]);
                return !!res;
            }
            return false;
        } catch {
            return false;
        }
    }

    public static async renameViaExplorer(app: App, file: TFile): Promise<boolean> {
        return this.executeExplorerCommand(app, 'file-explorer:rename-file', file);
    }

    public static async deleteViaExplorer(app: App, file: TFile): Promise<boolean> {
        return this.executeExplorerCommand(app, 'file-explorer:delete-file', file);
    }

    /** Find the closest existing parent note for a given file (Dendron-style). */
    public static findClosestParentNote(app: App, file: TFile): TFile | null {
        const folderPath = file.parent?.path ?? '';
        const base = file.basename; // without extension

        // 1) Dendron-style dotted parents in the same folder: a.b.c -> a.b -> a
        if (base.includes('.')) {
            const parts = base.split('.');
            for (let i = parts.length - 1; i >= 1; i--) {
                const parentBase = parts.slice(0, i).join('.');
                const parentPath = (folderPath && folderPath !== '/')
                    ? `${folderPath}/${parentBase}.md`
                    : `${parentBase}.md`;
                const af = app.vault.getAbstractFileByPath(parentPath);
                if (af instanceof TFile) return af;
            }
        }

        // 2) Folder note fallback: <folder>/<folder>.md
        if (folderPath && folderPath !== '/') {
            const segs = folderPath.split('/');
            const folderName = segs[segs.length - 1] || '';
            if (folderName) {
                const folderNotePath = `${folderPath}/${folderName}.md`;
                const af = app.vault.getAbstractFileByPath(folderNotePath);
                if (af instanceof TFile) return af;
            }
        }

        return null;
    }

    /** Open the closest existing parent note for the currently open file, with user feedback. */
    public static async openClosestParentNote(app: App, file: TFile): Promise<void> {
        const parent = this.findClosestParentNote(app, file);
        if (!parent) {
            new Notice(t('noticeNoParentNote'));
            return;
        }
        await this.openFile(app, parent);
    }
}
