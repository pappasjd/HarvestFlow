const express = require("express");
const crypto = require("crypto");

const app = express();

// Keep raw body for signature verification
app.use(
  express.json({
    verify: (req, res, buf) => {
      req.rawBody = buf;
    },
  })
);

const PORT = process.env.PORT || 3000;
const VERIFY_TOKEN = process.env.VERIFY_TOKEN || "";
const APP_SECRET = process.env.META_APP_SECRET || "";

// Health check
app.get("/", (_, res) => res.status(200).send("OK"));

// 1) Webhook verification (Meta will call this once when you add the callback URL)
app.get("/webhook", (req, res) => {
  const mode = req.query["hub.mode"];
  const token = req.query["hub.verify_token"];
  const challenge = req.query["hub.challenge"];

  if (mode === "subscribe" && token === VERIFY_TOKEN) {
    return res.status(200).send(challenge);
  }
  return res.sendStatus(403);
});

// Verify Meta signature (recommended)
function isValidSignature(req) {
  // If you haven't set META_APP_SECRET yet, allow (dev); set it for production.
  if (!APP_SECRET) return true;

  const header = req.get("x-hub-signature-256");
  if (!header) return false;

  const [algo, sig] = header.split("=");
  if (algo !== "sha256" || !sig) return false;

  const expected = crypto
    .createHmac("sha256", APP_SECRET)
    .update(req.rawBody || Buffer.from(""))
    .digest("hex");

  const sigBuf = Buffer.from(sig, "hex");
  const expBuf = Buffer.from(expected, "hex");
  if (sigBuf.length !== expBuf.length) return false;

  return crypto.timingSafeEqual(sigBuf, expBuf);
}

// 2) Receive events (Meta will POST JSON here)
app.post("/webhook", async (req, res) => {
  if (!isValidSignature(req)) return res.sendStatus(401);

  const body = req.body;

  // Always ACK fast to prevent retries
  res.sendStatus(200);

  // Log payload (view in Railway logs)
  console.log("=== WEBHOOK EVENT ===");
  console.log(JSON.stringify(body, null, 2));

  // Optional: basic parsing examples (depends on what you subscribe to)
  try {
    if (body.object === "page" && Array.isArray(body.entry)) {
      for (const entry of body.entry) {
        // Comments/Feed changes often appear in entry.changes
        if (Array.isArray(entry.changes)) {
          for (const ch of entry.changes) {
            console.log("CHANGE field:", ch.field);
            // ch.value varies: could be feed/comment info, etc.
          }
        }
        // Messenger events appear in entry.messaging (if subscribed)
        if (Array.isArray(entry.messaging)) {
          for (const msg of entry.messaging) {
            console.log("MESSAGING event:", msg);
          }
        }
      }
    }
  } catch (e) {
    console.error("Parse error:", e);
  }
});

app.listen(PORT, () => console.log(`Listening on port ${PORT}`));
