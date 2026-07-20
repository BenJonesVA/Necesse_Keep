const express = require("express");
const logParser = require("../services/logParser");

const router = express.Router();

router.get("/files", (req, res) => {
  res.json(logParser.listLogFiles());
});

router.get("/events", async (req, res, next) => {
  try {
    const { file } = req.query;
    const limit = Math.min(Number(req.query.limit) || 200, 1000);
    res.json(await logParser.parseEvents(file, limit));
  } catch (err) {
    next(err);
  }
});

router.get("/tail", async (req, res, next) => {
  try {
    const { file } = req.query;
    const lines = Math.min(Number(req.query.lines) || 200, 1000);
    res.json(await logParser.tailLines(file, lines));
  } catch (err) {
    next(err);
  }
});

module.exports = router;
