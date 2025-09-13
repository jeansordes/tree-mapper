/**
 * Utility functions for input validation and file existence checking
 */

import { App } from 'obsidian';
import { constructNewPath } from './PathUtils';

/**
 * Validate input fields
 */
export function validateInputs(nameValue: string): boolean {
    return nameValue.length > 0;
}

/**
 * Check if a file exists at the given path
 */
export function checkFileExists(
    pathValue: string,
    nameValue: string,
    extension: string,
    originalPath: string,
    app: App
): boolean {
    if (!nameValue) return false;

    // Construct the new path to check
    const newPath = constructNewPath(pathValue, nameValue, extension, originalPath);

    // Don't warn if it's the same as the current path (no actual change)
    if (newPath === originalPath) return false;

    // Check if file exists at the new path
    return app.vault.getAbstractFileByPath(newPath) !== null;
}

/**
 * Validate inputs and determine if warning should be shown
 */
export function shouldShowFileExistsWarning(
    pathValue: string,
    nameValue: string,
    extension: string,
    originalPath: string,
    app: App
): boolean {
    return checkFileExists(pathValue, nameValue, extension, originalPath, app);
}
