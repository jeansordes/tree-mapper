import { App } from 'obsidian';
import { FileUtils } from '../utils/FileUtils';
import { TreeNode, TreeNodeType } from '../types';
import { getYamlTitle } from '../utils/YamlTitleUtils';

export type Kind = 'folder' | 'file' | 'virtual';

export interface VItem {
  id: string;
  name: string;
  kind: Kind;
  extension?: string;
  children?: VItem[];
}

export interface VirtualizedData {
  data: VItem[];
  parentMap: Map<string, string | undefined>;
}

export function nodeKind(node: TreeNode): Kind {
  switch (node.nodeType) {
    case TreeNodeType.FOLDER: return 'folder';
    case TreeNodeType.FILE: return 'file';
    case TreeNodeType.VIRTUAL: return 'virtual';
  }
  return 'virtual';
}

export function displayName(app: App, node: TreeNode): string {
  // First check for YAML title
  const yamlTitle = getYamlTitle(app, node.path);
  if (yamlTitle) {
    return yamlTitle;
  }

  // Fallback to filename-based logic
  const base = FileUtils.basename(node.path);
  if (node.nodeType === TreeNodeType.FOLDER) return base.replace(/ \(\d+\)$/u, '');
  const matched = base.match(/([^.]+)\.[^.]+$/u);
  return (matched ? matched[1] : base).replace(/ \(\d+\)$/u, '');
}

export function extOf(path: string): string | undefined {
  const idx = path.lastIndexOf('.');
  return idx > -1 ? path.slice(idx + 1) : undefined;
}

export function buildVirtualizedData(app: App, root: TreeNode): VirtualizedData {
  const parentMap = new Map<string, string | undefined>();

  function build(node: TreeNode, parentId?: string): VItem {
    parentMap.set(node.path, parentId);
    const item: VItem = {
      id: node.path,
      name: displayName(app, node),
      kind: nodeKind(node),
    };

    if (node.nodeType === TreeNodeType.FILE) {
      const e = extOf(node.path);
      if (e) item.extension = e;
    }

    if (node.children && node.children.size > 0) {
      const children: VItem[] = [];
      Array.from(node.children.entries())
        .sort(([_aKey, aNode], [_bKey, bNode]) => {
          // Sort by display name (which includes YAML titles) instead of raw keys
          const aDisplayName = displayName(app, aNode);
          const bDisplayName = displayName(app, bNode);
          return aDisplayName.localeCompare(bDisplayName);
        })
        .forEach(([, child]) => {
          children.push(build(child, node.path));
        });
      item.children = children;
    }

    return item;
  }

  const data: VItem[] = [];
  Array.from(root.children.entries())
    .sort(([_aKey, aNode], [_bKey, bNode]) => {
      // Sort by display name (which includes YAML titles) instead of raw keys
      const aDisplayName = displayName(app, aNode);
      const bDisplayName = displayName(app, bNode);
      return aDisplayName.localeCompare(bDisplayName);
    })
    .forEach(([, child]) => data.push(build(child, root.path)));

  return { data, parentMap };
}

