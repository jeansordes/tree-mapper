import { App, Modal } from 'obsidian';
import { RenameDialogData, RenameMode, RenameOptions } from '../types';
import createDebug from 'debug';
import { parsePath, constructNewPath } from '../utils/PathUtils';
import { validateInputs } from '../utils/ValidationUtils';
import { autoResize } from '../utils/UIUtils';
import { loadDirectories } from '../utils/PathLoadingUtils';
import { shouldProceedWithRename, handleRename } from '../utils/RenameLogicUtils';
import { setupPathAutocomplete, AutocompleteState } from '../utils/AutocompleteUtils';
import { validatePath, hideWarning, validateAndShowWarning } from '../utils/PathValidationUtils';
import {
    createModeSelection,
    createChildrenList,
    createHints,
    shouldShowModeSelection as shouldShowModeSelectionUtil
} from '../utils/RenameDialogUIUtils';
import { updateFileDiff, updateAllFileItems } from '../utils/FileDiffUtils';
import { setupInputNavigation, setupKeyboardNavigation } from '../utils/InputNavigationUtils';

const debug = createDebug('dot-navigator:rename-dialog');

export class RenameDialog extends Modal {
    private data: RenameDialogData;
    private onRename: (options: RenameOptions) => Promise<void>;
    private pathInput: HTMLInputElement;
    private nameInput: HTMLInputElement;
    private extensionEl: HTMLElement;
    private modeSelection: RenameMode = RenameMode.FILE_AND_CHILDREN;
    private modeContainer: HTMLElement;
    private currentSelectedIndex = 0;
    private allDirectories: string[] = [];
    private autocompleteState: AutocompleteState | null = null;

    constructor(
        app: App,
        data: RenameDialogData,
        onRename: (options: RenameOptions) => Promise<void>
    ) {
        super(app);
        this.data = data;
        this.onRename = onRename;
        this.loadDirectories();

        // Remove the close button
        this.titleEl.addClass('is-hidden');
    }

    private loadDirectories(): void {
        this.allDirectories = loadDirectories(this.app);
    }

