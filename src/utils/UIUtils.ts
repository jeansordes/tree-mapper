/**
 * Utility functions for UI manipulation
 */

/**
 * Auto-resize an input element based on its content
 */
export function autoResize(input: HTMLInputElement): void {
    // Create a temporary span to measure text width
    const tempSpan = document.createElement('span');
    tempSpan.className = 'dotn-measure-span';
    tempSpan.style.setProperty('--dotn-measure-font', getComputedStyle(input).font);
    tempSpan.textContent = input.value || input.placeholder;

    document.body.appendChild(tempSpan);
    const textWidth = tempSpan.offsetWidth;
    document.body.removeChild(tempSpan);

    // Add some padding and set minimum width
    const minWidth = input.placeholder.length * 8; // Rough estimate
    const newWidth = Math.max(minWidth, textWidth + 36); // Add padding (20px + 1rem = 16px)
    input.style.width = `${newWidth}px`;
}

/**
 * Update the visual selection state of suggestion elements
 */
export function updateSuggestionSelection(
    suggestionElements: HTMLElement[],
    currentSuggestionIndex: number
): void {
    // Remove all selections
    suggestionElements.forEach(el => el.removeClass('selected'));

    // Add selection to current item
    if (currentSuggestionIndex >= 0 && currentSuggestionIndex < suggestionElements.length) {
        suggestionElements[currentSuggestionIndex].addClass('selected');
    }
}
