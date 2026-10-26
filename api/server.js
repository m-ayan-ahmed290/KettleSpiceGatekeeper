/**
 * api/server.js — Express REST API for the KTG Dashboard.
 *
 * HOW IT WORKS:
 *   This runs inside the same Node.js process as the Discord bot.
 *   It exposes a small set of authenticated endpoints so the Vercel
 *   dashboard can query live bot data (uptime, channels, roles, members)
 *   and trigger bot actions (timeout, refresh roles, re-register commands).
 *
 * SECURITY:
 *   Every request must include the header:
 *     x-bot-secret: <BOT_API_SECRET from .env>
 *   This secret must match the BOT_API_SECRET in the dashboard's Vercel env.
 *
 * SETUP:
 *   1. npm install express cors
 *   2. Add to your .env:
 *        BOT_API_SECRET=some_long_random_string
 *        BOT_API_PORT=4000          (optional, defaults to 4000)
 *   3. Call startApiServer(client) from index.js after client.login()
 *   4. In wispbyte, make sure port 4000 (or your chosen port) is exposed
 *      and note the public URL — that becomes BOT_API_URL in Vercel.
 */

const { timingSafeEqual } = require("crypto");
const { resourceStats } = require("../utilities/resourceStats");
const express = require("express");
const cors = require("cors");
require("dotenv").config();

const creditSchema = require("../schemas/credits");
const legacyCreditSchema = require("../schemas/legacyCredits");

const SECRET = process.env.BOT_API_SECRET;
const PORT = parseInt(process.env.BOT_API_PORT || process.env.PORT || process.env.SERVER_PORT || "4000", 10);
const GUILD_ID = process.env.GUILD_ID || require("../presets/kettle.json").primaryGuildId; // same as config.json guildId

// ─── Auth middleware ──────────────────────────────────────────────────────────

function auth(req, res, next) {
  if (!SECRET) return res.status(503).json({ error: "Dashboard API is disabled: set BOT_API_SECRET" });
  const supplied = Buffer.from(req.headers["x-bot-secret"] || "");
  const expected = Buffer.from(SECRET);
  if (supplied.length !== expected.length || !timingSafeEqual(supplied, expected))
    return res.status(401).json({ error: "Unauthorized" });
  next();
}

// ─── Main export ──────────────────────────────────────────────────────────────

