const fs = require("fs");

const ENV_PATH = process.env.ENV_FILE_PATH || "/app/config/.env";

// Parses a flat KEY=VALUE .env file, preserving comments/blank lines so a
// rewrite doesn't clobber the human-authored .env.example-style layout.
function parse(text) {
  const lines = text.split(/\r?\n/);
  const values = {};
  for (const line of lines) {
    const trimmed = line.trim();
    if (!trimmed || trimmed.startsWith("#")) continue;
    const eq = trimmed.indexOf("=");
    if (eq === -1) continue;
    const key = trimmed.slice(0, eq).trim();
    const value = trimmed.slice(eq + 1);
    values[key] = value;
  }
  return { lines, values };
}

function readAll() {
  const text = fs.readFileSync(ENV_PATH, "utf8");
  return parse(text).values;
}

// Merges `patch` into the existing file, rewriting only the lines whose key
// changed and leaving comments/ordering/unrelated keys untouched. Keys in
// `patch` that don't already exist as a line are appended.
function mergeAndWrite(patch) {
  const text = fs.readFileSync(ENV_PATH, "utf8");
  const { lines } = parse(text);
  const remaining = { ...patch };

  const newLines = lines.map((line) => {
    const trimmed = line.trim();
    if (!trimmed || trimmed.startsWith("#")) return line;
    const eq = trimmed.indexOf("=");
    if (eq === -1) return line;
    const key = trimmed.slice(0, eq).trim();
    if (Object.prototype.hasOwnProperty.call(remaining, key)) {
      const value = remaining[key];
      delete remaining[key];
      return `${key}=${value}`;
    }
    return line;
  });

  for (const [key, value] of Object.entries(remaining)) {
    newLines.push(`${key}=${value}`);
  }

  const finalText = newLines.join("\n").replace(/\n*$/, "\n");

  // NOTE: .env is bind-mounted into this container as a single file (not a
  // directory), which on some platforms (notably Windows + Docker Desktop)
  // makes it impossible to atomically replace via write-tmp-then-rename --
  // the rename fails with EBUSY because the target path is itself a mount
  // point. Writing in place trades perfect crash-atomicity (acceptable for
  // a single hobbyist server with no concurrent writers) for working
  // correctly across platforms.
  fs.writeFileSync(ENV_PATH, finalText, { mode: 0o600 });

  return parse(finalText).values;
}

module.exports = { readAll, mergeAndWrite, ENV_PATH };
