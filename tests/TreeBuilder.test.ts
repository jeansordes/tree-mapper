import { TFile, TFolder } from 'obsidian';
import { TreeBuilder } from '../src/utils/TreeBuilder';
import { TreeNodeType } from '../src/types';
import { createMockFile, createMockFolder } from './setup';

describe('TreeBuilder', () => {
    let treeBuilder: TreeBuilder;

    beforeEach(() => {
        treeBuilder = new TreeBuilder();
    });

    describe('buildDendronStructure', () => {
        it('should create the expected tree structure for a complex file hierarchy', () => {
            // Create mock folders
            const folderX = createMockFolder('x');
            const folderY = createMockFolder('x/y', undefined, folderX);
            const folderZ = createMockFolder('x/y/z', undefined, folderY);
            const folders = [folderX, folderY, folderZ];

            // Create mock files
            const files = [
                createMockFile('x/file1.md', undefined, folderX),
                createMockFile('x/y/file2.md', undefined, folderY),
                createMockFile('x/y/z/file3.md', undefined, folderZ)
            ];

            // Build the tree structure
            const rootNode = treeBuilder.buildDendronStructure(folders, files);

            // Verify root node
            expect(rootNode.path).toBe('/');
            expect(rootNode.nodeType).toBe(TreeNodeType.FOLDER);
            expect(rootNode.children.size).toBe(1);

            // Verify x folder
            const xNode = rootNode.children.get('x');
            expect(xNode).toBeDefined();
            expect(xNode?.path).toBe('x');
            expect(xNode?.nodeType).toBe(TreeNodeType.FOLDER);
            expect(xNode?.children.size).toBe(2); // file1.md and y folder

            // Verify y folder
            const yNode = xNode?.children.get('y');
            expect(yNode).toBeDefined();
            expect(yNode?.path).toBe('x/y');
            expect(yNode?.nodeType).toBe(TreeNodeType.FOLDER);
            expect(yNode?.children.size).toBe(2); // file2.md and z folder

            // Verify z folder
            const zNode = yNode?.children.get('z');
            expect(zNode).toBeDefined();
            expect(zNode?.path).toBe('x/y/z');
            expect(zNode?.nodeType).toBe(TreeNodeType.FOLDER);
            expect(zNode?.children.size).toBe(1); // file3.md

            // Verify files
            expect(xNode?.children.get('file1.md')?.nodeType).toBe(TreeNodeType.FILE);
            expect(yNode?.children.get('file2.md')?.nodeType).toBe(TreeNodeType.FILE);
            expect(zNode?.children.get('file3.md')?.nodeType).toBe(TreeNodeType.FILE);
        });

        it('should handle empty folders', () => {
            const emptyFolder = createMockFolder('empty');
            const rootNode = treeBuilder.buildDendronStructure([emptyFolder], []);

            expect(rootNode.path).toBe('/');
            expect(rootNode.children.size).toBe(1);
            
            const emptyNode = rootNode.children.get('empty');
            expect(emptyNode).toBeDefined();
            expect(emptyNode?.path).toBe('empty');
            expect(emptyNode?.nodeType).toBe(TreeNodeType.FOLDER);
            expect(emptyNode?.children.size).toBe(0);
        });

        it('should handle files without folders', () => {
            // Create a root folder for the file
            const rootFolder = { path: '/', name: '/' } as TFolder;
            const rootFile = { 
                path: 'root.md', 
                basename: 'root.md',
                parent: rootFolder
            } as TFile;

            const rootNode = treeBuilder.buildDendronStructure([rootFolder], [rootFile]);

            expect(rootNode.path).toBe('/');
            expect(rootNode.children.size).toBe(0); // Root node has no children since file is not processed

            // The file should not be in the tree since it's not in a folder
            const fileNode = rootNode.children.get('root.md');
            expect(fileNode).toBeUndefined();
        });

        it('should handle empty input', () => {
            const rootNode = treeBuilder.buildDendronStructure([], []);

            expect(rootNode.path).toBe('/');
            expect(rootNode.nodeType).toBe(TreeNodeType.FOLDER);
            expect(rootNode.children.size).toBe(0);
        });

        it('should handle files with dots in their names', () => {
            // Create a root folder for the file
            const rootFolder = { path: '/', name: '/' } as TFolder;
            const file = { 
                path: 'hello.world.md', 
                basename: 'hello.world.md',
                parent: rootFolder
            } as TFile;

            const rootNode = treeBuilder.buildDendronStructure([rootFolder], [file]);

            // Log the actual structure for debugging
            console.log('\nDebug tree structure:');
            console.log('Root node:', {
                path: rootNode.path,
                children: Array.from(rootNode.children.entries()).map(([key, node]) => ({
                    key,
                    path: node.path,
                    type: node.nodeType,
                    children: Array.from(node.children.entries()).map(([k, n]) => ({
                        key: k,
                        path: n.path,
                        type: n.nodeType
                    }))
                }))
            });

            // Log the internal state
            console.log('Internal nodeTypeByPath:', Array.from(treeBuilder['nodeTypeByPath'].entries()));
            console.log('Internal pathsByDepthLevel:', Array.from(treeBuilder['pathsByDepthLevel'].entries()).map(([depth, paths]) => ({
                depth,
                paths: Array.from(paths)
            })));

            // Verify root structure
            expect(rootNode.path).toBe('/');
            expect(rootNode.children.size).toBe(1);

            // Verify the virtual node is created
            const virtualNode = rootNode.children.get('hello.md');
            expect(virtualNode).toBeDefined();
            expect(virtualNode?.nodeType).toBe(TreeNodeType.VIRTUAL);
            expect(virtualNode?.path).toBe('hello.md');
            expect(virtualNode?.children.size).toBe(0);

            // Verify that nodes exist in the internal state
            expect(treeBuilder['nodeTypeByPath'].get('hello.md')).toBe(TreeNodeType.VIRTUAL);
            expect(treeBuilder['nodeTypeByPath'].get('hello.world.md')).toBe(TreeNodeType.FILE);
        });

        it('should handle duplicate virtual paths', () => {
            const rootFolder = { path: '/', name: '/' } as TFolder;
            const files = [
                { path: 'hello.world.md', basename: 'hello.world.md', parent: rootFolder } as TFile,
                { path: 'hello.universe.md', basename: 'hello.universe.md', parent: rootFolder } as TFile
            ];

            const rootNode = treeBuilder.buildDendronStructure([rootFolder], files);

            // Log the actual structure and internal state
            console.log('\nDebug tree structure for duplicate paths:');
            console.log('Internal nodeTypeByPath:', Array.from(treeBuilder['nodeTypeByPath'].entries()));
            console.log('Internal pathsByDepthLevel:', Array.from(treeBuilder['pathsByDepthLevel'].entries()).map(([depth, paths]) => ({
                depth,
                paths: Array.from(paths)
            })));

            // Verify root structure
            expect(rootNode.path).toBe('/');
            expect(rootNode.children.size).toBe(1);

            // Verify the virtual node
            const virtualNode = rootNode.children.get('hello.md');
            expect(virtualNode).toBeDefined();
            expect(virtualNode?.nodeType).toBe(TreeNodeType.VIRTUAL);
            expect(virtualNode?.path).toBe('hello.md');
            expect(virtualNode?.children.size).toBe(0);

            // Verify that nodes exist in the internal state
            expect(treeBuilder['nodeTypeByPath'].get('hello.md')).toBe(TreeNodeType.VIRTUAL);
            expect(treeBuilder['nodeTypeByPath'].get('hello.world.md')).toBe(TreeNodeType.FILE);
            expect(treeBuilder['nodeTypeByPath'].get('hello.universe.md')).toBe(TreeNodeType.FILE);
        });

        it('should handle virtual paths', () => {
            // Create the folder structure
            const rootFolder = { path: '/', name: '/' } as TFolder;
            const xFolder = { path: 'x', name: 'x', parent: rootFolder } as TFolder;
            const yFolder = { path: 'x/y', name: 'y', parent: xFolder } as TFolder;

            const file = { 
                path: 'x/y/test.spec.ts', 
                basename: 'test.spec.ts',
                parent: yFolder
            } as TFile;

            const rootNode = treeBuilder.buildDendronStructure([rootFolder, xFolder, yFolder], [file]);

            // Log the actual structure and internal state
            console.log('\nDebug tree structure for nested paths:');
            console.log('Internal nodeTypeByPath:', Array.from(treeBuilder['nodeTypeByPath'].entries()));
            console.log('Internal pathsByDepthLevel:', Array.from(treeBuilder['pathsByDepthLevel'].entries()).map(([depth, paths]) => ({
                depth,
                paths: Array.from(paths)
            })));

            // Verify the folder structure
            const xNode = rootNode.children.get('x');
            expect(xNode).toBeDefined();
            expect(xNode?.nodeType).toBe(TreeNodeType.FOLDER);

            const yNode = xNode?.children.get('y');
            expect(yNode).toBeDefined();
            expect(yNode?.nodeType).toBe(TreeNodeType.FOLDER);
            expect(yNode?.children.size).toBe(1);

            // Verify the virtual node
            const virtualNode = yNode?.children.get('test.md');
            expect(virtualNode).toBeDefined();
            expect(virtualNode?.nodeType).toBe(TreeNodeType.VIRTUAL);
            expect(virtualNode?.path).toBe('x/y/test.md');
            expect(virtualNode?.children.size).toBe(0);

            // Verify that nodes exist in the internal state
            expect(treeBuilder['nodeTypeByPath'].get('x/y/test.md')).toBe(TreeNodeType.VIRTUAL);
        });

        it('should handle circular parent paths', () => {
            // Create a root folder for the file
            const rootFolder = { path: '/', name: '/' } as TFolder;
            const file = { 
                path: 'test.ts', 
                basename: 'test.ts',
                parent: rootFolder
            } as TFile;

            const rootNode = treeBuilder.buildDendronStructure([rootFolder], [file]);

            // Log the actual structure and internal state
            console.log('\nDebug tree structure for circular paths:');
            console.log('Internal nodeTypeByPath:', Array.from(treeBuilder['nodeTypeByPath'].entries()));
            console.log('Internal pathsByDepthLevel:', Array.from(treeBuilder['pathsByDepthLevel'].entries()).map(([depth, paths]) => ({
                depth,
                paths: Array.from(paths)
            })));

            // Verify root structure
            expect(rootNode.path).toBe('/');
            expect(rootNode.children.size).toBe(0);

            // Verify that the file exists in the internal state
            expect(treeBuilder['nodeTypeByPath'].get('test.ts')).toBe(TreeNodeType.FILE);
        });
    });

    describe('getParentPath', () => {
        it('should handle folder paths', () => {
            const treeBuilder = new TreeBuilder();
            const rootFolder = { path: '/', name: '/' } as TFolder;
            const xFolder = { path: 'x', name: 'x', parent: rootFolder } as TFolder;
            const yFolder = { path: 'x/y', name: 'y', parent: xFolder } as TFolder;
            const zFolder = { path: 'x/y/z', name: 'z', parent: yFolder } as TFolder;

            treeBuilder.buildDendronStructure([rootFolder, xFolder, yFolder, zFolder], []);

            expect(treeBuilder['getParentPath']('x/y/z')).toBe('x/y');
            expect(treeBuilder['getParentPath']('x/y')).toBe('x');
            expect(treeBuilder['getParentPath']('x')).toBe('/');
        });

        it('should handle file paths', () => {
            const treeBuilder = new TreeBuilder();
            const rootFolder = { path: '/', name: '/' } as TFolder;
            const xFolder = { path: 'x', name: 'x', parent: rootFolder } as TFolder;
            const yFolder = { path: 'x/y', name: 'y', parent: xFolder } as TFolder;

            const file = { 
                path: 'x/y/test.ts', 
                basename: 'test.ts',
                parent: yFolder
            } as TFile;

            console.log('\n=== Test: should handle file paths ===');
            console.log('Input structure:', {
                folders: [
                    { path: rootFolder.path, name: rootFolder.name, parent: rootFolder.parent?.path },
                    { path: xFolder.path, name: xFolder.name, parent: xFolder.parent?.path },
                    { path: yFolder.path, name: yFolder.name, parent: yFolder.parent?.path }
                ],
                file: { path: file.path, basename: file.basename, parent: file.parent?.path }
            });

            treeBuilder.buildDendronStructure([rootFolder, xFolder, yFolder], [file]);

            console.log('getParentPath result:', treeBuilder['getParentPath']('x/y/test.ts'));
            console.log('nodeType for x/y/test.ts:', treeBuilder['nodeTypeByPath'].get('x/y/test.ts'));

            expect(treeBuilder['getParentPath']('x/y/test.ts')).toBe('x/y');
        });

        it('should handle virtual paths', () => {
            const treeBuilder = new TreeBuilder();
            const rootFolder = { path: '/', name: '/' } as TFolder;
            const xFolder = { path: 'x', name: 'x', parent: rootFolder } as TFolder;
            const yFolder = { path: 'x/y', name: 'y', parent: xFolder } as TFolder;

            const file = { 
                path: 'x/y/test.spec.ts', 
                basename: 'test.spec.ts',
                parent: yFolder
            } as TFile;

            console.log('\n=== Test: should handle virtual paths ===');
            console.log('Input structure:', {
                folders: [
                    { path: rootFolder.path, name: rootFolder.name, parent: rootFolder.parent?.path },
                    { path: xFolder.path, name: xFolder.name, parent: xFolder.parent?.path },
                    { path: yFolder.path, name: yFolder.name, parent: yFolder.parent?.path }
                ],
                file: { path: file.path, basename: file.basename, parent: file.parent?.path }
            });

            treeBuilder.buildDendronStructure([rootFolder, xFolder, yFolder], [file]);

            console.log('getParentPath result:', treeBuilder['getParentPath']('x/y/test.spec.ts'));
            console.log('nodeType for x/y/test.spec.ts:', treeBuilder['nodeTypeByPath'].get('x/y/test.spec.ts'));
            console.log('nodeType for x/y/test.ts:', treeBuilder['nodeTypeByPath'].get('x/y/test.ts'));

            // For virtual paths, getParentPath should return the path with .md extension
            expect(treeBuilder['getParentPath']('x/y/test.spec.ts')).toBe('x/y/test.md');
        });

        it('should handle root path', () => {
            const treeBuilder = new TreeBuilder();
            expect(treeBuilder['getParentPath']('/')).toBe('/');
        });
    });

    describe('getNodeType and getChildrenAmount', () => {
        let treeBuilder: TreeBuilder;
        let folders: TFolder[];
        let files: TFile[];

        beforeEach(() => {
            treeBuilder = new TreeBuilder();
            
            // Setup test data with proper parent relationships
            const rootFolder = { path: '/', name: '/' } as TFolder;
            const xFolder = { path: 'x', name: 'x', parent: rootFolder } as TFolder;
            folders = [rootFolder, xFolder];
            
            files = [
                { path: 'x/test.spec.ts', basename: 'test.spec.ts', parent: xFolder } as TFile
            ];

            // Build initial structure
            treeBuilder.buildPathsByDepthLevel(files, folders);
            treeBuilder.buildDendronStructure(folders, files);
        });

        it('should return correct node types', () => {
            expect(treeBuilder.getNodeType('/')).toBe(TreeNodeType.FOLDER);
            expect(treeBuilder.getNodeType('x')).toBe(TreeNodeType.FOLDER);
            expect(treeBuilder.getNodeType('x/test.spec.ts')).toBe(TreeNodeType.FILE);
            expect(treeBuilder.getNodeType('nonexistent')).toBe(TreeNodeType.VIRTUAL);
        });

        it('should return correct children amounts', () => {
            expect(treeBuilder.getChildrenAmount('/')).toBe(1);           // x folder
            expect(treeBuilder.getChildrenAmount('x')).toBe(1);          // test.spec.ts file
            expect(treeBuilder.getChildrenAmount('x/test.spec.ts')).toBe(0); // file has no children
            expect(treeBuilder.getChildrenAmount('nonexistent')).toBe(0);
        });
    });

    describe('getParentPath for virtual paths', () => {
        it('should handle virtual paths', () => {
            const treeBuilder = new TreeBuilder();
            const rootFolder = { path: '/', name: '/' } as TFolder;
            const xFolder = { path: 'x', name: 'x', parent: rootFolder } as TFolder;
            const yFolder = { path: 'x/y', name: 'y', parent: xFolder } as TFolder;

            const file = { 
                path: 'x/y/test.spec.ts', 
                basename: 'test.spec.ts',
                parent: yFolder
            } as TFile;

            treeBuilder.buildDendronStructure([rootFolder, xFolder, yFolder], [file]);

            // For virtual paths, getParentPath should return the path with .md extension
            expect(treeBuilder['getParentPath']('x/y/test.spec.ts')).toBe('x/y/test.md');
        });
    });
}); 