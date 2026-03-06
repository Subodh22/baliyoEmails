import { Router } from "express";
import { z } from "zod";
import { clerkClient } from "@clerk/clerk-sdk-node";
import { prisma } from "@baliyoemails/db";
import { requireAuth, AuthRequest } from "../middleware/auth";

export const authRouter = Router();

// Sync Clerk user to DB (called after sign-up/sign-in)
authRouter.post("/sync", requireAuth, async (req: AuthRequest, res) => {
  const clerkUser = await clerkClient.users.getUser(req.clerkUserId!);

  const user = await prisma.user.upsert({
    where: { clerkId: clerkUser.id },
    create: {
      clerkId: clerkUser.id,
      email: clerkUser.emailAddresses[0]?.emailAddress ?? "",
      name: `${clerkUser.firstName ?? ""} ${clerkUser.lastName ?? ""}`.trim(),
      avatarUrl: clerkUser.imageUrl,
    },
    update: {
      name: `${clerkUser.firstName ?? ""} ${clerkUser.lastName ?? ""}`.trim(),
      avatarUrl: clerkUser.imageUrl,
    },
  });

  res.json({ data: user });
});

// Create workspace
authRouter.post("/workspaces", requireAuth, async (req: AuthRequest, res) => {
  const { name } = z.object({ name: z.string().min(1).max(100) }).parse(req.body);

  const slug = name.toLowerCase().replace(/[^a-z0-9]+/g, "-").replace(/^-|-$/g, "");

  const workspace = await prisma.workspace.create({
    data: {
      name,
      slug: `${slug}-${Math.random().toString(36).slice(2, 6)}`,
      members: {
        create: { userId: req.userId!, role: "admin", accepted: true },
      },
      subscriptions: {
        create: { plan: "free" },
      },
    },
  });

  res.status(201).json({ data: workspace });
});

// Get user's workspaces
authRouter.get("/workspaces", requireAuth, async (req: AuthRequest, res) => {
  const memberships = await prisma.workspaceMember.findMany({
    where: { userId: req.userId, accepted: true },
    include: { workspace: true },
  });

  res.json({ data: memberships.map((m) => ({ ...m.workspace, role: m.role })) });
});

// Invite team member
authRouter.post("/workspaces/invite", requireAuth, async (req: AuthRequest, res) => {
  const { email, role } = z
    .object({ email: z.string().email(), role: z.enum(["admin", "member"]).default("member") })
    .parse(req.body);

  const crypto = await import("crypto");
  const token = crypto.randomBytes(32).toString("hex");

  // Check if user already exists
  let user = await prisma.user.findUnique({ where: { email } });

  const member = await prisma.workspaceMember.create({
    data: {
      workspaceId: req.workspaceId!,
      userId: user?.id ?? req.userId!, // Placeholder until they accept
      role: role as "admin" | "member",
      inviteEmail: email,
      inviteToken: token,
      accepted: false,
    },
  });

  // In production, send invite email via SES
  res.json({ data: { invited: true, token, email } });
});

// Accept invite
authRouter.post("/invite/accept", requireAuth, async (req: AuthRequest, res) => {
  const { token } = z.object({ token: z.string() }).parse(req.body);

  const member = await prisma.workspaceMember.findUnique({
    where: { inviteToken: token },
  });

  if (!member) return res.status(404).json({ error: "invalid_token" });

  await prisma.workspaceMember.update({
    where: { id: member.id },
    data: { userId: req.userId!, accepted: true, inviteToken: null },
  });

  res.json({ data: { accepted: true, workspaceId: member.workspaceId } });
});
