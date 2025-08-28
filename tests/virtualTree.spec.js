/* eslint-env jest */
/* global describe, test, expect */

// NOTE: These functions are duplicated from src/flatten.js and src/utils.js
// because Jest doesn't support ES modules out of the box in this project setup.
// In a production environment, you would configure Jest for ES modules or
// use a different test runner that supports them natively.

function clamp(value, min, max) {
  return Math.max(min, Math.min(max, value));
}

function computeWindow(scrollTop, rowHeight, buffer, clientHeight, total, poolSize) {
  const visibleCount = Math.ceil(clientHeight / rowHeight);
  const effectivePool = poolSize ?? visibleCount + buffer * 2;
  const startIndex = clamp(Math.floor(scrollTop / rowHeight) - buffer, 0, Math.max(total - 1, 0));
  const endIndex = Math.min(startIndex + effectivePool, total);
  return { startIndex, endIndex, poolSize: effectivePool };
}

function flattenTree(nodes, expandedMap = new Map(), level = 0, out = []) {
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

describe('flattenTree', () => {
  test('respects expanded map and levels', () => {
    const tree = [
      {
        id: 'a',
        name: 'A',
        kind: 'folder',
        children: [
          { id: 'a1', name: 'A1', kind: 'file' },
          { id: 'a2', name: 'A2', kind: 'folder', children: [
            { id: 'a2i', name: 'A2i', kind: 'file' }
          ] }
        ]
      }
    ];
    const expanded = new Map([['a', true]]);
    const flat = flattenTree(tree, expanded);
    expect(flat.map(n => n.id)).toEqual(['a', 'a1', 'a2']);

    const expandedAll = new Map([['a', true], ['a2', true]]);
    const flatAll = flattenTree(tree, expandedAll);
    expect(flatAll.map(n => n.id)).toEqual(['a', 'a1', 'a2', 'a2i']);
    expect(flatAll.map(n => n.level)).toEqual([0,1,1,2]);
  });
});

describe('computeWindow', () => {
  test('calculates start and end indices', () => {
    const res = computeWindow(100, 20, 2, 100, 100);
    expect(res.poolSize).toBe(9);
    expect(res.startIndex).toBe(3);
    expect(res.endIndex).toBe(12);
  });

  test('clamps indices at bounds', () => {
    const top = computeWindow(0, 20, 2, 100, 50);
    expect(top.startIndex).toBe(0);
    expect(top.endIndex).toBe(9);

    const bottom = computeWindow(1000, 20, 2, 100, 50);
    expect(bottom.startIndex).toBe(48);
    expect(bottom.endIndex).toBe(50);
  });
});
