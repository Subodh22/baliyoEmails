import { Router, Request, Response } from "express";
import Stripe from "stripe";
import { prisma } from "@baliyoemails/db";
import { bounceProcessorQueue } from "@baliyoemails/queue";

export const webhooksRouter = Router();

// ── SES Bounce/Complaint webhooks ─────────────────────────────────────────────
webhooksRouter.post("/ses", async (req: Request, res: Response) => {
  try {
    const body = typeof req.body === "string" ? JSON.parse(req.body) : req.body;

    // SNS subscription confirmation
    if (body.Type === "SubscriptionConfirmation") {
      const { default: https } = await import("https");
      https.get(body.SubscribeURL, () => {});
      return res.json({ ok: true });
    }

    if (body.Type !== "Notification") return res.json({ ok: true });

    const message = JSON.parse(body.Message);

    if (message.notificationType === "Bounce") {
      const bounce = message.bounce;
      for (const recipient of bounce.bouncedRecipients ?? []) {
        await bounceProcessorQueue.add("process-bounce", {
          messageId: message.mail?.messageId ?? "",
          email: recipient.emailAddress,
          bounceType: bounce.bounceType === "Permanent" ? "permanent" : "transient",
        });
      }
    }

    res.json({ ok: true });
  } catch (err) {
    console.error("SES webhook error:", err);
    res.status(500).json({ error: "webhook_error" });
  }
});

// ── Stripe webhooks ───────────────────────────────────────────────────────────
webhooksRouter.post("/stripe", async (req: Request, res: Response) => {
  const stripe = new Stripe(process.env.STRIPE_SECRET_KEY!, { apiVersion: "2024-04-10" });
  const sig = req.headers["stripe-signature"] as string;

  let event: Stripe.Event;
  try {
    event = stripe.webhooks.constructEvent(
      req.body,
      sig,
      process.env.STRIPE_WEBHOOK_SECRET!
    );
  } catch (err) {
    return res.status(400).json({ error: "invalid_signature" });
  }

  switch (event.type) {
    case "checkout.session.completed": {
      const session = event.data.object as Stripe.Checkout.Session;
      const workspaceId = session.metadata?.workspaceId;
      if (!workspaceId) break;

      await prisma.subscription.upsert({
        where: { workspaceId },
        create: {
          workspaceId,
          stripeCustomerId: session.customer as string,
          stripeSubId: session.subscription as string,
          plan: (session.metadata?.plan as "free" | "pro" | "agency") ?? "pro",
          status: "active",
        },
        update: {
          stripeCustomerId: session.customer as string,
          stripeSubId: session.subscription as string,
          plan: (session.metadata?.plan as "free" | "pro" | "agency") ?? "pro",
          status: "active",
        },
      });
      break;
    }

    case "customer.subscription.updated":
    case "customer.subscription.deleted": {
      const sub = event.data.object as Stripe.Subscription;
      await prisma.subscription.updateMany({
        where: { stripeSubId: sub.id },
        data: {
          status: sub.status,
          currentPeriodEnd: new Date(sub.current_period_end * 1000),
          cancelAtPeriodEnd: sub.cancel_at_period_end,
        },
      });
      break;
    }
  }

  res.json({ received: true });
});
