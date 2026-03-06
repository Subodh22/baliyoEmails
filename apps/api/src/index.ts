import "dotenv/config";
import express from "express";
import cors from "cors";
import helmet from "helmet";
import rateLimit from "express-rate-limit";
import * as Sentry from "@sentry/node";

import { authRouter } from "./routes/auth";
import { campaignsRouter } from "./routes/campaigns";
import { sequencesRouter } from "./routes/sequences";
import { leadsRouter } from "./routes/leads";
import { accountsRouter } from "./routes/accounts";
import { domainsRouter } from "./routes/domains";
import { analyticsRouter } from "./routes/analytics";
import { trackRouter } from "./routes/track";
import { webhooksRouter } from "./routes/webhooks";
import { billingRouter } from "./routes/billing";
import { inboxRouter } from "./routes/inbox";
import { apiKeysRouter } from "./routes/api-keys";

const app = express();
const PORT = process.env.PORT ?? 4000;

// ── Sentry ────────────────────────────────────────────────────────────────────
if (process.env.SENTRY_DSN) {
  Sentry.init({ dsn: process.env.SENTRY_DSN });
}

// ── Security ──────────────────────────────────────────────────────────────────
app.use(
  helmet({
    crossOriginResourcePolicy: { policy: "cross-origin" },
  })
);
app.use(
  cors({
    origin: process.env.NEXT_PUBLIC_APP_URL ?? "http://localhost:3000",
    credentials: true,
  })
);

// ── Rate limiting ─────────────────────────────────────────────────────────────
app.use(
  "/api",
  rateLimit({
    windowMs: 60 * 1000,
    max: 200,
    standardHeaders: true,
    legacyHeaders: false,
  })
);

// ── Body parsing ──────────────────────────────────────────────────────────────
// Raw for stripe webhook
app.use("/api/webhooks/stripe", express.raw({ type: "application/json" }));
app.use("/api/webhooks/ses", express.json());
app.use(express.json({ limit: "10mb" }));

// ── Routes ────────────────────────────────────────────────────────────────────
app.use("/api/auth", authRouter);
app.use("/api/campaigns", campaignsRouter);
app.use("/api/sequences", sequencesRouter);
app.use("/api/leads", leadsRouter);
app.use("/api/accounts", accountsRouter);
app.use("/api/domains", domainsRouter);
app.use("/api/analytics", analyticsRouter);
app.use("/api/track", trackRouter);
app.use("/api/webhooks", webhooksRouter);
app.use("/api/billing", billingRouter);
app.use("/api/inbox", inboxRouter);
app.use("/api/api-keys", apiKeysRouter);

// ── Health ────────────────────────────────────────────────────────────────────
app.get("/health", (_req, res) => res.json({ status: "ok" }));

// ── Error handling ────────────────────────────────────────────────────────────
app.use(
  (
    err: Error,
    _req: express.Request,
    res: express.Response,
    _next: express.NextFunction
  ) => {
    console.error(err);
    res.status(500).json({ error: "internal_error", message: err.message });
  }
);

app.listen(PORT, () => {
  console.log(`API listening on :${PORT}`);
});

export default app;
