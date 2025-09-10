# Dot Navigator

<img width="1878" height="1316" alt="CleanShot 2025-09-10 at 03 02 33@2x" src="https://github.com/user-attachments/assets/34114bbf-de6c-49ab-8d19-db82b8ebb027" />

A hierarchical note management system with Dendron-like features.

This tool brings hierarchical note management capabilities to your vault, inspired by Dendron. It allows you to organize your notes in a tree-like structure, making it easier to navigate and manage large knowledge bases.

(While Dot Navigator maintains some compatibility with Dendron-structured notes, future compatibility is not guaranteed. It is primarily intended for use with notes in your vault, utilizing a Dendron-like structure)

## Features

- Hierarchical note organization with a tree-like interface
- Create child notes directly from the hierarchy view
- Support all file types
- Works on mobile as well as desktop
- Allow you to customize the menu with any command you want

<img width="2810" height="2339" alt="CleanShot 2025-09-10 at 03 15 52@2x" src="https://github.com/user-attachments/assets/f7528d55-758f-4656-a54b-d828614e86bb" />


## Installation

Until the plugin is officially released, you can install it through BRAT (Beta Review and Testing)
1. <a href="https://www.jzs.fr/redirect?to=obsidian://show-plugin?id=obsidian42-brat" target="_blank">Install the BRAT plugin</a> if you don't have it already
2. <a href="https://www.jzs.fr/redirect?to=obsidian://brat?plugin=jeansordes/dot-navigator" target="_blank">Install Dot Navigator using BRAT</a>

## Available Commands

Dot Navigator provides several commands that can be accessed via the Command Palette (Ctrl/Cmd+P):

- **Open Tree View**: Opens the Dot Navigator View in the left sidebar
- **Show File in Tree View**: Highlights and reveals the current file in the tree view
- **Collapse All Nodes in Tree**: Collapses all nodes in the tree view
- **Expand All Nodes in Tree**: Expands all nodes in the tree view
- **Open Closest Parent Note**: Opens the nearest existing parent note of the current file (checks dotted parents like `a.b.c` → `a.b` → `a`, then folder note `<folder>/<folder>.md`)

## Internationalization

Dot Navigator supports multiple languages:
- English (default)
- French

The interface language will automatically match your vault language settings.

## Acknowledgments

- [Dendron](https://www.dendron.so/) for the inspiration on hierarchical note management

- Other tools that inspired this one:
  - [Structured Tree](https://github.com/Rudtrack/structured-tree)
  - [Obsidian Structure](https://github.com/dobrovolsky/obsidian-structure)
  - [Obsidian Dendron Tree](https://github.com/levirs565/obsidian-dendron-tree)

