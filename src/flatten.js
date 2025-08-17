export function flattenTree(nodes, expandedMap = new Map(), level = 0, out = []) {
  for (const n of nodes) {
    out.push({ id: n.id, name: n.name, kind: n.kind, level });
    const isFolder = n.kind === 'folder';
    if (isFolder) {
      const isOpen = expandedMap.get(n.id) ?? n.expanded ?? false;
      if (isOpen && Array.isArray(n.children) && n.children.length) {
        flattenTree(n.children, expandedMap, level + 1, out);
      }
    }
  }
  return out;
}
