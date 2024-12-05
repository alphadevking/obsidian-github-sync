"use strict";
var __awaiter = (this && this.__awaiter) || function (thisArg, _arguments, P, generator) {
    function adopt(value) { return value instanceof P ? value : new P(function (resolve) { resolve(value); }); }
    return new (P || (P = Promise))(function (resolve, reject) {
        function fulfilled(value) { try { step(generator.next(value)); } catch (e) { reject(e); } }
        function rejected(value) { try { step(generator["throw"](value)); } catch (e) { reject(e); } }
        function step(result) { result.done ? resolve(result.value) : adopt(result.value).then(fulfilled, rejected); }
        step((generator = generator.apply(thisArg, _arguments || [])).next());
    });
};
Object.defineProperty(exports, "__esModule", { value: true });
const obsidian_1 = require("obsidian");
const DEFAULT_SETTINGS = {
    githubRepo: "your-username/your-repo", // Replace with default repository
    githubToken: "",
};
class ObsidianGitHubSync extends obsidian_1.Plugin {
    onload() {
        return __awaiter(this, void 0, void 0, function* () {
            console.log("Obsidian GitHub Sync Plugin Loaded!");
            // Load settings
            yield this.loadSettings();
            // Validate and set up GitHub token
            if (this.settings.githubToken) {
                const isValid = yield this.validateToken();
                if (!isValid) {
                    new obsidian_1.Notice("Invalid GitHub token. Please check your settings.");
                }
            }
            else {
                new obsidian_1.Notice("GitHub token missing! Please set it in the settings.");
            }
            // Add a ribbon icon to trigger sync
            this.addRibbonIcon("refresh-cw", "Sync Vault with GitHub", () => __awaiter(this, void 0, void 0, function* () {
                yield this.syncVaultWithGitHub();
            }));
            // Add a command to manually trigger sync
            this.addCommand({
                id: "sync-vault",
                name: "Sync Vault with GitHub",
                callback: () => __awaiter(this, void 0, void 0, function* () {
                    yield this.syncVaultWithGitHub();
                }),
            });
            // Add settings tab
            this.addSettingTab(new GitHubSyncSettingTab(this));
            new obsidian_1.Notice("Obsidian GitHub Sync Plugin is now active!");
        });
    }
    onunload() {
        console.log("Obsidian GitHub Sync Plugin Unloaded.");
    }
    syncVaultWithGitHub() {
        return __awaiter(this, void 0, void 0, function* () {
            try {
                if (!this.settings.githubToken || !this.isValidRepo(this.settings.githubRepo)) {
                    new obsidian_1.Notice("GitHub token or repository settings are invalid. Please configure them in settings.");
                    return;
                }
                new obsidian_1.Notice("Syncing vault with GitHub...");
                const vaultFiles = this.app.vault.getAllLoadedFiles();
                const githubFiles = yield this.fetchGitHubRepoFiles();
                const vaultPaths = new Set(vaultFiles.map((file) => (file instanceof obsidian_1.TFile ? file.path : "")));
                let changesDetected = false;
                // Remove files on GitHub not present in the vault
                for (const githubFile of githubFiles) {
                    if (!vaultPaths.has(githubFile)) {
                        yield this.deleteFileFromGitHub(githubFile);
                        changesDetected = true;
                    }
                }
                // Upload files from vault to GitHub
                for (const file of vaultFiles) {
                    if (file instanceof obsidian_1.TFile) {
                        const localContent = yield this.app.vault.read(file);
                        const remoteContent = yield this.getRemoteFileContent(file.path);
                        if (remoteContent !== localContent) {
                            yield this.uploadFileToGitHub(file.path, localContent);
                            changesDetected = true;
                        }
                    }
                }
                if (!changesDetected) {
                    new obsidian_1.Notice("No changes found. Vault is already up-to-date.");
                }
                else {
                    new obsidian_1.Notice("Vault successfully synced with GitHub!");
                }
            }
            catch (error) {
                console.error("Error during vault synchronization:", error);
                new obsidian_1.Notice("Failed to sync vault with GitHub. Check the console for details.");
            }
        });
    }
    fetchGitHubRepoFiles() {
        return __awaiter(this, void 0, void 0, function* () {
            const files = [];
            const traverse = (...args_1) => __awaiter(this, [...args_1], void 0, function* (path = "") {
                try {
                    const response = yield fetch(`https://api.github.com/repos/${this.settings.githubRepo}/contents/${path}`, {
                        headers: { Authorization: `token ${this.settings.githubToken}` },
                    });
                    if (response.ok) {
                        const data = yield response.json();
                        if (Array.isArray(data)) {
                            for (const item of data) {
                                if (item.type === "file") {
                                    files.push(item.path);
                                }
                                else if (item.type === "dir") {
                                    yield traverse(item.path);
                                }
                            }
                        }
                    }
                }
                catch (error) {
                    console.error(`Error fetching GitHub files at ${path}:`, error);
                }
            });
            yield traverse();
            return files;
        });
    }
    deleteFileFromGitHub(filePath) {
        return __awaiter(this, void 0, void 0, function* () {
            try {
                const sha = yield this.getCurrentSha(filePath);
                if (!sha)
                    return;
                const response = yield fetch(`https://api.github.com/repos/${this.settings.githubRepo}/contents/${filePath}`, {
                    method: "DELETE",
                    headers: {
                        Authorization: `token ${this.settings.githubToken}`,
                        "Content-Type": "application/json",
                    },
                    body: JSON.stringify({
                        message: `Delete file: ${filePath}`,
                        sha,
                    }),
                });
                if (!response.ok) {
                    console.error(`Failed to delete file: ${filePath}`, yield response.json());
                }
                else {
                    console.log(`Deleted file: ${filePath}`);
                }
            }
            catch (error) {
                console.error(`Error deleting file: ${filePath}`, error);
            }
        });
    }
    uploadFileToGitHub(filePath, content) {
        return __awaiter(this, void 0, void 0, function* () {
            try {
                const encodedContent = Buffer.from(content).toString("base64");
                const sha = yield this.getCurrentSha(filePath);
                const response = yield fetch(`https://api.github.com/repos/${this.settings.githubRepo}/contents/${filePath}`, {
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
                });
                if (!response.ok) {
                    console.error(`Failed to upload file: ${filePath}`, yield response.json());
                }
                else {
                    console.log(`Uploaded file: ${filePath}`);
                }
            }
            catch (error) {
                console.error(`Error uploading file: ${filePath}`, error);
            }
        });
    }
    getRemoteFileContent(filePath) {
        return __awaiter(this, void 0, void 0, function* () {
            try {
                const response = yield fetch(`https://api.github.com/repos/${this.settings.githubRepo}/contents/${filePath}`, {
                    headers: { Authorization: `token ${this.settings.githubToken}` },
                });
                if (response.ok) {
                    const data = yield response.json();
                    if (data.content) {
                        return Buffer.from(data.content, "base64").toString("utf-8");
                    }
                }
                else if (response.status === 404) {
                    return null; // File does not exist remotely
                }
                else {
                    console.error(`Failed to fetch remote content for ${filePath}:`, yield response.json());
                }
            }
            catch (error) {
                console.error(`Error fetching remote content for ${filePath}:`, error);
            }
            return null;
        });
    }
    getCurrentSha(filePath) {
        return __awaiter(this, void 0, void 0, function* () {
            try {
                const response = yield fetch(`https://api.github.com/repos/${this.settings.githubRepo}/contents/${filePath}`, {
                    headers: { Authorization: `token ${this.settings.githubToken}` },
                });
                if (response.ok) {
                    const data = yield response.json();
                    return data.sha;
                }
                else if (response.status === 404) {
                    return null;
                }
                else {
                    console.error(`Failed to get SHA for ${filePath}:`, yield response.json());
                    return null;
                }
            }
            catch (error) {
                console.error(`Error fetching SHA for ${filePath}:`, error);
                return null;
            }
        });
    }
    loadSettings() {
        return __awaiter(this, void 0, void 0, function* () {
            this.settings = Object.assign({}, DEFAULT_SETTINGS, yield this.loadData());
        });
    }
    saveSettings() {
        return __awaiter(this, void 0, void 0, function* () {
            yield this.saveData(this.settings);
        });
    }
    validateToken() {
        return __awaiter(this, void 0, void 0, function* () {
            try {
                const response = yield fetch(`https://api.github.com/user`, {
                    headers: { Authorization: `token ${this.settings.githubToken}` },
                });
                return response.ok;
            }
            catch (error) {
                console.error("Error validating GitHub token:", error);
                return false;
            }
        });
    }
    isValidRepo(repo) {
        const regex = /^[a-zA-Z0-9_.-]+\/[a-zA-Z0-9_.-]+$/;
        return regex.test(repo);
    }
}
exports.default = ObsidianGitHubSync;
class GitHubSyncSettingTab extends obsidian_1.PluginSettingTab {
    constructor(plugin) {
        super(plugin.app, plugin);
        this.plugin = plugin;
    }
    display() {
        const { containerEl } = this;
        containerEl.empty();
        containerEl.createEl("h2", { text: "GitHub Sync Settings" });
        new obsidian_1.Setting(containerEl)
            .setName("GitHub Repository")
            .setDesc("Enter the repository (user/repo) for syncing data.")
            .addText((text) => text
            .setPlaceholder("e.g., user/repo")
            .setValue(this.plugin.settings.githubRepo)
            .onChange((value) => __awaiter(this, void 0, void 0, function* () {
            if (this.plugin.isValidRepo(value)) {
                this.plugin.settings.githubRepo = value;
                yield this.plugin.saveSettings();
            }
            else {
                new obsidian_1.Notice("Invalid repository format. Use 'user/repo'.");
            }
        })));
        new obsidian_1.Setting(containerEl)
            .setName("GitHub Token")
            .setDesc("Enter your GitHub personal access token.")
            .addText((text) => text
            .setPlaceholder("Paste token here")
            .setValue(this.plugin.settings.githubToken)
            .onChange((value) => __awaiter(this, void 0, void 0, function* () {
            this.plugin.settings.githubToken = value;
            yield this.plugin.saveSettings();
        })));
    }
}
