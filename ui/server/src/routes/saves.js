const express = require("express");
const savesReader = require("../services/savesReader");

const router = express.Router();

router.get("/", (req, res, next) => {
  try {
    res.json(savesReader.listSaves());
  } catch (err) {
    next(err);
  }
});

module.exports = router;
