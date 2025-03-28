## [1.1.2-beta.0](https://github.com/jeansordes/tree-mapper/compare/1.1.1...1.1.2-beta.0) (2025-03-25)



## [1.1.1](https://github.com/jeansordes/tree-mapper/compare/1.1.0...1.1.1) (2025-03-25)


### Bug Fixes

* restore core mechanism that was broken in last release, when trying to support all types of file ([997c60c](https://github.com/jeansordes/tree-mapper/commit/997c60c9bcdb374610abd93b270ebf347a430bc8))



# [1.1.0](https://github.com/jeansordes/tree-mapper/compare/1.0.10...1.1.0) (2025-03-24)


### Features

* add icons + extension for non-markdown files ([2be3b86](https://github.com/jeansordes/tree-mapper/commit/2be3b86cb663cd2746cc1f55f6f52e1d0cfb3f65))
* add support for any extension, not just markdown files ([87a425a](https://github.com/jeansordes/tree-mapper/commit/87a425a6717aa0b516461221e1a0d2b60dd7ecb1))


### Performance Improvements

* make sure the css is loaded before building the tree ([ff157dd](https://github.com/jeansordes/tree-mapper/commit/ff157dd53fcc747ec4895ccf53e9800fdf91f8db))
* replace 1000s of event listeners by a single one 💪 ([e23a96f](https://github.com/jeansordes/tree-mapper/commit/e23a96f265012152b71557e9dd8b614cb7478009))



## [1.0.10](https://github.com/jeansordes/tree-mapper/compare/1.0.9...1.0.10) (2025-03-23)


### Bug Fixes

* **ui:** add space around collapse all button ([3e71c85](https://github.com/jeansordes/tree-mapper/commit/3e71c8583236b87f88c71ad59548b88518f3e7f3))



## [1.0.9](https://github.com/jeansordes/tree-mapper/compare/1.0.8...1.0.9) (2025-03-23)



## [1.0.8](https://github.com/jeansordes/tree-mapper/compare/1.0.7...1.0.8) (2025-03-23)


### Bug Fixes

* restore desktop ui style ([3f963f8](https://github.com/jeansordes/tree-mapper/commit/3f963f8e54487d0e267b83eecf6ee0a7223a22b4))



## [1.0.7](https://github.com/jeansordes/tree-mapper/compare/1.0.6...1.0.7) (2025-03-23)


### Bug Fixes

* repair collapse mechanism + increase ui sizes on mobile ([80cb097](https://github.com/jeansordes/tree-mapper/commit/80cb097dbb1e011bf30822ec40e9760fa813be11))



## [1.0.6](https://github.com/jeansordes/tree-mapper/compare/1.0.5...1.0.6) (2025-03-22)



## [1.0.5](https://github.com/jeansordes/tree-mapper/compare/1.0.4...1.0.5) (2025-03-21)


### Bug Fixes

* restore mobile support ([c52d7f3](https://github.com/jeansordes/tree-mapper/commit/c52d7f3c67ca02ea73d45b1112b370033c369336))



## [1.0.4](https://github.com/jeansordes/tree-mapper/compare/1.0.3...1.0.4) (2025-03-21)



## [1.0.3](https://github.com/jeansordes/tree-mapper/compare/1.0.2...1.0.3) (2025-03-18)


### Features

* "Add child note" command added ([1789898](https://github.com/jeansordes/tree-mapper/commit/178989856c689a4b2835cbde109f8af810d1bf85))



## [1.0.2](https://github.com/jeansordes/tree-mapper/compare/1.0.1...1.0.2) (2025-03-18)



## 1.0.1 (2025-03-16)


### Bug Fixes

* stabilize plugin core functionality ([b135bd0](https://github.com/jeansordes/obsidian-another-dendron-plugin/commit/b135bd098e7161c14e0b2d10c2424f806183e809))


### Features

* initial plugin setup ([088d021](https://github.com/jeansordes/obsidian-another-dendron-plugin/commit/088d021c086abde044993536b92b421b7f16e7e1))
* **ui:** add file highlighting and navigation ([f3b394d](https://github.com/jeansordes/obsidian-another-dendron-plugin/commit/f3b394db02d4b63183e8be41d5787d7fe572cebc))
* **ui:** enhance view interaction and persistence ([c1aea71](https://github.com/jeansordes/obsidian-another-dendron-plugin/commit/c1aea71090129b6a947463e591f13cc4c10168b6))



## 1.0.0 (2025-03-16)

### Features

- Initial plugin setup
- Adds a view to see files
- Implements dendron structure for displaying files
- Refresh view when CRUD happens in vault
- When clicking on a file, it opens in the current tab
- Add folder support to tree view
- Add child note creation

#### UI Improvements
- Enhance view interaction and persistence
- Add file highlighting and navigation
- Add i18n and view controls
- Enhance expand/collapse button design
- Refine button colors

### Bug Fixes

- Stabilize plugin core functionality
- Correct tooltip and refactoring issues

### Refactoring

- Split files for better organization
- Localize plugin styles
- Enhance type definitions
- Simplify codebase
- Improve code organization
- Clean up implementation

### Styling

- Improve button aesthetics

### Chores

- Implement automated release process
