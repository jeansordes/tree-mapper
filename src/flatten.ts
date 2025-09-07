import { VirtualTreeItem } from './types';

export function flattenTree(
  nodes: VirtualTreeItem[] | undefined, 
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
    out.push({ id: n.id, name: n.name, kind: n.kind, level, hasChildren });
    if (hasChildren) {
      const isOpen = expandedMap.get(n.id) ?? n.expanded ?? false;
      if (isOpen && Array.isArray(n.children) && n.children.length) {
        flattenTree(n.children, expandedMap, level + 1, out);
      }
    }
  }
  return out;
}
