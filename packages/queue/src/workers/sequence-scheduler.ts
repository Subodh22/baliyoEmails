import { Worker, Job } from "bullmq";
import { prisma } from "@baliyoemails/db";
import { redis } from "../redis";
import { emailSendQueue } from "../queues";
import type { SequenceSchedulerJobData } from "../queues";

function msUntilNextSendWindow(
  campaign: { sendingDays: number[]; sendingStartHour: number; sendingEndHour: number; timezone: string },
  delayDays: number
): number {
  const now = new Date();
  const target = new Date(now);
  target.setDate(target.getDate() + delayDays);
  target.setHours(campaign.sendingStartHour, 0, 0, 0);

  // Clamp to valid sending day
  while (!campaign.sendingDays.includes(target.getDay())) {
    target.setDate(target.getDate() + 1);
  }

  return Math.max(target.getTime() - now.getTime(), 60_000);
}

export const sequenceSchedulerWorker = new Worker<SequenceSchedulerJobData>(
  "sequence-scheduler",
  async (job: Job<SequenceSchedulerJobData>) => {
    const { campaignLeadId } = job.data;

    const cl = await prisma.campaignLead.findUnique({
      where: { id: campaignLeadId },
      include: {
        campaign: {
          include: { sequence: { include: { steps: { orderBy: { stepNumber: "asc" } } } } },
        },
      },
    });

    if (!cl) return { skipped: true };
    if (cl.status !== "active" && cl.status !== "pending") return { skipped: true };

    const steps = cl.campaign.sequence.steps;
    const nextStepNumber = cl.currentStep + 1;
    const nextStep = steps.find((s) => s.stepNumber === nextStepNumber);

    if (!nextStep) {
      // Sequence complete
      await prisma.campaignLead.update({
        where: { id: campaignLeadId },
        data: { status: "finished", finishedAt: new Date() },
      });
      return { finished: true };
    }

    // First step: no delay; subsequent steps: delayDays
    const delayMs =
      cl.currentStep === 0
        ? 0
        : msUntilNextSendWindow(cl.campaign, nextStep.delayDays);

    const nextSendAt = new Date(Date.now() + delayMs);

    await prisma.campaignLead.update({
      where: { id: campaignLeadId },
      data: {
        currentStep: nextStepNumber,
        status: "active",
        nextSendAt,
        startedAt: cl.startedAt ?? new Date(),
      },
    });

    await emailSendQueue.add(
      `send-${campaignLeadId}-step${nextStepNumber}`,
      { campaignLeadId, stepNumber: nextStepNumber },
      { delay: delayMs }
    );

    return { scheduled: true, nextStep: nextStepNumber, delayMs };
  },
  { connection: redis, concurrency: 20 }
);
