# Obsidian Another Dendron Plugin

A Dendron-like hierarchical note management plugin for Obsidian (https://obsidian.md).

This plugin brings hierarchical note management capabilities to Obsidian, inspired by Dendron. It allows you to organize your notes in a tree-like structure, making it easier to navigate and manage large knowledge bases.

## Features

- Hierarchical note organization with a tree-like interface
- Easy navigation between related notes
- Create child notes directly from the hierarchy view
- Collapsible note hierarchy for better organization
- Seamless integration with Obsidian's existing features

## Installation

### From Obsidian Community Plugins

1. Open Obsidian
2. Go to Settings > Community plugins
3. Turn off Safe mode if it's on
4. Click "Browse" and search for "Another Dendron Plugin"
5. Click Install
6. Once installed, enable the plugin

### Manual Installation

1. Download the latest release from the [Releases page](https://github.com/jeansordes/another-dendron-plugin/releases)
2. Extract the files to your vault's plugins folder: `<vault>/.obsidian/plugins/another-dendron-plugin/`
3. Reload Obsidian
4. Go to Settings > Community plugins and enable "Another Dendron Plugin"

## Usage

1. Open the plugin view from the left sidebar
2. Navigate through your hierarchical notes
3. Click on a note to open it
4. Use the collapse/expand buttons to manage the tree view
5. Create new child notes directly from the hierarchy

## Development

### Prerequisites

- [Node.js](https://nodejs.org/) (v16 or higher)
- [npm](https://www.npmjs.com/) (comes with Node.js)

### Setup

1. Clone this repository to your local machine
2. Navigate to the project directory
3. Install dependencies:
   ```bash
   npm install
   ```
4. For development with hot-reload:
   ```bash
   npm run dev
   ```
5. For production build:
   ```bash
   npm run build
   ```

### Commit Guidelines

This project uses [Commitizen](https://github.com/commitizen/cz-cli) to standardize commit messages, which helps with automatic changelog generation. Instead of using `git commit`, please use:

```bash
npm run commit
```

This will prompt you to fill in standardized commit message fields:
- **Type**: The type of change (feat, fix, docs, style, refactor, perf, test, chore)
- **Scope**: The part of the codebase affected (optional)
- **Subject**: A short description of the change
- **Body**: A longer description (optional)
- **Breaking Changes**: Any breaking changes (optional)
- **Issues**: Issue references (optional)

Following this convention makes the changelog more useful and helps with semantic versioning.

### Testing in Obsidian

1. Create a symbolic link or copy the built files to your Obsidian vault's plugins folder:
   ```bash
   # Example (adjust paths as needed)
   ln -s /path/to/project /path/to/vault/.obsidian/plugins/another-dendron-plugin
   ```
2. Restart Obsidian or reload plugins
3. Enable the plugin in Obsidian settings

## Releasing New Versions

This plugin includes automated release scripts to simplify the versioning and publishing process. The release process includes automatic changelog generation based on your commit history and uses GitHub Actions to create releases.

### Release Process

1. Make your changes to the codebase
2. Run one of the following commands:
   ```bash
   # For a patch version bump (e.g., 1.0.0 -> 1.0.1)
   npm run release
   
   # For a minor version bump (e.g., 1.0.0 -> 1.1.0)
   npm run release:minor
   
   # For a major version bump (e.g., 1.0.0 -> 2.0.0)
   npm run release:major
   ```

This will:
- Build the plugin
- Bump the version number
- Generate/update the changelog
- Create a git commit
- Create a tag with the exact version number
- Push the commit and tag to GitHub
- **Trigger the GitHub Actions workflow that will:**
  - Build the plugin again
  - Create a GitHub release
  - Attach the necessary files (main.js, manifest.json, styles.css)

> **Note**: This method requires no additional setup beyond having push access to the repository.

### Manual Release Process

If you prefer more control over the process, you can manually trigger the GitHub Actions workflow:

1. Manually bump the version and create a tag:
   ```bash
   # First, update the version in package.json, manifest.json, and versions.json
   npm run version-bump
   
   # Commit the changes
   git add .
   git commit -m "Bump version to x.y.z"
   
   # Create a tag with the exact version number (no 'v' prefix)
   git tag -a "x.y.z" -m "Release x.y.z"
   
   # Push both the commit and the tag to GitHub
   git push origin master --tags
   ```

   > **Important**: According to Obsidian's guidelines, tag names should be just the version number (e.g., `1.0.0`) without the `v` prefix. The GitHub Actions workflow is configured to trigger only on tags that match this pattern.

2. The GitHub Actions workflow will automatically:
   - Build the plugin
   - Create a GitHub release with the tag name
   - Attach the necessary files (main.js, manifest.json, styles.css)

### Changelog Generation

The release process automatically generates a CHANGELOG.md file based on your commit history. To make the most of this feature:

1. Always use the structured commit format with `npm run commit`
2. Follow the [Conventional Commits](https://www.conventionalcommits.org/) specification
3. Use appropriate commit types:
   - `feat`: A new feature (triggers a minor version bump)
   - `fix`: A bug fix (triggers a patch version bump)
   - `docs`: Documentation changes
   - `style`: Code style changes (formatting, etc.)
   - `refactor`: Code changes that neither fix bugs nor add features
   - `perf`: Performance improvements
   - `test`: Adding or updating tests
   - `chore`: Changes to the build process or auxiliary tools

To manually generate or update the changelog without releasing:
```bash
npm run changelog
```

To regenerate the entire changelog from scratch:
```bash
npm run changelog:first
```

## Contributing

Contributions are welcome! Please feel free to submit a Pull Request.

1. Fork the repository
2. Create your feature branch (`git checkout -b feature/amazing-feature`)
3. Commit your changes (`git commit -m 'Add some amazing feature'`)
4. Push to the branch (`git push origin feature/amazing-feature`)
5. Open a Pull Request

## License

This project is licensed under the MIT License - see the [LICENSE](LICENSE) file for details.

## Troubleshooting

### Release Process Issues

- **Error: src refspec main does not match any**: This means the branch name in the release script doesn't match your actual branch name. The script is configured to use the `master` branch.

- **Error: main.js does not exist**: Make sure to run the build script before releasing. The release script should handle this automatically, but you can run `npm run build` manually if needed.

- **GitHub Actions not triggering**: Ensure you've pushed both the commit and the tag to the remote repository. For the automated process, check if the tag was successfully pushed with `git push origin <tag-name>`.

- **Error: GitHub Releases requires a tag**: This error occurs in GitHub Actions when trying to create a release without a proper tag. Make sure:
  1. You've created a tag with the exact version number (e.g., `1.0.0`, not `v1.0.0`)
  2. You've pushed the tag to GitHub with `git push origin <tag-name>` or `git push origin --tags`
  3. The tag format matches the pattern in the workflow file (`[0-9]+.[0-9]+.[0-9]+`)

- **Error: Resource not accessible by integration**: This error occurs when the GitHub Actions workflow doesn't have the necessary permissions to create releases. Make sure your workflow file includes the following permissions:
  ```yaml
  permissions:
    contents: write
  ```

- **Tag naming convention**: Obsidian requires tags to be just the version number (e.g., `1.0.0`) without the `v` prefix. All scripts have been updated to follow this convention.

- **GitHub Actions workflow failed**: If the GitHub Actions workflow fails:
  1. Check the workflow logs in the GitHub Actions tab of your repository
  2. Ensure the tag was properly created and pushed
  3. Verify that the GitHub Actions workflow has the necessary permissions to create releases

## Acknowledgments

- [Obsidian](https://obsidian.md/) for the amazing knowledge base platform
- [Dendron](https://www.dendron.so/) for the inspiration on hierarchical note management
