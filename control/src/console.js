const Docker = require("dockerode");
const { Writable } = require("stream");
const { ValidationError } = require("./validate");

const docker = new Docker({ socketPath: "/var/run/docker.sock" });
const CONTAINER_NAME = process.env.NECESSE_CONTAINER_NAME || "necesse-server";

// The Necesse dedicated server has no RCON/API -- the only way to send it
// commands is its interactive stdin console (confirmed live: `players`,
// `kick <player> [<reason>]`, `ban <authentication/name>`,
// `unban <authentication/name>`, `bans`). This module maintains ONE
// long-lived `docker attach` connection and serializes commands through it
// (attach is a shared broadcast stream -- running two commands concurrently
// would interleave their output with no way to tell which response belongs
// to which command).
//
// Known dockerode/docker-modem 4.0.12 quirk: dial() unconditionally
// JSON-stringifies the attach() options as a POST body and writes it into
// the hijacked stream before anything else, so the FIRST bytes the
// container's stdin ever sees are garbage. Confirmed via direct testing.
// Sending a lone newline immediately after attaching turns that garbage
// into its own harmless "could not find command" line and gives every real
// command afterward a clean line to itself.

let state = null; // { containerId, stream, buffer: string[], primed: boolean }
let queue = Promise.resolve();

function appendLine(bufferLines, text) {
  for (const line of text.split(/\r?\n/)) {
    if (line.length) bufferLines.push(line);
  }
  if (bufferLines.length > 2000) bufferLines.splice(0, bufferLines.length - 2000);
}

async function ensureAttached() {
  const container = docker.getContainer(CONTAINER_NAME);
  const info = await container.inspect();

  if (state && state.containerId === info.Id && !state.stream.destroyed) {
    return state;
  }

  if (!info.Config.OpenStdin) {
    throw new ConsoleUnavailableError(
      "necesse-server was not started with stdin open -- recreate it (docker compose up -d, or Apply in the UI) after enabling stdin_open."
    );
  }

  const stream = await container.attach({
    stream: true,
    stdin: true,
    stdout: true,
    stderr: true,
    hijack: true,
  });

  const bufferLines = [];
  const sink = (target) =>
    new Writable({
      write(chunk, enc, cb) {
        appendLine(target, chunk.toString("utf8"));
        cb();
      },
    });
  container.modem.demuxStream(stream, sink(bufferLines), sink(bufferLines));

  stream.on("error", () => {
    if (state && state.stream === stream) state = null;
  });
  stream.on("close", () => {
    if (state && state.stream === stream) state = null;
  });

  state = { containerId: info.Id, stream, buffer: bufferLines, primed: false };

  // Absorb the dockerode body-pollution artifact (see note above) before
  // any real command is ever sent on this connection.
  stream.write("\n");
  await new Promise((r) => setTimeout(r, 300));
  state.buffer.length = 0;
  state.primed = true;

  return state;
}

class ConsoleUnavailableError extends Error {
  constructor(message) {
    super(message);
    this.name = "ConsoleUnavailableError";
    this.statusCode = 409;
  }
}

// Runs one console command and returns the lines the server printed in
// response. Serialized via `queue` so concurrent callers never interleave.
function runCommand(command, { waitMs = 800 } = {}) {
  if (/[\r\n]/.test(command)) {
    throw new ValidationError("command must not contain a newline");
  }

  const task = queue.then(async () => {
    const s = await ensureAttached();
    const startIndex = s.buffer.length;
    s.stream.write(command + "\n");
    await new Promise((r) => setTimeout(r, waitMs));
    return s.buffer.slice(startIndex);
  });

  // Keep the queue alive even if this particular command's caller doesn't
  // await it / it rejects -- one failed command shouldn't wedge the queue.
  queue = task.catch(() => {});
  return task;
}

module.exports = { runCommand, ConsoleUnavailableError };
