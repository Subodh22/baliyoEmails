import { Queue } from "bullmq";
import { redis } from "../redis";

export const emailSendQueue = new Queue("email-send", {
  connection: redis,
  defaultJobOptions: {
    attempts: 3,
    backoff: { type: "exponential", delay: 5000 },
    removeOnComplete: { count: 1000 },
    removeOnFail: { count: 500 },
  },
});

export const sequenceSchedulerQueue = new Queue("sequence-scheduler", {
  connection: redis,
  defaultJobOptions: {
    attempts: 3,
    backoff: { type: "exponential", delay: 2000 },
    removeOnComplete: { count: 500 },
    removeOnFail: { count: 200 },
  },
});

export const replyDetectorQueue = new Queue("reply-detector", {
  connection: redis,
  defaultJobOptions: {
    attempts: 2,
    backoff: { type: "fixed", delay: 10000 },
    removeOnComplete: { count: 100 },
    removeOnFail: { count: 100 },
  },
});

export const bounceProcessorQueue = new Queue("bounce-processor", {
  connection: redis,
  defaultJobOptions: {
    attempts: 3,
    backoff: { type: "exponential", delay: 1000 },
    removeOnComplete: { count: 200 },
    removeOnFail: { count: 100 },
  },
});

export const analyticsRollupQueue = new Queue("analytics-rollup", {
  connection: redis,
  defaultJobOptions: {
    attempts: 2,
    removeOnComplete: { count: 50 },
    removeOnFail: { count: 50 },
  },
});

export type EmailSendJobData = {
  campaignLeadId: string;
  stepNumber: number;
};

export type SequenceSchedulerJobData = {
  campaignLeadId: string;
};

export type ReplyDetectorJobData = {
  accountId: string;
};

export type BounceProcessorJobData = {
  messageId: string;
  email: string;
  bounceType: "permanent" | "transient";
};
