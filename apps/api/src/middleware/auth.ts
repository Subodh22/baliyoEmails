import { Request, Response, NextFunction } from "express";
import { clerkClient } from "@clerk/clerk-sdk-node";
import { prisma } from "@baliyoemails/db";

export interface AuthRequest extends Request {
  userId?: string;
  workspaceId?: string;
  clerkUserId?: string;
}

export async function requireAuth(
  req: AuthRequest,
  res: Response,
  next: NextFunction
) {
  try {
    const token = req.headers.authorization?.replace("Bearer ", "");
    if (!token) {
      return res.status(401).json({ error: "unauthorized", message: "No token" });
    }

    // Verify Clerk JWT token
    const payload = await clerkClient.verifyToken(token);

    if (!payload?.sub) {
      return res.status(401).json({ error: "unauthorized", message: "Invalid token" });
    }

    const clerkUserId = payload.sub;

    // Find or create user in DB
    let user = await prisma.user.findUnique({ where: { clerkId: clerkUserId } });

    if (!user) {
      const clerkUser = await clerkClient.users.getUser(clerkUserId);
      user = await prisma.user.create({
        data: {
          clerkId: clerkUserId,
          email: clerkUser.emailAddresses[0]?.emailAddress ?? "",
          name: `${clerkUser.firstName ?? ""} ${clerkUser.lastName ?? ""}`.trim(),
          avatarUrl: clerkUser.imageUrl,
        },
      });
    }

    req.clerkUserId = clerkUserId;
    req.userId = user.id;

    // Extract workspace from header or query
    const workspaceId =
      (req.headers["x-workspace-id"] as string) ??
      (req.query.workspaceId as string);

    if (workspaceId) {
      // Verify membership
      const membership = await prisma.workspaceMember.findFirst({
        where: { workspaceId, userId: user.id, accepted: true },
      });

      if (!membership) {
        return res.status(403).json({ error: "forbidden", message: "Not a workspace member" });
      }

      req.workspaceId = workspaceId;
    }

    next();
  } catch (err) {
    return res.status(401).json({ error: "unauthorized", message: "Auth failed" });
  }
}

export async function requireApiKey(
  req: AuthRequest,
  res: Response,
  next: NextFunction
) {
  const key = req.headers["x-api-key"] as string;
  if (!key) return requireAuth(req, res, next);

  try {
    const crypto = await import("crypto");
    const keyHash = crypto.createHash("sha256").update(key).digest("hex");

    const apiKey = await prisma.apiKey.findUnique({
      where: { keyHash },
      include: { workspace: true },
    });

    if (!apiKey) {
      return res.status(401).json({ error: "unauthorized", message: "Invalid API key" });
    }

    await prisma.apiKey.update({
      where: { id: apiKey.id },
      data: { lastUsedAt: new Date() },
    });

    req.userId = apiKey.userId;
    req.workspaceId = apiKey.workspaceId;
    next();
  } catch {
    return res.status(401).json({ error: "unauthorized", message: "API key auth failed" });
  }
}
