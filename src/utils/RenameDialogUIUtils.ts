/**
 * Utility functions for creating RenameDialog UI components
 */

import { Setting, ToggleComponent } from 'obsidian';
import { RenameMode, RenameDialogData } from '../types';
import { t } from '../i18n';
import { setIcon } from 'obsidian';

export interface ModeSelectionCallbacks {
    onModeChange: (value: boolean) => void;
    updateAllFileItems: (childrenList: HTMLElement) => void;
}

export interface FileItemCallbacks {
    updateFileDiff: (diffContainer: HTMLElement, originalPath: string, isMainFile: boolean) => void;
}

/**
 * Create the mode selection UI component
 */
export function createModeSelection(
    container: HTMLElement,
    modeSelection: RenameMode,
    callbacks: ModeSelectionCallbacks
): HTMLElement {
    const modeContainer = container.createEl('div', { cls: 'rename-mode-container' });

    let toggleComponent: ToggleComponent;

    // Use Obsidian's Setting and ToggleComponent
    new Setting(modeContainer)
        .setName(t('renameDialogModeFileAndChildren', { count: '' })) // Remove count since it's shown in list header
        .setDesc(t('renameDialogModeFileOnlyHint'))
        .addToggle((toggle: ToggleComponent) => {
            toggleComponent = toggle;
            toggle
                .setValue(modeSelection === RenameMode.FILE_AND_CHILDREN)
                .onChange((value: boolean) => {
                    callbacks.onModeChange(value);
                    // Update all file diffs when mode changes
                    const childrenList = container.querySelector('.rename-children-list');
                    if (childrenList instanceof HTMLElement) {
                        callbacks.updateAllFileItems(childrenList);
                    }
                });
        });

    // Make the entire container clickable
    modeContainer.addEventListener('click', (e) => {
        // Don't trigger if clicking directly on the toggle
        if (e.target instanceof HTMLElement && !e.target.closest('.checkbox-container')) {
            toggleComponent.setValue(!toggleComponent.getValue());
            callbacks.onModeChange(toggleComponent.getValue());
        }
    });

    return modeContainer;
}

/**
 * Create the children list UI component
 */
export function createChildrenList(
    container: HTMLElement,
    data: RenameDialogData,
    callbacks: FileItemCallbacks & { updateAllFileItems: (childrenList: HTMLElement) => void }
): HTMLElement {
    const totalFiles = 1 + (data.children?.length || 0); // Main file + children

    const childrenContainer = container.createEl('div', { cls: 'rename-children-container' });

    // For folders, skip the header completely
    if (data.kind !== 'folder') {
        // Header with icon
        const header = childrenContainer.createEl('div', {
            cls: 'rename-children-header'
        });

        // Create icon container and text
        const iconContainer = header.createEl('span', { cls: 'rename-children-icon' });
        setIcon(iconContainer, 'file-edit');

        header.createEl('span', {
            text: t('renameDialogChildrenPreview', { count: String(totalFiles) })
        });
    }

    // Children list with scrollable content
    const childrenList = childrenContainer.createEl('div', { cls: 'rename-children-list' });

    // Add main file first (but not for folders where we don't want the main file styling)
    createFileItem(childrenList, data.path, data.kind !== 'folder', callbacks);

    // Add children if they exist
    if (data.children && data.children.length > 0) {
        data.children.forEach(childPath => {
            createFileItem(childrenList, childPath, false, callbacks);
        });
    }

    return childrenContainer;
}

/**
 * Create a file item in the children list
 */
export function createFileItem(
    container: HTMLElement,
    filePath: string,
    isMainFile: boolean,
    callbacks: FileItemCallbacks
): void {
    const fileItem = container.createEl('div', { cls: 'rename-child-item' });
    if (isMainFile) {
        fileItem.addClass('rename-main-file');
    }

    // Create inline diff for the file
    const diffContainer = fileItem.createEl('div', { cls: 'rename-file-diff' });
    callbacks.updateFileDiff(diffContainer, filePath, isMainFile);
}

/**
 * Create the hints UI component
 */
export function createHints(container: HTMLElement): HTMLElement {
    const hintsContainer = container.createEl('div', { cls: 'prompt-instructions' });

    const hints = [
        { key: '↑↓', action: t('renameDialogHintNavigate') },
        { key: '↵', action: t('renameDialogHintUse') },
        { key: 'esc', action: t('renameDialogHintClose') }
    ];

    hints.forEach((hint) => {
        const instruction = hintsContainer.createEl('div', { cls: 'prompt-instruction' });
        instruction.createEl('span', {
            text: hint.key,
            cls: 'prompt-instruction-command'
        });
        instruction.createEl('span', {
            text: hint.action,
            cls: 'prompt-instruction-text'
        });
    });

    return hintsContainer;
}

/**
 * Check if mode selection should be shown
 */
export function shouldShowModeSelection(data: RenameDialogData): boolean {
    return data.kind !== 'folder' &&
        Boolean(data.children) &&
        data.children!.length > 0;
}
