import { WindowResult } from './types';

export function clamp(value: number, min: number, max: number): number {
  return Math.max(min, Math.min(max, value));
}

export function computeWindow(
  scrollTop: number, 
  rowHeight: number, 
  buffer: number, 
  clientHeight: number, 
  total: number, 
  poolSize?: number
): WindowResult {
  const visibleCount = Math.ceil(clientHeight / rowHeight);
  const effectivePool = poolSize ?? visibleCount + buffer * 2;
  const startIndex = clamp(Math.floor(scrollTop / rowHeight) - buffer, 0, Math.max(total - 1, 0));
  const endIndex = Math.min(startIndex + effectivePool, total);
  return { startIndex, endIndex, poolSize: effectivePool };
}
