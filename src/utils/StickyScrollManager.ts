export interface TreeItem {
    path: string;
    level: number;
    isVisible: boolean;
    top: number;
}

export class StickyScrollManager {
    private visibleItems: TreeItem[] = [];

    /**
     * Updates which items are currently visible in the viewport
     */
    updateVisibleItems(items: TreeItem[]) {
        // Store all items, not just visible ones
        this.visibleItems = items;
    }

    /**
     * Gets the headers that should be shown based on current visible items
     * Returns array of paths that should be shown as sticky headers
     */
    getVisibleHeaders(): string[] { 
        if (this.visibleItems.length === 0) return [];

        // Find the topmost visible item
        const topmostItem = this.visibleItems.reduce((top, current) => {
            return (!top || current.top < top.top) ? current : top;
        }, null as TreeItem | null);

        if (!topmostItem) return [];

        // Get ancestors of the topmost item (excluding the item itself)
        const ancestors = this.getAncestorPaths(topmostItem.path);

        // Filter out ancestors that are not visible
        return ancestors.filter(path => {
            const item = this.visibleItems.find(i => i.path === path);
            return item && item.isVisible;
        });
    }

    /**
     * Gets ancestor paths for a given path, handling both folder structure and Dendron-style dots
     * e.g. for "Notes/tech/docs/git.commit.conventional.md", returns:
     * ["Notes", "Notes/tech", "Notes/tech/docs", "Notes/tech/docs/git", "Notes/tech/docs/git.commit"]
     * Note: Does not include the item itself in the returned array
     */
    private getAncestorPaths(path: string): string[] {
        // Remove the extension (e.g., .md)
        const pathWithoutExt = path.replace(/\.[^/.]+$/, '');
        
        // Split by folder separator first
        const folderParts = pathWithoutExt.split('/');
        
        // For the last part (file name), we need to handle dots
        const lastPart = folderParts[folderParts.length - 1];
        const dotParts = lastPart.split('.');
        
        // Build the ancestry chain
        const ancestors: string[] = [];
        
        // Add folder-level ancestors
        for (let i = 0; i < folderParts.length - 1; i++) {
            ancestors.push(folderParts.slice(0, i + 1).join('/'));
        }
        
        // Add dot-notation ancestors for the last part (excluding the last part)
        const folderPath = folderParts.slice(0, -1).join('/');
        for (let i = 0; i < dotParts.length - 1; i++) {
            const ancestorPath = folderPath ? 
                `${folderPath}/${dotParts.slice(0, i + 1).join('.')}` :
                dotParts.slice(0, i + 1).join('.');
            ancestors.push(ancestorPath);
        }
        
        return ancestors;
    }
} 