    onOpen(): void {
        const { contentEl } = this;
        contentEl.empty();
        contentEl.addClass('rename-dialog-content');

        // Parse current path
        const pathParts = parsePath(this.data.path, this.data.extension);

        // Create input container for single line layout
        const inputContainer = contentEl.createEl('div', { cls: 'rename-input-container' });

        // For folders, only show name input; for files, show both path and name
        if (this.data.kind !== 'folder') {
            // Position the path container for autocomplete
            const pathContainer = inputContainer.createEl('div', { cls: 'rename-path-container' });
            this.pathInput = pathContainer.createEl('input', {
                type: 'text',
                cls: 'rename-path-input',
                placeholder: pathParts.directory,
                value: pathParts.directory
            });
            this.pathInput.addEventListener('input', () => {
                validatePath(this.pathInput.value, this.app, contentEl);
                autoResize(this.pathInput);
                validateAndShowWarning(this.pathInput.value.trim(), this.nameInput.value.trim(), this.data.extension || '', this.data.path, this.app, contentEl);
            });
            const getAutocompleteState = setupPathAutocomplete(
                this.pathInput,
                contentEl,
                this.allDirectories,
                {
                    validatePath: () => validatePath(this.pathInput.value, this.app, contentEl),
                    validateAndShowWarning: () => validateAndShowWarning(this.pathInput.value.trim(), this.nameInput.value.trim(), this.data.extension || '', this.data.path, this.app, contentEl),
                    updateAllFileItems: (childrenList) => updateAllFileItems(childrenList, this.data, this.modeSelection, this.pathInput.value.trim(), this.nameInput.value.trim())
                }
            );
            this.autocompleteState = getAutocompleteState();

            // Set up navigation for path input before triggering focus
            setupInputNavigation(this.pathInput, {
                pathInput: this.pathInput,
                nameInput: this.nameInput, // This will be undefined but navigation will handle it
                contentEl,
                data: this.data,
                modeSelection: this.modeSelection,
                autocompleteState: () => this.autocompleteState, // Use getter to always get current state
                setAutocompleteState: (state) => { this.autocompleteState = state; },
                validatePath: () => validatePath(this.pathInput.value, this.app, contentEl),
                validateAndShowWarning: () => validateAndShowWarning(this.pathInput.value.trim(), this.nameInput.value.trim(), this.data.extension || '', this.data.path, this.app, contentEl),
                updateAllFileItems: (childrenList) => updateAllFileItems(childrenList, this.data, this.modeSelection, this.pathInput.value.trim(), this.nameInput.value.trim())
            });

            // Trigger initial suggestions display (shows empty state message)
            setTimeout(() => {
                const event = new Event('focus');
                this.pathInput.dispatchEvent(event);
            }, 50);
        } else {
            // For folders, create a dummy path input that's hidden
            this.pathInput = document.createElement('input');
            this.pathInput.value = pathParts.directory;
            this.pathInput.classList.add('is-hidden');
        }

        // Name input (inline with path for files, standalone for folders)
        this.nameInput = inputContainer.createEl('input', {
            type: 'text',
            cls: 'rename-name-input',
            placeholder: pathParts.name,
            value: pathParts.name
        });
        this.nameInput.addEventListener('input', () => {
            validateInputs(this.nameInput.value.trim());
            autoResize(this.nameInput);
            validateAndShowWarning(this.pathInput.value.trim(), this.nameInput.value.trim(), this.data.extension || '', this.data.path, this.app, contentEl);
        });
        setupInputNavigation(this.nameInput, {
            pathInput: this.pathInput,
            nameInput: this.nameInput,
            contentEl,
            data: this.data,
            modeSelection: this.modeSelection,
            autocompleteState: this.autocompleteState,
            setAutocompleteState: (state) => { this.autocompleteState = state; },
            validatePath: () => validatePath(this.pathInput.value, this.app, contentEl),
            validateAndShowWarning: () => validateAndShowWarning(this.pathInput.value.trim(), this.nameInput.value.trim(), this.data.extension || '', this.data.path, this.app, contentEl),
            updateAllFileItems: (childrenList) => updateAllFileItems(childrenList, this.data, this.modeSelection, this.pathInput.value.trim(), this.nameInput.value.trim())
        });

        // Extension display (inline with name)
        if (this.data.extension) {
            this.extensionEl = inputContainer.createEl('span', {
                text: this.data.extension,
                cls: 'rename-extension-display'
            });
        }

        // Setup keyboard navigation
        setupKeyboardNavigation(this.scope, {
            close: () => this.close(),
            shouldProceedWithRename: () => this.shouldProceedWithRename(),
            handleRename: () => this.handleRename()
        });

        // Set up auto-resize for inputs
        autoResize(this.pathInput);
        autoResize(this.nameInput);

        // Always create the files list (includes main file diff)
        const childrenContainer = createChildrenList(
            contentEl,
            this.data,
            {
                updateFileDiff: (diffContainer, originalPath, isMainFile) => updateFileDiff(diffContainer, originalPath, isMainFile, {
                    data: this.data,
                    modeSelection: this.modeSelection,
                    pathValue: this.pathInput.value.trim(),
                    nameValue: this.nameInput.value.trim()
                }),
                updateAllFileItems: (childrenList) => updateAllFileItems(childrenList, this.data, this.modeSelection, this.pathInput.value.trim(), this.nameInput.value.trim())
            }
        );

        // Update children previews when inputs change
        const childrenList = childrenContainer.querySelector('.rename-children-list') as HTMLElement;
        if (childrenList) {
            this.pathInput.addEventListener('input', () => updateAllFileItems(childrenList, this.data, this.modeSelection, this.pathInput.value.trim(), this.nameInput.value.trim()));
            this.nameInput.addEventListener('input', () => updateAllFileItems(childrenList, this.data, this.modeSelection, this.pathInput.value.trim(), this.nameInput.value.trim()));
        }

        // Mode selection after the files list (only show for files with children)
        if (shouldShowModeSelectionUtil(this.data)) {
            this.modeContainer = createModeSelection(
                contentEl,
                this.modeSelection,
                {
                    onModeChange: (value) => {
                        this.modeSelection = value ? RenameMode.FILE_AND_CHILDREN : RenameMode.FILE_ONLY;
                    },
                    updateAllFileItems: (childrenList) => updateAllFileItems(childrenList, this.data, this.modeSelection, this.pathInput.value.trim(), this.nameInput.value.trim())
                }
            );
        }

        // Hints at the bottom
        createHints(contentEl);

        // Focus the name input after a small delay to ensure everything is set up
        setTimeout(() => {
            this.nameInput.focus();
            // Position cursor at the end of the input instead of selecting all text
            this.nameInput.setSelectionRange(this.nameInput.value.length, this.nameInput.value.length);
            // Trigger initial validation to check if the current path conflicts
            validateAndShowWarning(this.pathInput.value.trim(), this.nameInput.value.trim(), this.data.extension || '', this.data.path, this.app, contentEl);
        }, 0);
    }





    /**
     * Check if there are any changes that warrant proceeding with rename
     */
    private shouldProceedWithRename(): boolean {
        const pathValue = this.pathInput.value.trim();
        const nameValue = this.nameInput.value.trim();

        return shouldProceedWithRename({
            data: this.data,
            pathValue,
            nameValue,
            modeSelection: this.modeSelection,
            shouldShowModeSelection: () => shouldShowModeSelectionUtil(this.data),
            app: this.app
        });
    }

    private async handleRename(): Promise<void> {
        const pathValue = this.pathInput.value.trim();
        const nameValue = this.nameInput.value.trim();

        debug('Rename options:', {
            originalPath: this.data.path,
            newPath: constructNewPath(pathValue, nameValue, this.data.extension || '', this.data.path),
            newTitle: nameValue,
            mode: shouldShowModeSelectionUtil(this.data) ? this.modeSelection : RenameMode.FILE_ONLY,
            kind: this.data.kind
        });

        try {
            await handleRename({
                data: this.data,
                pathValue,
                nameValue,
                modeSelection: this.modeSelection,
                shouldShowModeSelection: () => shouldShowModeSelectionUtil(this.data),
                app: this.app
            }, this.onRename);
            this.close();
        } catch (error) {
            debug('Rename failed:', error);
            // Error handling is done in the onRename callback
        }
    }


    onClose(): void {
        const { contentEl } = this;
        hideWarning(contentEl);
        this.autocompleteState = null;
        contentEl.empty();
    }
}
