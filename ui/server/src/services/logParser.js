const fs = require("fs");
const readline = require("readline");
const path = require("path");
const config = require("../config");

const LINE_RE = /^\[(\d{4}-\d{2}-\d{2} \d{2}:\d{2}:\d{2})\]\s?(.*)$/;

// Confirmed against a REAL dedicated-server session log with an actual
// client connecting and disconnecting (not just decompiled string
// fragments -- those turned out to only be approximately right). Real
// observed lines:
//   Client "76561197969451342" connected on slot 1/5.
//   Player 76561197969451342 ("Ben") disconnected with message: Quit
// The join line only ever carries the raw client id (Steam64 id in this
// case) -- the friendly in-game name isn't revealed until later gameplay
// lines (e.g. "Ben is now AFK", "Changed Ben level to cave") or at
// disconnect. Chat and death messages have still NOT been confirmed against
// a real log line -- those stay categorized as "other" rather than guessing
// a wrong pattern. The raw tail endpoint is always available as a fallback
// for anything the parser misses.
function parseLine(line) {
  const match = LINE_RE.exec(line);
  if (!match) return null;

  const [, timestamp, message] = match;

  let type = "other";
  let player = null;
  let name = null;
  let reason = null;

  const joinMatch = /^Client "([^"]+)" connected on slot \d+\/\d+\.?$/.exec(message);
  const leaveMatch = /^Player (\S+) \("([^"]*)"\) disconnected with message: (.*)$/.exec(message);

  if (joinMatch) {
    type = "join";
    player = joinMatch[1];
  } else if (leaveMatch) {
    type = "leave";
    player = leaveMatch[1];
    name = leaveMatch[2] || null;
    reason = leaveMatch[3];
  }

  return { timestamp, type, player, name, reason, message, raw: line };
}

function listLogFiles() {
  if (!fs.existsSync(config.logsDir)) return [];
  return fs
    .readdirSync(config.logsDir)
    .filter((name) => name.endsWith(".txt"))
    .map((name) => {
      const stat = fs.statSync(path.join(config.logsDir, name));
      return { name, size: stat.size, mtime: stat.mtime };
    })
    .sort((a, b) => b.mtime - a.mtime);
}

function resolveLogFile(fileName) {
  const files = listLogFiles();
  if (fileName) {
    const found = files.find((f) => f.name === fileName);
    if (!found) return null;
    return found.name;
  }
  return files.length ? files[0].name : null;
}

async function tailLines(fileName, lineCount = 200) {
  const resolved = resolveLogFile(fileName);
  if (!resolved) return { file: null, lines: [] };

  const fullPath = path.join(config.logsDir, resolved);
  const content = fs.readFileSync(fullPath, "utf8");
  const lines = content.split(/\r?\n/).filter(Boolean);
  return { file: resolved, lines: lines.slice(-lineCount) };
}

async function parseEvents(fileName, limit = 200) {
  const resolved = resolveLogFile(fileName);
  if (!resolved) return { file: null, events: [], caveat: caveatText() };

  const fullPath = path.join(config.logsDir, resolved);
  const rl = readline.createInterface({
    input: fs.createReadStream(fullPath, "utf8"),
    crlfDelay: Infinity,
  });

  const events = [];
  for await (const line of rl) {
    const parsed = parseLine(line);
    if (parsed) events.push(parsed);
  }

  return {
    file: resolved,
    events: events.slice(-limit),
    caveat: caveatText(),
  };
}

function caveatText() {
  return "Best-effort: join/leave are confirmed from real server log output; " +
    "chat/death are not reliably detected (no confirmed message format) and " +
    "appear only in the raw tail view.";
}

// "Online now" is derived purely from the CURRENT session's log file: walk
// join/leave events in order, a join adds the player, a matching leave
// removes them, whatever's left at the end is who's still connected. This
// is log-derived, not a live console query -- it can lag a few seconds
// behind reality and depends on join/leave detection staying accurate (see
// parseLine's caveat above). Only the latest log file is considered: each
// server start writes a new file, and a restart disconnects everyone, so
// older session files have no bearing on who's online now.
async function getOnlinePlayers() {
  const resolved = resolveLogFile();
  if (!resolved) return { file: null, players: [], caveat: onlineCaveatText() };

  const fullPath = path.join(config.logsDir, resolved);
  const rl = readline.createInterface({
    input: fs.createReadStream(fullPath, "utf8"),
    crlfDelay: Infinity,
  });

  // The join line only ever carries the raw client id -- the friendly name
  // isn't revealed until a later gameplay line or at disconnect. We build up
  // a best-effort id->name map as we go: confirmed unambiguously whenever a
  // leave event names its id directly; guessed, only when exactly one
  // player is online, from name-only activity lines (AFK/level-change).
  // With 2+ concurrent players those name-only lines can't be safely
  // attributed to an id, so they're skipped rather than guessed wrong.
  const online = new Map();
  const nameById = new Map();
  const NAME_ONLY_RE = /^(?:(.+?) is (?:now|no longer) AFK|Changed (.+?) level to )/;

  for await (const line of rl) {
    const parsed = parseLine(line);
    if (!parsed) continue;

    if (parsed.type === "join") {
      online.set(parsed.player, { player: parsed.player, joinedAt: parsed.timestamp });
    } else if (parsed.type === "leave") {
      if (parsed.name) nameById.set(parsed.player, parsed.name);
      online.delete(parsed.player);
    } else if (online.size === 1) {
      const nameMatch = NAME_ONLY_RE.exec(parsed.message);
      const name = nameMatch && (nameMatch[1] || nameMatch[2]);
      if (name) nameById.set(online.keys().next().value, name);
    }
  }

  const players = Array.from(online.values()).map((p) => ({
    ...p,
    name: nameById.get(p.player) || null,
  }));

  return {
    file: resolved,
    players,
    caveat: onlineCaveatText(),
  };
}

function onlineCaveatText() {
  return "Derived from the current session's log (join minus leave), not a live server query -- " +
    "can lag a few seconds and depends on join/leave detection staying accurate.";
}

module.exports = { listLogFiles, tailLines, parseEvents, parseLine, getOnlinePlayers };
