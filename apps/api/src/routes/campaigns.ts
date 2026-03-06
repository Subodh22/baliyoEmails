import { Router } from "express";
import { z } from "zod";
import { prisma } from "@baliyoemails/db";
import { requireAuth, AuthRequest } from "../middleware/auth";
import { sequenceSchedulerQueue, emailSendQueue } from "@baliyoemails/queue";
import nodemailer from "nodemailer";
import { SESClient, SendRawEmailCommand } from "@aws-sdk/client-ses";

export const campaignsRouter = Router();

const campaignSchema = z.object({
  name: z.string().min(1).max(255),
  sequenceId: z.string(),
  timezone: z.string().default("UTC"),
  sendingDays: z.array(z.number().min(0).max(6)).default([1, 2, 3, 4, 5]),
  sendingStartHour: z.number().min(0).max(23).default(9),
  sendingEndHour: z.number().min(0).max(23).default(17),
  dailySendingLimit: z.number().min(1).max(500).default(50),
  bounceThreshold: z.number().min(0).max(1).default(0.05),
  fromName: z.string().optional(),
  replyToEmail: z.string().email().optional(),
  trackingEnabled: z.boolean().default(true),
});

campaignsRouter.use(requireAuth);

// List campaigns
campaignsRouter.get("/", async (req: AuthRequest, res) => {
  const campaigns = await prisma.campaign.findMany({
    where: { workspaceId: req.workspaceId },
    orderBy: { createdAt: "desc" },
    include: {
      _count: { select: { campaignLeads: true } },
      sequence: { select: { id: true, name: true } },
    },
  });

  // Enrich with computed stats
  const enriched = await Promise.all(
    campaigns.map(async (c) => {
      const stats = await prisma.emailEvent.groupBy({
        by: ["type"],
        where: { email: { campaignId: c.id } },
        _count: { type: true },
      });

      const statMap = Object.fromEntries(
        stats.map((s) => [s.type, s._count.type])
      );

      return {
        ...c,
        stats: {
          sent: statMap.sent ?? 0,
          opens: statMap.opened ?? 0,
          clicks: statMap.clicked ?? 0,
          replies: statMap.replied ?? 0,
          bounces: statMap.bounced ?? 0,
        },
      };
    })
  );

  res.json({ data: enriched });
});

// Create campaign
campaignsRouter.post("/", async (req: AuthRequest, res) => {
  const parsed = campaignSchema.safeParse(req.body);
  if (!parsed.success) {
    return res.status(400).json({ error: "validation_error", details: parsed.error.flatten() });
  }

  const campaign = await prisma.campaign.create({
    data: { workspaceId: req.workspaceId!, ...parsed.data },
  });

  res.status(201).json({ data: campaign });
});

// Get campaign
campaignsRouter.get("/:id", async (req: AuthRequest, res) => {
  const campaign = await prisma.campaign.findFirst({
    where: { id: req.params.id, workspaceId: req.workspaceId },
    include: {
      sequence: { include: { steps: { orderBy: { stepNumber: "asc" } } } },
      _count: { select: { campaignLeads: true } },
      campaignLeads: {
        orderBy: { createdAt: "desc" },
        include: { lead: { select: { id: true, email: true, firstName: true, lastName: true } } },
      },
    },
  });

  if (!campaign) return res.status(404).json({ error: "not_found" });
  res.json({ data: campaign });
});

// Add lead to campaign by email
campaignsRouter.post("/:id/leads", async (req: AuthRequest, res) => {
  const { email } = req.body;
  if (!email || typeof email !== "string") {
    return res.status(400).json({ error: "email_required" });
  }

  const campaign = await prisma.campaign.findFirst({
    where: { id: req.params.id, workspaceId: req.workspaceId },
  });
  if (!campaign) return res.status(404).json({ error: "not_found" });

  // Upsert lead
  const lead = await prisma.lead.upsert({
    where: { workspaceId_email: { workspaceId: req.workspaceId!, email } },
    create: { workspaceId: req.workspaceId!, email },
    update: {},
  });

  // Upsert campaign lead
  const campaignLead = await prisma.campaignLead.upsert({
    where: { campaignId_leadId: { campaignId: campaign.id, leadId: lead.id } },
    create: { campaignId: campaign.id, leadId: lead.id },
    update: {},
    include: { lead: { select: { id: true, email: true, firstName: true, lastName: true } } },
  });

  // If campaign is active, queue immediately
  if (campaign.status === "active") {
    await sequenceSchedulerQueue.add("start-lead", { campaignLeadId: campaignLead.id });
  }

  res.status(201).json({ data: campaignLead });
});

// Update campaign
campaignsRouter.patch("/:id", async (req: AuthRequest, res) => {
  const parsed = campaignSchema.partial().safeParse(req.body);
  if (!parsed.success) {
    return res.status(400).json({ error: "validation_error", details: parsed.error.flatten() });
  }

  const campaign = await prisma.campaign.updateMany({
    where: { id: req.params.id, workspaceId: req.workspaceId },
    data: parsed.data,
  });

  if (!campaign.count) return res.status(404).json({ error: "not_found" });
  res.json({ data: { updated: true } });
});

// Delete campaign
campaignsRouter.delete("/:id", async (req: AuthRequest, res) => {
  await prisma.campaign.deleteMany({
    where: { id: req.params.id, workspaceId: req.workspaceId },
  });
  res.json({ data: { deleted: true } });
});

