import "dotenv/config";
import {
  emailSendWorker,
  sequenceSchedulerWorker,
  replyDetectorWorker,
  bounceProcessorWorker,
  replyDetectorQueue,
} from "@baliyoemails/queue";
import { prisma } from "@baliyoemails/db";

console.log("Workers starting...");

// Schedule IMAP polling for all active accounts on startup
async function scheduleReplyDetection() {
  const accounts = await prisma.emailAccount.findMany({
    where: { status: "active", imapHost: { not: null } },
    select: { id: true },
  });

  for (const account of accounts) {
    await replyDetectorQueue.add(
      `poll-${account.id}`,
      { accountId: account.id },
      {
        repeat: { every: 5 * 60 * 1000 },
        jobId: `repeat-poll-${account.id}`,
      }
    );
  }

  console.log(`Scheduled reply detection for ${accounts.length} accounts`);
}

scheduleReplyDetection().catch(console.error);

// Log worker events
for (const worker of [
  emailSendWorker,
  sequenceSchedulerWorker,
  replyDetectorWorker,
  bounceProcessorWorker,
]) {
  worker.on("completed", (job) => console.log(`✓ ${worker.name}:${job.id} completed`));
  worker.on("failed", (job, err) => console.error(`✗ ${worker.name}:${job?.id} failed:`, err.message));
}

process.on("SIGTERM", async () => {
  console.log("Shutting down workers...");
  await Promise.all([
    emailSendWorker.close(),
    sequenceSchedulerWorker.close(),
    replyDetectorWorker.close(),
    bounceProcessorWorker.close(),
  ]);
  process.exit(0);
});
