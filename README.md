# Obsidian GitHub Sync Plugin

Obsidian GitHub Sync is a plugin that enables synchronization of your Obsidian Vault with a GitHub repository. This allows you to back up and sync your vault content across devices by leveraging GitHub's version control and cloud storage.

## Features

- Synchronize your Obsidian Vault files with a GitHub repository.
- Automatically upload new or updated files and remove deleted files from the GitHub repository.
- Intuitive settings interface for configuring your GitHub repository and personal access token.
- Command palette and ribbon icon for manual sync triggers.

## Installation

1. Download or clone the plugin repository to your local machine.
2. Place the plugin folder in the `.obsidian/plugins/` directory of your Obsidian Vault.
3. Enable the plugin in **Settings > Community Plugins**.

## Configuration

### Setting Up the Plugin

1. Open Obsidian and go to **Settings > GitHub Sync Settings**.
2. Configure the following:
   - **GitHub Repository**: Enter your GitHub repository in the format `username/repo`.
   - **GitHub Token**: Generate a personal access token from GitHub with the required permissions (e.g., `repo` scope) and paste it here.
3. Save the settings.

### Generating a GitHub Token

1. Go to your GitHub account settings and navigate to **Developer Settings > Personal Access Tokens**.
2. Click **Generate new token** and select the necessary permissions (e.g., `repo` for private repositories).
3. Copy the generated token and paste it into the plugin settings under **GitHub Token**.

## Usage

### Syncing the Vault

- **Manual Sync**:
  - Use the ribbon icon on the left sidebar to trigger a manual sync.
  - Alternatively, use the command palette (`Ctrl+P` or `Cmd+P`) and search for "Sync Vault with GitHub".

- **Automatic Sync**:
  - Files in your vault are automatically compared with the files in the GitHub repository during manual sync.
  - The plugin handles uploading, updating, and deleting files to ensure the vault and repository stay in sync.

### How Sync Works

1. **Upload Files**:
   - New or updated files in the vault are uploaded to the GitHub repository.
2. **Delete Files**:
   - Files removed from the vault are also deleted from the GitHub repository.
3. **Resolve Conflicts**:
   - If the content differs between the vault and GitHub, the local version is prioritized.

## Troubleshooting

### Common Issues

- **Invalid GitHub Token**:
  - Ensure the token is pasted correctly and has the required `repo` scope permissions.
- **Invalid Repository Format**:
  - Ensure the repository is specified as `username/repo`.
- **Failed to Sync**:
  - Check the Obsidian console (`Ctrl+Shift+I` or `Cmd+Option+I`) for error details.

## Notes

- The plugin does not automatically resolve merge conflicts; ensure you manage conflicts directly on GitHub if they arise.
- Ensure you do not expose your personal access token publicly to maintain security.

## Contributing

Feel free to contribute by submitting issues or pull requests to improve the plugin functionality.

## License

This plugin is open-source and licensed under the [MIT License](LICENSE).

## Acknowledgements

- [Obsidian](https://obsidian.md/)
- [GitHub](https://github.com/)
