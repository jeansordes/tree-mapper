import { App, TFile, TFolder } from "obsidian";
import { RenameOptions, RenameMode, RenameProgress, RenameOperation } from "src/types";
import createDebug from 'debug';

const debug = createDebug('dot-navigator:rename-utils');

export class RenameUtils {
    /**
     * Find all children files for a given path (for virtual nodes)
     */
    public static findChildrenFiles(app: App, parentPath: string): string[] {
        const files = app.vault.getFiles();
        const children: string[] = [];

        // Extract the base name without extension for virtual nodes
        const baseName = parentPath.replace(/\.md$/i, '');

        for (const file of files) {
            const filePath = file.path;
            const fileBaseName = filePath.replace(/\.md$/i, '');

            // Check if this file is a child of the parent (Dendron-style)
            if (fileBaseName !== baseName && fileBaseName.startsWith(baseName + '.')) {
                children.push(filePath);
            }
        }

        return children.sort();
    }

    /**
     * Rename files according to the specified options with progress tracking
     */
    public static async renameWithProgress(
        app: App,
        options: RenameOptions,
        onProgress?: (progress: RenameProgress) => void
    ): Promise<RenameOperation[]> {
        debug('Starting rename operation', options);

        const operations: RenameOperation[] = [];
        const filesToRename: Array<{ from: string; to: string }> = [];

        // Determine which files need to be renamed
        if (options.mode === RenameMode.FILE_ONLY || options.kind === 'folder') {
            // Simple rename - just the target file/folder
            filesToRename.push({
                from: options.originalPath,
                to: options.newPath
            });
        } else {
            // Rename with children
            const children = this.findChildrenFiles(app, options.originalPath);

            // Add the main file if it exists (for virtual nodes, it might not exist)
            const mainFile = app.vault.getAbstractFileByPath(options.originalPath);
            if (mainFile instanceof TFile) {
                filesToRename.push({
                    from: options.originalPath,
                    to: options.newPath
                });
            }

            // Add all children with renamed paths
            const originalBaseName = options.originalPath.replace(/\.md$/i, '');
            const newBaseName = options.newPath.replace(/\.md$/i, '');

            for (const childPath of children) {
                const childBaseName = childPath.replace(/\.md$/i, '');
                const childSuffix = childBaseName.substring(originalBaseName.length);
                const newChildPath = newBaseName + childSuffix + '.md';

                filesToRename.push({
                    from: childPath,
                    to: newChildPath
                });
            }
        }

        const progress: RenameProgress = {
            total: filesToRename.length,
            completed: 0,
            successful: 0,
            failed: 0,
            errors: []
        };

        debug('Files to rename:', filesToRename);

        // Show initial progress
        onProgress?.(progress);

        // Create necessary directories first
        const dirsToCreate = new Set<string>();
        for (const { to } of filesToRename) {
            const dirPath = to.substring(0, to.lastIndexOf('/'));
            if (dirPath && !app.vault.getAbstractFileByPath(dirPath)) {
                dirsToCreate.add(dirPath);
            }
        }

        // Create directories
        for (const dirPath of Array.from(dirsToCreate).sort()) {
            try {
                await app.vault.createFolder(dirPath);
                debug('Created directory:', dirPath);
            } catch (error) {
                debug('Failed to create directory:', dirPath, error);
                // Continue anyway - the rename might still work
            }
        }

        // Perform renames
        for (const { from, to } of filesToRename) {
            const operation: RenameOperation = {
                originalPath: from,
                newPath: to,
                success: false
            };

            try {
                const file = app.vault.getAbstractFileByPath(from);
                if (file instanceof TFile) {
                    await app.fileManager.renameFile(file, to);
                    operation.success = true;
                    progress.successful++;
                    debug('Successfully renamed file:', from, '->', to);
                } else if (file instanceof TFolder) {
                    await app.fileManager.renameFile(file, to);
                    operation.success = true;
                    progress.successful++;
                    debug('Successfully renamed folder:', from, '->', to);
                } else {
                    throw new Error(`File or folder not found: ${from}`);
                }
            } catch (error) {
                operation.success = false;
                operation.error = error instanceof Error ? error.message : String(error);
                progress.failed++;
                progress.errors.push({
                    path: from,
                    error: operation.error
                });
                debug('Failed to rename:', from, error);
            }

            operations.push(operation);
            progress.completed++;

            // Update progress
            onProgress?.(progress);
        }

        debug('Rename operation completed:', progress);
        return operations;
    }

    /**
     * Undo a series of rename operations
     */
    public static async undoRenames(
        app: App,
        operations: RenameOperation[],
        onProgress?: (progress: RenameProgress) => void
    ): Promise<void> {
        debug('Starting undo operation', operations);

        // Only undo successful operations, in reverse order
        const successfulOps = operations.filter(op => op.success).reverse();

        const progress: RenameProgress = {
            total: successfulOps.length,
            completed: 0,
            successful: 0,
            failed: 0,
            errors: []
        };

        onProgress?.(progress);

        for (const operation of successfulOps) {
            try {
                const file = app.vault.getAbstractFileByPath(operation.newPath);
                if (file instanceof TFile) {
                    await app.fileManager.renameFile(file, operation.originalPath);
                    progress.successful++;
                    debug('Successfully undid rename:', operation.newPath, '->', operation.originalPath);
                } else {
                    throw new Error(`File not found: ${operation.newPath}`);
                }
            } catch (error) {
                progress.failed++;
                progress.errors.push({
                    path: operation.newPath,
                    error: error instanceof Error ? error.message : String(error)
                });
                debug('Failed to undo rename:', operation.newPath, error);
            }

            progress.completed++;
            onProgress?.(progress);
        }

        debug('Undo operation completed:', progress);
    }
}
