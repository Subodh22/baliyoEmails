import { Router } from "express";
import { z } from "zod";
import multer from "multer";
import { parse } from "csv-parse/sync";
import { prisma } from "@baliyoemails/db";
import { requireAuth, AuthRequest } from "../middleware/auth";

export const leadsRouter = Router();
leadsRouter.use(requireAuth);

const upload = multer({ storage: multer.memoryStorage(), limits: { fileSize: 20 * 1024 * 1024 } });

const leadUpdateSchema = z.object({
  firstName: z.string().optional(),
  lastName: z.string().optional(),
  company: z.string().optional(),
  title: z.string().optional(),
  phone: z.string().optional(),
  customFields: z.record(z.string()).optional(),
  tags: z.array(z.string()).optional(),
  unsubscribed: z.boolean().optional(),
});

// List leads
leadsRouter.get("/", async (req: AuthRequest, res) => {
  const { status, search, page = "1", limit = "50", campaignId } = req.query as Record<string, string>;

  const where: Record<string, unknown> = { workspaceId: req.workspaceId };

  if (search) {
    where.OR = [
      { email: { contains: search, mode: "insensitive" } },
      { firstName: { contains: search, mode: "insensitive" } },
      { lastName: { contains: search, mode: "insensitive" } },
      { company: { contains: search, mode: "insensitive" } },
    ];
  }

  if (campaignId) {
    where.campaignLeads = { some: { campaignId } };
  }

  const [leads, total] = await Promise.all([
    prisma.lead.findMany({
      where,
      orderBy: { createdAt: "desc" },
      skip: (parseInt(page) - 1) * parseInt(limit),
      take: parseInt(limit),
      include: status
        ? { campaignLeads: { where: { status: status as any } } }
        : { _count: { select: { campaignLeads: true } } },
    }),
    prisma.lead.count({ where }),
  ]);

  res.json({ data: leads, meta: { total, page: parseInt(page), limit: parseInt(limit) } });
});

// Import leads from CSV
// Create single lead
leadsRouter.post("/", async (req: AuthRequest, res) => {
  const schema = z.object({
    email: z.string().email(),
    firstName: z.string().optional(),
    lastName: z.string().optional(),
    company: z.string().optional(),
    title: z.string().optional(),
    phone: z.string().optional(),
    tags: z.array(z.string()).optional(),
  });

  const parsed = schema.safeParse(req.body);
  if (!parsed.success) return res.status(400).json({ error: "validation_error", details: parsed.error.flatten() });

  const lead = await prisma.lead.upsert({
    where: { workspaceId_email: { workspaceId: req.workspaceId!, email: parsed.data.email } },
    create: { workspaceId: req.workspaceId!, ...parsed.data },
    update: parsed.data,
  });

  res.status(201).json({ data: lead });
});

leadsRouter.post("/import", upload.single("file"), async (req: AuthRequest, res) => {
  const { campaignId, mapping } = req.body;

  if (!req.file) {
    return res.status(400).json({ error: "no_file", message: "CSV file required" });
  }

  const columnMap = JSON.parse(mapping || "{}") as Record<string, string>;

  let records: Record<string, string>[];
  try {
    records = parse(req.file.buffer, { columns: true, skip_empty_lines: true, trim: true });
  } catch {
    return res.status(400).json({ error: "invalid_csv", message: "Could not parse CSV" });
  }

  // Check blacklist
  const blacklist = await prisma.blacklist.findMany({ where: { workspaceId: req.workspaceId } });
  const blacklistedEmails = new Set(blacklist.filter((b) => b.type === "email").map((b) => b.value));
  const blacklistedDomains = new Set(blacklist.filter((b) => b.type === "domain").map((b) => b.value));

  const validRecords = records.filter((r) => {
    const email = r[columnMap.email ?? "email"]?.toLowerCase();
    if (!email) return false;
    if (blacklistedEmails.has(email)) return false;
    const domain = email.split("@")[1];
    if (domain && blacklistedDomains.has(domain)) return false;
    return true;
  });

  let created = 0;
  let skipped = 0;

  for (const record of validRecords) {
    const email = record[columnMap.email ?? "email"]?.toLowerCase();
    if (!email) { skipped++; continue; }

    try {
      const lead = await prisma.lead.upsert({
        where: { workspaceId_email: { workspaceId: req.workspaceId!, email } },
        create: {
          workspaceId: req.workspaceId!,
          email,
          firstName: record[columnMap.firstName ?? "first_name"],
          lastName: record[columnMap.lastName ?? "last_name"],
          company: record[columnMap.company ?? "company"],
          title: record[columnMap.title ?? "title"],
          phone: record[columnMap.phone ?? "phone"],
        },
        update: {},
      });

      if (campaignId) {
        await prisma.campaignLead.upsert({
          where: { campaignId_leadId: { campaignId, leadId: lead.id } },
          create: { campaignId, leadId: lead.id, status: "pending" },
          update: {},
        });
      }

      created++;
    } catch {
      skipped++;
    }
  }

  res.json({ data: { created, skipped, total: records.length } });
});

// Get lead
leadsRouter.get("/:id", async (req: AuthRequest, res) => {
  const lead = await prisma.lead.findFirst({
    where: { id: req.params.id, workspaceId: req.workspaceId },
    include: {
      campaignLeads: { include: { campaign: { select: { id: true, name: true, status: true } } } },
      emailsSent: {
        orderBy: { sentAt: "desc" },
        take: 20,
        include: { events: { orderBy: { createdAt: "desc" } } },
      },
    },
  });

  if (!lead) return res.status(404).json({ error: "not_found" });
  res.json({ data: lead });
});

// Update lead
leadsRouter.patch("/:id", async (req: AuthRequest, res) => {
  const parsed = leadUpdateSchema.safeParse(req.body);
  if (!parsed.success) {
    return res.status(400).json({ error: "validation_error", details: parsed.error.flatten() });
  }

  await prisma.lead.updateMany({
    where: { id: req.params.id, workspaceId: req.workspaceId },
    data: parsed.data,
  });

  res.json({ data: { updated: true } });
});

// Delete lead
leadsRouter.delete("/:id", async (req: AuthRequest, res) => {
  await prisma.lead.deleteMany({
    where: { id: req.params.id, workspaceId: req.workspaceId },
  });
  res.json({ data: { deleted: true } });
});

// Blacklist
leadsRouter.post("/blacklist", async (req: AuthRequest, res) => {
  const { value, type } = z
    .object({ value: z.string(), type: z.enum(["email", "domain"]) })
    .parse(req.body);

  await prisma.blacklist.upsert({
    where: { workspaceId_value: { workspaceId: req.workspaceId!, value } },
    create: { workspaceId: req.workspaceId!, value, type },
    update: {},
  });

  // Mark leads as unsubscribed if blacklisting email
  if (type === "email") {
    await prisma.lead.updateMany({
      where: { workspaceId: req.workspaceId, email: value },
      data: { unsubscribed: true },
    });
  }

  res.json({ data: { blacklisted: true } });
});
