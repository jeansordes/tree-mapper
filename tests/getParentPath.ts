import { NodeType } from "../src/types";
import { getParentPath } from "../src/utils/treeUtils";

const paths = [
    'xana/yolo/zorro/a.b.c.md',
    'xana/yolo/zorro/a.b.md',
    'xana/yolo/zorro/a.md',
    'xana/yolo/zorro/',
    'xana/yolo/a.b.c.md',
    'xana/yolo/a.b.md',
    'xana/yolo/a.md',
    'xana/yolo/',
    'xana/a.b.c.md',
    'xana/a.b.md',
    'xana/a.md',
    'xana/',
    'a.b.c.md',
    'a.b.md',
    'a.md',
    '/',
];
const expected = [
    'xana/yolo/zorro/a.b.c.md -> xana/yolo/zorro/a.b.md',
    'xana/yolo/zorro/a.b.md -> xana/yolo/zorro/a.md',
    'xana/yolo/zorro/a.md -> xana/yolo/zorro/',
    'xana/yolo/zorro/ -> xana/yolo/',
    'xana/yolo/a.b.c.md -> xana/yolo/a.b.md',
    'xana/yolo/a.b.md -> xana/yolo/a.md',
    'xana/yolo/a.md -> xana/yolo/',
    'xana/yolo/ -> xana/',
    'xana/a.b.c.md -> xana/a.b.md',
    'xana/a.b.md -> xana/a.md',
    'xana/a.md -> xana/',
    'xana/ -> /',
    'a.b.c.md -> a.b.md',
    'a.b.md -> a.md',
    'a.md -> /',
    '/ -> /',
];
paths.forEach(path => {
    const result = getParentPath(path, NodeType.FILE);
    console.log(path, '->', result);
});