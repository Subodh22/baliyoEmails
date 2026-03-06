import { Router } from "express";
import { z } from "zod";
import { prisma } from "@baliyoemails/db";
import { requireAuth, AuthRequest } from "../middleware/auth";
import { replyDetectorQueue } from "@baliyoemails/queue";

export const accountsRouter = Router();
accountsRouter.use(requireAuth);

const accountSchema = z.object({
  email: z.string().email(),
  name: z.string().min(1),
  type: z.enum(["gmail", "outlook", "smtp", "ses"]),
  smtpHost: z.string().optional(),
  smtpPort: z.number().optional(),
  smtpUser: z.string().optional(),
  smtpPassEnc: z.string().optional(),
  imapHost: z.string().optional(),
  imapPort: z.number().optional(),
  sesAccessKeyId: z.string().optional().transform(v => v || undefined),
  sesSecretKey: z.string().optional().transform(v => v || undefined),
  sesRegion: z.string().optional().transform(v => v || undefined),
  dailyLimit: z.number().min(1).max(1000).default(50),
  warmupEnabled: z.boolean().default(false),
});

// List accounts
accountsRouter.get("/", async (req: AuthRequest, res) => {
  const accounts = await prisma.emailAccount.findMany({
    where: { workspaceId: req.workspaceId },
    orderBy: { createdAt: "desc" },
    select: {
      id: true,
      email: true,
      name: true,
      type: true,
      status: true,
      dailyLimit: true,
      sentToday: true,
      warmupEnabled: true,
      lastCheckedAt: true,
      createdAt: true,
    },
  });

  res.json({ data: accounts });
});

// Connect account
accountsRouter.post("/", async (req: AuthRequest, res) => {
  const parsed = accountSchema.safeParse(req.body);
  if (!parsed.success) {
    return res.status(400).json({ error: "validation_error", details: parsed.error.flatten() });
  }

  const account = await prisma.emailAccount.create({
    data: { workspaceId: req.workspaceId!, ...parsed.data },
  });

  // Schedule IMAP polling every 5 minutes
  if (account.imapHost) {
    await replyDetectorQueue.add(
      `poll-${account.id}`,
      { accountId: account.id },
      { repeat: { every: 5 * 60 * 1000 } }
    );
  }

  res.status(201).json({ data: account });
});

// Get account health
accountsRouter.get("/:id/health", async (req: AuthRequest, res) => {
  const account = await prisma.emailAccount.findFirst({
    where: { id: req.params.id, workspaceId: req.workspaceId },
    select: {
      id: true,
      email: true,
      status: true,
      sentToday: true,
      dailyLimit: true,
      lastCheckedAt: true,
      warmupEnabled: true,
    },
  });

  if (!account) return res.status(404).json({ error: "not_found" });

  const last7Days = await prisma.emailSent.groupBy({
    by: ["sentAt"],
    where: {
      accountId: req.params.id,
      sentAt: { gte: new Date(Date.now() - 7 * 24 * 60 * 60 * 1000) },
    },
    _count: { id: true },
  });

  res.json({
    data: {
      ...account,
      utilization: account.dailyLimit > 0 ? account.sentToday / account.dailyLimit : 0,
      last7DaysSent: last7Days,
    },
  });
});

// Delete account
accountsRouter.delete("/:id", async (req: AuthRequest, res) => {
  await prisma.emailAccount.deleteMany({
    where: { id: req.params.id, workspaceId: req.workspaceId },
  });
  res.json({ data: { deleted: true } });
});
