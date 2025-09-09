import { VirtualTreeBaseItem, VirtualTreeItem } from './types';

export function flattenTree(
  nodes: VirtualTreeBaseItem[] | undefined, 
  expandedMap: Map<string, boolean> = new Map(), 
  level: number = 0, 
  out: VirtualTreeItem[] = []
): VirtualTreeItem[] {
  // Handle case when nodes is undefined or not an array
  if (!nodes || !Array.isArray(nodes)) {
    return out;
  }
  
  for (const n of nodes) {
    const hasChildren = Array.isArray(n.children) && n.children.length > 0;
    // Include hasChildren so virtual row renderers can decide whether to show toggles
    // Preserve optional fields like `extension` so file icons can render
    out.push({ id: n.id, name: n.name, kind: n.kind, extension: n.extension, level, hasChildren });
    if (hasChildren) {
      const isOpen = expandedMap.get(n.id) ?? n.expanded ?? false;
      if (isOpen && Array.isArray(n.children) && n.children.length) {
        flattenTree(n.children, expandedMap, level + 1, out);
      }
    }
  }
  return out;
}
