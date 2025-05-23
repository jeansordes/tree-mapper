import { TFile, TFolder } from 'obsidian';
import { TreeNode, TreeNodeType } from 'src/types';
import { FileUtils } from './FileUtils';

export class TreeBuilder {
    private pathsByDepthLevel: Map<number, Set<string>> = new Map<number, Set<string>>();
    private nodeTypeByPath = new Map<string, TreeNodeType>();
    private childrenAmountByPath = new Map<string, number>();

    /**
     * Creates an empty DendronNode with default values
     */
    private createDendronNode(options: Partial<TreeNode> = {}): TreeNode {
        return {
            path: '',
            children: new Map<string, TreeNode>(),
            nodeType: TreeNodeType.VIRTUAL,
            ...options
        };
    }

    public buildDendronStructure(folders: TFolder[], files: TFile[]): TreeNode {
        this.buildPathsByDepthLevel(files, folders);
        const rootNode = this.createDendronNode({
            path: '/',
            nodeType: TreeNodeType.FOLDER,
        });

        // Create a map to quickly look up nodes by path
        const nodesByPath = new Map<string, TreeNode>();
        nodesByPath.set('/', rootNode);

        // Process each depth level in ascending order to ensure parents are created before children
        for (let depth = 0; depth < this.pathsByDepthLevel.size; depth++) {
            const paths = this.pathsByDepthLevel.get(depth);
            if (!paths) continue;

            for (const path of paths) {
                // Skip root node as we already created it
                if (path === '/') continue;

                const parentPath = this.getParentPath(path);
                const parentNode = nodesByPath.get(parentPath);

                // Create the node
                const node = this.createDendronNode({
                    path: path,
                    nodeType: this.getNodeType(path),
                    // For FILE nodes, store the Obsidian resource
                    obsidianResource: this.getNodeType(path) === TreeNodeType.FILE ?
                        files.find(f => f.path === path) :
                        (this.getNodeType(path) === TreeNodeType.FOLDER ? folders.find(f => f.path === path) : undefined)
                });

                // Add to parent's children - use full path as key to avoid collisions
                const basename = FileUtils.basename(path);
                let uniqueKey = basename;
                let counter = 1;
                while (parentNode?.children.has(uniqueKey)) {
                    counter++;
                    uniqueKey = `${basename} (${counter})`;
                }
                parentNode?.children.set(uniqueKey, node);

                // Add to our lookup map
                nodesByPath.set(path, node);
            }
        }

        return rootNode;
    }

    public buildPathsByDepthLevel(files: TFile[], folders: TFolder[]): Map<number, Set<string>> {
        this.pathsByDepthLevel = new Map<number, Set<string>>();
        this.nodeTypeByPath = new Map<string, TreeNodeType>();
        this.childrenAmountByPath = new Map<string, number>();

        // Set root folder
        this.registerNode('/', 0, TreeNodeType.FOLDER);

        const folderPaths = new Set<string>();
        // Register all folders first
        for (const folder of folders) {
            this.nodeTypeByPath.set(folder.path, TreeNodeType.FOLDER);
            folderPaths.add(folder.path);
            const depth = folder.path === '/' ? 0 : folder.path.split('/').length;
            this.registerNode(folder.path, depth, TreeNodeType.FOLDER);
        }

        // Set to track processed paths to avoid duplicates
        const processedPaths = new Set<string>();

        for (const file of files) {
            this.nodeTypeByPath.set(file.path, TreeNodeType.FILE);
            if (processedPaths.has(file.path)) continue;
            processedPaths.add(file.path);

            const folderDepth = file.parent!.path === '/' ? 0 : file.parent!.path.split('/').length;
            const fileDepth = file.basename.split('.').length;
            const depth = folderDepth + fileDepth;

            // File registration
            this.registerNode(file.path, depth, TreeNodeType.FILE);

            // If the file contains dots, we add the VIRTUAL paths
            if (fileDepth > 1) {
                let virtualPath = this.getParentPath(file.path);
                let virtualDepth = depth - 1;

                while (!folderPaths.has(virtualPath) &&
                    virtualPath !== '/' &&
                    !processedPaths.has(virtualPath)) {

                    processedPaths.add(virtualPath);
                    this.registerNode(virtualPath, virtualDepth, TreeNodeType.VIRTUAL);

                    // Get next parent
                    const nextParent = this.getParentPath(virtualPath);

                    // Break if we're not making progress (safeguard)
                    if (nextParent === virtualPath) {
                        break;
                    }

                    virtualPath = nextParent;
                    virtualDepth--;
                }
            }
        }

        // Update children counts
        for (const nodePath of this.nodeTypeByPath.keys()) {
            const parentPath = this.getParentPath(nodePath);

            if (nodePath !== '/' && parentPath) {
                const amount = this.childrenAmountByPath.get(parentPath) ?? 0;
                this.childrenAmountByPath.set(parentPath, amount + 1);
            }
        }

        return this.pathsByDepthLevel;
    }

    private registerNode(path: string, depth: number, type: TreeNodeType = TreeNodeType.VIRTUAL): void {
        // Skip if this path/depth combination is already registered
        if (this.pathsByDepthLevel.has(depth) &&
            this.pathsByDepthLevel.get(depth)!.has(path)) {
            return;
        }

        // Skip clearly invalid paths
        if (!path || path === '') {
            return;
        }

        if (!this.pathsByDepthLevel.has(depth)) {
            this.pathsByDepthLevel.set(depth, new Set<string>());
        }
        this.pathsByDepthLevel.get(depth)!.add(path);

        // Only set the node type if it wasn't already set or if we're upgrading from VIRTUAL
        const existingType = this.nodeTypeByPath.get(path);
        if (!existingType || (existingType === TreeNodeType.VIRTUAL && type !== TreeNodeType.VIRTUAL)) {
            this.nodeTypeByPath.set(path, type);
        }

        // Initialize the children count if not already set
        if (!this.childrenAmountByPath.has(path)) {
            this.childrenAmountByPath.set(path, 0);
        }
    }

    public getParentPath(path: string): string {
        const nodeType = this.getNodeType(path);
        if (nodeType === TreeNodeType.FOLDER) {
            const result = path.replace(/[/]?[^/]*$/, '');
            return result === '' ? '/' : result;
        }

        // if it's not a FOLDER, then it's FILE or VIRTUAL
        // remove the file name if not dots
        let result = path.replace(/(\/|^)[^./]+\.[^.]+$/, '');
        // otherwise, remove the last part of the dendron path and ensure .md extension for virtual nodes
        result = result === '' ? '/' : result.replace(/\.[^.]+(\.[^.]+)$/, '.md');
        return result;
    }

    public getNodeType(path: string): TreeNodeType {
        return this.nodeTypeByPath.get(path) ?? TreeNodeType.VIRTUAL;
    }

    public getChildrenAmount(path: string): number {
        return this.childrenAmountByPath.get(path) ?? 0;
    }
}