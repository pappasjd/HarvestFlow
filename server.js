const express = require("express");
const crypto = require("crypto");

const app = express();

// Preserve raw body for signature validation
app.use(
  express.json({
    verify: (req, res, buf) => {
      req.rawBody = buf;
    },
  })
);

const PORT = process.env.PORT || 3000;

// Trim to prevent hidden whitespace issues
const VERIFY_TOKEN = (process.env.VERIFY_TOKEN || "").trim();
const APP_SECRET = (process.env.META_APP_SECRET || "").trim();

console.log("Server starting...");
console.log("Loaded VERIFY_TOKEN:", JSON.stringify(VERIFY_TOKEN));

// Health check
app.get("/", (req, res) => {
