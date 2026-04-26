const fs = require("fs");
const path = require("path");
const projectRoot = path.join(__dirname, "../..");
const tabsDir = path.join(projectRoot, "tabs");
const outputPath = path.join(projectRoot, "config.json");
const backupDir = path.join(projectRoot, "config-backups");

// Backup existing file before overwriting
if (fs.existsSync(outputPath)) {
    if (!fs.existsSync(backupDir)) {
        fs.mkdirSync(backupDir);
    }
    const timestamp = new Date().toISOString().replace(/[:.]/g, "-");
    const backupPath = path.join(backupDir, `config-${timestamp}.json`);
    fs.copyFileSync(outputPath, backupPath);
}

const result = {};
for (const file of fs.readdirSync(tabsDir)) {
    if (file.endsWith(".json")) {
        const data = JSON.parse(fs.readFileSync(path.join(tabsDir, file), "utf8"));
        const worldBackground = data.worldBackground;
        delete data.worldBackground;
        Object.assign(result, data);
        if (worldBackground !== undefined) {
            result.storySettings = result.storySettings || {};
            result.storySettings.worldBackground = worldBackground;
        }
    }
}
fs.writeFileSync(outputPath, JSON.stringify(result, null, 2));
console.log("rebuilt config.json");
