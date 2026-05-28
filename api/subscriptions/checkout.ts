import Stripe from "stripe";

interface PromoConfig {
  enabled: boolean;
  percentOff: number;
  durationMonths: number;
}

async function getPromoConfig(): Promise<PromoConfig | null> {
  const projectId = process.env["VITE_FIREBASE_PROJECT_ID"];
  if (!projectId) return null;
  try {
    const url = `https://firestore.googleapis.com/v1/projects/${projectId}/databases/(default)/documents/adminConfig/promotions`;
    const res = await fetch(url);
    if (!res.ok) return null;
    const data = await res.json() as {
      fields?: Record<string, { booleanValue?: boolean; integerValue?: string; doubleValue?: number }>;
    };
    const f = data.fields ?? {};
    const enabled = f["enabled"]?.booleanValue ?? false;
    if (!enabled) return null;
    return {
      enabled: true,
      percentOff: Number(f["percentOff"]?.integerValue ?? f["percentOff"]?.doubleValue ?? 50),
      durationMonths: Number(f["durationMonths"]?.integerValue ?? f["durationMonths"]?.doubleValue ?? 3),
    };
  } catch {
    return null;
  }
}

async function getOrCreatePromoCoupon(stripe: Stripe, percentOff: number, durationMonths: number): Promise<string> {
  const couponId = `marwo-${percentOff}off-${durationMonths}months`;
  try {
    const existing = await stripe.coupons.retrieve(couponId);
    if (existing.valid) return existing.id;
  } catch { /* not found — create it */ }
  const coupon = await stripe.coupons.create({
    id: couponId,
    name: `${percentOff}% off for first ${durationMonths} months`,
    percent_off: percentOff,
    duration: "repeating",
    duration_in_months: durationMonths,
  });
  return coupon.id;
}

const PLANS = {
  starter: { name: "Starter", price: 4900, currency: "aed", interval: "month" as const, description: "For small businesses getting started" },
  pro:     { name: "Pro",     price: 9900, currency: "aed", interval: "month" as const, description: "For growing teams that need more power" },
  business:{ name: "Business",price: 19900,currency: "aed", interval: "month" as const, description: "For established companies with full needs" },
} as const;

type PlanKey = keyof typeof PLANS;

export default async function handler(req: any, res: any) {
  if (req.method !== "POST") {
    res.status(405).json({ error: "Method not allowed" });
    return;
  }

  const key = process.env["STRIPE_SECRET_KEY"];
  if (!key) {
    res.status(500).json({ error: "Stripe is not configured" });
    return;
  }

  try {
    const stripe = new Stripe(key, { apiVersion: "2026-04-22.dahlia" });
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

    const promoConfig = await getPromoConfig();
    const couponId = promoConfig
      ? await getOrCreatePromoCoupon(stripe, promoConfig.percentOff, promoConfig.durationMonths)
      : null;

    const session = await stripe.checkout.sessions.create({
      mode: "subscription",
      payment_method_types: ["card"],
      customer_email: email || undefined,
      line_items: [{
        price_data: {
          currency: plan.currency,
          product_data: { name: `Marwo ${plan.name}`, description: plan.description },
          unit_amount: plan.price,
          recurring: { interval: plan.interval },
        },
        quantity: 1,
      }],
      ...(couponId ? { discounts: [{ coupon: couponId }] } : { allow_promotion_codes: true }),
      metadata: { companyId, companyName, planId },
      success_url: `${successUrl}?subscription=success&session_id={CHECKOUT_SESSION_ID}`,
      cancel_url: `${cancelUrl}?subscription=cancelled`,
    });

    res.json({ url: session.url, sessionId: session.id });
  } catch (err) {
    console.error("Subscription checkout failed", err);
    res.status(500).json({ error: "Failed to create subscription session" });
  }
}
