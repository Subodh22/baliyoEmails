import { Router, Request, Response } from "express";
import { prisma } from "@baliyoemails/db";

export const trackRouter = Router();

// 1x1 tracking pixel
trackRouter.get("/open/:emailId", async (req: Request, res: Response) => {
  const { emailId } = req.params;

  try {
    const email = await prisma.emailSent.findUnique({ where: { id: emailId } });
    if (email) {
      await prisma.emailEvent.create({
        data: { emailId, type: "opened" },
      });
    }
  } catch {}

  // Return 1x1 transparent GIF
  const pixel = Buffer.from(
    "R0lGODlhAQABAIAAAAAAAP///yH5BAEAAAAALAAAAAABAAEAAAIBRAA7",
    "base64"
  );
  res.set({
    "Content-Type": "image/gif",
    "Content-Length": pixel.length,
    "Cache-Control": "no-store, no-cache, must-revalidate",
    Pragma: "no-cache",
  });
  res.end(pixel);
});

// Click tracking redirect
trackRouter.get("/click/:linkId", async (req: Request, res: Response) => {
  const { linkId } = req.params;
  const { url } = req.query as { url?: string };

  try {
    await prisma.emailEvent.create({
      data: { emailId: linkId, type: "clicked", metadata: { url } },
    });
  } catch {}

  if (url) {
    return res.redirect(302, decodeURIComponent(url));
  }
  res.status(400).send("Missing redirect URL");
});

// Unsubscribe
trackRouter.get("/unsubscribe/:emailId", async (req: Request, res: Response) => {
  const { emailId } = req.params;

  try {
    const email = await prisma.emailSent.findUnique({
      where: { id: emailId },
      include: { lead: true },
    });

    if (email) {
      await prisma.lead.update({
        where: { id: email.leadId },
        data: { unsubscribed: true },
      });

      await prisma.campaignLead.updateMany({
        where: { leadId: email.leadId, campaignId: email.campaignId },
        data: { status: "unsubscribed" },
      });

      await prisma.emailEvent.create({
        data: { emailId, type: "unsubscribed" },
      });
    }
  } catch {}

  res.send(`
    <!DOCTYPE html>
    <html>
    <head><title>Unsubscribed</title></head>
    <body style="font-family:sans-serif;text-align:center;padding:80px;color:#333">
      <h2>You've been unsubscribed</h2>
      <p>You won't receive any more emails from this sender.</p>
    </body>
    </html>
  `);
});

export default trackRouter;
