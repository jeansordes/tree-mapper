/**
 * Utility functions for path validation and warning display
 */

import { App } from 'obsidian';
import { getFoldersToCreate } from './PathUtils';
import { t } from '../i18n';
import { setIcon } from 'obsidian';
import { shouldShowFileExistsWarning } from './ValidationUtils';

export interface PathValidationCallbacks {
    validateAndShowWarning: () => void;
}

/**
 * Validate path and show folder creation hints
 */
export function validatePath(
    pathValue: string,
    app: App,
    contentEl: HTMLElement
): void {
    // Get folders that will be created
    const foldersToCreate = getFoldersToCreate(pathValue, app);

    // Show hint only if we're creating folders
    const inputContainer = contentEl.querySelector('.rename-input-container');
    let hintEl = contentEl.querySelector('.rename-path-hint');
    if (!(hintEl instanceof HTMLElement)) {
        hintEl = null;
    }

    if (foldersToCreate.length > 0) {
        if (!hintEl) {
            hintEl = contentEl.createEl('div', { cls: 'rename-path-hint' });
            // Insert after the input container
            if (inputContainer) {
                inputContainer.insertAdjacentElement('afterend', hintEl);
            }
        }

        // Clear previous content and create folder labels
        hintEl.empty();

        // Add intro text
        const _introText = hintEl.createEl('span', {
            text: 'The following folders will be created: ',
            cls: 'rename-path-hint-text'
        });

        // Add folder labels
        const labelsContainer = hintEl.createEl('div', { cls: 'rename-folder-labels' });
        foldersToCreate.forEach(folder => {
            labelsContainer.createEl('span', {
                text: folder,
                cls: 'rename-folder-label'
            });
        });
    } else if (hintEl) {
        hintEl.remove();
    }
}

/**
 * Show warning message for file conflicts
 */
export function showWarning(contentEl: HTMLElement): HTMLElement {
    // Remove existing warning if any
    hideWarning(contentEl);

    // Create warning element
    const warningElement = contentEl.createEl('div', { cls: 'rename-warning-message' });

    // Add warning icon
    const iconContainer = warningElement.createEl('div', { cls: 'rename-warning-icon' });
    setIcon(iconContainer, 'alert-triangle');

    // Add warning content
    const contentDiv = warningElement.createEl('div', { cls: 'rename-warning-content' });
    contentDiv.createEl('div', {
        text: t('renameDialogFileExists'),
        cls: 'rename-warning-title'
    });
    contentDiv.createEl('div', {
        text: t('renameDialogFileExistsDesc'),
        cls: 'rename-warning-description'
    });

    // Position after the input container
    const inputContainer = contentEl.querySelector('.rename-input-container');
    if (inputContainer) {
        inputContainer.insertAdjacentElement('afterend', warningElement);
    }

    return warningElement;
}

/**
 * Hide warning message
 */
export function hideWarning(contentEl: HTMLElement): void {
    const warningElement = contentEl.querySelector('.rename-warning-message');
    if (warningElement instanceof HTMLElement) {
        warningElement.remove();
    }
}

/**
 * Validate inputs and show/hide warning as needed
 */
export function validateAndShowWarning(
    pathValue: string,
    nameValue: string,
    extension: string,
    originalPath: string,
    app: App,
    contentEl: HTMLElement
): void {
    if (shouldShowFileExistsWarning(pathValue, nameValue, extension, originalPath, app)) {
        showWarning(contentEl);
    } else {
        hideWarning(contentEl);
    }
}
