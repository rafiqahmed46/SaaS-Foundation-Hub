import { Router, type IRouter, type Request, type Response } from "express";
import Stripe from "stripe";

const router: IRouter = Router();

const PROMO_COUPON_ID = "clearcrm-50off-3months";

function getStripe(): Stripe {
  const key = process.env["STRIPE_SECRET_KEY"];
  if (!key) throw new Error("STRIPE_SECRET_KEY is not configured");
  return new Stripe(key, { apiVersion: "2026-04-22.dahlia" });
}

async function getOrCreatePromoCoupon(stripe: Stripe): Promise<string> {
  try {
    const existing = await stripe.coupons.retrieve(PROMO_COUPON_ID);
    if (existing.valid) return existing.id;
  } catch {
    // not found — create it
  }
  const coupon = await stripe.coupons.create({
    id: PROMO_COUPON_ID,
    name: "50% off for first 3 months",
    percent_off: 50,
    duration: "repeating",
    duration_in_months: 3,
  });
  return coupon.id;
}

const PLANS = {
  starter: {
    name: "Starter",
    price: 4900, // AED 49 in fils
    currency: "aed",
    interval: "month" as const,
    description: "For small businesses getting started",
  },
  pro: {
    name: "Pro",
    price: 9900, // AED 99 in fils
    currency: "aed",
    interval: "month" as const,
    description: "For growing teams that need more power",
  },
  business: {
    name: "Business",
    price: 19900, // AED 199 in fils
    currency: "aed",
    interval: "month" as const,
    description: "For established companies with full needs",
  },
} as const;

type PlanKey = keyof typeof PLANS;

// GET /api/subscriptions/plans
router.get("/subscriptions/plans", (_req: Request, res: Response) => {
  res.json({ plans: PLANS });
});

// POST /api/subscriptions/checkout
// Body: { planId, companyId, companyName, email, successUrl, cancelUrl }
router.post("/subscriptions/checkout", async (req: Request, res: Response) => {
  try {
    const stripe = getStripe();
    const { planId, companyId, companyName, email, successUrl, cancelUrl } = req.body as {
      planId: PlanKey;
      companyId: string;
      companyName: string;
      email: string;
      successUrl: string;
      cancelUrl: string;
    };

    if (!planId || !companyId || !successUrl || !cancelUrl) {
      res.status(400).json({ error: "planId, companyId, successUrl, cancelUrl are required" });
      return;
    }

    const plan = PLANS[planId];
    if (!plan) {
      res.status(400).json({ error: `Unknown plan: ${planId}` });
      return;
    }

    const couponId = await getOrCreatePromoCoupon(stripe);

    const session = await stripe.checkout.sessions.create({
      mode: "subscription",
      payment_method_types: ["card"],
      customer_email: email || undefined,
      line_items: [
        {
          price_data: {
            currency: plan.currency,
            product_data: {
              name: `ClearCRM ${plan.name}`,
              description: plan.description,
            },
            unit_amount: plan.price,
            recurring: { interval: plan.interval },
          },
          quantity: 1,
        },
      ],
      discounts: [{ coupon: couponId }],
      metadata: { companyId, companyName, planId },
      success_url: `${successUrl}?subscription=success&session_id={CHECKOUT_SESSION_ID}`,
      cancel_url: `${cancelUrl}?subscription=cancelled`,
    });

    res.json({ url: session.url, sessionId: session.id });
  } catch (err) {
    req.log.error({ err }, "Subscription checkout failed");
    res.status(500).json({ error: "Failed to create subscription session" });
  }
});

// GET /api/subscriptions/status?sessionId=xxx
router.get("/subscriptions/status", async (req: Request, res: Response) => {
  try {
    const stripe = getStripe();
    const sessionId = req.query["sessionId"] as string;
    if (!sessionId) {
      res.status(400).json({ error: "sessionId is required" });
      return;
    }

    const session = await stripe.checkout.sessions.retrieve(sessionId, {
      expand: ["subscription"],
    });

    const sub = session.subscription as Stripe.Subscription | null;
    const planId = session.metadata?.planId ?? null;
    const companyId = session.metadata?.companyId ?? null;

    res.json({
      active: sub?.status === "active" || sub?.status === "trialing",
      status: sub?.status ?? "none",
      planId,
      companyId,
      currentPeriodEnd: sub ? new Date((sub as Stripe.Subscription & { current_period_end: number }).current_period_end * 1000).toISOString() : null,
      subscriptionId: sub?.id ?? null,
    });
  } catch (err) {
    req.log.error({ err }, "Subscription status check failed");
    res.status(500).json({ error: "Failed to check subscription status" });
  }
});

// POST /api/subscriptions/portal
// Body: { customerId, returnUrl }
router.post("/subscriptions/portal", async (req: Request, res: Response) => {
  try {
    const stripe = getStripe();
    const { customerId, returnUrl } = req.body as { customerId: string; returnUrl: string };

    if (!customerId || !returnUrl) {
      res.status(400).json({ error: "customerId and returnUrl are required" });
      return;
    }

    const portalSession = await stripe.billingPortal.sessions.create({
      customer: customerId,
      return_url: returnUrl,
    });

    res.json({ url: portalSession.url });
  } catch (err) {
    req.log.error({ err }, "Billing portal session failed");
    res.status(500).json({ error: "Failed to open billing portal" });
  }
});

export default router;
