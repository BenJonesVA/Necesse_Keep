#!/usr/bin/env node
const bcrypt = require("bcryptjs");

const password = process.argv[2];
if (!password) {
  console.error("Usage: node scripts/hash-password.js <password>");
  process.exit(1);
}

const hash = bcrypt.hashSync(password, 12);
console.log("Add this to your .env as UI_PASSWORD_HASH:");
console.log(hash);
