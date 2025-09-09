import type { VirtualTreeLike } from './viewTypes';
import type { VItem } from '../core/virtualData';
import { FileUtils } from '../utils/FileUtils';

// Compute the Dendron-style parent id for a given path.
export function computeDendronParentId(path: string, kind: 'folder' | 'file' | 'virtual'): string {
  const lastSlash = path.lastIndexOf('/');
  const folderPath = lastSlash >= 0 ? path.slice(0, lastSlash) : '';
  const rootOrFolder = folderPath === '' ? '/' : folderPath;
  if (kind === 'folder') return rootOrFolder;

  const base = FileUtils.basename(path);
  const lastDot = base.lastIndexOf('.');
  const nameNoExt = lastDot >= 0 ? base.slice(0, lastDot) : base;
  const dotIdx = nameNoExt.lastIndexOf('.');
  if (dotIdx > -1) {
    const parentName = nameNoExt.slice(0, dotIdx) + '.md';
    return (folderPath ? folderPath + '/' : '') + parentName;
  }
  return rootOrFolder;
}

// Attempt to rename a single path in-place (only supports same-parent renames).
// Returns whether applied in place, a possibly updated parentMap, and a selectedId mapper.
export function renamePathInPlace(
  vt: VirtualTreeLike,
  parentMap: Map<string, string | undefined>,
  oldPath: string,
  newPath: string
): { applied: boolean; parentMap: Map<string, string | undefined>; mapSelected: (sel?: string) => string | undefined } {
  if (!oldPath || !newPath || oldPath === newPath) {
    return { applied: true, parentMap, mapSelected: (s) => s };
  }

  const findIn = (arr: VItem[], target: string): { list: VItem[]; index: number } | null => {
    for (let i = 0; i < arr.length; i++) {
      const it = arr[i];
      if (it.id === target) return { list: arr, index: i };
      if (it.children && it.children.length) {
        const found = findIn(it.children, target);
        if (found) return found;
      }
    }
    return null;
  };

  const loc = findIn(vt.data, oldPath);
  if (!loc) return { applied: false, parentMap, mapSelected: (s) => s };

  const node = loc.list[loc.index];
  const oldParentId = parentMap.get(oldPath) ?? computeDendronParentId(oldPath, node.kind);
  const newParentId = computeDendronParentId(newPath, node.kind);
  const sameDendronParent = oldParentId === newParentId;

  const newExpanded = new Map<string, boolean>();
  vt.expanded.forEach((v, k) => {
    if (!v) return;
    if (k === oldPath || k.startsWith(oldPath + '/')) {
      const replaced = newPath + k.slice(oldPath.length);
      newExpanded.set(replaced, true);
    } else {
      newExpanded.set(k, true);
    }
  });
  vt.expanded = newExpanded;

  const updateIds = (n: VItem) => {
    if (n.id === oldPath) {
      n.id = newPath;
      const base = FileUtils.basename(newPath);
      if (n.kind === 'folder') n.name = base.replace(/ \(\d+\)$/, '');
      else {
        const matched = base.match(/([^.]+)\.[^.]+$/);
        n.name = (matched ? matched[1] : base).replace(/ \(\d+\)$/, '');
      }
    } else if (n.id.startsWith(oldPath + '/')) {
      n.id = newPath + n.id.slice(oldPath.length);
    }
    if (n.children) n.children.forEach(updateIds);
  };

  if (sameDendronParent) {
    updateIds(node);
    loc.list.sort((a, b) => a.name.localeCompare(b.name));
  } else {
    const findNode = (arr: VItem[], target: string): VItem | null => {
      for (const it of arr) {
        if (it.id === target) return it;
        if (it.children && it.children.length) {
          const found = findNode(it.children, target);
          if (found) return found;
        }
      }
      return null;
    };
    const getDestList = (parentId: string): VItem[] | null => {
      if (!parentId || parentId === '/') return vt.data;
      const parentNode = findNode(vt.data, parentId);
      if (!parentNode) return null;
      if (!Array.isArray(parentNode.children)) parentNode.children = [];
      return parentNode.children ?? [];
    };

    const destList = getDestList(newParentId);
    if (!destList) return { applied: false, parentMap, mapSelected: (s) => s };

    const [movingNode] = loc.list.splice(loc.index, 1);
    updateIds(movingNode);
    destList.push(movingNode);
    destList.sort((a, b) => a.name.localeCompare(b.name));
  }

  const newParentMap = new Map<string, string | undefined>();
  const walk = (items: VItem[], parent?: string) => {
    for (const it of items) {
      newParentMap.set(it.id, parent);
      if (it.children && it.children.length) walk(it.children, it.id);
    }
  };
  walk(vt.data);

  const mapSelected = (selected?: string) => {
    if (!selected) return selected;
    if (selected === oldPath || selected.startsWith(oldPath + '/')) {
      return newPath + selected.slice(oldPath.length);
    }
    return selected;
  };

  return { applied: true, parentMap: newParentMap, mapSelected };
}

export function expandAllInData(data: VItem[], expanded: Map<string, boolean>): void {
  function walk(items: VItem[]) {
    for (const it of items) {
      const hasChildren = Array.isArray(it.children) && it.children.length > 0;
      if (hasChildren) expanded.set(it.id, true);
      if (it.children) walk(it.children);
    }
  }
  walk(data);
}

