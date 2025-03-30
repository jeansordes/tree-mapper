import { FileUtils } from '../utils/FileUtils';

describe('FileUtils', () => {
    describe('getNodeDepth', () => {
        it('should return 0 for root level files', () => {
            expect(FileUtils.getPathDepth('test.md')).toBe(0);
            expect(FileUtils.getPathDepth('Notes')).toBe(0);
        });

        it('should return correct depth for nested files', () => {
            expect(FileUtils.getPathDepth('Notes/biblio.md')).toBe(1);
            expect(FileUtils.getPathDepth('Notes/prj.archive-control.md')).toBe(2);
        });

        it('should handle paths with multiple segments', () => {
            expect(FileUtils.getPathDepth('a/b/c/d/file.md')).toBe(4);
        });

        it('should handle paths with no extension', () => {
            expect(FileUtils.getPathDepth('folder/subfolder/file')).toBe(2);
        });

        it('should handle paths with multiple dots', () => {
            expect(FileUtils.getPathDepth('folder/file.name.with.dots.md')).toBe(4);
        });

        it('should handle other extensions than md', () => {
            expect(FileUtils.getPathDepth('folder/file.name.with.dots.pdf')).toBe(4);
            expect(FileUtils.getPathDepth('test.canvas')).toBe(0);
            expect(FileUtils.getPathDepth('file.name.with.dots.canvas')).toBe(3);
        });
    });
}); 