function createApiApp(client) {
  const app = express();

  app.use(
    cors({
      origin: process.env.DASHBOARD_URL ?? "*",
      methods: ["GET", "POST", "PATCH", "DELETE"],
      allowedHeaders: ["Content-Type", "x-bot-secret", "x-guild-id"],
      exposedHeaders: ["X-Next-Cursor"],
    }),
  );
  app.disable("x-powered-by");
  app.get("/health", (req, res) => {
    const ready = client.isReady() && client.dataReady !== false && require("mongoose").connection.readyState === 1;
    res.status(ready ? 200 : 503).json({ ok: ready });
  });
  app.use(auth);
  app.use(express.json({ limit: "16kb" }));
  app.use((req, res, next) => {
    if (client.dataReady === false && !["/bot/stats", "/bot/guilds"].includes(req.path))
      return res.status(503).json({ error: "Database initialization or legacy import is in progress" });
    next();
  });
  app.get("/bot/guilds", (req, res) => res.json([...client.guilds.cache.values()].slice(0, 100).map(guild => ({ id: guild.id, name: guild.name }))));
  // The API secret is an operator credential for all bot guilds. Scope every route explicitly.
  app.use((req, res, next) => {
    const id = req.headers["x-guild-id"] || req.query.guildId || GUILD_ID;
    if (typeof id !== "string" || !/^\d{17,20}$/.test(id) || !client.guilds.cache.has(id))
      return res.status(404).json({ error: "Choose a guild the bot belongs to, using x-guild-id or ?guildId=" });
    req.guildId = id; next();
  });

  // ── GET /bot/stats ─────────────────────────────────────────────────────────
  app.get("/bot/stats", (req, res) => {
    const guild = client.guilds.cache.get(req.guildId);
    const mem = process.memoryUsage();

    res.json({
      online: client.isReady() && client.dataReady !== false,
      resources: resourceStats(),
      uptime: client.uptime,
      ping: client.ws.ping,
      guildName: guild?.name ?? "Unknown",
      guildIcon: guild?.iconURL({}) ?? null,
      memberCount: guild?.memberCount ?? 0,
      channelCount: guild?.channels.cache.size ?? 0,
      roleCount: guild?.roles.cache.size ?? 0,
      heapMB: (mem.heapUsed / 1024 / 1024).toFixed(1),
      rssMB: (mem.rss / 1024 / 1024).toFixed(1),
      commandCount: client.commands?.size ?? 0,
    });
  });

  // ── GET /bot/guild/channels ────────────────────────────────────────────────
  app.get("/bot/guild/channels", (req, res) => {
    const guild = client.guilds.cache.get(req.guildId);
    if (!guild) return res.status(404).json({ error: "Guild not cached" });

    const channels = guild.channels.cache
      .filter((c) => c.type === 0)
      .map((c) => ({
        id: c.id,
        name: c.name,
        parentName: c.parent?.name ?? null,
      }))
      .sort((a, b) => a.name.localeCompare(b.name));

    res.json(channels);
  });

  // ── GET /bot/guild/roles ───────────────────────────────────────────────────
  app.get("/bot/guild/roles", (req, res) => {
    const guild = client.guilds.cache.get(req.guildId);
    if (!guild) return res.status(404).json({ error: "Guild not cached" });

    const roles = guild.roles.cache
      .filter((r) => !r.managed && r.name !== "@everyone")
      .map((r) => ({
        id: r.id,
        name: r.name,
        color: r.hexColor,
        position: r.position,
      }))
      .sort((a, b) => b.position - a.position);

    res.json(roles);
  });

  // ── GET /bot/guild/members ─────────────────────────────────────────────────
  app.get("/bot/guild/members", async (req, res) => {
    const guild = client.guilds.cache.get(req.guildId);
    if (!guild) return res.status(404).json({ error: "Guild not cached" });

    const limit = parseLimit(req.query.limit, 100, 100);
    try {
      const after = req.query.after;
      if (after && !/^\d{17,20}$/.test(after)) return res.status(400).json({ error: "Invalid after cursor" });
      const members = await guild.members.list({ limit, after, cache: false });
      if (members.size) res.set("X-Next-Cursor", members.last().id);
      const list = members
        .filter((m) => !m.user.bot)
        .map((m) => ({
          id: m.user.id,
          username: m.user.tag,
          avatar: m.user.displayAvatarURL({}),
          nickname: m.nickname ?? null,
          roles: m.roles.cache
            .filter((r) => r.name !== "@everyone")
            .map((r) => ({ id: r.id, name: r.name })),
          timedOutUntil: m.communicationDisabledUntilTimestamp,
          joinedAt: m.joinedAt?.toISOString() ?? null,
        }))
        .slice(0, limit);
      res.json(list);
    } catch (err) {
      res.status(500).json({ error: err.message });
    }
  });

  // ── POST /bot/timeout ──────────────────────────────────────────────────────
  app.post("/bot/timeout", async (req, res) => {
    const { userId, durationMs, reason } = req.body;
    if (!/^\d{17,20}$/.test(userId || "") || !Number.isSafeInteger(durationMs) || durationMs <= 0 || durationMs > 28 * 86400_000)
      return res.status(400).json({ error: "userId and durationMs required" });

    const guild = client.guilds.cache.get(req.guildId);
    try {
      const member = await guild.members.fetch(userId);
      await member.timeout(durationMs, reason ?? "Dashboard action");
      res.json({ ok: true });
    } catch (err) {
      res.status(500).json({ error: err.message });
    }
  });

  // ── POST /bot/untimeout ────────────────────────────────────────────────────
  app.post("/bot/untimeout", async (req, res) => {
    const { userId } = req.body;
    if (typeof userId !== "string" || !/^\d{17,20}$/.test(userId)) return res.status(400).json({ error: "userId required" });

    const guild = client.guilds.cache.get(req.guildId);
    try {
      const member = await guild.members.fetch(userId);
      await member.timeout(null, "Dashboard: timeout lifted");
      res.json({ ok: true });
    } catch (err) {
      res.status(500).json({ error: err.message });
    }
  });

  // ── POST /bot/roles/refresh ────────────────────────────────────────────────
  app.post("/bot/roles/refresh", async (req, res) => {
    try {
      const { assignRolesToAllMembers } = require("../utilities/functions");
      await assignRolesToAllMembers(client.guilds.cache.get(req.guildId));
      res.json({ ok: true });
    } catch (err) {
      res.status(500).json({ error: err.message });
    }
  });

  // ── POST /bot/commands/register ────────────────────────────────────────────
  app.post("/bot/commands/register", async (req, res) => {
    try {
      const fs = require("fs");
      const path = require("path");
      const files = fs
        .readdirSync(path.join(__dirname, "../commands"))
        .filter((f) => f.endsWith(".js"));
      const cmds = files
        .map((f) => require(`../commands/${f}`))
        .filter((c) => c?.data)
        .map((c) => c.data);
      await client.application.commands.set(cmds);
      res.json({ ok: true, count: cmds.length });
    } catch (err) {
      res.status(500).json({ error: err.message });
    }
  });

  // ── GET /bot/credits ────────────────────────────────────────────────────────
  // Live credits leaderboard (post-rework). ?limit=N caps the result (default 50, max 200).
  app.get("/bot/credits", async (req, res) => {
    try {
      const limit = parseLimit(req.query.limit, 50, 200);
      const users = await creditSchema
        .find({ GuildID: req.guildId })
        .select("Username UserID Credits Blocked Reason")
        .sort({ Credits: -1 })
        .limit(limit)
        .lean();
      res.json(users);
    } catch (err) {
      res.status(500).json({ error: err.message });
    }
  });

  // ── GET /bot/credits/legacy ─────────────────────────────────────────────────
  // Archived pre-rework leaderboard — same shape, separate collection.
  app.get("/bot/credits/legacy", async (req, res) => {
    try {
      const limit = parseLimit(req.query.limit, 50, 200);
      const users = await legacyCreditSchema
        .find({ GuildID: req.guildId })
        .select("Username UserID Credits Blocked Reason")
        .sort({ Credits: -1 })
        .limit(limit)
        .lean();
      res.json(users);
    } catch (err) {
      res.status(500).json({ error: err.message });
    }
  });

  // ── GET /bot/credits/:userId ────────────────────────────────────────────────
  // Single user's credit record, including their Action history.
  // Pass ?legacy=true to look the user up in the archived leaderboard instead.
  app.get("/bot/credits/:userId", async (req, res) => {
    try {
      const model =
        req.query.legacy === "true" ? legacyCreditSchema : creditSchema;
      const user = await model.findOne({ GuildID: req.guildId, UserID: req.params.userId }).slice("Action", -100).lean();
      if (!user)
        return res
          .status(404)
          .json({ error: "No credit record for this user" });
      res.json(user);
    } catch (err) {
      res.status(500).json({ error: err.message });
    }
  });

  // ── POST /bot/credits/adjust ────────────────────────────────────────────────
  // Manual correction from the dashboard. `amount` may be negative.
  // Body: { userId, username?, amount, reason }
  app.post("/bot/credits/adjust", async (req, res) => {
    const { userId, username, amount, reason } = req.body;
    if (typeof userId !== "string" || !/^\d{17,20}$/.test(userId) || !Number.isSafeInteger(amount) || typeof reason !== "string" || !reason.trim() || reason.length > 1000 || (username != null && typeof username !== "string")) {
      return res
        .status(400)
        .json({ error: "userId, numeric amount, and reason are required" });
    }

    try {
      const creditUser = await creditSchema.findOneAndUpdate({ GuildID: req.guildId, UserID: userId }, [
        { $set: {
          GuildID: { $literal: req.guildId },
          UserID: { $literal: userId },
          Username: username ? { $literal: username } : { $ifNull: ["$Username", { $literal: userId }] },
          Credits: { $max: [0, { $add: [{ $ifNull: ["$Credits", 0] }, amount] }] },
          Action: { $concatArrays: [{ $ifNull: ["$Action", []] }, { $literal: [{
            Date: new Date(), ActionReason: reason, Credit: amount >= 0 ? `+${amount}` : `${amount}`,
          }] }] },
        } },
      ], { upsert: true, new: true });
      res.json({ ok: true, credits: creditUser.Credits });
    } catch (err) {
      res.status(500).json({ error: err.message });
    }
  });

  // ── POST /bot/credits/block ─────────────────────────────────────────────────
  // Body: { userId, reason? }
  app.post("/bot/credits/block", async (req, res) => {
    const { userId, reason } = req.body;
    if (typeof userId !== "string" || !/^\d{17,20}$/.test(userId)) return res.status(400).json({ error: "userId required" });

    try {
      const creditUser = await creditSchema.findOneAndUpdate(
        { GuildID: req.guildId, UserID: userId },
        { $set: { Blocked: true, Reason: reason ?? "Blocked via dashboard" } },
        { upsert: true, new: true },
      );
      res.json({ ok: true, user: creditUser });
    } catch (err) {
      res.status(500).json({ error: err.message });
    }
  });

  // ── POST /bot/credits/unblock ───────────────────────────────────────────────
  // Body: { userId }
  app.post("/bot/credits/unblock", async (req, res) => {
    const { userId } = req.body;
    if (typeof userId !== "string" || !/^\d{17,20}$/.test(userId)) return res.status(400).json({ error: "userId required" });

    try {
      const creditUser = await creditSchema.findOneAndUpdate(
        { GuildID: req.guildId, UserID: userId },
        { $set: { Blocked: false, Reason: "" } },
        { new: true },
      );
      if (!creditUser)
        return res
          .status(404)
          .json({ error: "No credit record for this user" });
      res.json({ ok: true, user: creditUser });
    } catch (err) {
      res.status(500).json({ error: err.message });
    }
  });

  return app;
}

function startApiServer(client) {
  const app = createApiApp(client);
  const server = app.listen(PORT, () => {
    console.log(`[API] Dashboard REST server listening on port ${PORT}`);
  });
  server.maxConnections = 32;
  server.requestTimeout = 15_000;
  server.headersTimeout = 10_000;
  server.on("error", error => console.error("[API]", error.message));
  return server;
}
function parseLimit(value, fallback, max) {
  const parsed = Number(value);
  return Number.isInteger(parsed) && parsed > 0 ? Math.min(parsed, max) : fallback;
}

module.exports = { startApiServer, createApiApp };
