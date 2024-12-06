import { Notice, Plugin, PluginSettingTab, Setting, TFile } from "obsidian";

interface GitHubSyncSettings {
  githubRepo: string;
  githubToken: string;
}

const DEFAULT_SETTINGS: GitHubSyncSettings = {
  githubRepo: "your-username/your-repo",
  githubToken: "",
};

export default class ObsidianGitHubSync extends Plugin {
  settings!: GitHubSyncSettings;

  async onload() {
    console.log("Obsidian GitHub Sync Plugin Loaded!");

    // Load settings
    await this.loadSettings();

    // Notices for loading
    new Notice("GitHub Sync Plugin loaded!");

    // Validate GitHub token
    if (this.settings.githubToken) {
      const isValid = await this.validateToken();
      if (!isValid) {
        new Notice("Invalid GitHub token. Please check your settings.");
      }
    } else {
      new Notice("GitHub token missing! Please set it in the settings.");
    }

    // Debug platform details
    console.log("Running on platform:", navigator.userAgent);

    // Add ribbon icons for desktop and mobile
    this.addRibbonIcon("refresh-cw", "Sync Vault with GitHub", async () => {
      await this.syncVaultWithGitHub();
    });

    this.addRibbonIcon("cloud-download", "Pull Updates from GitHub", async () => {
      await this.pullUpdatesFromGitHub();
    });

    // Add commands for syncing and pulling
    this.addCommand({
      id: "sync-vault",
      name: "Sync Vault with GitHub",
      callback: async () => {
        await this.syncVaultWithGitHub();
      },
    });

    this.addCommand({
      id: "pull-updates",
      name: "Pull Updates from GitHub",
      callback: async () => {
        await this.pullUpdatesFromGitHub();
      },
    });

    // Add settings tab
    this.addSettingTab(new GitHubSyncSettingTab(this));

    new Notice("Obsidian GitHub Sync Plugin is now active!");
  }

  onunload() {
    console.log("Obsidian GitHub Sync Plugin Unloaded.");
  }

  private async syncVaultWithGitHub() {
    try {
      if (!this.settings.githubToken || !this.isValidRepo(this.settings.githubRepo)) {
        new Notice("GitHub token or repository settings are invalid. Please configure them in settings.");
        return;
      }

      new Notice("Syncing vault with GitHub...");
      console.log("Starting vault sync...");

      const vaultFiles = this.app.vault.getAllLoadedFiles();
      const githubFiles = await this.fetchGitHubRepoFiles();

      console.log("Vault files:", vaultFiles.map((f) => (f instanceof TFile ? f.path : "")));
      console.log("GitHub files:", githubFiles);

      const vaultPaths = new Set(
        vaultFiles.map((file) => (file instanceof TFile ? file.path : ""))
      );

      let changesDetected = false;

      // Remove files on GitHub not present in the vault
      for (const githubFile of githubFiles) {
        if (!vaultPaths.has(githubFile)) {
          console.log(`Deleting GitHub file not in vault: ${githubFile}`);
          await this.deleteFileFromGitHub(githubFile);
          changesDetected = true;
        }
      }

      // Upload files from vault to GitHub
      for (const file of vaultFiles) {
        if (file instanceof TFile) {
          const localContent = await this.app.vault.read(file);
          const remoteContent = await this.getRemoteFileContent(file.path);

          if (remoteContent !== localContent) {
            console.log(`Uploading or updating file on GitHub: ${file.path}`);
            await this.uploadFileToGitHub(file.path, localContent);
            changesDetected = true;
          }
        }
      }

      if (!changesDetected) {
        new Notice("No changes found. Vault is already up-to-date.");
      } else {
        new Notice("Vault successfully synced with GitHub!");
      }
    } catch (error) {
      console.error("Error during vault synchronization:", error);
      new Notice("Failed to sync vault with GitHub. Check the console for details.");
    }
  }

  private async pullUpdatesFromGitHub() {
    try {
      if (!this.settings.githubToken || !this.isValidRepo(this.settings.githubRepo)) {
        new Notice("GitHub token or repository settings are invalid. Please configure them in settings.");
        return;
      }

      new Notice("Pulling updates from GitHub...");
      console.log("Starting pull updates...");

      const githubFiles = await this.fetchGitHubRepoFiles();
      console.log("GitHub files:", githubFiles);

      for (const githubFilePath of githubFiles) {
        const normalizedPath = githubFilePath;
        console.log("Processing file:", normalizedPath);

        const remoteContent = await this.getRemoteFileContent(githubFilePath);
        if (remoteContent !== null) {
          const parentFolderPath = normalizedPath.split("/").slice(0, -1).join("/");
          if (parentFolderPath) {
            await this.ensureFolderExists(parentFolderPath);
          }

          const localFile = this.app.vault.getAbstractFileByPath(normalizedPath);
          if (localFile instanceof TFile) {
            const localContent = await this.app.vault.read(localFile);
            if (localContent !== remoteContent) {
              console.log(`Updating local file: ${normalizedPath}`);
              await this.app.vault.modify(localFile, remoteContent);
            }
          } else {
            console.log(`Creating new local file: ${normalizedPath}`);
            await this.app.vault.create(normalizedPath, remoteContent);
          }
        }
      }

      new Notice("Vault successfully updated with changes from GitHub!");
    } catch (error) {
      console.error("Error during pull updates:", error);
      new Notice("Failed to pull updates from GitHub. Check the console for details.");
    }
  }

