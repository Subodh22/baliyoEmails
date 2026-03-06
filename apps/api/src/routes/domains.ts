import { Router } from "express";
import { z } from "zod";
import { SESClient, VerifyDomainDkimCommand, GetIdentityVerificationAttributesCommand } from "@aws-sdk/client-ses";
import { prisma } from "@baliyoemails/db";
import { requireAuth, AuthRequest } from "../middleware/auth";

export const domainsRouter = Router();
domainsRouter.use(requireAuth);

const ses = new SESClient({ region: process.env.AWS_REGION ?? "us-east-1" });

// List domains
domainsRouter.get("/", async (req: AuthRequest, res) => {
  const domains = await prisma.sendingDomain.findMany({
    where: { workspaceId: req.workspaceId },
    orderBy: { createdAt: "desc" },
  });
  res.json({ data: domains });
});

// Add domain
domainsRouter.post("/", async (req: AuthRequest, res) => {
  const { domain } = z.object({ domain: z.string().min(3) }).parse(req.body);

  // Initiate SES domain verification
  try {
    await ses.send(new VerifyDomainDkimCommand({ Domain: domain }));
  } catch (err) {
    console.error("SES error:", err);
  }

  const record = await prisma.sendingDomain.create({
    data: { workspaceId: req.workspaceId!, domain },
  });

  res.status(201).json({ data: record });
});

// Check domain verification status
domainsRouter.post("/:id/verify", async (req: AuthRequest, res) => {
  const domain = await prisma.sendingDomain.findFirst({
    where: { id: req.params.id, workspaceId: req.workspaceId },
  });

  if (!domain) return res.status(404).json({ error: "not_found" });

  try {
    const result = await ses.send(
      new GetIdentityVerificationAttributesCommand({ Identities: [domain.domain] })
    );

    const attrs = result.VerificationAttributes?.[domain.domain];
    const verified = attrs?.VerificationStatus === "Success";

    await prisma.sendingDomain.update({
      where: { id: domain.id },
      data: { verified, dkimVerified: verified },
    });

    res.json({ data: { verified, status: attrs?.VerificationStatus } });
  } catch (err) {
    res.status(500).json({ error: "ses_error", message: String(err) });
  }
});

// Delete domain
domainsRouter.delete("/:id", async (req: AuthRequest, res) => {
  await prisma.sendingDomain.deleteMany({
    where: { id: req.params.id, workspaceId: req.workspaceId },
  });
  res.json({ data: { deleted: true } });
});
