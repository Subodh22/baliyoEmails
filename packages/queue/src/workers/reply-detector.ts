import { Worker, Job } from "bullmq";
import { ImapFlow } from "imapflow";
import { prisma } from "@baliyoemails/db";
import { redis } from "../redis";
import type { ReplyDetectorJobData } from "../queues";

export const replyDetectorWorker = new Worker<ReplyDetectorJobData>(
  "reply-detector",
  async (job: Job<ReplyDetectorJobData>) => {
    const { accountId } = job.data;

    const account = await prisma.emailAccount.findUnique({
      where: { id: accountId },
    });

    if (!account || account.status !== "active") return { skipped: true };
    if (!account.imapHost) return { skipped: true, reason: "no IMAP config" };

    const client = new ImapFlow({
      host: account.imapHost,
      port: account.imapPort ?? 993,
      secure: true,
      auth: { user: account.smtpUser!, pass: account.smtpPassEnc! },
      logger: false,
    });

    try {
      await client.connect();
      const lock = await client.getMailboxLock("INBOX");

      try {
        const since = new Date();
        since.setMinutes(since.getMinutes() - 10); // Check last 10 minutes

        for await (const msg of client.fetch({ since }, { envelope: true, source: true })) {
          const fromEmail = msg.envelope.from?.[0]?.address?.toLowerCase();
          if (!fromEmail) continue;

          // Find if this is a reply from an active lead
          const lead = await prisma.lead.findFirst({
            where: { email: fromEmail },
            include: {
              campaignLeads: {
                where: { status: "active" },
                include: { campaign: true },
              },
            },
          });

          if (!lead || lead.campaignLeads.length === 0) continue;

          const campaignLead = lead.campaignLeads[0];

          // Mark lead as replied
          await prisma.campaignLead.update({
            where: { id: campaignLead.id },
            data: { status: "replied" },
          });

          // Create inbox message
          await prisma.inboxMessage.upsert({
            where: {
              id: `${accountId}-${msg.uid}`,
            },
            create: {
              id: `${accountId}-${msg.uid}`,
              workspaceId: lead.workspaceId,
              accountId,
              leadId: lead.id,
              campaignId: campaignLead.campaignId,
              subject: msg.envelope.subject ?? "(no subject)",
              body: msg.source?.toString() ?? "",
              fromEmail,
              fromName: msg.envelope.from?.[0]?.name ?? undefined,
              status: "new",
              receivedAt: msg.envelope.date ?? new Date(),
            },
            update: {},
          });

          // Record reply event on last sent email
          const lastEmail = await prisma.emailSent.findFirst({
            where: { leadId: lead.id, campaignId: campaignLead.campaignId },
            orderBy: { sentAt: "desc" },
          });

          if (lastEmail) {
            await prisma.emailEvent.create({
              data: { emailId: lastEmail.id, type: "replied" },
            });
          }
        }
      } finally {
        lock.release();
      }
    } finally {
      await client.logout();
    }

    await prisma.emailAccount.update({
      where: { id: accountId },
      data: { lastCheckedAt: new Date() },
    });

    return { checked: true };
  },
  { connection: redis, concurrency: 5 }
);
