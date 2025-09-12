import type { VItem } from '../core/virtualData';

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
