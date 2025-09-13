/**
 * Utility functions for fuzzy search and text highlighting
 */

export interface FuzzySearchResult {
    item: string;
    score: number;
    matches: Array<{ start: number, end: number }>;
}

export interface FuzzyMatchResult {
    score: number;
    matches: Array<{ start: number, end: number }>;
}

/**
 * Perform fuzzy search on a list of items
 */
export function performFuzzySearch(query: string, items: string[]): FuzzySearchResult[] {
    const queryWords = query.toLowerCase().split(/\s+/).filter(word => word.length > 0);
    const results: FuzzySearchResult[] = [];

    for (const item of items) {
        const matchResult = fuzzyMatch(item, queryWords);
        if (matchResult.score > 0) {
            results.push({
                item,
                score: matchResult.score,
                matches: matchResult.matches
            });
        }
    }

    // Sort by score (descending) and then alphabetically
    results.sort((a, b) => {
        if (a.score !== b.score) {
            return b.score - a.score;
        }
        return a.item.localeCompare(b.item);
    });

    // Limit to 100 results
    return results.slice(0, 100);
}

/**
 * Match query words against an item using fuzzy matching
 */
export function fuzzyMatch(item: string, queryWords: string[]): FuzzyMatchResult {
    const itemLower = item.toLowerCase();
    let totalScore = 0;
    const allMatches: Array<{ start: number, end: number }> = [];

    for (const word of queryWords) {
        const wordMatch = findBestWordMatch(itemLower, word);
        if (wordMatch.score === 0) {
            // If any word doesn't match, return no match
            return { score: 0, matches: [] };
        }
        totalScore += wordMatch.score;
        allMatches.push(...wordMatch.matches);
    }

    // Bonus for matching all words
    const allWordsBonus = queryWords.length > 1 ? 50 : 0;

    // Bonus for exact matches or prefix matches
    const exactBonus = itemLower === queryWords.join(' ') ? 100 : 0;
    const prefixBonus = itemLower.startsWith(queryWords[0]) ? 30 : 0;

    return {
        score: totalScore + allWordsBonus + exactBonus + prefixBonus,
        matches: allMatches
    };
}

/**
 * Find the best match for a word in an item
 */
export function findBestWordMatch(item: string, word: string): FuzzyMatchResult {
    const matches: Array<{ start: number, end: number }> = [];
    let bestScore = 0;

    // Exact word match (highest score)
    const exactIndex = item.indexOf(word);
    if (exactIndex !== -1) {
        matches.push({ start: exactIndex, end: exactIndex + word.length });
        bestScore = 100;
    }
    // Prefix match
    else if (item.startsWith(word)) {
        matches.push({ start: 0, end: word.length });
        bestScore = 80;
    }
    // Substring match
    else if (item.includes(word)) {
        const index = item.indexOf(word);
        matches.push({ start: index, end: index + word.length });
        bestScore = 60;
    }
    // Fuzzy character match (letters in order but not consecutive)
    else {
        const fuzzyMatch = fuzzyCharMatch(item, word);
        if (fuzzyMatch.matches.length > 0) {
            matches.push(...fuzzyMatch.matches);
            bestScore = fuzzyMatch.score;
        }
    }

    return { score: bestScore, matches };
}

/**
 * Perform fuzzy character matching (letters in order but not necessarily consecutive)
 */
export function fuzzyCharMatch(item: string, word: string): FuzzyMatchResult {
    const matches: Array<{ start: number, end: number }> = [];
    let itemIndex = 0;
    let wordIndex = 0;
    let consecutiveMatches = 0;
    let totalMatches = 0;

    while (itemIndex < item.length && wordIndex < word.length) {
        if (item[itemIndex] === word[wordIndex]) {
            matches.push({ start: itemIndex, end: itemIndex + 1 });
            wordIndex++;
            totalMatches++;
            consecutiveMatches++;
        } else {
            consecutiveMatches = 0;
        }
        itemIndex++;
    }

    // Only consider it a match if we matched most of the word
    const matchRatio = totalMatches / word.length;
    if (matchRatio < 0.6) {
        return { score: 0, matches: [] };
    }

    // Score based on match ratio and consecutive character bonus
    const score = Math.floor(matchRatio * 40 + consecutiveMatches * 2);
    return { score, matches };
}

/**
 * Create highlighted text with fuzzy search matches
 */
export function createHighlightedText(text: string, matches: Array<{ start: number, end: number }>): DocumentFragment {
    const fragment = document.createDocumentFragment();

    if (matches.length === 0) {
        fragment.appendChild(document.createTextNode(text));
        return fragment;
    }

    // Sort matches by start position and merge overlapping ones
    const sortedMatches = matches.sort((a, b) => a.start - b.start);
    const mergedMatches: Array<{ start: number, end: number }> = [];

    for (const match of sortedMatches) {
        if (mergedMatches.length === 0 || match.start > mergedMatches[mergedMatches.length - 1].end) {
            mergedMatches.push(match);
        } else {
            // Merge overlapping matches
            mergedMatches[mergedMatches.length - 1].end = Math.max(mergedMatches[mergedMatches.length - 1].end, match.end);
        }
    }

    let lastIndex = 0;
    for (const match of mergedMatches) {
        // Add text before highlight
        if (match.start > lastIndex) {
            fragment.appendChild(document.createTextNode(text.substring(lastIndex, match.start)));
        }

        // Add highlighted text
        const highlight = document.createElement('span');
        highlight.className = 'fuzzy-match-highlight';
        highlight.textContent = text.substring(match.start, match.end);
        fragment.appendChild(highlight);

        lastIndex = match.end;
    }

    // Add remaining text
    if (lastIndex < text.length) {
        fragment.appendChild(document.createTextNode(text.substring(lastIndex)));
    }

    return fragment;
}