// Launch campaign
campaignsRouter.post("/:id/launch", async (req: AuthRequest, res) => {
  const campaign = await prisma.campaign.findFirst({
    where: { id: req.params.id, workspaceId: req.workspaceId },
  });

  if (!campaign) return res.status(404).json({ error: "not_found" });
  if (campaign.status === "active") {
    return res.status(400).json({ error: "already_active" });
  }

  await prisma.campaign.update({
    where: { id: campaign.id },
    data: { status: "active" },
  });

  // Queue all pending leads
  const pendingLeads = await prisma.campaignLead.findMany({
    where: { campaignId: campaign.id, status: "pending" },
  });

  for (const cl of pendingLeads) {
    await sequenceSchedulerQueue.add("start-lead", { campaignLeadId: cl.id });
  }

  res.json({ data: { launched: true, leadsQueued: pendingLeads.length } });
});

// Pause campaign
campaignsRouter.post("/:id/pause", async (req: AuthRequest, res) => {
  await prisma.campaign.updateMany({
    where: { id: req.params.id, workspaceId: req.workspaceId },
    data: { status: "paused" },
  });
  res.json({ data: { paused: true } });
});

// Resume campaign
campaignsRouter.post("/:id/resume", async (req: AuthRequest, res) => {
  const campaign = await prisma.campaign.findFirst({
    where: { id: req.params.id, workspaceId: req.workspaceId },
  });

  if (!campaign) return res.status(404).json({ error: "not_found" });

  await prisma.campaign.update({
    where: { id: campaign.id },
    data: { status: "active" },
  });

  // Re-queue paused leads
  const pausedLeads = await prisma.campaignLead.findMany({
    where: { campaignId: campaign.id, status: "paused" },
  });

  for (const cl of pausedLeads) {
    await prisma.campaignLead.update({ where: { id: cl.id }, data: { status: "active" } });
    await sequenceSchedulerQueue.add("resume-lead", { campaignLeadId: cl.id });
  }

  res.json({ data: { resumed: true } });
});

// Send test email
campaignsRouter.post("/:id/test", async (req: AuthRequest, res) => {
  const { to } = req.body;
  if (!to || typeof to !== "string") {
    return res.status(400).json({ error: "to_email_required" });
  }

  const campaign = await prisma.campaign.findFirst({
    where: { id: req.params.id, workspaceId: req.workspaceId },
    include: { sequence: { include: { steps: { orderBy: { stepNumber: "asc" } } } } },
  });
  if (!campaign) return res.status(404).json({ error: "not_found" });

  const step = campaign.sequence.steps[0];
  if (!step) return res.status(400).json({ error: "no_steps", message: "Sequence has no steps" });

  const account = await prisma.emailAccount.findFirst({
    where: { workspaceId: req.workspaceId!, status: "active" },
  });
  if (!account) return res.status(400).json({ error: "no_account", message: "No active sending account found. Add one in Settings." });

  let transporter: nodemailer.Transporter;
  if (account.type === "ses") {
    const ses = new SESClient({
      region: account.sesRegion ?? process.env.AWS_REGION ?? "us-east-1",
      ...(account.sesAccessKeyId && {
        credentials: { accessKeyId: account.sesAccessKeyId, secretAccessKey: account.sesSecretKey! },
      }),
    });
    transporter = nodemailer.createTransport({ SES: { ses, aws: { SendRawEmailCommand } } });
  } else if (account.type === "smtp") {
    transporter = nodemailer.createTransport({
      host: account.smtpHost!,
      port: account.smtpPort!,
      secure: account.smtpPort === 465,
      auth: { user: account.smtpUser!, pass: account.smtpPassEnc! },
    });
  } else {
    return res.status(400).json({ error: "unsupported_type", message: `${account.type} accounts not supported for test send` });
  }

  await transporter.sendMail({
    from: `"${campaign.fromName ?? account.name}" <${account.email}>`,
    to,
    subject: `[TEST] ${step.subject}`,
    [step.plainText ? "text" : "html"]: step.body,
  });

  res.json({ data: { sent: true, from: account.email, to, subject: `[TEST] ${step.subject}` } });
});

// Force-send next step to a specific lead
campaignsRouter.post("/:id/leads/:leadId/force-send", async (req: AuthRequest, res) => {
  const campaign = await prisma.campaign.findFirst({
    where: { id: req.params.id, workspaceId: req.workspaceId },
  });
  if (!campaign) return res.status(404).json({ error: "not_found" });

  const campaignLead = await prisma.campaignLead.findFirst({
    where: { id: req.params.leadId, campaignId: campaign.id },
  });
  if (!campaignLead) return res.status(404).json({ error: "lead_not_found" });

  const stepNumber = Math.max(campaignLead.currentStep, 1);

  // Reset lead to active so the worker processes it
  await prisma.campaignLead.update({
    where: { id: campaignLead.id },
    data: { status: "active", currentStep: stepNumber, finishedAt: null },
  });

  await emailSendQueue.add(
    `force-${campaignLead.id}-step${stepNumber}`,
    { campaignLeadId: campaignLead.id, stepNumber },
    { delay: 0 }
  );

  res.json({ data: { queued: true, stepNumber } });
});
