// Every field the UI can stage/apply is validated here, independently of
// whatever validation the (internet-facing) ui service already did — this
// is the layer that actually has to hold if that upstream check is ever
// bypassed or buggy.

const SHELL_UNSAFE = /["'`$\\\n\r]/;

// WORLD/OWNER/MOTD get interpolated into a shell string by the game image's
// own ENTRYPOINT (`-motd "${MOTD}"`), so reject anything that could break
// out of the double quotes or inject a command substitution.
function assertShellSafe(name, value) {
  if (typeof value !== "string") {
    throw new ValidationError(`${name} must be a string`);
  }
  if (SHELL_UNSAFE.test(value)) {
    throw new ValidationError(
      `${name} contains a character that is not allowed (quotes, backticks, $, backslash, or newline)`
    );
  }
  if (value.length > 200) {
    throw new ValidationError(`${name} is too long (max 200 characters)`);
  }
}

function assertBoundedInt(name, value, min, max) {
  const n = Number(value);
  if (!Number.isInteger(n) || n < min || n > max) {
    throw new ValidationError(`${name} must be an integer between ${min} and ${max}`);
  }
  return n;
}

function assertBool01(name, value) {
  const n = Number(value);
  if (n !== 0 && n !== 1) {
    throw new ValidationError(`${name} must be 0 or 1`);
  }
  return n;
}

class ValidationError extends Error {
  constructor(message) {
    super(message);
    this.name = "ValidationError";
    this.statusCode = 400;
  }
}

// Whitelist of fields the UI is allowed to stage/apply. JVMARGS is
// deliberately excluded — it's raw arguments to the JVM (e.g. -javaagent)
// and there is no safe validation for arbitrary JVM flags.
const EDITABLE_FIELDS = [
  "WORLD",
  "SLOTS",
  "OWNER",
  "MOTD",
  "PASSWORD",
  "PAUSE",
  "GIVE_CLIENTS_POWER",
  "LOGGING",
  "ZIP",
  "HOST_PORT",
];

function validateConfigPatch(patch) {
  const clean = {};
  for (const key of Object.keys(patch)) {
    if (!EDITABLE_FIELDS.includes(key)) {
      throw new ValidationError(`${key} is not an editable field`);
    }
  }

  if ("WORLD" in patch) {
    assertShellSafe("WORLD", patch.WORLD);
    if (!/^[A-Za-z0-9_-]+$/.test(patch.WORLD)) {
      throw new ValidationError("WORLD may only contain letters, numbers, hyphens and underscores");
    }
    clean.WORLD = patch.WORLD;
  }
  if ("OWNER" in patch) {
    assertShellSafe("OWNER", patch.OWNER);
    clean.OWNER = patch.OWNER;
  }
  if ("MOTD" in patch) {
    assertShellSafe("MOTD", patch.MOTD);
    clean.MOTD = patch.MOTD;
  }
  if ("PASSWORD" in patch) {
    assertShellSafe("PASSWORD", patch.PASSWORD);
    clean.PASSWORD = patch.PASSWORD;
  }
  if ("SLOTS" in patch) {
    clean.SLOTS = assertBoundedInt("SLOTS", patch.SLOTS, 1, 250);
  }
  if ("PAUSE" in patch) {
    clean.PAUSE = assertBool01("PAUSE", patch.PAUSE);
  }
  if ("GIVE_CLIENTS_POWER" in patch) {
    clean.GIVE_CLIENTS_POWER = assertBool01("GIVE_CLIENTS_POWER", patch.GIVE_CLIENTS_POWER);
  }
  if ("LOGGING" in patch) {
    clean.LOGGING = assertBool01("LOGGING", patch.LOGGING);
  }
  if ("ZIP" in patch) {
    clean.ZIP = assertBool01("ZIP", patch.ZIP);
  }
  if ("HOST_PORT" in patch) {
    clean.HOST_PORT = assertBoundedInt("HOST_PORT", patch.HOST_PORT, 1, 65535);
  }

  return clean;
}

// Console commands are newline-delimited on the server's stdin -- a value
// containing a newline could terminate the intended command and inject a
// second one. Player identifiers are further restricted to the charset
// actual client ids (e.g. Steam64 ids) use, since we always target players
// by id (from the join/leave log or the live `players` query), never by
// free-text display name.
function assertPlayerId(value) {
  if (typeof value !== "string" || !/^[A-Za-z0-9_-]{1,64}$/.test(value)) {
    throw new ValidationError("player id must be alphanumeric (max 64 characters)");
  }
  return value;
}

function assertConsoleReason(value) {
  if (value === undefined || value === null || value === "") return "";
  if (typeof value !== "string" || /[\r\n]/.test(value) || value.length > 200) {
    throw new ValidationError("reason must be a single line, max 200 characters");
  }
  return value;
}

module.exports = {
  validateConfigPatch,
  ValidationError,
  EDITABLE_FIELDS,
  assertPlayerId,
  assertConsoleReason,
};
