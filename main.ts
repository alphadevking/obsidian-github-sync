import { Notice, Plugin, PluginSettingTab, Setting, TFile } from "obsidian";

interface GitHubSyncSettings {
  githubRepo: string;
  githubToken: string;
}

const DEFAULT_SETTINGS: GitHubSyncSettings = {
  githubRepo: "your-username/your-repo", // Replace with default repository
  githubToken: "",
};

export default class ObsidianGitHubSync extends Plugin {
  settings!: GitHubSyncSettings;

  async onload() {
    console.log("Obsidian GitHub Sync Plugin Loaded!");

    // Load settings
    await this.loadSettings();

    // Validate and set up GitHub token
    if (this.settings.githubToken) {
      const isValid = await this.validateToken();
      if (!isValid) {
        new Notice("Invalid GitHub token. Please check your settings.");
      }
    } else {
      new Notice("GitHub token missing! Please set it in the settings.");
    }

    // Add a ribbon icon to trigger sync
    this.addRibbonIcon("refresh-cw", "Sync Vault with GitHub", async () => {
      await this.syncVaultWithGitHub();
    });

    // Add a command to manually trigger sync
    this.addCommand({
      id: "sync-vault",
      name: "Sync Vault with GitHub",
      callback: async () => {
        await this.syncVaultWithGitHub();
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
        new Notice(
          "GitHub token or repository settings are invalid. Please configure them in settings."
        );
        return;
      }

      new Notice("Syncing vault with GitHub...");
      const vaultFiles = this.app.vault.getAllLoadedFiles();
      const githubFiles = await this.fetchGitHubRepoFiles();

      const vaultPaths = new Set(
        vaultFiles.map((file) => (file instanceof TFile ? file.path : ""))
      );

      let changesDetected = false;

      // Remove files on GitHub not present in the vault
      for (const githubFile of githubFiles) {
        if (!vaultPaths.has(githubFile)) {
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
        }
      } catch (error) {
        console.error(`Error fetching GitHub files at ${path}:`, error);
      }
    };

    await traverse();
    return files;
  }

  private async deleteFileFromGitHub(filePath: string) {
    try {
      const sha = await this.getCurrentSha(filePath);
      if (!sha) return;

      const response = await fetch(
        `https://api.github.com/repos/${this.settings.githubRepo}/contents/${filePath}`,
        {
          method: "DELETE",
          headers: {
            Authorization: `token ${this.settings.githubToken}`,
            "Content-Type": "application/json",
          },
          body: JSON.stringify({
            message: `Delete file: ${filePath}`,
            sha,
          }),
        }
      );

      if (!response.ok) {
        console.error(`Failed to delete file: ${filePath}`, await response.json());
      } else {
        console.log(`Deleted file: ${filePath}`);
      }
    } catch (error) {
      console.error(`Error deleting file: ${filePath}`, error);
    }
  }

  private async uploadFileToGitHub(filePath: string, content: string) {
    try {
      const encodedContent = Buffer.from(content).toString("base64");
      const sha = await this.getCurrentSha(filePath);

      const response = await fetch(
        `https://api.github.com/repos/${this.settings.githubRepo}/contents/${filePath}`,
        {
          method: "PUT",
          headers: {
            Authorization: `token ${this.settings.githubToken}`,
            "Content-Type": "application/json",
          },
          body: JSON.stringify({
            message: `Update file: ${filePath}`,
            content: encodedContent,
            sha,
          }),
        }
      );

      if (!response.ok) {
        console.error(`Failed to upload file: ${filePath}`, await response.json());
      } else {
        console.log(`Uploaded file: ${filePath}`);
      }
    } catch (error) {
      console.error(`Error uploading file: ${filePath}`, error);
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
        if (data.content) {
          return Buffer.from(data.content, "base64").toString("utf-8");
        }
      } else if (response.status === 404) {
        return null; // File does not exist remotely
      } else {
        console.error(`Failed to fetch remote content for ${filePath}:`, await response.json());
      }
    } catch (error) {
      console.error(`Error fetching remote content for ${filePath}:`, error);
    }
    return null;
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
        return data.sha;
      } else if (response.status === 404) {
        return null;
      } else {
        console.error(`Failed to get SHA for ${filePath}:`, await response.json());
        return null;
      }
    } catch (error) {
      console.error(`Error fetching SHA for ${filePath}:`, error);
      return null;
    }
  }

  async loadSettings() {
    this.settings = Object.assign({}, DEFAULT_SETTINGS, await this.loadData());
  }

  async saveSettings() {
    await this.saveData(this.settings);
  }

  private async validateToken(): Promise<boolean> {
    try {
      const response = await fetch(`https://api.github.com/user`, {
        headers: { Authorization: `token ${this.settings.githubToken}` },
      });

      return response.ok;
    } catch (error) {
      console.error("Error validating GitHub token:", error);
      return false;
    }
  }

  public isValidRepo(repo: string): boolean {
    const regex = /^[a-zA-Z0-9_.-]+\/[a-zA-Z0-9_.-]+$/;
    return regex.test(repo);
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
      .setDesc("Enter the repository (user/repo) for syncing data.")
      .addText((text) =>
        text
          .setPlaceholder("e.g., user/repo")
          .setValue(this.plugin.settings.githubRepo)
          .onChange(async (value) => {
            if (this.plugin.isValidRepo(value)) {
              this.plugin.settings.githubRepo = value;
              await this.plugin.saveSettings();
            } else {
              new Notice("Invalid repository format. Use 'user/repo'.");
            }
          })
      );

    new Setting(containerEl)
      .setName("GitHub Token")
      .setDesc("Enter your GitHub personal access token.")
      .addText((text) =>
        text
          .setPlaceholder("Paste token here")
          .setValue(this.plugin.settings.githubToken)
          .onChange(async (value) => {
            this.plugin.settings.githubToken = value;
            await this.plugin.saveSettings();
          })
      );
  }
}
