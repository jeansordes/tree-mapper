/**
 * Utility functions for path parsing and manipulation
 */

import { App } from 'obsidian';

export interface ParsedPath {
    directory: string;
    name: string;
}

/**
 * Parse a full path into directory and name components
 */
export function parsePath(fullPath: string, extension?: string): ParsedPath {
    // Remove extension first to get the base path
    let pathWithoutExt = fullPath;
    if (extension) {
        pathWithoutExt = fullPath.replace(new RegExp(extension.replace('.', '\\.') + '$'), '');
    }

    // Check for directory separator first (directory-based paths take precedence)
    const lastSlashIndex = pathWithoutExt.lastIndexOf('/');
    if (lastSlashIndex !== -1) {
        // This is a directory-based path like "Assets/image"
        return {
            directory: pathWithoutExt.substring(0, lastSlashIndex),
            name: pathWithoutExt.substring(lastSlashIndex + 1)
        };
    }

    // No directory separator, check for hierarchical dot notation
    const lastDotIndex = pathWithoutExt.lastIndexOf('.');
    if (lastDotIndex !== -1) {
        // Split at the last dot for hierarchical names like "journal.2025.weeks.37"
        return {
            directory: pathWithoutExt.substring(0, lastDotIndex),
            name: pathWithoutExt.substring(lastDotIndex + 1)
        };
    }

    // No separators at all, just a plain name
    return { directory: '', name: pathWithoutExt };
}

/**
 * Construct a new path from path, name, and extension components
 */
export function constructNewPath(pathValue: string, nameValue: string, extension: string, originalPath: string): string {
    let newPath: string;

    if (pathValue) {
        // Check if the original path was directory-based (contains /)
        // by looking at the original path structure
        const originalPathWithoutExt = originalPath.replace(extension || '', '');
        const isDirectoryBased = originalPathWithoutExt.includes('/');

        if (isDirectoryBased) {
            // Directory-based path: use slash separator
            newPath = `${pathValue}/${nameValue}`;
        } else {
            // Hierarchical path: use dot separator
            newPath = `${pathValue}.${nameValue}`;
        }
    } else {
        newPath = nameValue;
    }

    if (extension) {
        newPath += extension;
    }

    return newPath;
}

/**
 * Get the list of folders that need to be created for a given path
 */
export function getFoldersToCreate(pathValue: string, app: App): string[] {
    if (!pathValue) return [];

    // Split the path to check for actual directory creation
    const pathParts = pathValue.split('/');

    // If there's only one part (no slashes), it's a hierarchical path - no folders created
    if (pathParts.length === 1) {
        return [];
    }

    const foldersToCreate: string[] = [];

    // If there are multiple parts, check if any directory part needs to be created
    // We check all parts except the last one (which could be a hierarchical file name)
    for (let i = 1; i < pathParts.length; i++) {
        const partialPath = pathParts.slice(0, i).join('/');
        const isExistingFolder = app.vault.getAbstractFileByPath(partialPath);

        // If this directory part doesn't exist, we'll need to create it
        if (!isExistingFolder) {
            foldersToCreate.push(partialPath);
        }
    }

    return foldersToCreate;
}
