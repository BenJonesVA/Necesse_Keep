const fs = require("fs");
const path = require("path");
const AdmZip = require("adm-zip");
const config = require("../config");

// World saves are .zip archives, most commonly under saves/worlds/ inside
// the mounted volume. Each archive is expected to contain a plain-text
// worldSettings.cfg with basic metadata -- but a save can legitimately be
// an empty placeholder (e.g. a world that was created but never actually
// played), so this degrades gracefully rather than erroring.
function findSaveFiles(dir) {
  if (!fs.existsSync(dir)) return [];
  const results = [];
  for (const entry of fs.readdirSync(dir, { withFileTypes: true })) {
    const fullPath = path.join(dir, entry.name);
    if (entry.isDirectory()) {
      results.push(...findSaveFiles(fullPath));
    } else if (entry.name.endsWith(".zip")) {
      results.push(fullPath);
    }
  }
  return results;
}

function readWorldSettings(zipPath) {
  try {
    const zip = new AdmZip(zipPath);
    const entry = zip
      .getEntries()
      .find((e) => e.entryName.toLowerCase().endsWith("worldsettings.cfg"));
    if (!entry) return null;
    return entry.getData().toString("utf8");
  } catch {
    // Empty or unreadable archive (e.g. a world that was created but never
    // ticked/saved) -- not an error, just nothing to show.
    return null;
  }
}

function listSaves() {
  const files = findSaveFiles(config.savesDir);
  return files.map((fullPath) => {
    const stat = fs.statSync(fullPath);
    return {
      name: path.relative(config.savesDir, fullPath),
      size: stat.size,
      mtime: stat.mtime,
      worldSettings: stat.size > 0 ? readWorldSettings(fullPath) : null,
    };
  });
}

module.exports = { listSaves };
