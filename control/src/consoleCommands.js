const { runCommand } = require("./console");
const { assertPlayerId, assertConsoleReason } = require("./validate");

// Response text formats below are confirmed against the live server console
// (2026-07-20), not documentation (none exists) -- see console.js for the
// attach-connection mechanics. `raw` is always included so a UI can fall
// back to showing the literal server response if the parsing here is ever
// wrong or the server's wording changes in a future game version.

const ANSI_RE = /\x1b\[[0-9;]*m/g;
const TIMESTAMP_RE = /^\[\d{4}-\d{2}-\d{2} \d{2}:\d{2}:\d{2}\]\s?/;

// Unlike the on-disk log files (plain text, no ANSI/no echo), the raw
// attach stream mirrors the interactive console exactly: each line carries
// an ANSI color reset code, the same `[timestamp]` prefix as the log files,
// AND an echoed `> <command>` line for whatever we just sent. All three
// need stripping before matching against confirmed response text.
function clean(line) {
  return line.replace(ANSI_RE, "").replace(TIMESTAMP_RE, "");
}

function cleanAndDropEcho(lines, command) {
  return lines.map(clean).filter((l) => l !== `> ${command}`);
}

async function players() {
  const raw = await runCommand("players");
  const lines = cleanAndDropEcho(raw, "players");
  const summaryLine = lines.find((l) => /Players online:/.test(l));
  const match = summaryLine && /Players online:\s*(\d+)\/(\d+)/.exec(summaryLine);

  return {
    online: match ? Number(match[1]) : null,
    max: match ? Number(match[2]) : null,
    // Any lines beyond the summary (per-player detail) -- format not
    // confirmed live (no player was connected during development), so
    // exposed as raw text rather than guessed structured fields.
    detailLines: lines.filter((l) => l !== summaryLine && l.trim().length > 0),
    raw,
  };
}

async function kick(id, reason) {
  const playerId = assertPlayerId(id);
  const cleanReason = assertConsoleReason(reason);
  const command = cleanReason ? `kick ${playerId} ${cleanReason}` : `kick ${playerId}`;
  const raw = await runCommand(command);
  const lines = cleanAndDropEcho(raw, command);
  const ok = !lines.some((l) => /could not find/i.test(l));
  return { ok, raw };
}

async function ban(id) {
  const playerId = assertPlayerId(id);
  const command = `ban ${playerId}`;
  const raw = await runCommand(command);
  const lines = cleanAndDropEcho(raw, command);
  const ok = lines.some((l) => /^Banned /.test(l)) || lines.some((l) => /already banned/i.test(l));
  return { ok, raw };
}

async function unban(id) {
  const playerId = assertPlayerId(id);
  const command = `unban ${playerId}`;
  const raw = await runCommand(command);
  const lines = cleanAndDropEcho(raw, command);
  const ok = lines.some((l) => /is no longer banned/i.test(l));
  return { ok, raw };
}

async function bans() {
  const raw = await runCommand("bans");
  const lines = cleanAndDropEcho(raw, "bans");
  if (lines.some((l) => /no listed bans/i.test(l))) {
    return { entries: [], raw };
  }
  // First line is a "N total bans:" header, remainder are one id/name per line.
  const entries = lines.slice(1).filter((l) => l.trim().length > 0);
  return { entries, raw };
}

module.exports = { players, kick, ban, unban, bans };