  private async ensureFolderExists(folderPath: string) {
    console.log(`Ensuring folder exists: ${folderPath}`);
    const segments = folderPath.split("/");
    let currentPath = "";

    for (const segment of segments) {
      currentPath = currentPath ? `${currentPath}/${segment}` : segment;
      const folder = this.app.vault.getAbstractFileByPath(currentPath);

      if (!folder) {
        console.log(`Creating folder: ${currentPath}`);
        await this.app.vault.createFolder(currentPath);
      }
    }
  }

  private async fetchGitHubRepoFiles(): Promise<string[]> {
    const files: string[] = [];
    const traverse = async (path: string = "") => {
      try {
        const response = await fetch(
          `https://api.github.com/repos/${this.settings.githubRepo}/contents/${path}`,
          {
            headers: { Authorization: `token ${this.settings.githubToken}` },
          }
        );

        if (response.ok) {
          const data = await response.json();
          if (Array.isArray(data)) {
            for (const item of data) {
              if (item.type === "file") {
                files.push(item.path);
              } else if (item.type === "dir") {
                await traverse(item.path);
              }
            }
          }
        } else {
          console.error(`Error traversing path ${path}:`, await response.json());
        }
      } catch (error) {
        console.error(`Error fetching GitHub files at ${path}:`, error);
      }
    };

    await traverse();
    return files;
  }

  private async deleteFileFromGitHub(filePath: string) {
    const sha = await this.getCurrentSha(filePath);
    if (!sha) return;

    console.log(`Deleting file: ${filePath}`);
    const response = await fetch(
      `https://api.github.com/repos/${this.settings.githubRepo}/contents/${filePath}`,
      {
        method: "DELETE",
        headers: {
          Authorization: `token ${this.settings.githubToken}`,
          "Content-Type": "application/json",
        },
        body: JSON.stringify({ message: `Delete file: ${filePath}`, sha }),
      }
    );

    if (!response.ok) {
      console.error(`Failed to delete file: ${filePath}`, await response.json());
    }
  }

  private async uploadFileToGitHub(filePath: string, content: string) {
    const encodedContent = Buffer.from(content).toString("base64");
    const sha = await this.getCurrentSha(filePath);

    console.log(`Uploading file: ${filePath}`);
    const response = await fetch(
      `https://api.github.com/repos/${this.settings.githubRepo}/contents/${filePath}`,
      {
        method: "PUT",
        headers: {
          Authorization: `token ${this.settings.githubToken}`,
          "Content-Type": "application/json",
        },
        body: JSON.stringify({ message: `Update file: ${filePath}`, content: encodedContent, sha }),
      }
    );

    if (!response.ok) {
      console.error(`Failed to upload file: ${filePath}`, await response.json());
    }
  }

  private async getRemoteFileContent(filePath: string): Promise<string | null> {
    try {
      const response = await fetch(
        `https://api.github.com/repos/${this.settings.githubRepo}/contents/${filePath}`,
        {
          headers: { Authorization: `token ${this.settings.githubToken}` },
        }
      );

      if (response.ok) {
        const data = await response.json();
        return Buffer.from(data.content, "base64").toString("utf-8");
      } else if (response.status === 404) {
        return null;
      } else {
        console.error(`Error fetching remote content for file ${filePath}:`, await response.json());
        return null;
      }
    } catch (error) {
      console.error(`Error fetching remote content for file ${filePath}:`, error);
      return null;
    }
  }

  private async getCurrentSha(filePath: string): Promise<string | null> {
    try {
      const response = await fetch(
        `https://api.github.com/repos/${this.settings.githubRepo}/contents/${filePath}`,
        {
          headers: { Authorization: `token ${this.settings.githubToken}` },
        }
      );

      if (response.ok) {
        const data = await response.json();
        return data.sha || null;
      }
    } catch (error) {
      console.error(`Error fetching SHA for file ${filePath}:`, error);
    }
    return null;
  }

  private isValidRepo(repo: string): boolean {
    return /^[\w-]+\/[\w-]+$/.test(repo);
  }

  private async validateToken(): Promise<boolean> {
    try {
      const response = await fetch("https://api.github.com/user", {
        headers: { Authorization: `token ${this.settings.githubToken}` },
      });

      return response.ok;
    } catch (error) {
      console.error("Error validating GitHub token:", error);
      return false;
    }
  }

  async loadSettings() {
    this.settings = Object.assign({}, DEFAULT_SETTINGS, await this.loadData());
  }

  async saveSettings() {
    await this.saveData(this.settings);
  }
}

class GitHubSyncSettingTab extends PluginSettingTab {
  plugin: ObsidianGitHubSync;

  constructor(plugin: ObsidianGitHubSync) {
    super(plugin.app, plugin);
    this.plugin = plugin;
  }

  display(): void {
    const { containerEl } = this;
    containerEl.empty();

    containerEl.createEl("h2", { text: "GitHub Sync Settings" });

    new Setting(containerEl)
      .setName("GitHub Repository")
      .setDesc("Your GitHub repository in the format 'username/repo'")
      .addText((text) =>
        text
          .setPlaceholder("username/repo")
          .setValue(this.plugin.settings.githubRepo)
          .onChange(async (value) => {
            this.plugin.settings.githubRepo = value;
            await this.plugin.saveSettings();
          })
      );

    new Setting(containerEl)
      .setName("GitHub Token")
      .setDesc("Your GitHub personal access token")
      .addText((text) =>
        text
          .setPlaceholder("Enter your token")
          .setValue(this.plugin.settings.githubToken)
          .onChange(async (value) => {
            this.plugin.settings.githubToken = value;
            await this.plugin.saveSettings();
          })
      );
  }
}
