// French localization
export default {
    // View
    viewName: 'Dot Navigator',
    
    // Commands
    commandOpenTree: 'Ouvrir l\'arborescence des fichiers',
    commandShowFile: 'Afficher le fichier dans Dot Navigator',
    commandCollapseAll: 'Réduire tous les nœuds dans Dot Navigator',
    commandExpandAll: 'Développer tous les nœuds dans Dot Navigator',
    commandCreateChildNote: 'Créer une note enfant',
    commandOpenClosestParent: 'Ouvrir la note parente la plus proche',
    commandRename: 'Renommer le fichier actuel',
    
    // UI Elements
    buttonCollapseAll: 'Tout réduire',
    buttonExpandAll: 'Tout développer',
    tooltipCollapseAll: 'Réduire tous les dossiers',
    tooltipExpandAll: 'Développer tous les dossiers',
    tooltipRevealActiveFile: 'Afficher le fichier actif dans l\'arborescence',
    tooltipCreateNewFile: 'Créer un nouveau fichier',
    tooltipCreateNewFolder: 'Créer un nouveau dossier',
    tooltipFolder: 'Dossier',
    tooltipCreateNote: 'Créer une note : {{path}}',
    tooltipCreateChildNote: 'Créer une note enfant : {{path}}',
    tooltipMoreActions: 'Plus d\'actions',
    menuRename: 'Renommer',
    menuRenameFile: 'Renommer le fichier',
    menuDeleteFile: 'Supprimer le fichier',
    menuDeleteFolder: 'Supprimer le dossier',
    confirmDeleteFile: 'Supprimer ce fichier ?\n{{path}}',
    
    // Notices
    noticeCreatedNote: 'Note créée : {{path}}',
    noticeFailedCreateNote: 'Échec de création de la note : {{path}}',
    noticeRenameNote: 'Appuyez sur F2 pour renommer la note',
    noticeDeletedFile: 'Supprimé : {{path}}',
    noticeFailedDeleteFile: 'Échec de la suppression : {{path}}',
    promptRenameFile: 'Renommer le fichier : {{name}}',
    noticeFileExists: 'Un fichier existe déjà à : {{path}}',
    noticeRenamedFile: 'Renommé en : {{newPath}}',
    noticeFailedRenameFile: 'Échec du renommage : {{path}}',
    noticeNoParentNote: 'Aucune note parente trouvée',
    
    // Ribbon
    ribbonTooltip: 'Ouvrir Dot Navigator',

    // Settings
    settingsAddCustomCommandLink: 'Personnaliser le menu…',

    // Rename dialog
    renameDialogTitle: 'Renommer {{type}}',
    renameDialogPath: 'Chemin',
    renameDialogName: 'Nom',
    renameDialogExtension: 'Extension',
    renameDialogModeFileOnly: 'Renommer seulement ce fichier',
    renameDialogModeFileOnlyHint: 'Si cette option est désactivée, seul ce fichier sera renommé',
    renameDialogModeFileAndChildren: 'Renommer aussi les sous-fichiers',
    renameDialogCancel: 'Annuler',
    renameDialogConfirm: 'Renommer',
    renameDialogPathNotExists: 'Le chemin n\'existe pas (les dossiers seront créés)',
    renameDialogFoldersWillBeCreated: 'Les dossiers suivants seront créés : {{folders}}',
    renameDialogPathSuggestions: 'Suggestions de chemins',
    renameDialogChildrenPreview: 'Fichiers à renommer ({{count}})',
    renameDialogProgress: 'Renommage terminé : {{completed}}/{{total}} ({{percent}}%) ✓{{successful}} ✗{{failed}}',
    
    // Rename notices
    noticeRenameStarted: 'Début de l\'opération de renommage...',
    noticeRenameCompleted: 'Renommage terminé : {{successful}} réussis, {{failed}} échoués',
    noticeRenameCancelled: 'Opération de renommage annulée',
    noticeRenameUndone: 'Opération de renommage annulée',

    // Rename dialog hints
    renameDialogHintNavigate: 'pour naviguer entre les suggestions',
    renameDialogHintUse: 'pour valider la saisie',
    renameDialogHintClose: 'pour fermer',
    renameDialogHintToggleMode: 'pour basculer le mode',

    // Rename dialog warnings
    renameDialogFileExists: 'Un fichier avec ce nom existe déjà',
    renameDialogFileExistsDesc: 'Choisissez un nom différent pour éviter les conflits',

    // Untitled
    untitledPath: 'sans-titre',
}; 
