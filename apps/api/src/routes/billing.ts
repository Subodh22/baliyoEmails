import { Router } from "express";
import Stripe from "stripe";
import { prisma } from "@baliyoemails/db";
import { requireAuth, AuthRequest } from "../middleware/auth";

export const billingRouter = Router();
billingRouter.use(requireAuth);

const PLANS = [
  {
    name: "free",
    displayName: "Free",
    priceMonthly: 0,
    seats: 1,
    leads: 500,
    domains: 1,
    features: ["1 email account", "500 leads", "Basic sequences", "Community support"],
    priceId: null,
  },
  {
    name: "pro",
    displayName: "Pro",
    priceMonthly: 49,
    seats: 3,
    leads: 10000,
    domains: 5,
    features: [
      "3 team members",
      "10,000 leads",
      "5 sending domains",
      "A/B testing",
      "Analytics",
      "Priority support",
    ],
    priceId: process.env.STRIPE_PRO_PRICE_ID,
  },
  {
    name: "agency",
    displayName: "Agency",
    priceMonthly: 149,
    seats: null,
    leads: null,
    domains: null,
    features: [
      "Unlimited seats",
      "Unlimited leads",
      "Unlimited domains",
      "White-label",
      "API access",
      "Dedicated support",
    ],
    priceId: process.env.STRIPE_AGENCY_PRICE_ID,
  },
];

billingRouter.get("/plans", (_req, res) => {
  res.json({ data: PLANS });
});

billingRouter.get("/subscription", async (req: AuthRequest, res) => {
  const sub = await prisma.subscription.findUnique({
    where: { workspaceId: req.workspaceId },
  });
  res.json({ data: sub ?? { plan: "free", status: "active" } });
});

billingRouter.post("/checkout", async (req: AuthRequest, res) => {
  const { plan } = req.body as { plan: "pro" | "agency" };
  const stripe = new Stripe(process.env.STRIPE_SECRET_KEY!, { apiVersion: "2024-04-10" });

  const planConfig = PLANS.find((p) => p.name === plan);
  if (!planConfig?.priceId) {
    return res.status(400).json({ error: "invalid_plan" });
  }

  const session = await stripe.checkout.sessions.create({
    mode: "subscription",
    payment_method_types: ["card"],
    line_items: [{ price: planConfig.priceId, quantity: 1 }],
    success_url: `${process.env.NEXT_PUBLIC_APP_URL}/settings/billing?success=1`,
    cancel_url: `${process.env.NEXT_PUBLIC_APP_URL}/settings/billing`,
    metadata: { workspaceId: req.workspaceId!, plan },
  });

  res.json({ data: { url: session.url } });
});

billingRouter.post("/portal", async (req: AuthRequest, res) => {
  const stripe = new Stripe(process.env.STRIPE_SECRET_KEY!, { apiVersion: "2024-04-10" });

  const sub = await prisma.subscription.findUnique({
    where: { workspaceId: req.workspaceId },
  });

  if (!sub?.stripeCustomerId) {
    return res.status(400).json({ error: "no_subscription" });
  }

  const session = await stripe.billingPortal.sessions.create({
    customer: sub.stripeCustomerId,
    return_url: `${process.env.NEXT_PUBLIC_APP_URL}/settings/billing`,
  });

  res.json({ data: { url: session.url } });
});
