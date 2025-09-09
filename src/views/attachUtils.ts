import { logger } from '../utils/logger';

export function setupAttachment(opts: {
  container: HTMLElement;
  isAttached: () => boolean;
  attachToViewBody: (host: HTMLElement, viewBody: HTMLElement) => void;
  safeRender: (context: string) => void;
  observeResize: (viewBody: HTMLElement) => void;
}): void {
  const { container, isAttached, attachToViewBody, safeRender, observeResize } = opts;

  const findAndAttachViewBody = () => {
    logger.log('[DotNavigator] Looking for view body in container:', {
      containerClass: container.className,
      children: Array.from(container.children).map(child => ({
        tagName: child.tagName,
        className: child.className
      }))
    });

    if (container.classList.contains('view-content')) {
      const viewBody = container.querySelector('.tm_view-body');
      if (viewBody instanceof HTMLElement && !isAttached()) {
        logger.log('[DotNavigator] View body found in view-content, attaching now');
        attachToViewBody(container, viewBody);
        safeRender('first render');
        requestAnimationFrame(() => safeRender('deferred render'));
        if ('ResizeObserver' in window) observeResize(viewBody);
        return true;
      }
    }

    const viewBody = container.querySelector('.tm_view-body');
    if (viewBody instanceof HTMLElement && !isAttached()) {
      logger.log('[DotNavigator] View body found, attaching now');
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
        logger.error('[DotNavigator] Error: Could not find .tm_view-body after maximum retries. Container structure:', {
          container: container,
          containerClass: container.className,
          children: Array.from(container.children).map(child => ({
            tagName: child.tagName,
            className: child.className,
            innerHTML: child instanceof HTMLElement ? child.innerHTML.substring(0, 100) + '...' : undefined
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

  logger.log('[DotNavigator] Attaching to view body, current structure:', {
    hostClass: host.className,
    viewBodyClass: viewBody.className,
    hostChildren: Array.from(host.children).map(c => (c instanceof HTMLElement ? c.className : '')),
    viewBodyChildren: Array.from(viewBody.children).map(c => (c instanceof HTMLElement ? c.className : '')),
    virtualizerExists: !!virtualTree.virtualizer
  });

  try {
    const isChildOfHost = Array.from(host.children).includes(virtualTree.virtualizer);
    if (isChildOfHost) {
      logger.log('[DotNavigator] Removing virtualizer from host');
      host.removeChild(virtualTree.virtualizer);
    } else {
      logger.log('[DotNavigator] Virtualizer is not a child of host, skipping removal');
    }
  } catch (error) {
    logger.error('[DotNavigator] Error removing virtualizer:', error);
  }

  const isChildOfViewBody = Array.from(viewBody.children).includes(virtualTree.virtualizer);
  if (!isChildOfViewBody) {
    logger.log('[DotNavigator] Appending virtualizer to view body');
    const treeContainer = viewBody.querySelector('.tm_view-tree');
    if (treeContainer instanceof HTMLElement) {
      logger.log('[DotNavigator] Found existing tm_view-tree, using it as target');
      while (treeContainer.firstChild) treeContainer.removeChild(treeContainer.firstChild);
      treeContainer.appendChild(virtualTree.virtualizer);
    } else {
      viewBody.appendChild(virtualTree.virtualizer);
    }
  } else {
    logger.log('[DotNavigator] Virtualizer is already a child of view body, skipping append');
  }

  host.removeEventListener('scroll', virtualTree._onScroll);
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

  setAttached(true);
  virtualTree.scrollContainer = viewBody;
  try {
    const minPanelWidth = viewBody.clientWidth;
    const virtualizerEl = virtualTree.virtualizer;
    if (virtualizerEl instanceof HTMLElement) virtualizerEl.style.width = `${Math.max(0, minPanelWidth)}px`;
  } catch { /* ignore width init errors */ }

  setTimeout(() => {
    logger.log('[DotNavigator] Forcing render after attachment');
    try { virtualTree._render(); } catch (error) { logger.error('[DotNavigator] Error in post-attachment render:', error); }
  }, 100);
}
