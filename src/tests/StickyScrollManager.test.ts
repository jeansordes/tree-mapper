import { StickyScrollManager, TreeItem } from '../utils/StickyScrollManager';
import { FileUtils } from '../utils/FileUtils';

describe('StickyScrollManager', () => {
    let manager: StickyScrollManager;

    beforeEach(() => {
        manager = new StickyScrollManager();
    });

    test('should return empty array when no items are visible', () => {
        manager.updateVisibleItems([]);
        expect(manager.getVisibleHeaders()).toEqual([]);
    });

    test('should return no headers for root level item', () => {
        manager.updateVisibleItems([
            { 
                path: 'Notes.md', 
                level: FileUtils.getPathDepth('Notes.md'), 
                isVisible: true, 
                top: 100 
            }
        ]);
        expect(manager.getVisibleHeaders()).toEqual([]);
    });

    test('should return only parent folders for nested folder path', () => {
        manager.updateVisibleItems([
            { 
                path: 'Notes/tech/docs/git.md', 
                level: FileUtils.getPathDepth('Notes/tech/docs/git.md'), 
                isVisible: true, 
                top: 100 
            }
        ]);
        expect(manager.getVisibleHeaders()).toEqual([
            'Notes',
            'Notes/tech',
            'Notes/tech/docs'
        ]);
    });

    test('should return only ancestors for Dendron-style path', () => {
        manager.updateVisibleItems([
            { 
                path: 'Notes/tech/docs/git.commit.conventional.md', 
                level: FileUtils.getPathDepth('Notes/tech/docs/git.commit.conventional.md'), 
                isVisible: true, 
                top: 100 
            }
        ]);
        expect(manager.getVisibleHeaders()).toEqual([
            'Notes',
            'Notes/tech',
            'Notes/tech/docs',
            'Notes/tech/docs/git',
            'Notes/tech/docs/git.commit'
        ]);
    });

    test('should return ancestors of topmost item when multiple items are visible', () => {
        manager.updateVisibleItems([
            { 
                path: 'Notes/tech/docs/git.commit.conventional.md', 
                level: FileUtils.getPathDepth('Notes/tech/docs/git.commit.conventional.md'), 
                isVisible: true, 
                top: 200 
            },
            { 
                path: 'Notes/tools.windows.md', 
                level: FileUtils.getPathDepth('Notes/tools.windows.md'), 
                isVisible: true, 
                top: 100 
            },
            { 
                path: 'Notes/archive.2024.md', 
                level: FileUtils.getPathDepth('Notes/archive.2024.md'), 
                isVisible: true, 
                top: 300 
            }
        ]);
        expect(manager.getVisibleHeaders()).toEqual([
            'Notes',
            'Notes/tools'
        ]);
    });

    test('should handle mixed folder and Dendron paths showing only ancestors', () => {
        manager.updateVisibleItems([
            { 
                path: 'Notes/tech/docs/git.commit.conventional.md', 
                level: FileUtils.getPathDepth('Notes/tech/docs/git.commit.conventional.md'), 
                isVisible: true, 
                top: 100 
            },
            { 
                path: 'Notes/tools.md', 
                level: FileUtils.getPathDepth('Notes/tools.md'), 
                isVisible: true, 
                top: 100 
            }
        ]);
        expect(manager.getVisibleHeaders()).toEqual([
            'Notes',
            'Notes/tech',
            'Notes/tech/docs',
            'Notes/tech/docs/git',
            'Notes/tech/docs/git.commit'
        ]);
    });

    test('should ignore non-visible items and show only ancestors of visible ones', () => {
        manager.updateVisibleItems([
            { 
                path: 'Notes/tech/docs/git.commit.conventional.md', 
                level: FileUtils.getPathDepth('Notes/tech/docs/git.commit.conventional.md'), 
                isVisible: false, 
                top: 50 
            },
            { 
                path: 'Notes/tools.windows.md', 
                level: FileUtils.getPathDepth('Notes/tools.windows.md'), 
                isVisible: true, 
                top: 100 
            },
            { 
                path: 'Notes/archive.2024.md', 
                level: FileUtils.getPathDepth('Notes/archive.2024.md'), 
                isVisible: false, 
                top: 150 
            }
        ]);
        expect(manager.getVisibleHeaders()).toEqual([
            'Notes',
            'Notes/tools'
        ]);
    });

    describe('top position handling', () => {
        test('should select item with smallest top value as reference for headers', () => {
            manager.updateVisibleItems([
                { 
                    path: 'Notes/tech/docs/git.md', 
                    level: FileUtils.getPathDepth('Notes/tech/docs/git.md'),
                    isVisible: true,
                    top: 150  // Middle item
                },
                { 
                    path: 'Notes/tools/windows.md',
                    level: FileUtils.getPathDepth('Notes/tools/windows.md'),
                    isVisible: true,
                    top: 50   // Top item - this should be used for headers
                },
                { 
                    path: 'Notes/archive/2024.md',
                    level: FileUtils.getPathDepth('Notes/archive/2024.md'),
                    isVisible: true,
                    top: 250  // Bottom item
                }
            ]);
            
            // Should show ancestors of 'windows.md' since it has the smallest top value
            expect(manager.getVisibleHeaders()).toEqual([
                'Notes',
                'Notes/tools'
            ]);
        });

        test('should handle negative top values (elements above viewport)', () => {
            manager.updateVisibleItems([
                { 
                    path: 'Notes/tech/docs/git.md', 
                    level: FileUtils.getPathDepth('Notes/tech/docs/git.md'),
                    isVisible: true,
                    top: -50  // Above viewport
                },
                { 
                    path: 'Notes/tools/windows.md',
                    level: FileUtils.getPathDepth('Notes/tools/windows.md'),
                    isVisible: true,
                    top: 0    // At top of viewport
                }
            ]);
            
            // Should show ancestors of 'git.md' since it has the smallest top value
            expect(manager.getVisibleHeaders()).toEqual([
                'Notes',
                'Notes/tech',
                'Notes/tech/docs'
            ]);
        });

        test('should handle elements at same top position', () => {
            manager.updateVisibleItems([
                { 
                    path: 'Notes/tech/docs/git.md', 
                    level: FileUtils.getPathDepth('Notes/tech/docs/git.md'),
                    isVisible: true,
                    top: 100
                },
                { 
                    path: 'Notes/tools/windows.md',
                    level: FileUtils.getPathDepth('Notes/tools/windows.md'),
                    isVisible: true,
                    top: 100  // Same top position
                }
            ]);
            
            // Should use the first item in the array when top values are equal
            expect(manager.getVisibleHeaders()).toEqual([
                'Notes',
                'Notes/tech',
                'Notes/tech/docs'
            ]);
        });

        test('should ignore top values of non-visible items', () => {
            manager.updateVisibleItems([
                { 
                    path: 'Notes/tech/docs/git.md', 
                    level: FileUtils.getPathDepth('Notes/tech/docs/git.md'),
                    isVisible: false,  // Not visible
                    top: 50           // Even though it's higher
                },
                { 
                    path: 'Notes/tools/windows.md',
                    level: FileUtils.getPathDepth('Notes/tools/windows.md'),
                    isVisible: true,
                    top: 100
                }
            ]);
            
            // Should show ancestors of 'windows.md' since it's the only visible item
            expect(manager.getVisibleHeaders()).toEqual([
                'Notes',
                'Notes/tools'
            ]);
        });
    });
}); 