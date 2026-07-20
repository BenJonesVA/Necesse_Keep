const express = require("express");
const logParser = require("../services/logParser");
const controlClient = require("../lib/controlClient");

const router = express.Router();

// Log-derived "online now" -- always available, no server config required,
// but can lag a few seconds and its identity data is best-effort (see
// logParser.js). Kept as a fallback/history view alongside the live one.
router.get("/online", async (req, res, next) => {
  try {
    res.json(await logParser.getOnlinePlayers());
  } catch (err) {
    next(err);
  }
});

// Live, authoritative player count straight from the server's own console
// (requires necesse-server to have been created with stdin_open -- control
// returns 409 with instructions if not).
router.get("/console", async (req, res, next) => {
  try {
    res.json(await controlClient.consolePlayers());
  } catch (err) {
    next(err);
  }
});

router.post("/kick", async (req, res, next) => {
  try {
    const { id, reason } = req.body || {};
    res.json(await controlClient.kick(id, reason));
  } catch (err) {
    next(err);
  }
});

router.post("/ban", async (req, res, next) => {
  try {
    const { id } = req.body || {};
    res.json(await controlClient.ban(id));
  } catch (err) {
    next(err);
  }
});

router.post("/unban", async (req, res, next) => {
  try {
    const { id } = req.body || {};
    res.json(await controlClient.unban(id));
  } catch (err) {
    next(err);
  }
});

router.get("/bans", async (req, res, next) => {
  try {
    res.json(await controlClient.bans());
  } catch (err) {
    next(err);
  }
});

module.exports = router;
