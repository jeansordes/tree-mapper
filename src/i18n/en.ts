// English localization
export default {
    // View
    viewName: 'Dot Navigator',
    
    // Commands
    commandOpenTree: 'Open File Tree View',
    commandShowFile: 'Show File in Dot Navigator View',
    commandCollapseAll: 'Collapse All Nodes in Dot Navigator',
    commandExpandAll: 'Expand All Nodes in Dot Navigator',
    commandCreateChildNote: 'Create Child Note',
    commandOpenClosestParent: 'Open Closest Parent Note',
    commandRename: 'Rename Current File',
    
    // UI Elements
    buttonCollapseAll: 'Collapse All',
    buttonExpandAll: 'Expand All',
    tooltipCollapseAll: 'Collapse all folders',
    tooltipExpandAll: 'Expand all folders',
    tooltipRevealActiveFile: 'Reveal current file in tree',
    tooltipCreateNewFile: 'Create new file',
    tooltipCreateNewFolder: 'Create new folder',
    tooltipFolder: 'Folder',
    tooltipCreateNote: 'Create note: {{path}}',
    tooltipCreateChildNote: 'Create child note: {{path}}',
    tooltipMoreActions: 'More actions',
    menuRename: 'Rename',
    menuRenameFile: 'Rename file',
    menuDeleteFile: 'Delete file',
    menuDeleteFolder: 'Delete folder',
    confirmDeleteFile: 'Delete this file?\n{{path}}',
    
    // Notices
    noticeCreatedNote: 'Created note: {{path}}',
    noticeFailedCreateNote: 'Failed to create note: {{path}}',
    noticeRenameNote: 'Press F2 to rename the note',
    noticeDeletedFile: 'Deleted: {{path}}',
    noticeFailedDeleteFile: 'Failed to delete: {{path}}',
    promptRenameFile: 'Rename file: {{name}}',
    noticeFileExists: 'A file already exists at: {{path}}',
    noticeRenamedFile: 'Renamed to: {{newPath}}',
    noticeFailedRenameFile: 'Failed to rename: {{path}}',
    noticeNoParentNote: 'No parent note found',
    
    // Ribbon
    ribbonTooltip: 'Open Dot Navigator',

    // Settings
    settingsAddCustomCommandLink: 'Customize menu…',

    // Rename dialog
    renameDialogTitle: 'Rename {{type}}',
    renameDialogPath: 'Path',
    renameDialogName: 'Name',
    renameDialogExtension: 'Extension',
    renameDialogModeFileOnly: 'Rename only this file',
    renameDialogModeFileOnlyHint: 'If this option is off, only this file will be renamed',
    renameDialogModeFileAndChildren: 'Rename sub-files as well',
    renameDialogCancel: 'Cancel',
    renameDialogConfirm: 'Rename',
    renameDialogPathNotExists: 'Path does not exist (folders will be created)',
    renameDialogFoldersWillBeCreated: 'The following folders will be created: {{folders}}',
    renameDialogPathSuggestions: 'Paths suggestions',
    renameDialogChildrenPreview: 'Files to be renamed ({{count}})',
    renameDialogProgress: 'Renaming done: {{completed}}/{{total}} ({{percent}}%) ✓{{successful}} ✗{{failed}}',
    
    // Rename notices
    noticeRenameStarted: 'Starting rename operation...',
    noticeRenameCompleted: 'Rename completed: {{successful}} successful, {{failed}} failed',
    noticeRenameCancelled: 'Rename operation cancelled',
    noticeRenameUndone: 'Rename operation undone',

    // Rename dialog hints
    renameDialogHintNavigate: 'to navigate through suggestions',
    renameDialogHintUse: 'to submit the input',
    renameDialogHintClose: 'to close',
    renameDialogHintToggleMode: 'to toggle mode',

    // Rename dialog warnings
    renameDialogFileExists: 'A file with this name already exists',
    renameDialogFileExistsDesc: 'Choose a different name to avoid conflicts',

    // Untitled
    untitledPath: 'untitled',
}; 
