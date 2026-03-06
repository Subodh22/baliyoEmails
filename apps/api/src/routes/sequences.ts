import { Router } from "express";
import { z } from "zod";
import { prisma } from "@baliyoemails/db";
import { requireAuth, AuthRequest } from "../middleware/auth";

export const sequencesRouter = Router();
sequencesRouter.use(requireAuth);

const stepSchema = z.object({
  stepNumber: z.number().int().min(1),
  subject: z.string().min(1),
  subjectB: z.string().optional(),
  body: z.string().min(1),
  delayDays: z.number().int().min(0).default(1),
  plainText: z.boolean().default(false),
});

const sequenceSchema = z.object({
  name: z.string().min(1).max(255),
  description: z.string().optional(),
  steps: z.array(stepSchema).min(1),
});

// List
sequencesRouter.get("/", async (req: AuthRequest, res) => {
  const sequences = await prisma.sequence.findMany({
    where: { workspaceId: req.workspaceId },
    orderBy: { createdAt: "desc" },
    include: { _count: { select: { steps: true } } },
  });
  res.json({ data: sequences });
});

// Create
sequencesRouter.post("/", async (req: AuthRequest, res) => {
  const parsed = sequenceSchema.safeParse(req.body);
  if (!parsed.success) {
    return res.status(400).json({ error: "validation_error", details: parsed.error.flatten() });
  }

  const { steps, ...rest } = parsed.data;

  const sequence = await prisma.sequence.create({
    data: {
      workspaceId: req.workspaceId!,
      ...rest,
      steps: { create: steps },
    },
    include: { steps: { orderBy: { stepNumber: "asc" } } },
  });

  res.status(201).json({ data: sequence });
});

// Get
sequencesRouter.get("/:id", async (req: AuthRequest, res) => {
  const sequence = await prisma.sequence.findFirst({
    where: { id: req.params.id, workspaceId: req.workspaceId },
    include: { steps: { orderBy: { stepNumber: "asc" } } },
  });

  if (!sequence) return res.status(404).json({ error: "not_found" });
  res.json({ data: sequence });
});

// Update
sequencesRouter.patch("/:id", async (req: AuthRequest, res) => {
  const parsed = sequenceSchema.partial().safeParse(req.body);
  if (!parsed.success) {
    return res.status(400).json({ error: "validation_error", details: parsed.error.flatten() });
  }

  const { steps, ...rest } = parsed.data;

  const sequence = await prisma.sequence.findFirst({
    where: { id: req.params.id, workspaceId: req.workspaceId },
  });

  if (!sequence) return res.status(404).json({ error: "not_found" });

  await prisma.$transaction(async (tx) => {
    if (Object.keys(rest).length > 0) {
      await tx.sequence.update({ where: { id: sequence.id }, data: rest });
    }

    if (steps) {
      await tx.sequenceStep.deleteMany({ where: { sequenceId: sequence.id } });
      await tx.sequenceStep.createMany({
        data: steps.map((s) => ({ ...s, sequenceId: sequence.id })),
      });
    }
  });

  const updated = await prisma.sequence.findUnique({
    where: { id: sequence.id },
    include: { steps: { orderBy: { stepNumber: "asc" } } },
  });

  res.json({ data: updated });
});

// Delete
sequencesRouter.delete("/:id", async (req: AuthRequest, res) => {
  await prisma.sequence.deleteMany({
    where: { id: req.params.id, workspaceId: req.workspaceId },
  });
  res.json({ data: { deleted: true } });
});
