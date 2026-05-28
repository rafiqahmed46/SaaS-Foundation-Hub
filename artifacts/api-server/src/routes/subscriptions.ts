import { Router, type IRouter, type Request, type Response } from "express";
import crypto from "crypto";

const router: IRouter = Router();

const PLANS = {
  starter:  { name: "Starter",  price: 19.99, currency: "USD" },
  pro:      { name: "Pro",      price: 49.99, currency: "USD" },
  business: { name: "Business", price: 99.99, currency: "USD" },
} as const;

// GET /api/subscriptions/plans
router.get("/subscriptions/plans", (_req: Request, res: Response) => {
  res.json({ plans: PLANS });
});

// POST /api/subscriptions/webhook
// Point this URL at your Paddle dashboard → Developer Tools → Notifications
router.post("/subscriptions/webhook", (req: Request, res: Response) => {
  const paddleSignature = req.headers["paddle-signature"] as string | undefined;
  const webhookSecret = process.env["PADDLE_WEBHOOK_SECRET"];

  if (webhookSecret && paddleSignature) {
    const ts  = paddleSignature.split(";").find((s) => s.startsWith("ts="))?.slice(3) ?? "";
    const h1  = paddleSignature.split(";").find((s) => s.startsWith("h1="))?.slice(3) ?? "";
    const raw = JSON.stringify(req.body);
    const expected = crypto.createHmac("sha256", webhookSecret).update(`${ts}:${raw}`).digest("hex");
    if (expected !== h1) {
      res.status(401).json({ error: "Invalid webhook signature" });
      return;
    }
  }

  const event = req.body as { event_type?: string; data?: Record<string, unknown> };
  req.log.info({ eventType: event.event_type }, "Paddle webhook received");
  res.json({ received: true });
});

export default router;
