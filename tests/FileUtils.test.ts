import { App, Notice, TFile, WorkspaceLeaf } from 'obsidian';
import { FileUtils } from '../src/utils/FileUtils';
import { createMockApp, createMockFile } from './setup';

// Mock the i18n function
jest.mock('src/i18n', () => ({
    t: (key: string, params?: Record<string, string>) => {
        if (key === 'untitledPath') return 'untitled';
        if (key === 'noticeCreatedNote') return `Created note at ${params?.path}`;
        if (key === 'noticeFailedCreateNote') return `Failed to create note at ${params?.path}`;
        return key;
    }
}));

// Mock Obsidian classes
jest.mock('obsidian', () => {
    const original = jest.requireActual('obsidian');
    return {
        ...original,
        Notice: jest.fn().mockImplementation(() => ({
            setMessage: jest.fn(),
            hide: jest.fn()
        })),
        WorkspaceLeaf: jest.fn().mockImplementation(() => ({
            openFile: jest.fn()
        }))
    };
});

describe('FileUtils', () => {
    describe('basename', () => {
        it('should handle Unix-style paths', () => {
            expect(FileUtils.basename('/path/to/file.txt')).toBe('file.txt');
            expect(FileUtils.basename('path/to/file.txt')).toBe('file.txt');
            expect(FileUtils.basename('file.txt')).toBe('file.txt');
        });

        it('should handle Windows-style paths', () => {
            expect(FileUtils.basename('C:\\path\\to\\file.txt')).toBe('file.txt');
            expect(FileUtils.basename('path\\to\\file.txt')).toBe('file.txt');
        });

        it('should handle empty paths', () => {
            expect(FileUtils.basename('')).toBe('');
        });

        it('should handle paths ending with separator', () => {
            expect(FileUtils.basename('/path/to/')).toBe('');
            expect(FileUtils.basename('C:\\path\\to\\')).toBe('');
        });
    });

    describe('getChildPath', () => {
        it('should create child path for files with extension', () => {
            expect(FileUtils.getChildPath('test.md')).toBe('test.untitled.md');
            expect(FileUtils.getChildPath('folder/test.txt')).toBe('folder/test.untitled.txt');
        });

        it('should preserve directory structure', () => {
            expect(FileUtils.getChildPath('/path/to/test.md')).toBe('/path/to/test.untitled.md');
        });
    });

    describe('createAndOpenNote', () => {
        let app: App;

        beforeEach(() => {
            app = createMockApp();
            jest.clearAllMocks();
        });

        it('should create and open a new note', async () => {
            const path = 'test.md';
            const createSpy = jest.spyOn(app.vault, 'create');
            const openSpy = jest.spyOn(FileUtils, 'openFile');

            await FileUtils.createAndOpenNote(app, path);

            expect(createSpy).toHaveBeenCalledWith(path, '');
            expect(Notice).toHaveBeenCalled();
            expect(openSpy).toHaveBeenCalled();
        });

        it('should handle existing notes', async () => {
            const path = 'existing.md';
            const existingFile = createMockFile(path);
            jest.spyOn(app.vault, 'getAbstractFileByPath').mockReturnValue(existingFile);
            
            const createSpy = jest.spyOn(app.vault, 'create');
            const openSpy = jest.spyOn(FileUtils, 'openFile');

            await FileUtils.createAndOpenNote(app, path);

            expect(createSpy).not.toHaveBeenCalled();
            expect(openSpy).toHaveBeenCalledWith(app, existingFile);
        });

        it('should handle creation failures', async () => {
            const path = 'error.md';
            jest.spyOn(app.vault, 'create').mockRejectedValue(new Error('Failed to create'));

            await FileUtils.createAndOpenNote(app, path);

            expect(Notice).toHaveBeenCalled();
        });
    });

    describe('createChildNote', () => {
        it('should create a child note with the correct path', async () => {
            const createAndOpenNoteSpy = jest.spyOn(FileUtils, 'createAndOpenNote');
            await FileUtils.createChildNote(createMockApp(), 'parent.md');
            expect(createAndOpenNoteSpy).toHaveBeenCalledWith(expect.any(App), 'parent.untitled.md');
        });
    });

    describe('openFile', () => {
        it('should open file in a new leaf', async () => {
            const app = createMockApp();
            const file = createMockFile('test.md');
            const mockLeaf = new WorkspaceLeaf();
            jest.spyOn(app.workspace, 'getLeaf').mockReturnValue(mockLeaf);
            const openFileSpy = jest.spyOn(mockLeaf, 'openFile');

            await FileUtils.openFile(app, file);

            expect(openFileSpy).toHaveBeenCalledWith(file);
        });

        it('should handle null leaf gracefully', async () => {
            const app = createMockApp();
            // Use type assertion to satisfy TypeScript
            jest.spyOn(app.workspace, 'getLeaf').mockReturnValue(null as unknown as WorkspaceLeaf);
            const file = createMockFile('test.md');

            // This should not throw
            await FileUtils.openFile(app, file);
        });
    });
}); 