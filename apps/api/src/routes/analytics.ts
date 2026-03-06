import { Router } from "express";
import { prisma } from "@baliyoemails/db";
import { requireAuth, AuthRequest } from "../middleware/auth";

export const analyticsRouter = Router();
analyticsRouter.use(requireAuth);

// Overview stats
analyticsRouter.get("/overview", async (req: AuthRequest, res) => {
  const { days = "30" } = req.query as { days?: string };
  const since = new Date(Date.now() - parseInt(days) * 24 * 60 * 60 * 1000);

  const events = await prisma.emailEvent.groupBy({
    by: ["type"],
    where: {
      email: { campaign: { workspaceId: req.workspaceId } },
      createdAt: { gte: since },
    },
    _count: { type: true },
  });

  const statMap = Object.fromEntries(events.map((e) => [e.type, e._count.type]));

  const sent = statMap.sent ?? 0;
  const opens = statMap.opened ?? 0;
  const clicks = statMap.clicked ?? 0;
  const replies = statMap.replied ?? 0;
  const bounces = statMap.bounced ?? 0;

  res.json({
    data: {
      sent,
      opens,
      clicks,
      replies,
      bounces,
      openRate: sent > 0 ? opens / sent : 0,
      replyRate: sent > 0 ? replies / sent : 0,
      clickRate: sent > 0 ? clicks / sent : 0,
      bounceRate: sent > 0 ? bounces / sent : 0,
    },
  });
});

// Time series
analyticsRouter.get("/timeseries", async (req: AuthRequest, res) => {
  const { days = "30" } = req.query as { days?: string };
  const since = new Date(Date.now() - parseInt(days) * 24 * 60 * 60 * 1000);

  const emails = await prisma.emailSent.findMany({
    where: {
      campaign: { workspaceId: req.workspaceId },
      sentAt: { gte: since },
    },
    select: {
      sentAt: true,
      events: { select: { type: true } },
    },
    orderBy: { sentAt: "asc" },
  });

  // Group by date
  const byDate: Record<string, { sent: number; opens: number; replies: number; clicks: number }> =
    {};

  for (const email of emails) {
    const date = email.sentAt.toISOString().split("T")[0];
    if (!byDate[date]) byDate[date] = { sent: 0, opens: 0, replies: 0, clicks: 0 };
    byDate[date].sent++;
    for (const ev of email.events) {
      if (ev.type === "opened") byDate[date].opens++;
      if (ev.type === "replied") byDate[date].replies++;
      if (ev.type === "clicked") byDate[date].clicks++;
    }
  }

  const series = Object.entries(byDate).map(([date, stats]) => ({ date, ...stats }));
  res.json({ data: series });
});

// Campaign analytics
analyticsRouter.get("/campaigns/:id", async (req: AuthRequest, res) => {
  const campaign = await prisma.campaign.findFirst({
    where: { id: req.params.id, workspaceId: req.workspaceId },
  });

  if (!campaign) return res.status(404).json({ error: "not_found" });

  const [events, leadStats, stepStats] = await Promise.all([
    prisma.emailEvent.groupBy({
      by: ["type"],
      where: { email: { campaignId: campaign.id } },
      _count: { type: true },
    }),
    prisma.campaignLead.groupBy({
      by: ["status"],
      where: { campaignId: campaign.id },
      _count: { status: true },
    }),
    prisma.emailSent.findMany({
      where: { campaignId: campaign.id },
      select: {
        stepNumber: true,
        events: { select: { type: true } },
      },
    }),
  ]);

  const eventMap = Object.fromEntries(events.map((e) => [e.type, e._count.type]));
  const leadStatusMap = Object.fromEntries(leadStats.map((l) => [l.status, l._count.status]));

  // Per-step stats
  const stepMap: Record<number, { sent: number; opens: number; replies: number }> = {};
  for (const email of stepStats) {
    const step = email.stepNumber;
    if (!stepMap[step]) stepMap[step] = { sent: 0, opens: 0, replies: 0 };
    stepMap[step].sent++;
    for (const ev of email.events) {
      if (ev.type === "opened") stepMap[step].opens++;
      if (ev.type === "replied") stepMap[step].replies++;
    }
  }

  res.json({
    data: {
      events: eventMap,
      leadStatus: leadStatusMap,
      steps: Object.entries(stepMap).map(([step, stats]) => ({
        step: parseInt(step),
        ...stats,
        openRate: stats.sent > 0 ? stats.opens / stats.sent : 0,
        replyRate: stats.sent > 0 ? stats.replies / stats.sent : 0,
      })),
    },
  });
});
