import Stripe from "stripe";

export default async function handler(req: any, res: any) {
  if (req.method !== "GET") {
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
      currentPeriodEnd: sub
        ? new Date((sub as Stripe.Subscription & { current_period_end: number }).current_period_end * 1000).toISOString()
        : null,
      subscriptionId: sub?.id ?? null,
    });
  } catch (err) {
    console.error("Subscription status check failed", err);
    res.status(500).json({ error: "Failed to check subscription status" });
  }
}
