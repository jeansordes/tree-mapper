import { App, TFile } from "obsidian";

/**
 * Reads the YAML title from a file's frontmatter
 * @param app - The Obsidian app instance
 * @param filePath - The path to the file to read
 * @returns The custom title from YAML frontmatter, or null if not found
 */
export function getYamlTitle(app: App, filePath: string): string | null {
  try {
    const file = app.vault.getAbstractFileByPath(filePath);
    if (!(file instanceof TFile)) return null;

    const cache = app.metadataCache.getFileCache(file);
    const frontmatter = cache?.frontmatter;

    return frontmatter?.title || null;
  } catch (error) {
    console.error('Error reading YAML title:', error);
    return null;
  }
}

/**
 * Checks if a file has a YAML custom title
 * @param app - The Obsidian app instance
 * @param filePath - The path to the file to check
 * @returns True if the file has a YAML title, false otherwise
 */
export function hasYamlTitle(app: App, filePath: string): boolean {
  const title = getYamlTitle(app, filePath);
  return title !== null && title.trim() !== '';
}
