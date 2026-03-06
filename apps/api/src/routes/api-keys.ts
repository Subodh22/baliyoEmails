import { Router } from "express";
import { z } from "zod";
import { createHash, randomBytes } from "crypto";
import { prisma } from "@baliyoemails/db";
import { requireAuth, AuthRequest } from "../middleware/auth";

export const apiKeysRouter = Router();
apiKeysRouter.use(requireAuth);

apiKeysRouter.get("/", async (req: AuthRequest, res) => {
  const keys = await prisma.apiKey.findMany({
    where: { workspaceId: req.workspaceId },
    select: { id: true, name: true, keyPrefix: true, lastUsedAt: true, createdAt: true },
    orderBy: { createdAt: "desc" },
  });
  res.json({ data: keys });
});

apiKeysRouter.post("/", async (req: AuthRequest, res) => {
  const { name } = z.object({ name: z.string().min(1).max(100) }).parse(req.body);

  const rawKey = `baliyo_${randomBytes(32).toString("hex")}`;
  const keyHash = createHash("sha256").update(rawKey).digest("hex");
  const keyPrefix = rawKey.slice(0, 12) + "...";

  const key = await prisma.apiKey.create({
    data: {
      workspaceId: req.workspaceId!,
      userId: req.userId!,
      name,
      keyHash,
      keyPrefix,
    },
  });

  // Return raw key once — never stored in plaintext
  res.status(201).json({ data: { id: key.id, name, key: rawKey, keyPrefix } });
});

apiKeysRouter.delete("/:id", async (req: AuthRequest, res) => {
  await prisma.apiKey.deleteMany({
    where: { id: req.params.id, workspaceId: req.workspaceId },
  });
  res.json({ data: { deleted: true } });
});
