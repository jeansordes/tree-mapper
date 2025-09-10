import createDebug from 'debug';
const debug = createDebug('dot-navigator:views:attach');
const debugError = debug.extend('error');

export function setupAttachment(opts: {
  container: HTMLElement;
  isAttached: () => boolean;
  attachToViewBody: (host: HTMLElement, viewBody: HTMLElement) => void;
  safeRender: (context: string) => void;
  observeResize: (viewBody: HTMLElement) => void;
}): void {
  const { container, isAttached, attachToViewBody, safeRender, observeResize } = opts;

  const findAndAttachViewBody = () => {
    debug('Looking for view body in container:', {
      containerClass: container.className,
      children: Array.from(container.children).map(child => ({
        tagName: child.tagName,
        className: child.className
      }))
    });

    if (container.classList.contains('view-content')) {
      const viewBody = container.querySelector('.dotn_view-body');
      if (viewBody instanceof HTMLElement && !isAttached()) {
        debug('View body found in view-content, attaching now');
        attachToViewBody(container, viewBody);
        safeRender('first render');
        requestAnimationFrame(() => safeRender('deferred render'));
        if ('ResizeObserver' in window) observeResize(viewBody);
        return true;
      }
    }

    const viewBody = container.querySelector('.dotn_view-body');
    if (viewBody instanceof HTMLElement && !isAttached()) {
      debug('View body found, attaching now');
      attachToViewBody(container, viewBody);
      safeRender('first render');
      requestAnimationFrame(() => safeRender('deferred render'));
      if ('ResizeObserver' in window) observeResize(viewBody);
      return true;
    }
    return false;
  };

  if (!findAndAttachViewBody()) {
    let retryCount = 0;
    const maxRetries = 20;
    const retryInterval = 100;
    const retry = () => {
      retryCount++;
      if (retryCount >= maxRetries) {
        debugError('[DotNavigator] Error: Could not find .dotn_view-body after maximum retries. Container structure:', {
          container: container,
          containerClass: container.className,
          children: Array.from(container.children).map(child => ({
            tagName: child.tagName,
            className: child.className
          }))
        });
        return;
      }
      if (!findAndAttachViewBody()) setTimeout(retry, retryInterval);
    };
    setTimeout(retry, retryInterval);
  }
}

import type { VirtualTreeLike } from './viewTypes';

export function attachToViewBodyImpl(ctx: {
  virtualTree: VirtualTreeLike;
  host: HTMLElement;
  viewBody: HTMLElement;
  getLastScrollTop: () => number;
  setLastScrollTop: (n: number) => void;
  setAttached: (b: boolean) => void;
  setBoundScroll: (fn: () => void) => void;
}): void {
  const { virtualTree, host, viewBody, getLastScrollTop, setLastScrollTop, setAttached, setBoundScroll } = ctx;

  debug('Attaching to view body, current structure:', {
    hostClass: host.className,
    viewBodyClass: viewBody.className,
    hostChildren: Array.from(host.children).map(c => (c instanceof HTMLElement ? c.className : '')),
    viewBodyChildren: Array.from(viewBody.children).map(c => (c instanceof HTMLElement ? c.className : '')),
    virtualizerExists: !!virtualTree.virtualizer
  });

  try {
    const isChildOfHost = Array.from(host.children).includes(virtualTree.virtualizer);
    if (isChildOfHost) {
      debug('Removing virtualizer from host');
      host.removeChild(virtualTree.virtualizer);
    } else {
      debug('Virtualizer is not a child of host, skipping removal');
    }
  } catch (error) {
    debugError('Error removing virtualizer:', error);
  }

  const isChildOfViewBody = Array.from(viewBody.children).includes(virtualTree.virtualizer);
  if (!isChildOfViewBody) {
    debug('Appending virtualizer to view body');
    const treeContainer = viewBody.querySelector('.dotn_view-tree');
    if (treeContainer instanceof HTMLElement) {
      debug('Found existing dotn_view-tree, using it as target');
      while (treeContainer.firstChild) treeContainer.removeChild(treeContainer.firstChild);
      treeContainer.appendChild(virtualTree.virtualizer);
    } else {
      viewBody.appendChild(virtualTree.virtualizer);
    }
  } else {
    debug('Virtualizer is already a child of view body, skipping append');
  }

  // If using TanStack Virtual, it manages scroll listeners itself.
  host.removeEventListener('scroll', virtualTree._onScroll);
  const isTanstack = (virtualTree as unknown as { usesTanstack?: () => boolean }).usesTanstack?.() === true;
  if (!isTanstack) {
    const bound = () => requestAnimationFrame(() => {
      const sc1 = virtualTree.scrollContainer;
      const sc2 = virtualTree.container;
      const sc = sc1 instanceof HTMLElement ? sc1 : sc2;
      const st = sc instanceof HTMLElement ? sc.scrollTop : 0;
      if (st !== getLastScrollTop()) {
        setLastScrollTop(st);
        virtualTree._onScroll();
      }
    });
    viewBody.addEventListener('scroll', bound);
    setBoundScroll(bound);
  }

  setAttached(true);
  virtualTree.scrollContainer = viewBody;
  // Ensure the virtualizer updates to the new scroll element
  try { (virtualTree as unknown as { syncScrollElement?: () => void }).syncScrollElement?.(); } catch { /* ignore */ }
  // Avoid forcing widths here to prevent reflow; CSS governs width.

  setTimeout(() => {
    debug('[DotNavigator] Forcing render after attachment');
    try { virtualTree._render(); } catch (error) { debugError('[DotNavigator] Error in post-attachment render:', error); }
  }, 100);
}
