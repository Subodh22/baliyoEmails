import { Worker, Job } from "bullmq";
import { prisma } from "@baliyoemails/db";
import { redis } from "../redis";
import type { BounceProcessorJobData } from "../queues";

const BOUNCE_THRESHOLD = 0.05; // 5%

export const bounceProcessorWorker = new Worker<BounceProcessorJobData>(
  "bounce-processor",
  async (job: Job<BounceProcessorJobData>) => {
    const { messageId, email, bounceType } = job.data;

    if (bounceType !== "permanent") return { skipped: true };

    // Find the email that bounced
    const emailSent = await prisma.emailSent.findFirst({
      where: { messageId },
      include: { campaign: true, lead: true },
    });

    if (!emailSent) return { notFound: true };

    // Record bounce event
    await prisma.emailEvent.create({
      data: { emailId: emailSent.id, type: "bounced" },
    });

    // Mark lead as bounced
    await prisma.campaignLead.updateMany({
      where: { campaignId: emailSent.campaignId, leadId: emailSent.leadId },
      data: { status: "bounced" },
    });

    // Check bounce rate for campaign - auto-pause if above threshold
    const [totalLeads, bouncedLeads] = await Promise.all([
      prisma.campaignLead.count({ where: { campaignId: emailSent.campaignId } }),
      prisma.campaignLead.count({
        where: { campaignId: emailSent.campaignId, status: "bounced" },
      }),
    ]);

    const bounceRate = totalLeads > 0 ? bouncedLeads / totalLeads : 0;
    if (bounceRate >= BOUNCE_THRESHOLD) {
      await prisma.campaign.update({
        where: { id: emailSent.campaignId },
        data: { status: "paused" },
      });
    }

    return { processed: true, bounceRate };
  },
  { connection: redis, concurrency: 10 }
);
