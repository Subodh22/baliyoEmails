import { Router } from "express";
import { z } from "zod";
import { prisma } from "@baliyoemails/db";
import { requireAuth, AuthRequest } from "../middleware/auth";

export const inboxRouter = Router();
inboxRouter.use(requireAuth);

inboxRouter.get("/", async (req: AuthRequest, res) => {
  const { status, page = "1", limit = "50" } = req.query as Record<string, string>;

  const where: Record<string, unknown> = { workspaceId: req.workspaceId };
  if (status) where.status = status;

  const [messages, total] = await Promise.all([
    prisma.inboxMessage.findMany({
      where,
      orderBy: { receivedAt: "desc" },
      skip: (parseInt(page) - 1) * parseInt(limit),
      take: parseInt(limit),
      include: {
        lead: { select: { id: true, email: true, firstName: true, lastName: true, company: true } },
      },
    }),
    prisma.inboxMessage.count({ where }),
  ]);

  res.json({ data: messages, meta: { total, page: parseInt(page), limit: parseInt(limit) } });
});

inboxRouter.patch("/:id", async (req: AuthRequest, res) => {
  const { status } = z
    .object({ status: z.enum(["new", "interested", "not_interested", "closed"]) })
    .parse(req.body);

  await prisma.inboxMessage.updateMany({
    where: { id: req.params.id, workspaceId: req.workspaceId },
    data: { status },
  });

  res.json({ data: { updated: true } });
});
