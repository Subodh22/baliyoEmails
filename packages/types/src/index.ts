// ── Enums ──────────────────────────────────────────────────────────────────────

export type WorkspaceRole = "admin" | "member";

export type EmailAccountType = "gmail" | "outlook" | "smtp";
export type EmailAccountStatus = "active" | "error" | "warming";

export type CampaignStatus =
  | "draft"
  | "active"
  | "paused"
  | "archived"
  | "finished";

export type LeadStatus =
  | "pending"
  | "active"
  | "paused"
  | "replied"
  | "bounced"
  | "unsubscribed"
  | "finished";

export type EmailEventType =
  | "sent"
  | "delivered"
  | "opened"
  | "clicked"
  | "replied"
  | "bounced"
  | "unsubscribed";

export type ReplyStatus = "interested" | "not_interested" | "closed" | "new";

export type PlanName = "free" | "pro" | "agency";

export type WebhookEvent =
  | "reply"
  | "open"
  | "click"
  | "bounce"
  | "unsubscribe"
  | "finish";

// ── Workspace ─────────────────────────────────────────────────────────────────

export interface Workspace {
  id: string;
  name: string;
  slug: string;
  plan: PlanName;
  createdAt: string;
}

export interface WorkspaceMember {
  id: string;
  workspaceId: string;
  userId: string;
  role: WorkspaceRole;
  email: string;
  name: string;
  createdAt: string;
}

// ── Email Accounts ─────────────────────────────────────────────────────────────

export interface EmailAccount {
  id: string;
  workspaceId: string;
  email: string;
  name: string;
  type: EmailAccountType;
  status: EmailAccountStatus;
  dailyLimit: number;
  sentToday: number;
  warmupEnabled: boolean;
  createdAt: string;
}

// ── Sending Domains ────────────────────────────────────────────────────────────

export interface SendingDomain {
  id: string;
  workspaceId: string;
  domain: string;
  verified: boolean;
  spfVerified: boolean;
  dkimVerified: boolean;
  dmarcVerified: boolean;
  reputationScore: number;
  createdAt: string;
}

// ── Sequences ──────────────────────────────────────────────────────────────────

export interface SequenceStep {
  id: string;
  sequenceId: string;
  stepNumber: number;
  subject: string;
  subjectB?: string;
  body: string;
  delayDays: number;
  plainText: boolean;
}

export interface Sequence {
  id: string;
  workspaceId: string;
  name: string;
  steps: SequenceStep[];
  createdAt: string;
}

// ── Campaigns ─────────────────────────────────────────────────────────────────

export interface Campaign {
  id: string;
  workspaceId: string;
  name: string;
  sequenceId: string;
  status: CampaignStatus;
  timezone: string;
  sendingDays: number[];
  sendingStartHour: number;
  sendingEndHour: number;
  dailySendingLimit: number;
  bounceThreshold: number;
  totalLeads: number;
  sentCount: number;
  openCount: number;
  clickCount: number;
  replyCount: number;
  bounceCount: number;
  createdAt: string;
}

// ── Leads ──────────────────────────────────────────────────────────────────────

export interface Lead {
  id: string;
  workspaceId: string;
  email: string;
  firstName?: string;
  lastName?: string;
  company?: string;
  title?: string;
  phone?: string;
  customFields?: Record<string, string>;
  tags?: string[];
  status: LeadStatus;
  unsubscribed: boolean;
  createdAt: string;
}

export interface CampaignLead {
  id: string;
  campaignId: string;
  leadId: string;
  status: LeadStatus;
  currentStep: number;
  nextSendAt?: string;
  lead: Lead;
}

// ── Emails ──────────────────────────────────────────────────────────────────────

export interface EmailSent {
  id: string;
  campaignId: string;
  leadId: string;
  accountId: string;
  stepNumber: number;
  subject: string;
  body: string;
  sentAt: string;
  messageId?: string;
}

export interface EmailEvent {
  id: string;
  emailId: string;
  type: EmailEventType;
  createdAt: string;
  metadata?: Record<string, unknown>;
}

// ── Inbox ─────────────────────────────────────────────────────────────────────

export interface InboxMessage {
  id: string;
  workspaceId: string;
  accountId: string;
  leadId: string;
  campaignId: string;
  subject: string;
  body: string;
  fromEmail: string;
  fromName?: string;
  status: ReplyStatus;
  receivedAt: string;
  lead: Lead;
  campaign: Pick<Campaign, "id" | "name">;
}

// ── Analytics ─────────────────────────────────────────────────────────────────

export interface AnalyticsOverview {
  totalSent: number;
  totalDelivered: number;
  totalOpens: number;
  totalClicks: number;
  totalReplies: number;
  totalBounces: number;
  openRate: number;
  replyRate: number;
  clickRate: number;
  bounceRate: number;
}

export interface TimeSeriesPoint {
  date: string;
  sent: number;
  opens: number;
  clicks: number;
  replies: number;
}

// ── API responses ─────────────────────────────────────────────────────────────

export interface ApiResponse<T> {
  data: T;
  meta?: {
    total: number;
    page: number;
    limit: number;
  };
}

export interface ApiError {
  error: string;
  message: string;
  statusCode: number;
}

// ── Billing ───────────────────────────────────────────────────────────────────

export interface Plan {
  name: PlanName;
  displayName: string;
  priceMonthly: number;
  seats: number | null;
  leads: number | null;
  domains: number | null;
  features: string[];
}

export interface Subscription {
  id: string;
  workspaceId: string;
  plan: PlanName;
  status: string;
  currentPeriodEnd: string;
  cancelAtPeriodEnd: boolean;
}
