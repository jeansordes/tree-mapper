/**
 * Utility functions for autocomplete functionality
 */

import { performFuzzySearch, createHighlightedText } from './FuzzySearchUtils';
import { autoResize, updateSuggestionSelection } from './UIUtils';
import { t } from '../i18n';
import { setIcon } from 'obsidian';

export interface AutocompleteCallbacks {
    validatePath: () => void;
    validateAndShowWarning: () => void;
    updateAllFileItems: (childrenList: HTMLElement) => void;
}

export interface AutocompleteState {
    suggestionsContainer: HTMLElement | null;
    suggestionElements: HTMLElement[];
    currentSuggestionIndex: number;
    originalTypedValue: string;
    allDirectories: string[];
}

/**
 * Set up path autocomplete functionality for an input element
 */
export function setupPathAutocomplete(
    input: HTMLInputElement,
    container: HTMLElement,
    allDirectories: string[],
    callbacks: AutocompleteCallbacks
): () => AutocompleteState {
    let suggestionsContainer: HTMLElement | null = null;
    let suggestionElements: HTMLElement[] = [];
    let currentSuggestionIndex = -1;
    let originalTypedValue = '';

    // Create suggestions container
    const createSuggestionsContainer = (): HTMLElement => {
        const suggestions = container.createEl('div', { cls: 'rename-path-suggestions' });

        // Position after the input container
        const inputContainer = container.querySelector('.rename-input-container');
        if (inputContainer) {
            inputContainer.insertAdjacentElement('afterend', suggestions);
        }

        return suggestions;
    };

    const showSuggestions = (query: string) => {
        if (!suggestionsContainer) return;

        // Clear existing content
        suggestionsContainer.empty();

        // Handle empty input
        if (!query.trim()) {
            const _emptyMsg = suggestionsContainer.createEl('div', {
                cls: 'rename-path-suggestions-no-results',
                text: 'Type to search for paths...'
            });
            return;
        }

        const matches = performFuzzySearch(query.trim(), allDirectories);

        if (matches.length === 0) {
            // Show "no results" message
            const _noResultsMsg = suggestionsContainer.createEl('div', {
                cls: 'rename-path-suggestions-no-results',
                text: 'No matching paths found'
            });
            return;
        }

        // Add a header to clarify what the suggestions are for, show result count
        const header = suggestionsContainer.createEl('div', {
            cls: 'rename-path-suggestions-header'
        });

        // Create icon container and text
        const iconContainer = header.createEl('span', { cls: 'rename-suggestions-icon' });
        setIcon(iconContainer, 'folder');

        const resultCount = matches.length === 100 ? '100+' : matches.length.toString();
        const _textSpan = header.createEl('span', {
            text: `${t('renameDialogPathSuggestions')} (${resultCount})`
        });

        // Reset suggestion tracking
        suggestionElements = [];
        currentSuggestionIndex = -1;

        // Show all matches, but limit visible items to 10 with scrolling
        matches.forEach((matchResult, index) => {
            const suggestion = suggestionsContainer!.createEl('div', {
                cls: 'rename-path-suggestion'
            });

            // Store the actual value in a data attribute for easy retrieval
            suggestion.setAttribute('data-value', matchResult.item);

            // Create highlighted version of the match
            suggestion.appendChild(createHighlightedText(matchResult.item, matchResult.matches));

            suggestionElements.push(suggestion);

            suggestion.addEventListener('click', () => {
                input.value = matchResult.item;
                callbacks.validatePath();
                autoResize(input);
                callbacks.validateAndShowWarning();
                currentSuggestionIndex = index;
                updateSuggestionSelection(suggestionElements, index);

                // Update the diff sections when suggestion is selected
                const childrenList = container.querySelector('.rename-children-list');
                if (childrenList instanceof HTMLElement) {
                    callbacks.updateAllFileItems(childrenList);
                }
            });
        });
    };

    // Create the suggestions container
    suggestionsContainer = createSuggestionsContainer();

    // Set up event listeners
    input.addEventListener('input', () => {
        // Reset suggestion navigation when user types
        currentSuggestionIndex = -1;
        originalTypedValue = '';
        showSuggestions(input.value);
    });

    input.addEventListener('focus', () => {
        // Always show suggestions on focus, even if input is empty
        showSuggestions(input.value);
    });

    // Return a function to get the current state
    return () => ({
        suggestionsContainer,
        suggestionElements,
        currentSuggestionIndex,
        originalTypedValue,
        allDirectories
    });
}

/**
 * Navigate through autocomplete suggestions
 */
export function navigateSuggestions(
    direction: 'up' | 'down',
    state: AutocompleteState,
    input: HTMLInputElement,
    callbacks: AutocompleteCallbacks,
    container: HTMLElement
): AutocompleteState {
    const { suggestionsContainer, suggestionElements, currentSuggestionIndex, originalTypedValue } = state;

    if (suggestionElements.length === 0) return state;

    // Store the original typed value if we haven't started navigation yet
    let newOriginalTypedValue = originalTypedValue;
    if (currentSuggestionIndex === -1) {
        newOriginalTypedValue = input.value;
    }

    // Remove current selection
    if (currentSuggestionIndex >= 0) {
        suggestionElements[currentSuggestionIndex]?.removeClass('selected');
    }

    // Update index (allow going back to original typed value with -1)
    let newCurrentSuggestionIndex: number;
    if (direction === 'down') {
        newCurrentSuggestionIndex = Math.min(suggestionElements.length - 1, currentSuggestionIndex + 1);
    } else {
        newCurrentSuggestionIndex = Math.max(-1, currentSuggestionIndex - 1);
    }

    // Apply new selection
    updateSuggestionSelection(suggestionElements, newCurrentSuggestionIndex);

    // Apply the selected value to the input
    let valueToApply: string;
    if (newCurrentSuggestionIndex === -1) {
        // Back to original typed value
        valueToApply = newOriginalTypedValue || '';
    } else {
        // Use selected suggestion - get the data-value attribute or text content
        const selectedElement = suggestionElements[newCurrentSuggestionIndex];
        valueToApply = selectedElement.getAttribute('data-value') || selectedElement.textContent || '';
    }

    input.value = valueToApply;
    callbacks.validatePath();
    autoResize(input);
    callbacks.validateAndShowWarning();

    // Update the diff sections when suggestion is applied via navigation
    const childrenList = container.querySelector('.rename-children-list');
    if (childrenList instanceof HTMLElement) {
        callbacks.updateAllFileItems(childrenList);
    }

    // Scroll into view if needed (only for actual suggestions, not original value)
    if (newCurrentSuggestionIndex >= 0) {
        const selectedElement = suggestionElements[newCurrentSuggestionIndex];
        if (selectedElement) {
            selectedElement.scrollIntoView({ block: 'nearest' });
        }
    }

    return {
        suggestionsContainer,
        suggestionElements,
        currentSuggestionIndex: newCurrentSuggestionIndex,
        originalTypedValue: newOriginalTypedValue,
        allDirectories: state.allDirectories
    };
}
