/* eslint-env browser */
/* global document, requestAnimationFrame */
import { flattenTree } from './flatten.js';
import { computeWindow } from './utils.js';

export class VirtualTree {
  constructor({ container, data = [], rowHeight = 20, buffer = 10, onOpen, onSelect }) {
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
    this._render();
  }

  toggle(id) { this.expanded.set(id, !this.expanded.get(id)); this._recomputeVisible(); this._render(); }
  expand(id) { this.expanded.set(id, true); this._recomputeVisible(); this._render(); }
  collapse(id) { this.expanded.set(id, false); this._recomputeVisible(); this._render(); }

  _recomputeVisible() {
    this.visible = flattenTree(this.data, this.expanded);
    this.total = this.visible.length;
    this.spacer.style.height = `${this.total * this.rowHeight}px`;
  }

  _onScroll() { this._render(); }

  _render() {
    const { scrollTop, clientHeight } = this.container;
    const { startIndex, endIndex } = computeWindow(scrollTop, this.rowHeight, this.buffer, clientHeight, this.total, this.poolSize);

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
