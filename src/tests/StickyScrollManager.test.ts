import { StickyScrollManager } from '../utils/StickyScrollManager';

describe('StickyScrollManager', () => {
    describe('getAncestorPaths', () => {
        test('should return empty array for root level file', () => {
            expect(StickyScrollManager.getAncestorPaths('Notes.md')).toEqual([]);
        });

        test('should return folder ancestors for nested folder path', () => {
            expect(StickyScrollManager.getAncestorPaths('Notes/tech/docs/git.md')).toEqual([
                'Notes',
                'Notes/tech',
                'Notes/tech/docs'
            ]);
        });

        test('should return ancestors for Dendron-style path', () => {
            expect(StickyScrollManager.getAncestorPaths('Notes/tech/docs/git.commit.conventional.md')).toEqual([
                'Notes',
                'Notes/tech',
                'Notes/tech/docs',
                'Notes/tech/docs/git.md',
                'Notes/tech/docs/git.commit.md'
            ]);
        });

        test('should handle path with no extension', () => {
            expect(StickyScrollManager.getAncestorPaths('Notes/tech/docs/git')).toEqual([
                'Notes',
                'Notes/tech',
                'Notes/tech/docs'
            ]);
        });

        test('should handle path with multiple dots in extension', () => {
            expect(StickyScrollManager.getAncestorPaths('Notes/tech/docs/git.commit.conventional.md')).toEqual([
                'Notes',
                'Notes/tech',
                'Notes/tech/docs',
                'Notes/tech/docs/git.md',
                'Notes/tech/docs/git.commit.md'
            ]);
        });

        test('should handle root level Dendron-style path', () => {
            expect(StickyScrollManager.getAncestorPaths('git.commit.conventional.md')).toEqual([
                'git.md',
                'git.commit.md'
            ]);
        });

        test('should handle path with mixed folder and dot notation', () => {
            expect(StickyScrollManager.getAncestorPaths('Notes/tech/docs.git.commit.md')).toEqual([
                'Notes',
                'Notes/tech',
                'Notes/tech/docs.md',
                'Notes/tech/docs.git.md',
            ]);
        });
    });
}); 