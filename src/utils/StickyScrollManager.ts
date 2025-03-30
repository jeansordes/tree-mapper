export interface TreeItem {
    path: string;
    level: number;
    isVisible: boolean;
    top: number;
}

export class StickyScrollManager {
    /**
     * Gets ancestor paths for a given path, handling both folder structure and Dendron-style dots
     * e.g. for "Notes/tech/docs/git.commit.conventional.md", returns:
     * ["Notes", "Notes/tech", "Notes/tech/docs", "Notes/tech/docs/git.md", "Notes/tech/docs/git.commit.md"]
     * Note: Does not include the item itself in the returned array
     */
    public static getAncestorPaths(path: string): string[] {
        // Split by folder separator first
        const folderParts = path.split('/');
        const ancestors: string[] = [];
        
        // Add folder-level ancestors (excluding the last part)
        for (let i = 0; i < folderParts.length - 1; i++) {
            ancestors.push(folderParts.slice(0, i + 1).join('/'));
        }
        
        // Handle the last part (file or folder name)
        const lastPart = folderParts[folderParts.length - 1];
        if (!lastPart.includes('.')) {
            return ancestors;
        }
        
        // Split the last part into name and extensions
        const parts = lastPart.split('.');
        const extension = parts[parts.length - 1];
        const nameWithoutExtension = parts.slice(0, -1).join('.');
        
        // Handle Dendron-style dots in the name
        const dotParts = nameWithoutExtension.split('.');
        const folderPath = folderParts.slice(0, -1).join('/');
        
        // Build dot-notation ancestors
        let currentPath = '';
        for (let i = 0; i < dotParts.length - 1; i++) {
            currentPath = currentPath ? `${currentPath}.${dotParts[i]}` : dotParts[i];
            const ancestorPath = folderPath ? 
                `${folderPath}/${currentPath}.${extension}` :
                `${currentPath}.${extension}`;
            ancestors.push(ancestorPath);
        }
        
        return ancestors;
    }
} 