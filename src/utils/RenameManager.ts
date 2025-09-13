import { App, Notice } from 'obsidian';
import { RenameUtils } from './RenameUtils';
import { RenameOptions, RenameOperation, RenameProgress, RenameDialogData, MenuItemKind } from '../types';
import { RenameDialog } from '../views/RenameDialog';
import { t } from '../i18n';
import createDebug from 'debug';

const debug = createDebug('dot-navigator:rename-manager');

export class RenameManager {
    private app: App;
    private undoStack: RenameOperation[][] = [];
    private maxUndoStackSize = 10;

    constructor(app: App) {
        this.app = app;
    }

    /**
     * Show rename dialog for a given path
     */
    async showRenameDialog(path: string, kind: MenuItemKind): Promise<void> {
        debug('Showing rename dialog for:', path, kind);

        const dialogData = this.prepareDialogData(path, kind);
        
        const dialog = new RenameDialog(
            this.app,
            dialogData,
            (options) => this.performRename(options)
        );

        dialog.open();
    }

    /**
     * Prepare dialog data for a given path
     */
    private prepareDialogData(path: string, kind: MenuItemKind): RenameDialogData {
        let extension: string | undefined;
        let title: string;
        
        // Parse path components
        const lastSlashIndex = path.lastIndexOf('/');
        const fileName = lastSlashIndex === -1 ? path : path.substring(lastSlashIndex + 1);
        
        if (kind === 'file' || (kind === 'virtual' && fileName.includes('.'))) {
            const lastDotIndex = fileName.lastIndexOf('.');
            if (lastDotIndex > 0) {
                title = fileName.substring(0, lastDotIndex);
                extension = fileName.substring(lastDotIndex);
            } else {
                title = fileName;
            }
        } else {
            title = fileName;
        }

        // Find children for virtual nodes and files
        let children: string[] | undefined;
        if (kind === 'virtual' || kind === 'file') {
            children = RenameUtils.findChildrenFiles(this.app, path);
        }

        return {
            path,
            title,
            extension,
            kind,
            children
        };
    }

    /**
     * Perform the rename operation with progress tracking
     */
    private async performRename(options: RenameOptions): Promise<void> {
        debug('Performing rename:', options);

        let progressNotice: Notice | undefined;
        let currentProgress: RenameProgress | null = null;

        const onProgress = (progress: RenameProgress) => {
            currentProgress = progress;
            const percent = progress.total > 0 ? Math.round((progress.completed / progress.total) * 100) : 0;
            const message = t('renameDialogProgress', {
                completed: String(progress.completed),
                total: String(progress.total),
                percent: String(percent),
                successful: String(progress.successful),
                failed: String(progress.failed)
            });

            if (progressNotice) {
                progressNotice.setMessage(message);
            } else {
                progressNotice = new Notice(message, 0); // 0 = don't auto-hide
            }
        };

        try {
            // Show initial notice
            new Notice(t('noticeRenameStarted'));

            // Perform the rename
            const operations = await RenameUtils.renameWithProgress(
                this.app,
                options,
                onProgress
            );

            // Hide progress notice
            if (progressNotice) {
                progressNotice.hide();
                progressNotice = undefined;
            }

            // Add to undo stack
            this.addToUndoStack(operations);

            // Show completion notice
            const finalProgress = currentProgress!;
            const message = t('noticeRenameCompleted', {
                successful: String(finalProgress.successful),
                failed: String(finalProgress.failed)
            });
            new Notice(message);

            // Show errors if any
            if (finalProgress.errors.length > 0) {
                for (const error of finalProgress.errors.slice(0, 3)) { // Show max 3 errors
                    new Notice(`Failed to rename ${error.path}: ${error.error}`, 5000);
                }
                if (finalProgress.errors.length > 3) {
                    new Notice(`... and ${finalProgress.errors.length - 3} more errors`, 3000);
                }
            }

        } catch (error) {
            // Hide progress notice on error
            if (progressNotice) {
                progressNotice.hide();
            }

            debug('Rename operation failed:', error);
            new Notice(`Rename operation failed: ${error instanceof Error ? error.message : String(error)}`);
            throw error;
        }
    }

    /**
     * Add operations to the undo stack
     */
    private addToUndoStack(operations: RenameOperation[]): void {
        // Only add if there were successful operations
        const successfulOps = operations.filter(op => op.success);
        if (successfulOps.length === 0) return;

        this.undoStack.push(operations);
        
        // Limit stack size
        if (this.undoStack.length > this.maxUndoStackSize) {
            this.undoStack.shift();
        }

        debug('Added to undo stack, stack size:', this.undoStack.length);
    }

    /**
     * Undo the last rename operation
     */
    async undoLastRename(): Promise<void> {
        if (this.undoStack.length === 0) {
            new Notice('No rename operations to undo');
            return;
        }

        const operations = this.undoStack.pop()!;
        debug('Undoing rename operations:', operations);

        let progressNotice: Notice | undefined;

        const onProgress = (progress: RenameProgress) => {
            const percent = progress.total > 0 ? Math.round((progress.completed / progress.total) * 100) : 0;
            const message = `Undoing rename: ${progress.completed}/${progress.total} (${percent}%)`;

            if (progressNotice) {
                progressNotice.setMessage(message);
            } else {
                progressNotice = new Notice(message, 0);
            }
        };

        try {
            await RenameUtils.undoRenames(this.app, operations, onProgress);
            
            if (progressNotice) {
                progressNotice.hide();
            }

            new Notice(t('noticeRenameUndone'));
        } catch (error) {
            if (progressNotice) {
                progressNotice.hide();
            }

            debug('Undo operation failed:', error);
            new Notice(`Undo failed: ${error instanceof Error ? error.message : String(error)}`);
        }
    }

    /**
     * Clear the undo stack
     */
    clearUndoStack(): void {
        this.undoStack = [];
        debug('Undo stack cleared');
    }

    /**
     * Get the number of undoable operations
     */
    getUndoStackSize(): number {
        return this.undoStack.length;
    }
}
