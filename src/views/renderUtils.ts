import type { VirtualTreeLike } from './viewTypes';
import createDebug from 'debug';
const debug = createDebug('dot-navigator:views:render-utils');

export function ensurePoolCapacity(vt: VirtualTreeLike, onRowInit?: (row: HTMLElement) => void): void {
  const scrollContainer = vt.scrollContainer;
  const container = vt.container;
  const sc = scrollContainer instanceof HTMLElement ? scrollContainer : container;
  const rowHeight: number = vt.rowHeight;
  const buffer: number = vt.buffer;
  const pool: HTMLElement[] = vt.pool;
  const poolSize: number = vt.poolSize;

  const visibleCount = Math.max(1, Math.ceil(sc.clientHeight / rowHeight));
  const desired = visibleCount + buffer * 2;
  if (desired > poolSize) {
    const virtualizer = vt.virtualizer;
    if (virtualizer instanceof HTMLElement) {
      for (let i = poolSize; i < desired; i++) {
        const row = document.createElement('div');
        row.className = 'tree-row';
        row.dataset.poolIndex = String(i);
        if (onRowInit) onRowInit(row);
        virtualizer.appendChild(row);
        pool.push(row);
      }
      vt.poolSize = desired;
      debug('grow pool', {
        clientHeight: sc.clientHeight,
        rowHeight,
        visibleCount,
        buffer,
        oldPoolSize: poolSize,
        newPoolSize: desired
      });
    }
  }
}

export function logRenderWindow(vt: VirtualTreeLike, sc: HTMLElement, startIndex: number, endIndex: number, scrollTop: number): void {
  try {
    const rowHeight: number = vt.rowHeight;
    const buffer: number = vt.buffer;
    const poolSize: number = vt.poolSize;
    const clientHeight = sc.clientHeight || 0;
    const visibleCount = Math.max(1, Math.ceil(clientHeight / rowHeight));
    const renderCount = Math.max(0, endIndex - startIndex);
    const total: number = vt.total;
    const now = (typeof performance !== 'undefined' ? performance.now() : Date.now());
    // store on element dataset to avoid keeping extra state here
    const lastStart = Number(sc.dataset.tmLastStart || '-1');
    const lastScroll = Number(sc.dataset.tmLastScroll || '-1');
    const lastLog = Number(sc.dataset.tmLastLog || '0');
    const movedEnough = Math.abs(startIndex - lastStart) >= 5 || Math.abs(scrollTop - lastScroll) >= rowHeight * 3;
    const timeElapsed = now - lastLog > 200; // throttle
    const underCoverage = renderCount < visibleCount; // not enough rows to cover viewport
    if (lastStart < 0 || movedEnough || timeElapsed || underCoverage) {
      sc.dataset.tmLastStart = String(startIndex);
      sc.dataset.tmLastScroll = String(scrollTop);
      sc.dataset.tmLastLog = String(now);
      debug('render window', {
        scrollTop,
        rowHeight,
        clientHeight,
        visibleCount,
        buffer,
        poolSize,
        startIndex,
        endIndex,
        renderCount,
        total,
        underCoverage
      });
    }
  } catch { /* ignore logging errors */ }
}

export function scheduleWidthAdjust(
  vt: VirtualTreeLike,
  state: { getTimer: () => number | undefined; setTimer: (n: number | undefined) => void; getMaxWidth: () => number; setMaxWidth: (n: number) => void }
): void {
  const currentTimer = state.getTimer();
  if (currentTimer) window.clearTimeout(currentTimer);
  const timerId = window.setTimeout(() => {
    state.setTimer(undefined);
    try {
      const rows: HTMLElement[] = vt.pool.filter(r => !r.classList.contains('is-hidden'));
      if (rows.length === 0) return;

      let max = 0;
      const prevWidths: string[] = [];
      for (const row of rows) {
        prevWidths.push(row.style.width);
        row.style.width = 'auto';
        const w = Math.ceil(row.scrollWidth);
        if (w > max) max = w;
      }

      const sc1 = vt.scrollContainer;
      const sc2 = vt.container;
      const sc = sc1 instanceof HTMLElement ? sc1 : sc2;
      const minPanelWidth = sc instanceof HTMLElement ? sc.clientWidth : 0;
      const finalWidth = Math.max(max, minPanelWidth);
      const widthPx = finalWidth > 0 ? `${finalWidth}px` : '';
      for (let i = 0; i < rows.length; i++) {
        rows[i].style.width = widthPx || prevWidths[i] || '';
      }

      if (finalWidth > 0) {
        state.setMaxWidth(finalWidth);
        const virtualizerEl = vt.virtualizer;
        if (virtualizerEl instanceof HTMLElement && virtualizerEl.style.width !== widthPx) virtualizerEl.style.width = widthPx;
      }
    } catch { /* non-critical */ }
  }, 120);
  state.setTimer(timerId);
}
