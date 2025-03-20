import { TFile, TFolder } from "obsidian";
import { NodeType } from "src/types";

export class Tree {
    private pathsByDepthLevel: Map<number, Set<string>> = new Map<number, Set<string>>();
    private nodeTypeByPath = new Map<string, NodeType>();
    private childrenAmountByPath = new Map<string, number>();

    constructor(files: TFile[], folders: TFolder[]) {
        this.updatePathsByDepthLevel(files, folders);
    }

    public updatePathsByDepthLevel(files: TFile[], folders: TFolder[]): void {
        this.pathsByDepthLevel = new Map<number, Set<string>>();
        this.pathsByDepthLevel.set(0, new Set<string>(['/']));
        this.nodeTypeByPath = new Map<string, NodeType>();
        this.childrenAmountByPath = new Map<string, number>();

        const folderPaths = new Set<string>();
        this.registerNode('/', 0);
        folderPaths.add('/');
        for (const folder of folders) {
            folderPaths.add(folder.path);
            const depth = folder.path.split('/').length;
            this.registerNode(folder.path, depth);
        }

        for (const file of files) {
            const folderDepth = file.parent!.path === '/' ? 0 : file.parent!.path.split('/').length;
            const fileDepth = file.basename.split('.').length;
            const depth = folderDepth + fileDepth;

            // File registration
            this.registerNode(file.path, depth);

            // If the file contains dots, we add the VIRTUAL paths
            if (fileDepth > 1) {
                let virtualPath = this.getParentPath(file.path);
                let virtualDepth = depth - 1;
                while (!folderPaths.has(virtualPath)) {
                    this.registerNode(virtualPath, virtualDepth);
                    virtualPath = this.getParentPath(virtualPath);
                    virtualDepth--;
                }
            }
        }

        this.nodeTypeByPath.set('/', NodeType.FOLDER);
        for (const folder of folders) {
            this.nodeTypeByPath.set(folder.path, NodeType.FOLDER);
        }
        for (const file of files) {
            this.nodeTypeByPath.set(file.path, NodeType.FILE);
        }
        for (const nodePath of this.nodeTypeByPath.keys()) {
            const parentPath = this.getParentPath(nodePath);
            
            if (nodePath !== '/') {
                const amount = this.childrenAmountByPath.get(parentPath);
                this.childrenAmountByPath.set(parentPath, amount + 1);
            }
        }
    }

    private registerNode(path: string, depth: number, type: NodeType = NodeType.VIRTUAL): void {
        if (!this.pathsByDepthLevel.has(depth)) {
            this.pathsByDepthLevel.set(depth, new Set<string>());
        }
        this.pathsByDepthLevel.get(depth)!.add(path);

        this.nodeTypeByPath.set(path, type);
        this.childrenAmountByPath.set(path, 0);
    }

    public getParentPath(path: string): string {
        const nodeType = this.nodeTypeByPath.get(path);
        if (nodeType !== undefined && nodeType === NodeType.FOLDER) {
            const result = path.replace(/[\/]?[^\/]*$/, '');
            return result === '' ? '/' : result;
        }

        // if it's not a FOLDER, then it's FILE or VIRTUAL
        let result = path.replace(/(\/|^)[^\.\/]+.md$/, '');
        result = result === '' ? '/' : result.replace(/\.[^\.]+\.md$/, '.md');
        return result;
    }

    // Getters - All
    public getAllPathsByDepthLevel(): Map<number, Set<string>> {
        return this.pathsByDepthLevel;
    }

    public getAllNodesType(): Map<string, NodeType> {
        return this.nodeTypeByPath;
    }

    public getAllChildrenAmountByPath(): Map<string, number> {
        return this.childrenAmountByPath;
    }

    // Getters - Single
    public getNodeType(path: string): NodeType {
        return this.nodeTypeByPath.get(path) ?? NodeType.VIRTUAL;
    }

    public getChildrenAmount(path: string): number {
        return this.childrenAmountByPath.get(path) ?? 0;
    }
}