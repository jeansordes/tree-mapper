# Goal

Build a **high‑performance virtualized file tree** in **vanilla JavaScript** that can display and interact with **10k–100k nodes** smoothly (60 FPS target) using **DOM virtualization + row reuse** (not React, not Canvas by default). Provide clean, production‑ready code with clear APIs and tests.

# Context

- The current implementation renders thousands of DOM nodes and is slow (jank on scroll, long initial render).
- We want a solution similar to VS Code’s Explorer: flatten visible nodes, render only the window, recycle rows, and use a spacer to simulate full height.
- Tech constraints:
  - Pure **vanilla JS**, no frameworks.
  - Works in modern Chromium/WebKit/Gecko.
  - Fixed row height for v1 (20px default), optional variable height extension behind a feature flag.

# Deliverables

- `index.html`, `styles.css`, `virtualTree.js` (ES modules), plus a small `server.js` (optional) for local demo.
- A demo page that loads a generated large tree (e.g., 50k items) and remains fluid.
- A small unit test file (`virtualTree.spec.js`) covering core math (windowing/indices) and flattening.
- A `README.md` with usage and perf notes.

# Functional Requirements

- Data model:
  - Input tree node shape:
    - `{ id: string, name: string, kind: 'file'|'folder', children?: Node[], expanded?: boolean }`
  - Provide `buildVisibleList(tree, expandedState)` → `Array<{id, name, level, kind}>` where `level` is indent depth.
- Virtualization:
  - Only render **N = visibleRows + bufferAbove + bufferBelow** DOM rows (defaults: visibleRows computed from container height / row height; buffer 10–20 rows each side).
  - Use a single `spacer` element with height = `totalItems * ROW_HEIGHT` to create scrollable space.
  - Use **absolute positioning** with `transform: translateY(y)` for each row.
  - **Reuse** a fixed pool of row DIVs; never create/destroy rows on scroll.
  - Update rows on `scroll` using `requestAnimationFrame` (coalesce events) and avoid layout thrash.
- Expand/Collapse:
  - Clicking a folder toggles its `expanded` state and **recomputes** the visible list; keep scroll position stable when possible.
  - Iconography can be simple text (📁/📄) for demo; structured for easy replacement.
- Interaction:
  - Row selection (single, with keyboard ↑/↓, Home/End, PageUp/PageDown).
  - Double‑click folder toggles; Enter opens/toggles.
  - Basic A11y: roletree/aria-level/aria-expanded on rows; focus ring handling.
- Performance:
  - Maintain 60 FPS on scroll with 50k items on a mid‑range laptop.
  - Initial render under 50ms for 10k items (target; document measurements in README).
- API surface:
  - `new VirtualTree({ container, data, rowHeight=20, buffer=10, onOpen, onSelect })`
  - Methods:
    - `.setData(tree)`
    - `.expand(id)` / `.collapse(id)` / `.toggle(id)`
    - `.scrollToIndex(index)`
    - `.destroy()`
  - Events/callbacks:
    - `onOpen(node)`, `onSelect(node)`

# Non‑Functional Requirements

- Avoid forced reflow in hot paths (no `getBoundingClientRect()` inside loops).
- Use `CSS contain` to isolate layout/paint.
- No external deps. Keep bundle small (<10 KB gz if later bundled).
- Code should be modular, documented, and easy to extend (e.g., variable row height mode).

# Acceptance Criteria (Definition of Done)

- Smooth scrolling without blank gaps, even on fast flicks.
- No DOM growth while scrolling (verify with DevTools).
- Expand/collapse updates are O(visible + changed branch), not O(total).
- Keyboard navigation works and stays within the virtual window.
- Lighthouse/Performance profile shows no long tasks >50ms during scroll.

# File Structure

- `/demo/index.html` — minimal UI with a container and controls.
- `/src/virtualTree.js` — main class.
- `/src/flatten.js` — flattening utilities.
- `/src/utils.js` — math helpers.
- `/styles.css` — lightweight styles.
- `/test/virtualTree.spec.js` — unit tests (use tiny harness; no framework required).
- `/README.md` — usage, perf notes, and extension ideas.

# Implementation Details

- CSS (core):

  - Container: `position: relative; overflow-y: auto; will-change: transform;`
  - Spacer: `position: relative; height: totalItems * rowHeight;`
  - Row:
    - `position: absolute; height: var(--row-h, 20px); line-height: var(--row-h, 20px); width: 100%; white-space: nowrap; text-overflow: ellipsis; overflow: hidden; contain: layout style paint;`

- Scrolling math:

  - `startIndex = clamp(floor(scrollTop / rowHeight) - buffer, 0, total - 1)`
  - `endIndex = min(startIndex + poolSize, total)` where `poolSize = visibleCount + buffer*2`
  - For `i in [0, poolSize)`:
    - `itemIndex = startIndex + i`
    - `row.style.transform = translateY(itemIndex * rowHeight)`

- Flattening:

  - `flattenTree(tree, expanded)` returns visible nodes depth‑first.
  - Keep `expanded` in a `Map<id, boolean>`; never mutate original data.

- Event Handling:

  - Click target detection for icon/text areas (toggle vs select).
  - Keyboard:
    - ArrowUp/Down → ±1 index
    - Home/End → 0 / last
    - PageUp/Down → ±visibleCount
    - Enter/Space on folder → toggle

