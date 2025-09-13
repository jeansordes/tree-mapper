/**
 * Utility functions for rename business logic
 */

import { App } from 'obsidian';
import { RenameMode, RenameOptions, RenameDialogData } from '../types';
import { parsePath, constructNewPath } from './PathUtils';
import { validateInputs, shouldShowFileExistsWarning } from './ValidationUtils';

export interface RenameLogicParams {
    data: RenameDialogData;
    pathValue: string;
    nameValue: string;
    modeSelection: RenameMode;
    shouldShowModeSelection: () => boolean;
    app: App;
}

/**
 * Check if there are any changes that warrant proceeding with rename
 */
export function shouldProceedWithRename(params: RenameLogicParams): boolean {
    const { data, pathValue, nameValue } = params;

    if (!validateInputs(nameValue)) {
        return false;
    }

    // Parse the original path to get the expected initial values
    const originalParsed = parsePath(data.path, data.extension);

    // Check if the inputs are different from what they should be initially
    const pathChanged = pathValue !== originalParsed.directory;
    const nameChanged = nameValue !== originalParsed.name;

    return pathChanged || nameChanged;
}

/**
 * Handle the rename operation
 */
export async function handleRename(
    params: RenameLogicParams,
    onRename: (options: RenameOptions) => Promise<void>
): Promise<void> {
    const { data, pathValue, nameValue, modeSelection, shouldShowModeSelection } = params;

    if (!validateInputs(nameValue)) {
        return;
    }

    // Check if the target file already exists
    const extension = data.extension || '';
    if (shouldShowFileExistsWarning(pathValue, nameValue, extension, data.path, params.app)) {
        throw new Error('Target file already exists, cannot proceed with rename');
    }

    // Construct new path using the same logic as in constructNewPath
    const newPath = constructNewPath(pathValue, nameValue, extension, data.path);

    // Check if there are any actual changes
    if (newPath === data.path) {
        throw new Error('No changes detected, cancelling rename operation');
    }

    const options: RenameOptions = {
        originalPath: data.path,
        newPath,
        newTitle: nameValue,
        mode: shouldShowModeSelection() ? modeSelection : RenameMode.FILE_ONLY,
        kind: data.kind
    };

    await onRename(options);
}
