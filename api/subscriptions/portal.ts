import Stripe from "stripe";

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
    console.error("Billing portal session failed", err);
    res.status(500).json({ error: "Failed to open billing portal" });
  }
}
