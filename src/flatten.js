export function flattenTree(nodes, expandedMap = new Map(), level = 0, out = []) {
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
