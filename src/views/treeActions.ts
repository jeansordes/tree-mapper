import type { VirtualTreeLike } from './viewTypes';
import { scrollIntoView } from '../utils/rowState';

export function selectPath(vt: VirtualTreeLike, path: string): number | undefined {
  const list = vt.visible;
  const idx = list.findIndex(it => it.id === path);
  if (idx >= 0) {
    vt.selectedIndex = idx;
    vt._render();
    return idx;
  }
  return undefined;
}

export function collapseAll(vt: VirtualTreeLike): void {
  vt.expanded.clear();
  vt._recomputeVisible();
  vt._render();
}

export async function revealPath(vt: VirtualTreeLike, parentMap: Map<string, string | undefined>, path: string): Promise<number | undefined> {
  const expanded = vt.expanded;
  let cur: string | undefined = path;
  const guard = new Set<string>();
  while (cur && !guard.has(cur)) {
    guard.add(cur);
    const parent = parentMap.get(cur);
    if (parent) expanded.set(parent, true);
    cur = parent;
  }
  vt._recomputeVisible();
  const list = vt.visible;
  const idx = list.findIndex(it => it.id === path);
  if (idx >= 0) {
    vt.focusedIndex = idx;
    vt.selectedIndex = idx;
    
    // First, scroll vertically to the row using row-based scrolling
    scrollIntoView({
      rowIndex: idx,
      rowHeight: vt.rowHeight,
      totalRows: vt.total,
      container: vt.scrollContainer instanceof HTMLElement ? vt.scrollContainer : vt.container,
      padding: 'var(--dotn_view-padding, 16px)',
      smooth: true
    });
    
    vt._render();
    
    // Then, find the title element specifically and scroll it horizontally into view
    // We need to wait a moment for the render to complete
    setTimeout(() => {
      // Try to find the row element first
      const escapedPath = CSS.escape(path);
      const rowElement = vt.virtualizer?.querySelector(`[data-id="${escapedPath}"]`) ||
                        vt.container.querySelector(`[data-id="${escapedPath}"]`) ||
                        document.querySelector(`[data-id="${escapedPath}"]`);
      
      if (rowElement instanceof HTMLElement) {
        // Find the title element within the row
        const titleElement = rowElement.querySelector('.dotn_tree-item-title.is-active') ||
                            rowElement.querySelector('.dotn_tree-item-title');
        
        if (titleElement instanceof HTMLElement) {
          // Scroll the title element specifically into view
          scrollIntoView({
            target: titleElement,
            container: vt.scrollContainer instanceof HTMLElement ? vt.scrollContainer : vt.container,
            padding: 'var(--dotn_view-padding, 16px)',
            smooth: true,
            blockAlign: 'auto', // Don't change vertical position
            inlineAlign: 'auto'  // Scroll horizontally as needed
          });
        }
      }
    }, 100); // Slightly longer delay to ensure render is complete
    
    return idx;
  }
  return undefined;
}

export function scrollToIndex(vt: VirtualTreeLike, index: number): void {
  // Use unified scrolling function
  scrollIntoView({
    rowIndex: index,
    rowHeight: vt.rowHeight,
    totalRows: vt.total,
    container: vt.scrollContainer instanceof HTMLElement ? vt.scrollContainer : vt.container,
    padding: 'var(--dotn_view-padding, 16px)',
    smooth: true,
    bufferRows: 3
  });
}

