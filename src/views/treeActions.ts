import type { VirtualTreeLike } from './viewTypes';

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
    vt.scrollToIndex(idx);
    vt._render();
    return idx;
  }
  return undefined;
}

export function scrollToIndex(vt: VirtualTreeLike, index: number): void {
  const sc1 = vt.scrollContainer;
  const sc2 = vt.container;
  if (sc1 instanceof HTMLElement || sc2 instanceof HTMLElement) {
    const sc = sc1 || sc2;
    const total: number = vt.total;
    if (index < 0 || index >= total) return;
    const rowHeight: number = vt.rowHeight;
    const rowTop = index * rowHeight;
    const rowBottom = rowTop + rowHeight;
    const viewTop = sc.scrollTop;
    const viewBottom = viewTop + sc.clientHeight;
    if (rowTop >= viewTop && rowBottom <= viewBottom) return;
    const offsetRows = 3;
    const maxScrollTop = Math.max(0, total * rowHeight - sc.clientHeight);
    let targetScrollTop = Math.max(0, (index - offsetRows) * rowHeight);
    targetScrollTop = Math.min(targetScrollTop, maxScrollTop);
    try { sc.scrollTo({ top: targetScrollTop, behavior: 'smooth' }); }
    catch { sc.scrollTop = targetScrollTop; }
  }
}

