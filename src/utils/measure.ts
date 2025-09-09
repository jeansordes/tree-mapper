import { logger } from './logger';

export function computeRowHeight(rootContainer: HTMLElement): number | null {
  try {
    const viewBody = rootContainer.querySelector('.tm_view-body');
    const host = viewBody instanceof HTMLElement ? viewBody : rootContainer;

    const toPx = (cssVar: string): number => {
      const probe = document.createElement('div');
      probe.style.position = 'absolute';
      probe.style.visibility = 'hidden';
      probe.style.pointerEvents = 'none';
      probe.style.height = cssVar;
      host.appendChild(probe);
      const h = Math.round(probe.getBoundingClientRect().height);
      probe.remove();
      return Number.isFinite(h) ? h : 0;
    };

    const btnH = toPx('var(--tm_button-size)');
    const gapH = toPx('var(--tm_gap)');
    const total = btnH + gapH;
    if (total < 26) return 28; // guard fallback
    if (total > 0) return total;
  } catch (error) {
    logger.error('[TreeMapper] Error computing row height:', error);
  }
  return null;
}

export function computeGap(rootContainer: HTMLElement): number | null {
  try {
    const viewBody = rootContainer.querySelector('.tm_view-body');
    const host = viewBody instanceof HTMLElement ? viewBody : rootContainer;
    const probe = document.createElement('div');
    probe.style.position = 'absolute';
    probe.style.visibility = 'hidden';
    probe.style.pointerEvents = 'none';
    probe.style.height = 'var(--tm_gap)';
    host.appendChild(probe);
    const h = Math.round(probe.getBoundingClientRect().height);
    probe.remove();
    if (Number.isFinite(h) && h >= 0) return h;
  } catch (error) {
    logger.error('[TreeMapper] Error computing gap:', error);
  }
  return null;
}
