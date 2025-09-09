import type { VItem } from '../core/virtualData';

// Shape of items after flattening, as consumed by the virtual renderer
export type RowItem = VItem & { level: number; hasChildren?: boolean };

// Minimal interface to access required properties/methods of VirtualTree
export interface VirtualTreeLike {
  expanded: Map<string, boolean>;
  data: VItem[];
  visible: RowItem[];
  total: number;
  virtualizer: Element;
  scrollContainer?: Element;
  focusedIndex: number;
  selectedIndex: number;
  rowHeight: number;
  container: HTMLElement;
  buffer: number;
  pool: HTMLElement[];
  poolSize: number;
  _render: () => void;
  _recomputeVisible: () => void;
  _onScroll: () => void;
  scrollToIndex: (index: number) => void;
}

