import { Worker, Job } from "bullmq";
import nodemailer from "nodemailer";
import { SESClient, SendRawEmailCommand } from "@aws-sdk/client-ses";
import { prisma } from "@baliyoemails/db";
import { redis } from "../redis";
import type { EmailSendJobData } from "../queues";
import { sequenceSchedulerQueue } from "../queues";

function renderTemplate(template: string, vars: Record<string, string>) {
  return template.replace(/\{\{(\w+)\}\}/g, (_, key) => vars[key] ?? "");
}

async function getTransporter(accountId: string) {
  const account = await prisma.emailAccount.findUnique({
    where: { id: accountId },
  });
  if (!account) throw new Error("Email account not found");

  if (account.type === "smtp") {
    return nodemailer.createTransport({
      host: account.smtpHost!,
      port: account.smtpPort!,
      secure: account.smtpPort === 465,
      auth: { user: account.smtpUser!, pass: account.smtpPassEnc! },
    });
  }

  if (account.type === "ses") {
    const ses = new SESClient({
      region: account.sesRegion ?? process.env.AWS_REGION ?? "us-east-1",
      ...(account.sesAccessKeyId && {
        credentials: {
          accessKeyId: account.sesAccessKeyId,
          secretAccessKey: account.sesSecretKey!,
        },
      }),
    });
    return nodemailer.createTransport({ SES: { ses, aws: { SendRawEmailCommand } } });
  }

  // For Gmail/Outlook via OAuth — simplified (real impl needs OAuth2 transport)
  throw new Error(`OAuth transport for ${account.type} not yet implemented`);
}

export const emailSendWorker = new Worker<EmailSendJobData>(
  "email-send",
  async (job: Job<EmailSendJobData>) => {
    const { campaignLeadId, stepNumber } = job.data;

    const campaignLead = await prisma.campaignLead.findUnique({
      where: { id: campaignLeadId },
      include: {
        lead: true,
        campaign: {
          include: { sequence: { include: { steps: true } } },
        },
      },
    });

    if (!campaignLead) throw new Error("CampaignLead not found");
    if (campaignLead.status !== "active") {
      return { skipped: true, reason: "lead not active" };
    }

    const step = campaignLead.campaign.sequence.steps.find(
      (s) => s.stepNumber === stepNumber
    );
    if (!step) throw new Error(`Step ${stepNumber} not found`);

    const lead = campaignLead.lead;
    const campaign = campaignLead.campaign;

    // Find available email account (under daily limit)
    const account = await prisma.emailAccount.findFirst({
      where: {
        workspaceId: campaign.workspaceId,
        status: "active",
        sentToday: { lt: prisma.emailAccount.fields.dailyLimit },
      },
    });

    if (!account) {
      throw new Error("No available sending account (daily limits reached)");
    }

    // Build personalization vars
    const vars: Record<string, string> = {
      first_name: lead.firstName ?? "",
      last_name: lead.lastName ?? "",
      company: lead.company ?? "",
      email: lead.email,
      ...(lead.customFields as Record<string, string> ?? {}),
    };

    const subject = renderTemplate(step.subject, vars);
    const body = renderTemplate(step.body, vars);

    const trackingId = `${campaignLead.id}-step${stepNumber}-${Date.now()}`;

    // Wrap body with tracking pixel if enabled
    let finalBody = body;
    if (campaign.trackingEnabled && !step.plainText) {
      const pixelUrl = `${process.env.API_URL}/api/track/open/${trackingId}`;
      finalBody += `<img src="${pixelUrl}" width="1" height="1" style="display:none"/>`;
    }

    const transporter = await getTransporter(account.id);

    const info = await transporter.sendMail({
      from: `"${campaign.fromName ?? account.name}" <${account.email}>`,
      to: lead.email,
      subject,
      [step.plainText ? "text" : "html"]: finalBody,
    });

    // Record sent email
    const emailSent = await prisma.emailSent.create({
      data: {
        campaignId: campaign.id,
        leadId: lead.id,
        accountId: account.id,
        stepNumber,
        subject,
        body: finalBody,
        messageId: info.messageId,
      },
    });

    await prisma.emailEvent.create({
      data: { emailId: emailSent.id, type: "sent" },
    });

    // Increment daily sent counter
    await prisma.emailAccount.update({
      where: { id: account.id },
      data: { sentToday: { increment: 1 } },
    });

    // Schedule next step
    await sequenceSchedulerQueue.add("schedule-next", { campaignLeadId });

    return { sent: true, messageId: info.messageId };
  },
  { connection: redis, concurrency: 10 }
);
