import { TFile, TFolder } from 'obsidian';
import { TreeBuilder } from '../utils/TreeBuilder';
import { TreeNode, TreeNodeType } from '../types';

describe('TreeBuilder', () => {
    let treeBuilder: TreeBuilder;

    beforeEach(() => {
        treeBuilder = new TreeBuilder();
    });

    describe('buildDendronStructure', () => {
        it('should create the expected tree structure for a complex file hierarchy', () => {
            /**
             * Mock folders :
             * x/y/z
             * x/y
             * x
             */
            const folders: TFolder[] = [
                { path: 'x', name: 'x' } as TFolder,
                { path: 'x/y', name: 'y', parent: { path: 'x' } as TFolder } as TFolder,
                { path: 'x/y/z', name: 'z', parent: { path: 'x/y' } as TFolder } as TFolder,
            ];

            /**
             * Mock files :
             * x/y/z/a.b.c.d.canvas
             * x/y/z/a.jpg
             * x/y/z/a.md
             * x/y/z/a.b.c.md
             * x/a.md
             * x/a.b.c.md
             */
            const files: TFile[] = [
                { 
                    path: 'x/y/z/a.b.c.d.canvas',
                    name: 'a.b.c.d.canvas',
                    basename: 'a.b.c.d',
                    extension: 'canvas',
                    parent: { path: 'x/y/z' } as TFolder
                } as TFile,
                {
                    path: 'x/y/z/a.jpg',
                    name: 'a.jpg',
                    basename: 'a',
                    extension: 'jpg',
                    parent: { path: 'x/y/z' } as TFolder
                } as TFile,
                {
                    path: 'x/y/z/a.md',
                    name: 'a.md',
                    basename: 'a',
                    extension: 'md',
                    parent: { path: 'x/y/z' } as TFolder
                } as TFile,
                {
                    path: 'x/y/z/a.b.c.md',
                    name: 'a.b.c.md',
                    basename: 'a.b.c',
                    extension: 'md',
                    parent: { path: 'x/y/z' } as TFolder
                } as TFile,
                {
                    path: 'a.md',
                    name: 'a.md',
                    basename: 'a',
                    extension: 'md',
                    parent: { path: '/' } as TFolder
                } as TFile,
                {
                    path: 'a.b.c.md',
                    name: 'a.b.c.md',
                    basename: 'a.b.c',
                    extension: 'md',
                    parent: { path: '/' } as TFolder
                } as TFile,
            ];

            /**
             * Expected tree :
             * /
             * ├── x/ FOLDER
             * │   └── y/ FOLDER
             * │       └── z/ FOLDER
             * │           ├── a.jpg FILE
             * │           └── a.md FILE
             * │               └── b.md VIRTUAL
             * │                   └── c.md FILE
             * │                       └── a.b.c.d.canvas FILE
             * └── a.md FILE
             *     └── c.md VIRTUAL
             *         └── c.md FILE
             */
            const expectedTree: TreeNode = {
                path: '/',
                nodeType: TreeNodeType.FOLDER,
                children: new Map([
                    ['x', {
                        path: '/x',
                        nodeType: TreeNodeType.FOLDER,
                        children: new Map([
                            ['y', {
                                path: '/x/y',
                                nodeType: TreeNodeType.FOLDER,
                                children: new Map([
                                    ['z', {
                                        path: '/x/y/z',
                                        nodeType: TreeNodeType.FOLDER,
                                        children: new Map(),
                                    }]
                                ]),
                            }]
                        ])
                    }]
                ])
            };
            

            // Build the tree structure
            const rootNode = treeBuilder.buildDendronStructure(folders, files);

            // Debug: Log root node's children
            console.log('Root node children:', Array.from(rootNode.children.keys()));

            // Verify root node
            expect(rootNode.path).toBe('/');
            expect(rootNode.nodeType).toBe(TreeNodeType.FOLDER);
            expect(rootNode.children.size).toBe(2); // 'a' and 'x'

            // Verify root level files
            const rootA = rootNode.children.get('a');
            expect(rootA).toBeDefined();
            expect(rootA?.nodeType).toBe(TreeNodeType.VIRTUAL);
            expect(rootA?.children.size).toBe(2); // 'a.md' and 'a.b'

            // Verify root level a.b.c.md
            const rootAB = rootA?.children.get('b');
            expect(rootAB).toBeDefined();
            expect(rootAB?.nodeType).toBe(TreeNodeType.VIRTUAL);
            const rootABC = rootAB?.children.get('c');
            expect(rootABC).toBeDefined();
            expect(rootABC?.nodeType).toBe(TreeNodeType.VIRTUAL);
            const rootABCFile = rootABC?.children.get('a.b.c.md');
            expect(rootABCFile).toBeDefined();
            expect(rootABCFile?.nodeType).toBe(TreeNodeType.FILE);
            expect(rootABCFile?.path).toBe('a.b.c.md');

            // Verify x/y/z structure
            const xNode = rootNode.children.get('x');
            expect(xNode).toBeDefined();
            expect(xNode?.nodeType).toBe(TreeNodeType.FOLDER);
            
            const yNode = xNode?.children.get('y');
            expect(yNode).toBeDefined();
            expect(yNode?.nodeType).toBe(TreeNodeType.FOLDER);
            
            const zNode = yNode?.children.get('z');
            expect(zNode).toBeDefined();
            expect(zNode?.nodeType).toBe(TreeNodeType.FOLDER);
            expect(zNode?.children.size).toBe(1); // 'a'

            // Verify x/y/z/a structure
            const zANode = zNode?.children.get('a');
            expect(zANode).toBeDefined();
            expect(zANode?.nodeType).toBe(TreeNodeType.VIRTUAL);
            expect(zANode?.children.size).toBe(3); // 'a.md', 'a.jpg', and 'a.b'

            // Verify deepest virtual nodes
            const zABNode = zANode?.children.get('b');
            expect(zABNode).toBeDefined();
            expect(zABNode?.nodeType).toBe(TreeNodeType.VIRTUAL);
            
            const zABCNode = zABNode?.children.get('c');
            expect(zABCNode).toBeDefined();
            expect(zABCNode?.nodeType).toBe(TreeNodeType.VIRTUAL);
            expect(zABCNode?.children.size).toBe(2); // 'a.b.c.md' and 'a.b.c.d'

            const zABCDNode = zABCNode?.children.get('d');
            expect(zABCDNode).toBeDefined();
            expect(zABCDNode?.nodeType).toBe(TreeNodeType.FILE);
            expect(zABCDNode?.path).toBe('x/y/z/a.b.c.d.canvas');
        });
    });
}); 