- Focus Management:

  - Keep a `focusedIndex` separate from selection; ensure the focused row is kept within buffer when updating window.

- A11y (minimal):

  - Container `role="tree"`.
  - Row `role="treeitem"` with `aria-level`, `aria-expanded` (if folder), `tabindex` for the focused one.

# Example Skeleton Code

```html
<div id="tree" class="vtree"></div>
```

```css
.vtree { position: relative; height: 500px; overflow-y: auto; }
.vtree .spacer { position: relative; }
.vtree .row { position: absolute; height: 20px; line-height: 20px; width: 100%; contain: layout style paint; }
```

```js
// src/virtualTree.js
import { flattenTree } from './flatten.js';

export class VirtualTree {
  constructor({ container, data, rowHeight = 20, buffer = 10, onOpen, onSelect }) {
    this.container = container;
    this.rowHeight = rowHeight;
    this.buffer = buffer;
    this.onOpen = onOpen || (() => {});
    this.onSelect = onSelect || (() => {});

    this.expanded = new Map();
    this.spacer = document.createElement('div');
    this.spacer.className = 'spacer';
    this.container.appendChild(this.spacer);

    this.pool = [];
    this.visibleCount = Math.ceil(this.container.clientHeight / this.rowHeight);
    this.poolSize = this.visibleCount + this.buffer * 2;
    for (let i = 0; i < this.poolSize; i++) {
      const row = document.createElement('div');
      row.className = 'row';
      row.dataset.poolIndex = String(i);
      row.addEventListener('click', (e) => this._onRowClick(e, row));
      this.container.appendChild(row);
      this.pool.push(row);
    }

    this.setData(data);
    this._onScroll = this._onScroll.bind(this);
    this.container.addEventListener('scroll', () => requestAnimationFrame(this._onScroll));
  }

  setData(data) {
    this.data = data || [];
    this._recomputeVisible();
    this._render(true);
  }

  toggle(id) { this.expanded.set(id, !this.expanded.get(id)); this._recomputeVisible(); this._render(false); }
  expand(id) { this.expanded.set(id, true); this._recomputeVisible(); this._render(false); }
  collapse(id) { this.expanded.set(id, false); this._recomputeVisible(); this._render(false); }

  _recomputeVisible() {
    this.visible = flattenTree(this.data, this.expanded);
    this.total = this.visible.length;
    this.spacer.style.height = `${this.total * this.rowHeight}px`;
  }

  _onScroll() { this._render(false); }

  _render(force) {
    const { scrollTop, clientHeight } = this.container;
    const startIndex = Math.max(Math.floor(scrollTop / this.rowHeight) - this.buffer, 0);
    const endIndex = Math.min(startIndex + this.poolSize, this.total);

    for (let i = 0; i < this.poolSize; i++) {
      const itemIndex = startIndex + i;
      const row = this.pool[i];
      if (itemIndex >= endIndex) { row.style.display = 'none'; continue; }
      const item = this.visible[itemIndex];
      row.style.display = 'block';
      row.style.transform = `translateY(${itemIndex * this.rowHeight}px)`;
      row.style.paddingLeft = `${item.level * 20 + 8}px`;
      row.textContent = (item.kind === 'folder' ? '📁 ' : '📄 ') + item.name;
      row.dataset.id = item.id;
      row.dataset.index = String(itemIndex);
      row.setAttribute('role', 'treeitem');
      row.setAttribute('aria-level', String(item.level + 1));
    }
  }

  _onRowClick(e, row) {
    const id = row.dataset.id;
    const idx = Number(row.dataset.index);
    const item = this.visible[idx];
    if (item.kind === 'folder') {
      this.toggle(id);
      this.onOpen(item);
    } else {
      this.onSelect(item);
    }
  }

  destroy() {
    this.container.removeEventListener('scroll', this._onScroll);
    this.container.innerHTML = '';
  }
}
```

```js
// src/flatten.js
export function flattenTree(nodes, expandedMap, level = 0, out = []) {
  for (const n of nodes) {
    out.push({ id: n.id, name: n.name, kind: n.kind, level });
    const isFolder = n.kind === 'folder';
    if (isFolder) {
      const isOpen = expandedMap.get(n.id) ?? n.expanded ?? false;
      if (isOpen && Array.isArray(n.children) && n.children.length) {
        flattenTree(n.children, expandedMap, level + 1, out);
      }
    }
  }
  return out;
}
```

# Tests (outline)

- `flattenTree` respects `expandedMap` and preserves DFS order.
- Window math: given `scrollTop`, `rowHeight`, `buffer`, `clientHeight`, compute correct `startIndex`, `endIndex`.
- Pool size stays constant while scrolling; no extra DOM nodes are created.

# README Content (outline)

- How it works (flatten → virtualize → reuse rows).
- Tuning `rowHeight` and `buffer`.
- Known limitations (variable heights, a11y caveats).
- Extension ideas:
  - Variable row heights with an index/accumulator and binary search.
  - Sticky headers for folders.
  - Off‑main‑thread flattening via Web Worker for giant trees.

# Stretch Goals (optional)

- **Canvas mode** behind a flag for 100k+ nodes: render rows on `<canvas>` with manual hit‑testing.
- **Persisted expansion state** (e.g., `localStorage`).
- **TypeScript** typings.

