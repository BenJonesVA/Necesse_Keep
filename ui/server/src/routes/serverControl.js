const express = require("express");
const controlClient = require("../lib/controlClient");

const router = express.Router();

router.get("/status", async (req, res, next) => {
  try {
    res.json(await controlClient.getStatus());
  } catch (err) {
    next(err);
  }
});

router.post("/start", async (req, res, next) => {
  try {
    res.json(await controlClient.start());
  } catch (err) {
    next(err);
  }
});

router.post("/stop", async (req, res, next) => {
  try {
    res.json(await controlClient.stop());
  } catch (err) {
    next(err);
  }
});

router.post("/restart", async (req, res, next) => {
  try {
    res.json(await controlClient.restart());
  } catch (err) {
    next(err);
  }
});

module.exports = router;
