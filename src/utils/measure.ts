import createDebug from 'debug';
const debugError = createDebug('dot-navigator:utils:measure:error');

export function computeRowHeight(rootContainer: HTMLElement): number | null {
  try {
    const viewBody = rootContainer.querySelector('.dotn_view-body');
    const host = viewBody instanceof HTMLElement ? viewBody : rootContainer;

    const toPx = (cssVar: string): number => {
      const probe = document.createElement('div');
      probe.className = 'dotn_probe dotn_probe-row';
      // Allowed: height can be set directly; others come from CSS class
      probe.style.height = cssVar;
      host.appendChild(probe);
      const h = Math.round(probe.getBoundingClientRect().height);
      probe.remove();
      return Number.isFinite(h) ? h : 0;
    };

    const btnH = toPx('var(--dotn_button-size)');
    const gapH = toPx('var(--dotn_gap)');
    const total = btnH + gapH;
    if (total < 26) return 28; // guard fallback
    if (total > 0) return total;
  } catch (error) {
    debugError('Error computing row height:', error);
  }
  return null;
}

export function computeGap(rootContainer: HTMLElement): number | null {
  try {
    const viewBody = rootContainer.querySelector('.dotn_view-body');
    const host = viewBody instanceof HTMLElement ? viewBody : rootContainer;
    const probe = document.createElement('div');
    probe.className = 'dotn_probe dotn_probe-gap';
    // Height is allowed to be set directly
    probe.style.height = 'var(--dotn_gap)';
    host.appendChild(probe);
    const h = Math.round(probe.getBoundingClientRect().height);
    probe.remove();
    if (Number.isFinite(h) && h >= 0) return h;
  } catch (error) {
    debugError('Error computing gap:', error);
  }
  return null;
}
