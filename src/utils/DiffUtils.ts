/**
 * Utility functions for computing and displaying text diffs
 */

export interface DiffChange {
    text: string;
    type: 'unchanged' | 'removed' | 'added';
}

/**
 * Compute inline diff between old and new text
 */
export function computeInlineDiff(oldText: string, newText: string): DiffChange[] {
    // Simple character-by-character diff algorithm
    const changes: DiffChange[] = [];

    // Find common prefix
    let prefixEnd = 0;
    while (prefixEnd < oldText.length && prefixEnd < newText.length &&
        oldText[prefixEnd] === newText[prefixEnd]) {
        prefixEnd++;
    }

    // Find common suffix
    let suffixStart = Math.max(prefixEnd, oldText.length);
    let newSuffixStart = Math.max(prefixEnd, newText.length);

    while (suffixStart > prefixEnd && newSuffixStart > prefixEnd &&
        oldText[suffixStart - 1] === newText[newSuffixStart - 1]) {
        suffixStart--;
        newSuffixStart--;
    }

    // Add common prefix
    if (prefixEnd > 0) {
        changes.push({ text: oldText.substring(0, prefixEnd), type: 'unchanged' });
    }

    // Add removed text
    if (suffixStart > prefixEnd) {
        changes.push({ text: oldText.substring(prefixEnd, suffixStart), type: 'removed' });
    }

    // Add added text
    if (newSuffixStart > prefixEnd) {
        changes.push({ text: newText.substring(prefixEnd, newSuffixStart), type: 'added' });
    }

    // Add common suffix
    if (suffixStart < oldText.length) {
        changes.push({ text: oldText.substring(suffixStart), type: 'unchanged' });
    }

    return changes;
}

/**
 * Create an inline diff element for display
 */
export function createInlineDiff(oldText: string, newText: string): HTMLElement {
    const container = document.createElement('div');
    container.className = 'rename-inline-diff';

    const changes = computeInlineDiff(oldText, newText);

    changes.forEach(change => {
        const span = document.createElement('span');
        span.textContent = change.text;

        if (change.type === 'removed') {
            span.className = 'diff-removed';
        } else if (change.type === 'added') {
            span.className = 'diff-added';
        } else {
            span.className = 'diff-unchanged';
        }

        container.appendChild(span);
    });

    return container;
}
