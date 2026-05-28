import { Router, type IRouter } from "express";
import Stripe from "stripe";

const router: IRouter = Router();

function getStripe(): Stripe | null {
  const key = process.env["STRIPE_SECRET_KEY"];
  if (!key) return null;
  return new Stripe(key, { apiVersion: "2026-04-22.dahlia" });
}

// POST /api/stripe/checkout
// Creates a Stripe Checkout Session for an invoice payment
router.post("/stripe/checkout", async (req, res) => {
  const stripe = getStripe();
  if (!stripe) {
    res.status(503).json({ error: "Stripe is not configured on this server." });
    return;
  }

  const { invoiceId, invoiceNumber, customerName, amount, currency, portalUrl } = req.body as {
    invoiceId: string;
    invoiceNumber: string;
    customerName: string;
    amount: number;
    currency: string;
    portalUrl: string;
  };

  if (!invoiceId || !amount || !portalUrl) {
    res.status(400).json({ error: "invoiceId, amount and portalUrl are required." });
    return;
  }

  try {
    // Stripe amounts are in the smallest currency unit (fils for AED, cents for USD)
    const unitAmount = Math.round(amount * 100);
    const cur = (currency || "AED").toLowerCase();

    const session = await stripe.checkout.sessions.create({
      payment_method_types: ["card"],
      line_items: [
        {
          price_data: {
            currency: cur,
            product_data: {
              name: `Invoice #${invoiceNumber}`,
              description: `Payment from ${customerName}`,
            },
            unit_amount: unitAmount,
          },
          quantity: 1,
        },
      ],
      mode: "payment",
      customer_email: undefined,
      metadata: { invoiceId, invoiceNumber, customerName },
      success_url: `${portalUrl}?payment=success&session_id={CHECKOUT_SESSION_ID}`,
      cancel_url: `${portalUrl}?payment=cancelled`,
    });

    res.json({ url: session.url, sessionId: session.id });
  } catch (err) {
    req.log.error({ err }, "Stripe checkout session creation failed");
    res.status(500).json({ error: "Failed to create payment session." });
  }
});

// GET /api/stripe/verify?session_id=xxx
// Verifies a completed Stripe Checkout Session and returns payment amount
router.get("/stripe/verify", async (req, res) => {
  const stripe = getStripe();
  if (!stripe) {
    res.status(503).json({ error: "Stripe is not configured." });
    return;
  }

  const sessionId = req.query["session_id"] as string;
  if (!sessionId) {
    res.status(400).json({ error: "session_id is required." });
    return;
  }

  try {
    const session = await stripe.checkout.sessions.retrieve(sessionId);
    const paid = session.payment_status === "paid";
    const amount = paid ? (session.amount_total ?? 0) / 100 : 0;
    const invoiceId = session.metadata?.invoiceId ?? null;

    res.json({ paid, amount, invoiceId, currency: session.currency?.toUpperCase() ?? "AED" });
  } catch (err) {
    req.log.error({ err }, "Stripe session verification failed");
    res.status(500).json({ error: "Failed to verify payment session." });
  }
});

export default router;
