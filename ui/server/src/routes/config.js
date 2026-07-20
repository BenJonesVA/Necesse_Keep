const express = require("express");
const controlClient = require("../lib/controlClient");

const router = express.Router();

router.get("/", async (req, res, next) => {
  try {
    res.json(await controlClient.getConfig());
  } catch (err) {
    next(err);
  }
});

// Stages values only -- does not touch the running container. The client
// must call POST /api/config/apply as an explicit second step.
router.put("/", async (req, res, next) => {
  try {
    res.json({ staged: await controlClient.putConfig(req.body || {}), requiresApply: true });
  } catch (err) {
    next(err);
  }
});

router.post("/apply", async (req, res, next) => {
  try {
    res.json(await controlClient.recreate());
  } catch (err) {
    next(err);
  }
});

module.exports = router;
