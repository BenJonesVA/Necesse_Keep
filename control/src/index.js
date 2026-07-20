const express = require("express");
const dockerService = require("./dockerService");
const envFile = require("./envFile");
const { validateConfigPatch, ValidationError, EDITABLE_FIELDS } = require("./validate");
const consoleCommands = require("./consoleCommands");
const { ConsoleUnavailableError } = require("./console");

const app = express();
app.use(express.json());

// This service is never published to a host port and never reachable from
// the internet -- only the ui service, over the internal `backend` Docker
// network, talks to it. Every route below accepts only the specific scalar
// fields it needs; nothing here accepts an Image/Binds/Cmd/Privileged field
// from the caller, so a compromised caller cannot pivot into arbitrary
// container creation even though this process holds docker.sock.

app.get("/status", async (req, res, next) => {
  try {
    res.json(await dockerService.getStatus());
  } catch (err) {
    next(err);
  }
});

app.post("/start", async (req, res, next) => {
  try {
    await dockerService.start();
    res.json({ ok: true });
  } catch (err) {
    next(err);
  }
});

app.post("/stop", async (req, res, next) => {
  try {
    await dockerService.stop();
    res.json({ ok: true });
  } catch (err) {
    next(err);
  }
});

app.post("/restart", async (req, res, next) => {
  try {
    await dockerService.restart();
    res.json({ ok: true });
  } catch (err) {
    next(err);
  }
});

app.get("/config", (req, res, next) => {
  try {
    const all = envFile.readAll();
    const visible = {};
    for (const key of EDITABLE_FIELDS) visible[key] = all[key];
    res.json(visible);
  } catch (err) {
    next(err);
  }
});

// Stages values into .env WITHOUT touching the running container.
app.put("/config", (req, res, next) => {
  try {
    const clean = validateConfigPatch(req.body || {});
    const updated = envFile.mergeAndWrite(clean);
    const visible = {};
    for (const key of EDITABLE_FIELDS) visible[key] = updated[key];
    res.json(visible);
  } catch (err) {
    next(err);
  }
});

// Recreates the necesse-server container from the currently-persisted .env.
app.post("/recreate", async (req, res, next) => {
  try {
    const result = await dockerService.recreateNecesseContainer();
    res.json(result);
  } catch (err) {
    next(err);
  }
});

// Live console commands (players/kick/ban/unban/bans) -- confirmed against
// the real server console (see consoleCommands.js). Requires the necesse
// container to have been created with stdin_open; if not, these return 409
// with instructions rather than hanging.

app.get("/console/players", async (req, res, next) => {
  try {
    res.json(await consoleCommands.players());
  } catch (err) {
    next(err);
  }
});

app.post("/console/kick", async (req, res, next) => {
  try {
    const { id, reason } = req.body || {};
    res.json(await consoleCommands.kick(id, reason));
  } catch (err) {
    next(err);
  }
});

app.post("/console/ban", async (req, res, next) => {
  try {
    const { id } = req.body || {};
    res.json(await consoleCommands.ban(id));
  } catch (err) {
    next(err);
  }
});

app.post("/console/unban", async (req, res, next) => {
  try {
    const { id } = req.body || {};
    res.json(await consoleCommands.unban(id));
  } catch (err) {
    next(err);
  }
});

app.get("/console/bans", async (req, res, next) => {
  try {
    res.json(await consoleCommands.bans());
  } catch (err) {
    next(err);
  }
});

app.use((err, req, res, next) => {
  if (err instanceof ValidationError) {
    return res.status(err.statusCode).json({ error: err.message });
  }
  if (err instanceof ConsoleUnavailableError) {
    return res.status(err.statusCode).json({ error: err.message });
  }
  console.error(err);
  res.status(500).json({ error: "internal_error" });
});

const PORT = process.env.PORT || 4000;
app.listen(PORT, () => {
  console.log(`control listening on ${PORT}`);
});
